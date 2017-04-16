import { delete as $delete, insert, select, Select, Statement, update } from "sql-bricks";
import { Data } from "../data";
import { DeleteCommand, FindCommand, InsertCommand, Mapper, UpdateCommand } from "../mapper";

export class DBMapper<T extends Data> extends Mapper<T> {
    select(): Select {
        const table = this.getCollection();
        const columns = this.getColumns().keySeq().toArray();

        return select(columns).from(table);
    }

    // async fetch(select: Select): Promise<T[]> {

    // }

    async execute(stmt: Statement): Promise<any> {

    }

    protected async doFind(cmd: FindCommand): Promise<object | null> {
        const columns = this.getColumns().keySeq().toArray();

        await this.execute(
            select(columns)
                .from(cmd.collection)
                .where(cmd.id.toObject()),
        );

        return {};
    }

    protected async doInsert(cmd: InsertCommand): Promise<object> {
        await this.execute(
            insert(cmd.collection).values(cmd.record.toObject()),
        );

        return {};
    }

    protected async doUpdate(cmd: UpdateCommand): Promise<object> {
        await this.execute(
            update(cmd.collection)
                .set(cmd.record.toObject())
                .where(cmd.id.toObject()),
        );

        return {};
    }

    protected async doDelete(cmd: DeleteCommand): Promise<boolean> {
        await this.execute(
            $delete(cmd.collection)
                .where(cmd.id.toObject()),
        );

        return true;
    }
}
