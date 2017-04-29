import { forEach, isNil } from "lodash";
import { Data } from "../data";
import { DeleteCommand, FindCommand, InsertCommand, Mapper, UpdateCommand } from "../mapper";
import { DBManager } from "./adapter";

export class DBMapper<T extends Data> extends Mapper<T> {
    select() {
        const adapter = this.getDBAdapter();
        const table = this.getCollection();

        return adapter.select(table);
    }

    // async fetch(select: Select): Promise<T[]> {

    // }

    protected getDBAdapter(service?: string) {
        if (service === undefined) {
            service = this.getService();
        }

        return DBManager.get(service);
    }

    protected async doFind(cmd: FindCommand): Promise<object | null> {
        const adapter = this.getDBAdapter(cmd.service);
        const table = cmd.collection;
        const columns = this.getColumns().keySeq().toArray();
        const stmt = adapter.select(table).columns(columns).where(cmd.id.toObject());

        const result = await adapter.execute(stmt);
        const row = result[0][0];

        if (row === undefined) {
            return null;
        }

        return row;
    }

    protected async doInsert(cmd: InsertCommand): Promise<object> {
        let id = cmd.id;
        const returning = id
            .filter((value, key) => { return isNil(value); })
            .keySeq()
            .toArray();

        if (returning.length > 1) {
            throw new Error();
        }

        const adapter = this.getDBAdapter(cmd.service);
        const table = cmd.collection;
        const stmt = adapter.insert(table, cmd.record.toObject());

        if (returning.length) {
            stmt.returning(returning);
        }

        const result = await adapter.executeInsert(stmt);

        forEach(result.returning || [], (value, key: string) => {
            id = id.set(key, value);
        });

        // TODO: 获取自增长主键的值
        return id.toObject();
    }

    protected async doUpdate(cmd: UpdateCommand): Promise<object> {
        const adapter = this.getDBAdapter(cmd.service);
        const table = cmd.collection;
        const stmt = adapter.update(table, cmd.record.toObject()).where(cmd.id.toObject());

        await adapter.executeUpdate(stmt);

        return {};
    }

    protected async doDelete(cmd: DeleteCommand): Promise<void> {
        const adapter = this.getDBAdapter(cmd.service);
        const table = cmd.collection;
        const stmt = adapter.delete(table).where(cmd.id.toObject());

        await adapter.executeDelete(stmt);
    }
}
