import test from "ava";
import { Map } from "immutable";
import * as AnyORM from "../src/index";
import "./fixture/columns";
import { TestMapper } from "./fixture/mapper";

class Mapper extends TestMapper(AnyORM.Mapper) {

}

(() => {
    class Data extends AnyORM.Data {
        public static mapper = Mapper;

        @AnyORM.Column("integer", { primary: true })
        public id: number;

        @AnyORM.Column("string")
        public foo: string;
    }

    test("Construct", (t) => {
        let data = new Data();

        t.false(data.isDirty());
        t.true(data.isFresh());

        t.true(data.hasColumn("id"));
        t.true(data.hasColumn("foo"));
        t.false(data.hasColumn("bar"));

        t.true(AnyORM.getMapperOf(data) instanceof Mapper);
    });

    test("Setter & Getter", (t) => {
        let data = new Data();

        t.is(data.foo, null);

        data.foo = "foo";
        t.is(data.foo, "foo");

        t.true(data.isDirty());
        t.true(data.isDirty("foo"));
        t.false(data.isDirty("id"));

        data.set("foo", "FOO");
        t.is(data.get("foo"), "FOO");
    });

    test("Import values", (t) => {
        let data = new Data();
        let values = Map<string, any>();

        values = values.set("foo", "Foo");
        data.__import(values);

        t.false(data.isFresh());
        t.false(data.isDirty());
        t.is(data.foo, "Foo");
    });

    test("Replace value", (t) => {
        let data = new Data();
        let values = Map<string, any>();

        values = values.set("foo", "foo");
        data.__import(values);

        data.foo = "foo";
        t.false(data.isDirty("foo"));

        data.foo = "Foo";
        t.true(data.isDirty("foo"));
    });
})();
