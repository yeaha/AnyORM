import * as _ from "lodash";
import { Mapper, MapperConstructor, AttributesOption } from "./mapper";
import { UndefinedPropertyError } from "./error";

interface DataValues {
    [key: string]: any;
}

interface DataMapperOption {
    service: string;
    collection: string;
    readonly?: boolean;
    [key: string]: any;
}

function getMapperOf(target: Data | typeof Data): Mapper {
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

    let mapperOption = constructor.mapperOption;
    mapperOption.attributes = constructor.attributes;

    return constructor.mapper = Reflect.construct(mapper, [mapperOption]);
}

export abstract class Data {
    static mapper: Mapper | MapperConstructor;

    static mapperOption: DataMapperOption;

    static attributes: AttributesOption;

    protected fresh: boolean = true;

    protected values: DataValues = {};

    protected stage: { fresh: boolean, values: DataValues };

    constructor(values: DataValues) {
        this.snapshoot();

        this.values = values;
    }

    isFresh(): boolean {
        return this.fresh;
    }

    isDirty(): boolean {
        return !_.isEqual(this.values, this.stage.values);
    }

    rollback(): this {
        this.values = _.cloneDeep(this.stage.values)
        this.fresh = this.stage.fresh;

        return this;
    }

    snapshoot(): this {
        this.stage.fresh = this.fresh;
        this.stage.values = _.cloneDeep(this.values);

        return this;
    }

    has(key: string): boolean {
        const mapper = this.getMapper();

        return mapper.hasAttribute(key);
    }

    get(key: string) {
        if (!this.has(key)) {
            throw new UndefinedPropertyError(`Undefined property ${key}`);
        }

        const mapper = this.getMapper();
        const attribute = mapper.getAttribute(key);
        const type = mapper.getTypeOf(attribute.type);

        if (!this.values.hasOwnProperty(key)) {
            return type.getDefaultValue(attribute);
        }

        const value = this.values[key];

        return type.clone(value);
    }

    set(key: string, value): this {
        const mapper = this.getMapper();
        const attribute = mapper.getAttribute(key);
        const type = mapper.getTypeOf(attribute.type);

        if (!type.isNull(value)) {
            value = type.normalize(value, attribute);
        }

        this.values[key] = value;

        return this;
    }

    merge(values: DataValues): this {
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

    getMapper(): Mapper {
        return getMapperOf(this);
    }

    async save() {
        return await this.getMapper().save(this);
    }

    async destroy() {
        return await this.getMapper().destroy(this);
    }

    static async find(id): Promise<Data | null> {
        return await getMapperOf(this).find(id);
    }
}