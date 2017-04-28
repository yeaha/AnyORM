import { is as isSame, Map, OrderedMap } from "immutable";
import { ColumnInterface } from "./column";
import { FormatterFunc } from "./decorators";
import { RefuseUpdateColumnError, UndefinedColumnError, UnexpectedColumnValueError } from "./error";
import { Columns, getMapperOf, Mapper, MapperConstructor, MapperOptions } from "./mapper";

export type Values = Map<string, any>;

export interface DataConstructor<D extends Data, M extends Mapper<D>> {
    mapper: MapperConstructor<D, M>;
    mapperService: string;
    mapperCollection: string;
    mapperOptions?: object | MapperOptions;
    columns: Columns;

    new (values?: object): D;
}

export abstract class Data {
    static mapper: MapperConstructor<Data, Mapper<Data>>;

    static mapperService: string = "";

    static mapperCollection: string = "";

    static mapperOptions?: object | MapperOptions;

    static columns: Columns = Map() as Columns;

    private current: { fresh: boolean, values: Values };

    private staged: { fresh: boolean, values: Values };

    constructor(values: object = {}) {
        this.current = {
            fresh: true,
            values: Map() as Values,
        };

        this.initializeProperties();
        this.snapshot();

        this.getColumns().forEach((column, key) => {
            const value = values.hasOwnProperty(key)
                ? values[key]
                : column.getDefaultValue();

            if (value !== null) {
                this.set(key, value, column);
            }
        });
    }

    async __beforeSave() { }
    async __afterSave() { }

    async __beforeInsert() { }
    async __afterInsert() { }

    async __beforeUpdate() { }
    async __afterUpdate() { }

    async __beforeDelete() { }
    async __afterDelete() { }

    __retrieve(values: Values): this {
        this.current.fresh = false;
        this.current.values = this.current.values.merge(values);

        this.snapshot();

        return this;
    }

    reset(): this {
        this.current.fresh = this.staged.fresh;
        this.current.values = this.staged.values;

        return this;
    }

    isFresh(): boolean {
        return this.current.fresh;
    }

    isDirty(key?: string): boolean {
        if (key === undefined) {
            return !isSame(this.current.values, this.staged.values);
        }

        return !isSame(
            this.current.values.get(key),
            this.staged.values.get(key),
        );
    }

    hasColumn(key: string): boolean {
        return getMapperOf(this).hasColumn(key);
    }

    getID() {
        const id = this.getIDValues();

        return id.size === 1
            ? id.first()
            : id;
    }

    getIDValues(): Values {
        let id = OrderedMap() as Values;

        getMapperOf(this).getPrimaryKeys().forEach((column, key) => {
            id = id.set(key, this.get(key, column));
        });

        return id;
    }

    get(key: string, column?: ColumnInterface) {
        if (column === undefined) {
            if (!this.hasColumn(key)) {
                throw new UndefinedColumnError(`Undefined property ${key}`);
            }

            column = getMapperOf(this).getColumn(key);
        }

        const value = this.current.values.has(key)
            ? this.current.values.get(key)
            : column.getDefaultValue();

        return column.clone(value);
    }

    set(key: string, value, column?: ColumnInterface): this {
        if (column === undefined) {
            if (!this.hasColumn(key)) {
                throw new UndefinedColumnError(`Undefined property ${key}`);
            }

            column = getMapperOf(this).getColumn(key);
        }

        if (column.isRefuseUpdate() && !this.isFresh()) {
            throw new RefuseUpdateColumnError(`${key} refuse update`);
        }

        this.change(key, value, column);

        return this;
    }

    pick(...keys: string[]): Values {
        const columns = this.getColumns();
        let values = Map() as Values;

        for (const key of keys) {
            if (columns.has(key)) {
                values = values.set(key, this.get(key));
            }
        }

        return values;
    }

    toMap(): Values {
        let values = Map() as Values;

        this.getColumns().forEach((column, key) => {
            values = values.set(key, this.get(key, column));
        });

        return values;
    }

    toJsonObject(): object {
        const obj = {};

        this.getColumns()
            .filter((column) => {
                return !column.isProtected();
            })
            .forEach((column, key) => {
                obj[key] = column.toJson(this.get(key, column));
            });

        return obj;
    }

    toJson(): string {
        return JSON.stringify(this.toJsonObject());
    }

    merge(values: object, strict: boolean = false): this {
        const columns = this.getColumns();

        for (const key of Object.keys(values)) {
            const column = columns.get(key);

            if (column === undefined) {
                continue;
            }

            if (column.isRefuseUpdate() && !this.isFresh()) {
                continue;
            }

            if (column.isProtected() || column.isStrict()) {
                continue;
            }

            this.change(key, values[key], column);
        }

        return this;
    }

    async save(): Promise<this> {
        await getMapperOf(this).save(this);

        return this;
    }

    async destroy(): Promise<this> {
        await getMapperOf(this).destroy(this);

        return this;
    }

    validate(): void {
        const isFresh = this.isFresh();

        this.getColumns().forEach((column, key) => {
            if (!isFresh && this.isDirty(key)) {
                return;
            }

            const value = this.get(key, column);

            if (column.isNull(value)) {
                if (column.isAutoGenerate() && isFresh) {
                    return;
                }

                if (!column.isNullable()) {
                    throw new UnexpectedColumnValueError(`${key} not nullable`);
                }
            } else {
                const re = column.getOption("regexp");
                if (re instanceof RegExp && !re.test(value)) {
                    throw new UnexpectedColumnValueError(`${key} missmatch pattern ${re}`);
                }
            }

            column.validate(value);
        });
    }

    protected getColumns(): Columns {
        return getMapperOf(this).getColumns();
    }

    private initializeProperties() {
        this.getColumns().forEach((column, key) => {
            Object.defineProperty(this, key, {
                get: () => {
                    return this.get(key, column);
                },
                set: (value) => {
                    return this.set(key, value, column);
                },
            });
        });
    }

    private snapshot(): void {
        this.staged = {
            fresh: this.current.fresh,
            values: this.current.values,
        };
    }

    private getFormatter(key: string): FormatterFunc | undefined {
        const formatters = Object.getPrototypeOf(this).constructor["formatters"];

        if (formatters === undefined) {
            return undefined;
        }

        return (formatters as Map<string, FormatterFunc>).get(key);
    }

    private change(key: string, value, column: ColumnInterface): void {
        const formatter = this.getFormatter(key);
        if (formatter !== undefined) {
            value = formatter.apply(this, [value, column]);
        }

        value = column.normalize(value);

        if (!isSame(value, this.current.values.get(key))) {
            value = column.clone(value);

            this.current.values = this.current.values.set(key, value);
        }
    }
}
