import * as EventEmitter from "events";
import { is as isSame, Map } from "immutable";
import { ColumnFactory, ColumnInterface, ColumnOptions } from "./column";
import { RefuseUpdateColumnError, UndefinedColumnError, UnexpectColumnValueError } from "./error";
import { Columns, Mapper, MapperOptions } from "./mapper";

export type Values = Map<string, any>;

export function getMapperOf(target: Data | typeof Data): Mapper {
    let constructor: typeof Data;

    if (target instanceof Data) {
        constructor = Object.getPrototypeOf(target).constructor;
    } else {
        constructor = target;
    }

    let mapper = constructor.mapper;

    if (mapper === undefined) {
        throw new Error(`MapperConstructor is undefined`);
    }

    if (mapper instanceof Mapper) {
        return mapper;
    }

    let options = constructor.mapperOptions;
    if (options === undefined) {
        options = {};
    }

    options["service"] = constructor.mapperService;
    options["collection"] = constructor.mapperCollection;

    return constructor.mapper = Reflect.construct(mapper, [constructor, constructor.columns, options]);
}

// Data property decorator
export function Column(type: string, options?: object | ColumnOptions) {
    return (target: Data, propertyKey: string) => {
        const column = ColumnFactory(type, options);
        const constructor = target["constructor"];

        constructor["columns"] = constructor["columns"].set(propertyKey, column);
    };
}

export function PrimaryColumn(type: string, options?: object | ColumnOptions) {
    if (options === undefined) {
        options = { primary: true };
    } else {
        options["primary"] = true;
    }

    return Column(type, options);
}

export abstract class Data extends EventEmitter {
    public static mapper: Mapper | typeof Mapper;

    public static mapperService: string = "";

    public static mapperCollection: string = "";

    public static mapperOptions?: object | MapperOptions;

    public static columns: Columns = Map() as Columns;

    public static async find(id): Promise<Data | null> {
        return await getMapperOf(this).find(id);
    }

    private current: { fresh: boolean, values: Values };

    private staged: { fresh: boolean, values: Values };

    constructor(values: object = {}) {
        super();

        this.current = {
            fresh: true,
            values: Map() as Values,
        };

        this.initializeProperties();
        this.initializeEvents();
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

    public __retrieve(values: Values): this {
        this.current.fresh = false;
        this.current.values = this.current.values.merge(values);

        this.snapshot();

        return this;
    }

    public rollback(): this {
        this.current.fresh = this.staged.fresh;
        this.current.values = this.staged.values;

        return this;
    }

    public isFresh(): boolean {
        return this.current.fresh;
    }

    public isDirty(key?: string): boolean {
        if (key === undefined) {
            return !isSame(this.current.values, this.staged.values);
        }

        return !isSame(
            this.current.values.get(key),
            this.staged.values.get(key),
        );
    }

    public hasColumn(key: string): boolean {
        return getMapperOf(this).hasColumn(key);
    }

    public getID() {
        const id = this.getIDValues();

        return id.size === 1
            ? id.first()
            : id;
    }

    public getIDValues(): Values {
        let id = Map() as Values;

        getMapperOf(this).getPrimaryKeys().forEach((column, key) => {
            id = id.set(key, this.get(key, column));
        });

        return id;
    }

    public get(key: string, column?: ColumnInterface) {
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

    public set(key: string, value, column?: ColumnInterface): this {
        if (column === undefined) {
            if (!this.hasColumn(key)) {
                throw new UndefinedColumnError(`Undefined property ${key}`);
            }

            column = getMapperOf(this).getColumn(key);
        }

        const options = column.getOptions();

        if (options.refuseUpdate && !this.isFresh()) {
            throw new RefuseUpdateColumnError(`${key} refuse update`);
        }

        this.change(key, value, column);

        return this;
    }

    public pick(...keys: string[]): Values {
        const columns = this.getColumns();
        let values = Map() as Values;

        for (const key of keys) {
            if (columns.has(key)) {
                values = values.set(key, this.get(key));
            }
        }

        return values;
    }

    public getValues(): Values {
        let values = Map() as Values;

        this.getColumns().forEach((column, key) => {
            values = values.set(key, this.get(key, column));
        });

        return values;
    }

    public merge(values: object, strict: boolean = false): this {
        const columns = this.getColumns();

        for (const key of Object.keys(values)) {
            const column = columns.get(key);

            if (column === undefined) {
                continue;
            }

            const options = column.getOptions();

            if (options.refuseUpdate && !this.isFresh()) {
                continue;
            }

            if (options.protected || options.strict) {
                continue;
            }

            this.change(key, values[key], column);
        }

        return this;
    }

    public async save(): Promise<this> {
        this.validate();

        await getMapperOf(this).save(this);

        return this;
    }

    public async destroy(): Promise<this> {
        await getMapperOf(this).destroy(this);

        return this;
    }

    public validate(): void {
        const isFresh = this.isFresh();

        this.getColumns().forEach((column, key) => {
            if (!isFresh && this.isDirty(key)) {
                return;
            }

            const options = column.getOptions();
            const value = this.get(key, column);

            if (column.isNull(value)) {
                if (options.autoGenerate && isFresh) {
                    return;
                }

                if (!options.nullable) {
                    throw new UnexpectColumnValueError(`${key} not nullable`);
                }
            } else {
                const re = options.regexp;
                if (re instanceof RegExp && !re.test(value)) {
                    throw new UnexpectColumnValueError(`${key} missmatch pattern ${re}`);
                }
            }

            column.validate(value);
        });
    }

    protected getColumns(): Columns {
        return getMapperOf(this).getColumns();
    }

    protected beforeSave(): void { }
    protected afterSave(): void { }

    protected beforeInsert(): void { }
    protected afterInsert(): void { }

    protected beforeUpdate(): void { }
    protected afterUpdate(): void { }

    protected beforeDelete(): void { }
    protected afterDelete(): void { }

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

    private initializeEvents() {
        this.on(`before:save`, this.beforeSave.bind(this));
        this.on(`after:save`, this.afterSave.bind(this));

        this.on(`before:insert`, this.beforeInsert.bind(this));
        this.on(`after:insert`, this.afterInsert.bind(this));

        this.on(`before:update`, this.beforeUpdate.bind(this));
        this.on(`after:update`, this.afterUpdate.bind(this));

        this.on(`before:delete`, this.beforeDelete.bind(this));
        this.on(`after:delete`, this.afterDelete.bind(this));
    }

    private snapshot(): void {
        this.staged = {
            fresh: this.current.fresh,
            values: this.current.values,
        };
    }

    private change(key: string, value, column: ColumnInterface): void {
        value = column.normalize(value);

        if (!isSame(value, this.current.values.get(key))) {
            value = column.clone(value);

            this.current.values = this.current.values.set(key, value);
        }
    }
}
