import * as Orm from "./index";

class Mapper extends Orm.Mapper {
    protected getService(id?: object) {

    }

    protected async doFind(id: object, service?: object, collection?: string): Promise<object> {
        return Promise.resolve({});
    }

    protected async doInsert(data: Orm.Data, service?: object, collection?: string): Promise<object> {
        return Promise.resolve({});
    }

    protected async doUpdate(data: Orm.Data, service?: object, collection?: string): Promise<object> {
        return Promise.resolve({});
    }

    protected async doDelete(data: Orm.Data, service?: object, collection?: string): Promise<boolean> {
        return Promise.resolve(true);
    }
}

class Data extends Orm.Data {
    public static mapper = Mapper;
    public static mapperService = "test";
    public static mapperColection = "test";

    // @Orm.PrimaryColumn("integer")
    @Orm.Column("integer", { primary: true })
    public id: number;
}

let data = new Data();
console.log(data.isFresh(), data.isDirty())

// data.set('id', 1);
data.id = 1;
console.log(data);

console.log(data.isFresh(), data.isDirty());
