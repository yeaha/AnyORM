import {
    cloneDeep,
    isNaN,
    isObject,
    toInteger,
    toLower,
    toNumber,
    toString,
    toUpper,
    trim,
} from "lodash";
import * as moment from "moment";
import * as uuid from "uuid";
import { UnexpectedColumnValueError } from "./error";

export interface ColumnOptions {
    primary?: boolean;
    autoGenerate?: boolean;
    default?: any;
    nullable?: boolean;
    refuseUpdate?: boolean;
    protected?: boolean;
    strict?: boolean;
    regexp?: RegExp | null;
    [propName: string]: any;
}

export interface FixedColumnOptions extends ColumnOptions {
    primary: boolean;
    autoGenerate: boolean;
    default: any;
    nullable: boolean;
    refuseUpdate: boolean;
    protected: boolean;
    strict: boolean;
    regexp: RegExp | null;
}

export interface ColumnConstructor {
    new (options?: ColumnOptions): ColumnInterface;
}

export interface ColumnInterface {
    normalize(value);
    store(value);
    retrieve(value);
    getDefaultValue();
    toJson(value);
    clone(value);
    isNull(value): boolean;
    getOption(key: string): any;
    getOptions(): FixedColumnOptions;
    validate(value): void;
    isPrimary(): boolean;
    isNullable(): boolean;
    isProtected(): boolean;
    isStrict(): boolean;
    isRefuseUpdate(): boolean;
    isAutoGenerate(): boolean;
}

const constructors = new Map<string, ColumnConstructor>();

export function columnRegister(type: string, constructor: ColumnConstructor) {
    constructors.set(type, constructor);
}

export function columnFactory(type: string, options?: object | ColumnOptions): ColumnInterface {
    if (!constructors.has(type)) {
        type = "any";
    }

    const constructor = constructors.get(type) as ColumnConstructor;

    return Reflect.construct(constructor, [options]);
}

export class AnyColumn implements ColumnInterface {
    protected options: FixedColumnOptions;

    constructor(options?: ColumnOptions) {
        this.options = this.normalizeOptions(options);
    }

    normalize(value) {
        return value;
    }

    store(value) {
        return this.isNull(value) ? null : value;
    }

    retrieve(value) {
        return this.isNull(value) ? null : this.normalize(value);
    }

    getDefaultValue() {
        const value = this.options.default;

        if (typeof value === "function") {
            return Reflect.apply(value, this, []);
        }

        return value;
    }

    isPrimary(): boolean {
        return this.options.primary;
    }

    isAutoGenerate(): boolean {
        return this.options.autoGenerate;
    }

    isProtected(): boolean {
        return this.options.protected;
    }

    isStrict(): boolean {
        return this.options.strict;
    }

    isRefuseUpdate(): boolean {
        return this.options.refuseUpdate;
    }

    isNullable(): boolean {
        return this.options.nullable;
    }

    toJson(value) {
        return value;
    }

    clone(value) {
        return isObject(value) ? cloneDeep(value) : value;
    }

    isNull(value): boolean {
        return value === "" || value === null || value === undefined;
    }

    getOption(key: string) {
        return this.options[key];
    }

    getOptions(): FixedColumnOptions {
        return this.options;
    }

    validate(value): void { }

