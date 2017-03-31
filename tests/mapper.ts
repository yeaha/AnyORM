import test from "ava";
import { Map } from "immutable";
import * as AnyORM from "../src/index";
import { TestMapper } from "./fixture/mapper";

class Mapper extends TestMapper(AnyORM.Mapper) {

}

(() => {
    class Data extends AnyORM.Data {

    }

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

(() => {
    class FooData extends AnyORM.Data {
        public static mapper = Mapper;
        public static mapperService = "foo.service";
        public static mapperCollection = "foo.collection";

        @AnyORM.PrimaryColumn("uuid")
        public foo_id: string;

        @AnyORM.Column("string")
        public foo: string;
    }

    class BarData extends AnyORM.Data {
        public static mapper = Mapper;
        public static mapperService = "bar.service";
        public static mapperCollection = "bar.collection";

        @AnyORM.PrimaryColumn("uuid")
        public bar_id: string;

        @AnyORM.Column("string")
        public bar: string;
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
