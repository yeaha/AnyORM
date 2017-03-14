import * as Type from "./type";
import * as _ from "lodash";
import { Mapper, Attributes } from "./mapper";
import { UndefinedPropertyError } from "./error";

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
        throw new Error('MapperConstructor is undefined');
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
    return function (target: Data, propertyKey: string) {
        let constructor: Function = Object.getPrototypeOf(target).constructor;

        if (constructor["attributes"] === undefined) {
            constructor["attributes"] = new Map<string, Type.Attribute>();
        }

        if (attribute === undefined) {
            attribute = { type: type };
        } else {
            attribute["type"] = type;
        }

        attribute = Type.normalizeAttribute(attribute);

        constructor["attributes"].set(propertyKey, attribute);
    };
}

export abstract class Data {
    static mapper: Mapper | typeof Mapper;

    static mapperOptions: MapperOptions = { service: '', collection: '' };

    static attributes: Attributes = new Map<string, Type.Attribute>();

    protected current: { fresh: boolean, data: Values } = { fresh: true, data: {} };

    protected staged: { fresh: boolean, data: Values };

    constructor(values?: Values) {
        this.snapshoot();

        if (values !== undefined) {
            this.current.data = values;
        }

        let mapper = getMapperOf(this);
        mapper.getAttributes().forEach((attribute, key) => {
            Object.defineProperty(this, key, {
                get: () => {
                    return this.get(key);
                },
                set: (val) => {
                    return this.set(key, val);
                }
            });
        });
    }

    isFresh(): boolean {
        return this.current.fresh;
    }

    isDirty(): boolean {
        return !_.isEqual(this.current.data, this.staged.data);
    }

    snapshoot(): this {
        this.staged = _.cloneDeep(this.current);

        return this;
    }

    rollback(): this {
        this.current = _.cloneDeep(this.staged);

        return this;
    }

    has(key: string): boolean {
        return getMapperOf(this).hasAttribute(key);
    }

    get(key: string) {
        if (!this.has(key)) {
            throw new UndefinedPropertyError(`Undefined property ${key}`);
        }

        const mapper = getMapperOf(this);
        const attribute = mapper.getAttribute(key);
        const type = Type.get(attribute.type);

        if (!this.current.hasOwnProperty(key)) {
            return type.getDefaultValue(attribute);
        }

        const value = this.current.data[key];

        return type.clone(value);
    }

    set(key: string, value): this {
        const mapper = getMapperOf(this);
        const attribute = mapper.getAttribute(key);
        const type = Type.get(attribute.type);

        if (!type.isNull(value)) {
            value = type.normalize(value, attribute);
        }

        this.current.data[key] = value;

        return this;
    }

    merge(values: Values): this {
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

    async save() {
        return await getMapperOf(this).save(this);
    }

    async destroy() {
        return await getMapperOf(this).destroy(this);
    }

    static async find(id): Promise<Data | null> {
        return await getMapperOf(this).find(id);
    }
}