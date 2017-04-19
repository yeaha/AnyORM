import { Map, OrderedMap } from "immutable";
import {
    Data,
    DeleteCommand,
    FindCommand,
    InsertCommand,
    Mapper,
    UpdateCommand,
    Values,
} from "../../src/index";
import { Serial } from "./columns";

export let testStorage = Map<any, Values>();

export class TestMapper<T extends Data> extends Mapper<T> {
    protected async doFind(cmd: FindCommand): Promise<object | null> {
        const key = this.getIndexKey(cmd.id);
        const record = testStorage.get(key);

        if (record === undefined) {
            return null;
        }

        return record.toObject();
    }

    protected async doInsert(cmd: InsertCommand): Promise<object> {
        let record = cmd.record;
        let id = OrderedMap() as Values;

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

    protected async doUpdate(cmd: UpdateCommand): Promise<object> {
        const key = this.getIndexKey(cmd.id);
        const values = testStorage.get(key);

        if (values !== undefined) {
            testStorage = testStorage.set(key, values.merge(cmd.record));
        }

        return {};
    }

    protected async doDelete(cmd: DeleteCommand): Promise<void> {
        const key = this.getIndexKey(cmd.id);

        testStorage = testStorage.delete(key);
    }

    private getIndexKey(id: Values): string {
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
