import { Map, OrderedMap } from "immutable";
import * as AnyORM from "../../src/index";
import { Serial } from "./columns";

export let testStorage = Map<any, AnyORM.Values>();

export class TestMapper extends AnyORM.Mapper<AnyORM.Data> {
    protected async doFind(cmd: AnyORM.FindCommand): Promise<object | null> {
        const key = this.getIndexKey(cmd.id);
        const record = testStorage.get(key);

        if (record === undefined) {
            return null;
        }

        return record.toObject();
    }

    protected async doInsert(cmd: AnyORM.InsertCommand): Promise<object> {
        let record = cmd.record;
        let id = OrderedMap() as AnyORM.Values;

        this.primaryKeys.forEach((column, key) => {
            if (column instanceof Serial) {
                record = record.set(key, column.getNext());
            }

            id = id.set(key, record.get(key));
        });

        const key = this.getIndexKey(id);

        testStorage = testStorage.set(key, record);

        return id.toObject();
    }

    protected async doUpdate(cmd: AnyORM.UpdateCommand): Promise<object> {
        const key = this.getIndexKey(cmd.id);
        const values = testStorage.get(key);

        if (values !== undefined) {
            testStorage = testStorage.set(key, values.merge(cmd.record));
        }

        return {};
    }

    protected async doDelete(cmd: AnyORM.DeleteCommand): Promise<boolean> {
        const key = this.getIndexKey(cmd.id);

        testStorage = testStorage.delete(key);

        return true;
    }

    private getIndexKey(id: AnyORM.Values): string {
        if (!(id instanceof OrderedMap)) {
            id = id.toOrderedMap();
        }

        let result: String[] = [];

        id.forEach((value, key) => {
            result.push(`${key}:${value}`);
        });

        return result.join(`&`);
    }
}
