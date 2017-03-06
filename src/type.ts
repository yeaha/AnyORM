import * as _ from 'lodash';

export interface Attribute {
    type?: string;
    primary_key?: boolean;
    default?: any;
    allow_null?: boolean;
    protected?: boolean;
    strict?: boolean;
    [propName: string]: any;
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

export function normalizeAttribute(attribute: Attribute): Attribute {
    const defaults = {
        type: 'any',
        primary_key: false,
        default: null,
        allow_null: false,
        protected: false,
    };

    attribute = { ...defaults, ...attribute };

    return attribute;
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

    store(value, attribute: Attribute): string | null {
        return this.isNull(value) ? null : _.toString(value);
    }

    retrieve(value, attribute: Attribute) {
        return this.normalize(value, attribute);
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
        return _.isEmpty(value);
    }
}

export class Numeric extends Any {
    normalize(value, attribute: Attribute): number {
        value = _.toNumber(value);

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
    normalize(value, attribute: Attribute): string {
        return _.toString(value);
    }
}

register('any', new Any());
register('number', new Numeric());
register('integer', new Integer());
register('text', new Text());