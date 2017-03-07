import * as _ from 'lodash';
import { UnexpectPropertyValueError } from "./error";

export interface AttributeOption {
    type: string;
    primaryKey?: boolean;
    default?: any;
    allowNull?: boolean;
    refuseUpdate?: boolean;
    protected?: boolean;
    strict?: boolean;
    regexp?: RegExp | null;
    [propName: string]: any;
}

export interface Attribute extends AttributeOption {
    primaryKey: boolean;
    default: any;
    allowNull: boolean;
    refuseUpdate: boolean;
    protected: boolean;
    strict: boolean;
    regexp: RegExp | null;
}

export interface TypeInterface {
    normalizeAttribute(attribute: Attribute): Attribute;
    normalize(value, attribute: Attribute);
    store(value, attribute: Attribute): string | null;
    retrieve(value, attribute: Attribute);
    getDefaultValue(attribute: Attribute);
    toJson(value, attribute: Attribute);
    clone(value);
    isNull(value): boolean;
}

export function normalizeAttribute(attribute: AttributeOption): Attribute {
    const defaults: Attribute = {
        type: 'any',
        primaryKey: false,
        default: null,
        allowNull: false,
        refuseUpdate: false,
        protected: false,
        strict: false,
        regexp: null,
    };

    let normalized: Attribute = { ...defaults, ...attribute };
    normalized = get(normalized.type).normalizeAttribute(normalized);

    if (normalized.primaryKey) {
        normalized.allowNull = false;
        normalized.protected = true;
        normalized.refuseUpdate = true;
        normalized.strict = true;
    }

    if (normalized.allowNull) {
        normalized.default = null;
    }

    return normalized;
}

let types = new Map<string, TypeInterface>();

export function register(name: string, type: TypeInterface) {
    types.set(name, type);
}

export function get(name: string): TypeInterface {
    if (!types.has(name)) {
        name = 'any';
    }

    return types.get(name) as TypeInterface;
}

export class Any implements TypeInterface {
    normalizeAttribute(attribute: Attribute): Attribute {
        return attribute;
    }

    normalize(value, attribute: Attribute) {
        return value;
    }

    store(value, attribute: Attribute) {
        return this.isNull(value) ? null : value;
    }

    retrieve(value, attribute: Attribute) {
        return this.isNull(value) ? null : this.normalize(value, attribute);
    }

    getDefaultValue(attribute: Attribute) {
        return attribute.default;
    }

    toJson(value, attribute: Attribute) {
        return value;
    }

    clone(value) {
        return _.isObject(value) ? _.cloneDeep(value) : value;
    }

    isNull(value): boolean {
        return value === '' || value === null || value === undefined;
    }
}

export class Numeric extends Any {
    normalize(value, attribute: Attribute): number {
        value = _.toNumber(value);

        if (value === Infinity) {
            throw new UnexpectPropertyValueError("Infinity number");
        } else if (_.isNaN(value)) {
            throw new UnexpectPropertyValueError("Not a number");
        }

        return value;
    }
}

export class Integer extends Numeric {
    normalize(value, attribute: Attribute): number {
        value = super.normalize(value, attribute);

        return _.toInteger(value);
    }
}

export class Text extends Any {
    normalizeAttribute(attribute: Attribute): Attribute {
        return _.defaults({
            trimSpace: false,
        }, attribute);
    }

    normalize(value, attribute: Attribute): string {
        value = _.toString(value);

        if (attribute.trimSpace) {
            value = _.trim(value)
        }

        return value;
    }

    store(value, attribute: Attribute): string | null {
        return this.isNull(value) ? null : _.toString(value);
    }

    retrieve(value, attribute: Attribute): string {
        return this.isNull(value) ? '' : value;
    }
}

register('any', new Any());
register('numeric', new Numeric());
register('integer', new Integer());
register('text', new Text());