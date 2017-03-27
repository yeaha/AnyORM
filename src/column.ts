import * as _ from "lodash";
import { UnexpectPropertyValueError } from "./error";

export interface ColumnOptions {
    primary: boolean;
    default: any;
    nullable: boolean;
    refuseUpdate: boolean;
    protected: boolean;
    strict: boolean;
    regexp: RegExp | null;
    [propName: string]: any;
}

export interface ColumnConstructor {
    new (options?: object | ColumnOptions): ColumnInterface;
}

export interface ColumnInterface {
    normalize(value);
    store(value);
    retrieve(value);
    getDefaultValue();
    toJson(value);
    clone(value);
    isNull(value): boolean;
    getOptions(): ColumnOptions;
}

let constructors = new Map<string, ColumnConstructor>();

export function ColumnRegister(type: string, constructor: ColumnConstructor) {
    constructors.set(type, constructor);
}

export function ColumnFactory(type: string, options?: object | ColumnOptions): ColumnInterface {
    if (!constructors.has(type)) {
        type = "any";
    }

    const constructor = constructors.get(type) as ColumnConstructor;

    return Reflect.construct(constructor, [options]);
}

export class AnyColumn implements ColumnInterface {
    protected options: ColumnOptions;

    public constructor(options?: object | ColumnOptions) {
        this.options = this.normalizeOptions(options);
    }

    public normalize(value) {
        return value;
    }

    public store(value) {
        return this.isNull(value) ? null : value;
    }

    public retrieve(value) {
        return this.isNull(value) ? null : this.normalize(value);
    }

    public getDefaultValue() {
        return this.options.default;
    }

    public toJson(value) {
        return value;
    }

    public clone(value) {
        return _.isObject(value) ? _.cloneDeep(value) : value;
    }

    public isNull(value): boolean {
        return value === "" || value === null || value === undefined;
    }

    public getOptions(): ColumnOptions {
        return this.options;
    }

    protected normalizeOptions(options?: object | ColumnOptions): ColumnOptions {
        let normalized: ColumnOptions;

        const defaults: ColumnOptions = {
            primary: false,
            default: null,
            nullable: false,
            refuseUpdate: false,
            protected: false,
            strict: false,
            regexp: null,
        };

        if (options === undefined) {
            normalized = defaults;
        } else {
            normalized = { ...defaults, ...options } as ColumnOptions;
        }

        if (normalized.primary) {
            normalized.nullable = false;
            normalized.protected = true;
            normalized.refuseUpdate = true;
            normalized.strict = true;
        }

        if (normalized.nullable) {
            normalized.default = null;
        }

        return normalized;
    }
}

export class NumericColumn extends AnyColumn {
    public normalize(value): number {
        value = _.toNumber(value);

        if (value === Infinity) {
            throw new UnexpectPropertyValueError("Infinity number");
        } else if (_.isNaN(value)) {
            throw new UnexpectPropertyValueError("Not a number");
        }

        return value;
    }
}

export class IntegerColumn extends NumericColumn {
    public normalize(value): number {
        value = super.normalize(value);

        return _.toInteger(value);
    }
}

export class TextColumn extends AnyColumn {
    public normalize(value) {
        value = _.toString(value);

        if (this.options["trimSpace"]) {
            value = _.trim(value);
        }

        return value;
    }

    public store(value) {
        return this.isNull(value) ? null : _.toString(value);
    }

    public retrieve(value) {
        return this.isNull(value) ? "" : value;
    }

    protected normalizeOptions(options): ColumnOptions {
        options = super.normalizeOptions(options);

        return { ...({ trimSpace: false }), ...options };
    }
}

ColumnRegister("any", AnyColumn);
ColumnRegister("numeric", NumericColumn);
ColumnRegister("integer", IntegerColumn);
ColumnRegister("text", TextColumn);
