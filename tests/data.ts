import test from "ava";
import { Map } from "immutable";
import {
    Column,
    Data,
    getMapperOf,
    MapperConstructor,
    PrimaryColumn,
    Values,
} from "../src/index";
import "./fixture/columns";
import { TestMapper } from "./fixture/mapper";

(() => {
    class MyData extends Data {
        static mapper: MapperConstructor<MyData, TestMapper<MyData>> = TestMapper;

        @PrimaryColumn("integer")
        id: number;

        @Column("string")
        foo: string;

        @Column("string")
        bar: string;
    }

    test("Construct", (t) => {
        let data = new MyData();

        t.false(data.isDirty());
        t.true(data.isFresh());

        t.true(data.hasColumn("id"));
        t.true(data.hasColumn("foo"));
        t.true(data.hasColumn("bar"));
        t.false(data.hasColumn("foobar"));

        t.true(getMapperOf(data) instanceof TestMapper);
    });

    test("Setter & Getter", (t) => {
        let data = new MyData();

        t.is(data.foo, null);

        data.foo = "foo";
        t.is(data.foo, "foo");

        t.true(data.isDirty());
        t.true(data.isDirty("foo"));
        t.false(data.isDirty("id"));

        data.set("foo", "FOO");
        t.is(data.get("foo"), "FOO");
    });

    test("Pick values", (t) => {
        let data = new MyData({
            foo: "Foo",
        });

        t.is(data.pick().size, 0);

        const values = data.pick("foo", "bar", "foobar");
        t.is(values.get("foo"), "Foo");
        t.is(values.get("bar"), null);
        t.false(values.has("foobar"));
    });

    test("Get all values", (t) => {
        let data = new MyData();
        data.bar = "bar";

        const values = data.getValues();

        t.is(values.size, 3);
        t.is(values.get("id"), null);
        t.is(values.get("foo"), null);
        t.is(values.get("bar"), "bar");
    });

    test("Merge values", (t) => {
        let data = new MyData();

        data.merge({
            foo: "foo",
            foobar: "foobar",
        });

        t.is(data.foo, "foo");
        t.true(data.isDirty("foo"));
    });

    test("Retrieve values", (t) => {
        let data = new MyData();
        let values = Map() as Values;

        values = values.set("foo", "Foo");
        data.__retrieve(values);

        t.false(data.isFresh());
        t.false(data.isDirty());
        t.is(data.foo, "Foo");
    });

    test("Replace value", (t) => {
        let data = new MyData();
        let values = Map() as Values;

        values = values.set("foo", "foo");
        data.__retrieve(values);

        data.foo = "foo";
        t.false(data.isDirty("foo"));

        data.foo = "Foo";
        t.true(data.isDirty("foo"));
    });
})();

(() => {
    class SinglePKData extends Data {
        static mapper: MapperConstructor<SinglePKData, TestMapper<SinglePKData>> = TestMapper;

        @PrimaryColumn("uuid")
        id: string;
    }

    class MultiplePKData extends Data {
        static mapper: MapperConstructor<MultiplePKData, TestMapper<MultiplePKData>> = TestMapper;

        @PrimaryColumn("uuid")
        foo_id: string;

        @PrimaryColumn("uuid")
        bar_id: string;
    }

    test("Get id", (t) => {
        const sdata = new SinglePKData();
        const mdata = new MultiplePKData();

        const sid = sdata.getIDValues();
        const mid = mdata.getIDValues();

        t.is(sid.size, 1);
        t.true(sid.has(`id`));

        t.is(mid.size, 2);
        t.true(mid.has(`foo_id`));
        t.true(mid.has(`bar_id`));

        t.true(typeof sdata.getID() === `string`);
        t.true(mid.equals(mdata.getID()));
    });
})();
