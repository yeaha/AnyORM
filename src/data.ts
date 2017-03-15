import * as _ from "lodash";
import { UndefinedPropertyError } from "./error";
import { Attributes, Mapper } from "./mapper";
import * as Type from "./type";

interface Values {
    [key: string]: any;
}

interface MapperOptions {
    service: string;
    collection: string;
    readonly?: boolean;
    [key: string]: any;
}

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

    let mapperOptions = constructor.mapperOptions;
    let service = mapperOptions.service;
    let collection = mapperOptions.collection;
    delete mapperOptions.service;
    delete mapperOptions.collection;

    return constructor.mapper = Reflect.construct(mapper, [service, collection, constructor.attributes, mapperOptions]);
}

// Data property decorator
export function Column(type: string, attribute?: Type.AttributeOptions) {
    return (target: Data, propertyKey: string) => {
        let constructor: Function = Object.getPrototypeOf(target).constructor;

        if (attribute === undefined) {
            attribute = { type: type };
        } else {
            attribute.type = type;
        }

        attribute = Type.normalizeAttribute(attribute);

        constructor["attributes"].set(propertyKey, attribute);
    };
}

export abstract class Data {
    public static mapper: Mapper | typeof Mapper;

    public static mapperOptions: MapperOptions = { service: "", collection: "" };

    public static attributes: Attributes = new Map<string, Type.Attribute>();

    public static async find(id): Promise<Data | null> {
        return await getMapperOf(this).find(id);
    }

    protected current: { fresh: boolean, values: Values } = { fresh: true, values: {} };

    protected staged: { fresh: boolean, values: Values };

    constructor(values: Values = {}) {
        this.initializeProperties();
        this.snapshoot();

        this.current.values = values;
    }

    public isFresh(): boolean {
        return this.current.fresh;
    }

    public isDirty(): boolean {
        return !_.isEqual(this.current.values, this.staged.values);
    }

    public rollback(): this {
        this.current = _.cloneDeep(this.staged);

        return this;
    }

    public has(key: string): boolean {
        return getMapperOf(this).hasAttribute(key);
    }

    public get(key: string) {
        if (!this.has(key)) {
            throw new UndefinedPropertyError(`Undefined property ${key}`);
        }

        const mapper = getMapperOf(this);
        const attribute = mapper.getAttribute(key);
        const type = Type.get(attribute.type);

        if (!this.current.hasOwnProperty(key)) {
            return type.getDefaultValue(attribute);
        }

        const value = this.current.values[key];

        return type.clone(value);
    }

    public set(key: string, value): this {
        const mapper = getMapperOf(this);
        const attribute = mapper.getAttribute(key);
        const type = Type.get(attribute.type);

        if (!type.isNull(value)) {
            value = type.normalize(value, attribute);
        }

        this.current.values[key] = value;

        return this;
    }

    public merge(values: Values): this {
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
        mapper.getAttributes().forEach((attribute, key) => {
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
