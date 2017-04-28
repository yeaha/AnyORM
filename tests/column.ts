import test from "ava";
import * as moment from "moment";
import {
    AnyColumn,
    columnFactory,
    ColumnInterface,
    DateColumn,
    DateTimeColumn,
    IntegerColumn,
    NumericColumn,
    StringColumn,
    TimeColumn,
    UnexpectedColumnValueError,
    UUIDColumn,
} from "../src/index";
import "./index";

test("normalize options", (t) => {
    const column: ColumnInterface = columnFactory("any");
    const options = column.getOptions();

    t.is(options.nullable, false);
    t.is(options.primary, false);
    t.is(options.default, null);
    t.is(options.protected, false);
    t.is(options.strict, false);
    t.is(options.refuseUpdate, false);
});

test("normalize primary options", (t) => {
    const column = columnFactory("any", { primary: true });
    const options = column.getOptions();

    t.is(options.primary, true);
    t.is(options.strict, true);
    t.is(options.refuseUpdate, true);
});

test("ColumnFactory", (t) => {
    t.true(columnFactory("foobar") instanceof AnyColumn);
    t.true(columnFactory("numeric") instanceof NumericColumn);
    t.true(columnFactory("integer") instanceof IntegerColumn);
    t.true(columnFactory("string") instanceof StringColumn);
    t.true(columnFactory("date") instanceof DateColumn);
    t.true(columnFactory("time") instanceof TimeColumn);
    t.true(columnFactory("datetime") instanceof DateTimeColumn);
});

(() => {
    const column = columnFactory("string");

    test("StringColumn options", (t) => {
        const options = column.getOptions();

        t.true(options["trimSpace"] !== undefined);
        t.true(options["trimSpace"]);
    });
})();

// Numeric type
(() => {
    const column = columnFactory("numeric");

    test("NumericColumn.normalize()", (t) => {
        t.is(column.normalize(1.23), 1.23);
        t.is(column.normalize("1.10"), 1.1);
    });

    test("NumericColumn.store()", (t) => {
        t.is(column.store(1), 1);
        t.is(column.store(null), null);
        t.is(column.store(""), null);
    });

    test("NumericColumn.retrieve()", (t) => {
        t.is(column.retrieve(1), 1);
        t.is(column.retrieve("0"), 0);
        t.is(column.retrieve(null), null);
        t.is(column.retrieve(""), null);
    });

    test("NumericColumn.normalize() unexpect value", (t) => {
        t.throws(() => {
            column.normalize(Infinity);
        }, UnexpectedColumnValueError);

        t.throws(() => {
            column.normalize("a");
        }, UnexpectedColumnValueError);
    });
})();

// UUID Type
(() => {
    test("UUID auto generator", (t) => {
        const column = columnFactory("uuid", { autoGenerate: true });

        t.regex(column.getDefaultValue(), /^[0-9a-f\-]{36}$/);
    });

    test("UUID upperCase option", (t) => {
        const column = columnFactory("uuid", { upperCase: true }) as UUIDColumn;

        t.regex(column.generate(), /^[0-9A-Z\-]{36}$/);
    });

    test("UUID as primary key", (t) => {
        const column = columnFactory("uuid", { primary: true });

        t.regex(column.getDefaultValue(), /^[0-9a-f\-]{36}$/);
    });
})();

// Date Type
(() => {
    const column = columnFactory("date");

    test("DateColumn.options", (t) => {
        const options = column.getOptions();

        t.true(options.regexp instanceof RegExp);
    });

    test("DateColumn.normalize()", (t) => {
        t.regex(column.normalize(new Date()), /^\d{4}\-\d{1,2}\-\d{1,2}$/);
        t.regex(column.normalize("2017-04-27"), /^\d{4}\-\d{1,2}\-\d{1,2}$/);

        t.throws(() => {
            column.normalize(123);
        }, UnexpectedColumnValueError);

        t.throws(() => {
            column.normalize("abc");
        }, UnexpectedColumnValueError);
    });
})();

// Time Type
(() => {
    const column = columnFactory("time");

    test("DateColumn.options", (t) => {
        const options = column.getOptions();

        t.true(options.regexp instanceof RegExp);
    });

    test("DateColumn.normalize()", (t) => {
        t.regex(column.normalize(new Date()), /^\d{1,2}:\d{1,2}:\d{1,2}$/);
        t.regex(column.normalize("17:32:50"), /^\d{1,2}:\d{1,2}:\d{1,2}$/);

        t.throws(() => {
            column.normalize(123);
        }, UnexpectedColumnValueError);

        t.throws(() => {
            column.normalize("abc");
        }, UnexpectedColumnValueError);
    });
})();

// DateTime type
(() => {
    const column = columnFactory("datetime");
    const Moment = Object.getPrototypeOf(moment()).constructor;

    test("DateTimeColumn.normalize()", (t) => {
        const now = new Date();

        t.true(column.normalize(now) instanceof Moment);

        const time = "2017-04-28T13:06:00+08";

        t.true(column.normalize(time) instanceof Moment);
    });

    test("DateTimeColumn.store()", (t) => {
        const timeString = "2017-04-28T13:06:00+08:00";
        const time = moment(timeString);

        t.true(typeof column.store(time) === "string");
        t.is(column.store(time), timeString);
    });
})();
