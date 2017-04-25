import { Map } from "immutable";
import * as Knex from "knex";

export type DispatcherFunction = (...args: any[]) => string;

let adapters = Map<string, DBAdapter | Knex.Config>();
let dispatchers = Map<string, DispatcherFunction>();

export abstract class DBAdapter {
    static register(name: string, config: Knex.Config): typeof DBAdapter {
        const adapter = this.factory(config);

        adapters = adapters.set(name, adapter);

        return this;
    }

    static registerDispatcher(name: string, dispatcher: DispatcherFunction): typeof DBAdapter {
        dispatchers = dispatchers.set(name, dispatcher);

        return this;
    }

    static get(name: string, ...args: any[]): DBAdapter {
        const dispatcher = dispatchers.get(name);
        if (dispatcher !== undefined) {
            name = dispatcher(...args);
        }

        let adapter = adapters.get(name);
        if (adapter === undefined) {
            throw new Error();
        }

        if (adapter instanceof DBAdapter) {
            return adapter;
        }

        const result = DBAdapter.factory(adapter);
        adapters = adapters.set(name, result);

        return result;
    }

    static factory(options: Knex.Config): DBAdapter {
        switch (options.client) {
            case "mysql":
            case "mysql2":
                return new MysqlAdapter(options);
            case "pg":
                return new PgsqlAdapter(options);
            default:
                throw new Error(`Undefined adapter for ${options.client}`);
        }
    }

    protected options: Knex.Config;
    protected client: Knex;

    constructor(options: Knex.Config) {
        this.options = options;
    }

    // abstract async getLastID(tableName: string, column: string): Promise<number | null>;

    connect() {
        if (!this.client) {
            this.client = Knex(this.options);
        }

        return this.client;
    }

    async disconnect(): Promise<boolean> {
        if (!this.client) {
            return Promise.resolve(true);
        }

        return new Promise<boolean>((resolve, reject) => {
            this.client.destroy((error) => {
                if (error) {
                    reject(error);
                } else {
                    delete this.client;
                    resolve(true);
                }
            });
        });
    }

    async execute(statement: string, ...values: any[]): Promise<any>;
    async execute(statement: string, values: any[], trx?: Knex.Transaction): Promise<any>;
    async execute(statement: Knex.QueryBuilder, trx?: Knex.Transaction): Promise<any>;
    async execute(
        statement: Knex.QueryBuilder | string,
        values?: any[] | Knex.Transaction,
        trx?: Knex.Transaction,
    ): Promise<any> {
        let cmd: { text: string, values: any[] } = { text: "", values: [] };

        if (typeof statement === "string") {
            cmd.text = statement;

            if (values instanceof Array) {
                cmd.values = values;
            }
        } else {
            const sql = statement.toSQL();
            cmd.text = sql.sql;
            cmd.values = sql.bindings;
        }

        const conn = this.connect();

        if (trx !== undefined) {
            conn.transacting(trx);
        } else if (values !== undefined && !(values instanceof Array)) {
            conn.transacting(values);
        }

        return new Promise((resolve, reject) => {
            conn.raw(cmd.text, cmd.values).asCallback((error, result) => {
                error ? reject(error) : resolve(resolve);
            });
        });
    }

    select(table: string) {
        return (this.connect())(table).select();
    }

    insert(table: string, values: object) {
        return (this.connect())(table).insert(values);
    }

    update(table: string, values: object) {
        return (this.connect())(table).update(values);
    }

    delete(table: string) {
        return (this.connect())(table).delete();
    }
}

export class MysqlAdapter extends DBAdapter {

}

export class PgsqlAdapter extends DBAdapter {

}
