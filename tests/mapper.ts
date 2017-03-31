import test from "ava";
import { Map } from "immutable";
import * as AnyORM from "../src/index";
import { TestMapper } from "./fixture/mapper";

class Mapper extends TestMapper(AnyORM.Mapper) {

}

class Data extends AnyORM.Data {

}

(() => {
    let columns = Map() as AnyORM.Columns;
    columns = columns.set("id", AnyORM.ColumnFactory("numeric", { primary: true }));

    const options = {
        service: "test.service",
        collection: "test.collection",
        foo: "FOO",
    };

    let mapper = new Mapper(Data, columns, options);
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