    protected normalizeOptions(options?: ColumnOptions): FixedColumnOptions {
        let normalized: FixedColumnOptions;

        const defaults: FixedColumnOptions = {
            primary: false,
            autoGenerate: false,
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
            normalized = { ...defaults, ...options };
        }

        if (normalized.primary) {
            normalized.autoGenerate = true;
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
    normalize(value): number {
        value = toNumber(value);

        if (value === Infinity) {
            throw new UnexpectedColumnValueError("Infinity number");
        } else if (isNaN(value)) {
            throw new UnexpectedColumnValueError("Not a number");
        }

        return value;
    }
}

export class IntegerColumn extends NumericColumn {
    normalize(value): number {
        value = super.normalize(value);

        return toInteger(value);
    }
}

export class StringColumn extends AnyColumn {
    normalize(value) {
        value = toString(value);

        if (this.options["trimSpace"]) {
            value = trim(value);
        }

        return value;
    }

    store(value) {
        return this.isNull(value) ? null : toString(value);
    }

    retrieve(value) {
        return this.isNull(value) ? "" : value;
    }

    protected normalizeOptions(options): FixedColumnOptions {
        const defaults = { trimSpace: true };

        options = super.normalizeOptions(options);

        return { ...defaults, ...options };
    }
}

export class UUIDColumn extends StringColumn {
    normalize(value) {
        value = this.options["upperCase"]
            ? toUpper(value)
            : toLower(value);

        return super.normalize(value);
    }

    getDefaultValue() {
        if (this.options.autoGenerate) {
            return this.normalize(this.generate());
        }

        return this.options.default;
    }

    generate(): string {
        return this.normalize(uuid.v4());
    }

    protected normalizeOptions(options): FixedColumnOptions {
        const defaults = { upperCase: false };

        options = super.normalizeOptions(options);

        return { ...defaults, ...options };
    }
}

export class DateColumn extends StringColumn {
    normalize(value) {
        if (value instanceof Date) {
            const year = value.getFullYear();
            const month = value.getMonth() + 1;
            const day = value.getDate();

            value = year + "-" + month + "-" + day;
        } else {
            const regexp = this.options.regexp as RegExp;

            if (typeof value !== "string" || !regexp.test(value)) {
                throw new UnexpectedColumnValueError("Unexpected Date value");
            }
        }

        return super.normalize(value);
    }

    protected normalizeOptions(options): FixedColumnOptions {
        options = super.normalizeOptions(options);

        // yyyy-mm-dd
        options.regexp = /^\d{4}\-\d{1,2}\-\d{1,2}$/;

        return options;
    }
}

export class TimeColumn extends StringColumn {
    normalize(value) {
        if (value instanceof Date) {
            const hour = value.getHours();
            const minute = value.getMinutes();
            const second = value.getSeconds();

            value = hour + ":" + minute + ":" + second;
        } else {
            const regexp = this.options.regexp as RegExp;

            if (typeof value !== "string" || !regexp.test(value)) {
                throw new UnexpectedColumnValueError("Unexpected Time value");
            }
        }

        return super.normalize(value);
    }

    protected normalizeOptions(options): FixedColumnOptions {
        options = super.normalizeOptions(options);

        // hh:mm:ss
        options.regexp = /^\d{1,2}:\d{1,2}:\d{1,2}$/;

        return options;
    }
}

export class DateTimeColumn extends AnyColumn {
    normalize(value): moment.Moment {
        if (moment.isMoment(value)) {
            return value;
        } else if (moment.isDate(value)) {
            return moment(value);
        }

        const time = moment(value);

        if (!time.isValid()) {
            throw new UnexpectedColumnValueError(`Invalid datetime value`);
        }

        return time;
    }

    retrieve(value) {
        return this.isNull(value) ? null : moment(value, this.getFormat());
    }

    store(value): string | null {
        if (this.isNull(value)) {
            return null;
        }

        if (!moment.isMoment(value) || !value.isValid()) {
            throw new UnexpectedColumnValueError(`Invalid datetime value`);
        }

        return value.format(this.getFormat());
    }

    toJson(value): string | null {
        return this.store(value);
    }

    clone(value) {
        return this.isNull(value) ? value : moment(value);
    }

    private getFormat(): string {
        return this.getOption("format") || "YYYY-MM-DDTHH:mm:ssZ";
    }
}

columnRegister("any", AnyColumn);
columnRegister("date", DateColumn);
columnRegister("datetime", DateTimeColumn);
columnRegister("integer", IntegerColumn);
columnRegister("numeric", NumericColumn);
columnRegister("string", StringColumn);
columnRegister("time", TimeColumn);
columnRegister("uuid", UUIDColumn);
