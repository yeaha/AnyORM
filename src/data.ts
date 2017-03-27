import * as Immutable from "immutable";
import * as _ from "lodash";
import { ColumnFactory, ColumnOptions } from "./column";
import { UndefinedPropertyError } from "./error";
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

    protected current: { fresh: boolean, values: Immutable.Map<string, any> };

    private staged: { fresh: boolean, values: Immutable.Map<string, any> };

    constructor(values: object = {}) {
        this.initializeProperties();

        this.current = {
            fresh: true,
            values: Immutable.Map({}),
        };

        this.snapshoot();

        this.current.values = Immutable.fromJS(values);
    }

    public isFresh(): boolean {
        return this.current.fresh;
    }

    public isDirty(): boolean {
        return Immutable.is(this.current.values, this.staged.values);
    }

    public rollback(): this {
        this.current = _.cloneDeep(this.staged);

        return this;
    }

    public hasColumn(key: string): boolean {
        return getMapperOf(this).hasColumn(key);
    }

    public get(key: string) {
        if (!this.hasColumn(key)) {
            throw new UndefinedPropertyError(`Undefined property ${key}`);
        }

        const mapper = getMapperOf(this);
        const column = mapper.getColumn(key);

        if (!this.current.hasOwnProperty(key)) {
            return column.getDefaultValue();
        }

        const value = this.current.values.get(key);

        return column.clone(value);
    }

    public set(key: string, value): this {
        const mapper = getMapperOf(this);
        const column = mapper.getColumn(key);

        if (!column.isNull(value)) {
            value = column.normalize(value);
        }

        this.current.values = this.current.values.set(key, column.clone(value));

        return this;
    }

    public merge(values: object): this {
        _.each(values, (value, key: string) => {
            try {
                this.set(key, value);
            } catch (e) {
                if (e instanceof UndefinedPropertyError) {
                    return true;
                }

                throw e;
            }
        });

        return this;
    }

    public async save() {
        return await getMapperOf(this).save(this);
    }

    public async destroy() {
        return await getMapperOf(this).destroy(this);
    }

    private snapshoot(): this {
        this.staged = _.cloneDeep(this.current);

        return this;
    }

    private initializeProperties() {
        let mapper = getMapperOf(this);

        mapper.getColumns().forEach((column, key) => {
            Object.defineProperty(this, key, {
                get: () => {
                    return this.get(key);
                },
                set: (val) => {
                    return this.set(key, val);
                },
            });
        });
    }
}
