import test from "ava";
import { Map } from "immutable";
import * as AnyORM from "../src/index";
import "./fixture/columns";
import { TestMapper } from "./fixture/mapper";

class Mapper extends TestMapper(AnyORM.Mapper) {

}

(() => {
    class Data extends AnyORM.Data {

    }

    let columns = Map() as AnyORM.Columns;
    columns = columns.set("id", AnyORM.columnFactory("numeric", { primary: true }));

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

(() => {
    class FooData extends AnyORM.Data {
        static mapper = Mapper;
        static mapperService = "foo.service";
        static mapperCollection = "foo.collection";

        @AnyORM.PrimaryColumn("uuid")
        foo_id: string;

        @AnyORM.Column("string")
        foo: string;
    }

    class BarData extends AnyORM.Data {
        static mapper = Mapper;
        static mapperService = "bar.service";
        static mapperCollection = "bar.collection";

        @AnyORM.PrimaryColumn("uuid")
        bar_id: string;

        @AnyORM.Column("string")
        bar: string;
    }

    test("Mapper of Data", (t) => {
        const fooMapper = AnyORM.getMapperOf(FooData);
        const barMapper = AnyORM.getMapperOf(BarData);

        t.notDeepEqual(fooMapper, barMapper);

        t.is(fooMapper.getOption("service"), "foo.service");
        t.is(barMapper.getOption("service"), "bar.service");

        t.is(fooMapper.getOption("collection"), "foo.collection");
        t.is(barMapper.getOption("collection"), "bar.collection");

        t.true(fooMapper.hasColumn("foo"));
        t.false(fooMapper.hasColumn("bar"));

        t.true(barMapper.hasColumn("bar"));
        t.false(barMapper.hasColumn("foo"));
    });
})();

(() => {
    class TestData extends AnyORM.Data {
        static mapper = Mapper;

        @AnyORM.PrimaryColumn(`serial`)
        id: number;

        @AnyORM.Column(`string`)
        foo: string;

        @AnyORM.Column(`string`)
        bar: string;
    }

    test.serial("Insert data", async (t) => {
        const data = new TestData();

        data.foo = "FOO";
        data.bar = "BAR";

        await data.save();

        t.false(data.isDirty());
        t.false(data.id === null);

        t.pass();
    });

    test.serial("Find data", async (t) => {
        const data = await TestData.findOrFail(1);

        t.is(data.get("foo"), "FOO");
        t.is(data.get("bar"), "BAR");
    });

    test.serial("Update data", async (t) => {
        const data = await TestData.findOrFail(1);

        data.set("foo", "foo");

        await data.save();

        t.false(data.isDirty());
    });

    test.serial("Delete data", async (t) => {
        const data = await TestData.findOrFail(1);

        await data.destroy();

        t.is(await TestData.find(1), null);
    });
})();
