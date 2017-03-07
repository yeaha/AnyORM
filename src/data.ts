import * as _ from "lodash";
import { AttributeOption } from "./type";
import { Mapper } from "./mapper";
import { UndefinedPropertyError } from "./error";

interface DataValues {
    [propName: string]: any;
}

export abstract class Data {
    protected abstract getMapper(): Mapper;

    static service: string;
    static collection: string;
    static attributes: AttributeOption;

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

    rollback(): Data {
        this.values = _.cloneDeep(this.stage.values)
        this.fresh = this.stage.fresh;

        return this;
    }

    snapshoot(): Data {
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

    set(key: string, value): Data {
        const mapper = this.getMapper();
        const attribute = mapper.getAttribute(key);
        const type = mapper.getTypeOf(attribute.type);

        if (!type.isNull(value)) {
            value = type.normalize(value, attribute);
        }

        this.values[key] = value;

        return this;
    }

    merge(values: DataValues): Data {
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
        return await this.getMapper().save(this);
    }

    async destroy() {
        return await this.getMapper().destroy(this);
    }
}