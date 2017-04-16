import * as anydb from "any-db";
import * as begin from "any-db-transaction";
import { Map } from "immutable";
import { Parameterized, Statement } from "sql-bricks";

export type DispatcherFunction = (...args: any[]) => string;

export interface DBAdapterOptions {
    dsn: string;
    poolOptions: anydb.PoolConfig;
}

let adapters = Map<string, DBAdapter | DBAdapterOptions>();
let dispatchers = Map<string, DispatcherFunction>();

export abstract class DBAdapter {
    static register(name: string, options: DBAdapterOptions);
    static register(name: string, dispatcher: DispatcherFunction);
    static register(name: string, value: DBAdapterOptions | DispatcherFunction): void {
        if (typeof value === "function") {
            dispatchers = dispatchers.set(name, value);
        } else {
            adapters = adapters.set(name, value);
        }
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

    static factory(options: DBAdapterOptions): DBAdapter {
        // const dsn = options.dsn;
        // const parsed = ParseDSN(dsn);
        // const adapter: string = parsed["adapter"];

        // switch (adapter) {
        //     case "mysql":
        //         return new MysqlAdapter(options);
        //     case "postgres":
        //         return new PgsqlAdapter(options);
        //     default:
        //         throw new Error(`Undefined adapter for ${adapter}`);
        // }
    }

    protected options: DBAdapterOptions;
    protected pool: anydb.ConnectionPool;

    constructor(options: DBAdapterOptions) {
        this.options = options;
    }

    // abstract async getLastID(tableName: string, column: string): Promise<number | null>;

    connect() {
        if (!this.pool) {
            this.pool = anydb.createPool(this.options.dsn, this.options.poolOptions);
        }

        return this.pool;
    }

    async disconnect(): Promise<boolean> {
        if (!this.pool) {
            return Promise.resolve(true);
        }

        return new Promise<boolean>((resolve, reject) => {
            this.pool.close((error) => {
                if (error) {
                    reject(error);
                } else {
                    delete this.pool;
                    resolve(true);
                }
            });
        });
    }

    async acquire(priority?: number): Promise<anydb.Connection> {
        const pool = this.connect();

        return new Promise<anydb.Connection>((resolve, reject) => {
            pool.acquire((error, client) => {
                error ? reject(error) : resolve(client);
            });
        });
    }

    release(client: anydb.Connection): void {
        const pool = this.connect();

        pool.release(client);
    }

    async execute(statement: string, ...values: any[]): Promise<anydb.ResultSet>;
    async execute(statement: Statement): Promise<anydb.ResultSet>;
    async execute(statement: Statement | string, ...values: any[]): Promise<anydb.ResultSet> {
        let cmd: Parameterized;

        if (typeof statement === "string") {
            cmd = { text: statement, values: values };
        } else {
            cmd = statement.toParams();
        }

        const client = await this.acquire();

        return new Promise<anydb.ResultSet>((resolve, reject) => {
            client.query(cmd.text, cmd.values, (error, result) => {
                error ? reject(error) : resolve(result);

                this.release(client);
            });
        });
    }

    async begin(options?: begin.TransactionOptions): Promise<begin.Transaction> {
        const connect = await this.acquire();

        return new Promise<begin.Transaction>((resolve, reject) => {
            begin(connect, options, (error, tx) => {
                error ? reject(error) : resolve(tx);
            });
        });
    }

    async rollback(tx: begin.Transaction): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            tx.rollback((error) => {
                error ? reject(error) : resolve(true);
            });
        });
    }

    async commit(tx: begin.Transaction): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            tx.commit((error) => {
                error ? reject(error) : resolve(true);
            });
        });
    }
}

export class MysqlAdapter extends DBAdapter {

}

export class PgsqlAdapter extends DBAdapter {

}
