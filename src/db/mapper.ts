import { Data } from "../data";
import { DeleteCommand, FindCommand, InsertCommand, Mapper, UpdateCommand } from "../mapper";
import { DBAdapter, PgsqlAdapter } from "./adapter";

export class DBMapper<T extends Data> extends Mapper<T> {
    select() {
        const adapter = this.getDBAdapter();
        const table = this.getCollection();

        return adapter.select(table);
    }

    // async fetch(select: Select): Promise<T[]> {

    // }

    protected getDBAdapter(service?: string): DBAdapter {
        if (service === undefined) {
            service = this.getService();
        }

        return DBAdapter.get(service);
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
        const adapter = this.getDBAdapter(cmd.service);
        const table = cmd.collection;
        const stmt = adapter.insert(table, cmd.record.toObject());

        if (adapter instanceof PgsqlAdapter) {
            stmt.returning(cmd.id.keySeq().toArray());
        }

        await adapter.execute(stmt);

        return {};
    }

    protected async doUpdate(cmd: UpdateCommand): Promise<object> {
        const adapter = this.getDBAdapter(cmd.service);
        const table = cmd.collection;
        const stmt = adapter.update(table, cmd.record.toObject()).where(cmd.id.toObject());

        await adapter.execute(stmt);

        return {};
    }

    protected async doDelete(cmd: DeleteCommand): Promise<boolean> {
        const adapter = this.getDBAdapter(cmd.service);
        const table = cmd.collection;
        const stmt = adapter.delete(table).where(cmd.id.toObject());

        await adapter.execute(stmt);

        return true;
    }
}
