import test from "ava";
import * as AnyORM from "../src/index";
import { TestMapper } from "./fixture/mapper";

class Mapper extends TestMapper(AnyORM.Mapper) {

}

(() => {
    let columns: AnyORM.Columns = new Map();
    columns.set("id", AnyORM.ColumnFactory("numeric", { primary: true }));

    let mapper = new Mapper("test.service", "test.collection", columns, { foo: "FOO" });
    test("Getter", (t) => {
        t.is(mapper.getService(), "test.service");
        t.is(mapper.getCollection(), "test.collection");
        t.true(mapper.hasColumn("id"));
        t.false(mapper.hasColumn("not_exist"));
        t.is(mapper.getOption("foo"), "FOO");

        t.false(mapper.getOption("readonly"));
        t.throws(() => {
            mapper.getOption("bar");
        }, /undefined mapper option/i);

        let keys = mapper.getPrimaryKeys();
        t.is(keys.size, 1);
        t.true(keys.has("id"));
    });
})();
