import { Map } from "immutable";
import { columnFactory, ColumnInterface, ColumnOptions } from "./column";
import { Data } from "./data";

export type FormatterFunc = (value, column: ColumnInterface) => any;

////////////////////////////////////////////////////////////////////////////////
// Data property decorator
////////////////////////////////////////////////////////////////////////////////

export function Column(type: string, options?: ColumnOptions) {
    return (target: Data, propertyKey: string) => {
        const column = columnFactory(type, options);
        const constructor = target["constructor"];

        constructor["columns"] = constructor["columns"].set(propertyKey, column);
    };
}

export function PrimaryColumn(type: string, options?: ColumnOptions) {
    if (options === undefined) {
        options = { primary: true };
    } else {
        options["primary"] = true;
    }

    return Column(type, options);
}

export function ProtectedColumn(type: string, options?: ColumnOptions) {
    if (options === undefined) {
        options = { protected: true };
    } else {
        options["protected"] = true;
    }

    return Column(type, options);
}

export function StrictColumn(type: string, options?: ColumnOptions) {
    if (options === undefined) {
        options = { strict: true };
    } else {
        options["strict"] = true;
    }

    return Column(type, options);
}

export function Formatter(func: FormatterFunc) {
    return (prototype: Data, propertyKey: string) => {
        const constructor = prototype["constructor"];
        let formatters = constructor["formatters"];

        if (formatters === undefined) {
            formatters = Map<string, FormatterFunc>();
        }

        constructor["formatters"] = formatters.set(propertyKey, func);
    };
}
