// import * as _ from "lodash";
import { ColumnFactory, ColumnInterface, ColumnOptions } from "./column";
import { RefuseUpdateColumnError, UndefinedColumnError, UnexpectColumnValueError } from "./error";
import { Columns, Mapper, MapperOptions } from "./mapper";

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
    let service = constructor.mapperService;
    let collection = constructor.mapperCollection;

    return constructor.mapper = Reflect.construct(mapper, [service, collection, constructor.columns, options]);
}

// Data property decorator
export function Column(type: string, options?: object | ColumnOptions) {
    return (target: Data, propertyKey: string) => {
        const column = ColumnFactory(type, options);

        let constructor: Function = Object.getPrototypeOf(target).constructor;
        constructor["columns"].set(propertyKey, column);
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

export abstract class Data {
    public static mapper: Mapper | typeof Mapper;

    public static mapperService: string = "";

    public static mapperCollection: string = "";

    public static mapperOptions?: object | MapperOptions;

    public static columns: Columns = new Map();

    public static async find(id): Promise<Data | null> {
        return await getMapperOf(this).find(id);
    }

    protected fresh: boolean = true;

    protected values: Map<string, any> = new Map();

    private changedColumns: Set<string> = new Set();

    constructor(values?: object) {
        this.initializeProperties();

        if (values !== undefined) {
            getMapperOf(this).getColumns().forEach((column, key) => {
                if (values.hasOwnProperty(key)) {
                    this.set(key, values[key], column);
                }
            });
        }
    }

    public isFresh(): boolean {
        return this.fresh;
    }

    public isDirty(key?: string): boolean {
        if (key === undefined) {
            return this.changedColumns.size > 0;
        }

        return this.changedColumns.has(key);
    }

    public hasColumn(key: string): boolean {
        return getMapperOf(this).hasColumn(key);
    }

    public get(key: string, column?: ColumnInterface) {
        if (column === undefined) {
            if (!this.hasColumn(key)) {
                throw new UndefinedColumnError(`Undefined property ${key}`);
            }

            column = getMapperOf(this).getColumn(key);
        }

        const value = this.values.has(key)
            ? this.values.get(key)
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

        if (options.refuseUpdate && !this.fresh) {
            throw new RefuseUpdateColumnError(`${key} refuse update`);
        }

        this.change(key, value, column);

        return this;
    }

    public merge(values: object, strict: boolean = false): this {
        const columns = getMapperOf(this).getColumns();

        for (const key of Object.keys(values)) {
            if (!columns.has(key)) {
                continue;
            }

            const column = columns.get(key) as ColumnInterface;
            const options = column.getOptions();

            if (options.refuseUpdate && !this.fresh) {
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

    private initializeProperties() {
        let mapper = getMapperOf(this);

        mapper.getColumns().forEach((column, key) => {
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

    private change(key: string, value, column: ColumnInterface): void {
        value = column.normalize(value);

        if (value !== this.values.get(key)) {
            value = column.clone(value);

            this.values.set(key, value);
            this.changedColumns.add(key);
        }
    }

    private validate(): void {
        const columns = getMapperOf(this).getColumns();

        let keys = this.isFresh()
            ? this.values.keys()
            : this.changedColumns.keys();

        for (const key of keys) {
            const column = columns.get(key) as ColumnInterface;
            const options = column.getOptions();
            const value = this.get(key, column);

            if (options.autoGenerate && this.isFresh()) {
                continue;
            }

            if (column.isNull(value)) {
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
        }
    }
}
