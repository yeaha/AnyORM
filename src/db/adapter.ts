import { Map } from "immutable";
import * as Knex from "knex";
import { isArray, isNumber } from "lodash";

export interface DBResponse {
    original: any;
    result: any[];
    lastInsertId?: number;
    affectedRows?: number;
}

interface SelectResult {
    original: any;
    rows: object[];
}

interface InsertResult {
    original: any;
    affectedRows: number;
    returning?: any[];
}

interface UpdateResult {
    original: any;
    affectedRows: number;
    returning?: any[];
}

interface DeleteResult {
    original: any;
    affectedRows: number;
    returning?: any[];
}

interface Dialects extends Wrapper {
    transaction(): Promise<Client & Transaction>;
    executeInsert(statement: Knex.QueryBuilder, returningId?: string[]): Promise<InsertResult>;
    processSelectResult(result): SelectResult;
    processInsertResult(result): InsertResult;
    processUpdateResult(result): UpdateResult;
    processDeleteResult(result): DeleteResult;
}

interface Client extends Dialects {
    executeSelect(statement: Knex.QueryBuilder): Promise<SelectResult>;
    executeDelete(statement: Knex.QueryBuilder): Promise<DeleteResult>;
    executeUpdate(statement: Knex.QueryBuilder): Promise<UpdateResult>;
}

interface Constructor<T extends Wrapper> {
    new (...args: any[]): T;
}

abstract class Wrapper {
    client: Knex | Knex.Transaction;

    constructor(client: Knex | Knex.Transaction) {
        this.client = client;
    }

    async execute(statement: string, ...values: any[]): Promise<any>;
    async execute(statement: string, values: any[]): Promise<any>;
    async execute(statement: string, values: any[]): Promise<any> {
        return await this.client.raw(statement, values);
    }

    select(table: string) {
        return this.client(table).select();
    }

    insert(table: string, values?: object) {
        return this.client(table).insert(values);
    }

    update(table: string, values?: object) {
        return this.client(table).update(values);
    }

    delete(table: string) {
        return this.client(table).delete();
    }
}

class Adapter extends Wrapper {
    client: Knex;

    constructor(config: Knex.Config) {
        super(Knex(config));
    }
}

class Transaction extends Wrapper {
    client: Knex.Transaction;

    constructor(client: Knex.Transaction) {
        super(client);
    }

    async commit() {
        return await this.client.commit();
    }

    async rollback(error) {
        return await this.client.rollback(error);
    }
}

function Client<T extends Constructor<Dialects>>(Base: T) {
    return class extends Base implements Client {
        async executeSelect(statement: Knex.QueryBuilder): Promise<SelectResult> {
            const result = await statement;

            return this.processSelectResult(result);
        }

        async executeUpdate(statement: Knex.QueryBuilder): Promise<UpdateResult> {
            const result = await statement;

            return this.processUpdateResult(result);
        }

        async executeDelete(statement: Knex.QueryBuilder): Promise<DeleteResult> {
            const result = await statement;

            return this.processDeleteResult(result);
        }
    };
}

function MysqlDialects<T extends Constructor<Wrapper>>(Base: T) {
    return class extends Base implements Dialects {
        async transaction() {
            return new Promise((resolve, reject) => {
                this.client.transaction((trx) => {
                    const T = Client(MysqlDialects(Transaction));

                    resolve(new T(trx));
                }).catch((error) => {
                    reject(error);
                });
            });
        }

        async executeInsert(statement: Knex.QueryBuilder, returningId: string[] = []): Promise<InsertResult> {
            if (returningId.length > 1) {
                throw new Error();
            }

            const result = await statement;

            return this.processInsertResult(result);
        }

        processSelectResult(result): SelectResult {
            return {
                rows: result as object[],
                original: result,
            };
        }

        processInsertResult(result): InsertResult {
            const r: InsertResult = {
                original: result,
                affectedRows: 0,
            };

            if (isArray(result)) {
                r.affectedRows = result.length;
                r.returning = result;
            } else {
                throw new Error("Unexpected db response");
            }

            return r;
        }

        processUpdateResult(result): UpdateResult {
            return this.processDeleteResult(result);
        }

        processDeleteResult(result): DeleteResult {
            const r = {
                original: result,
                affectedRows: 0,
            };

            if (isNumber(result)) {
                r.affectedRows = result;
            } else {
                throw new Error("Unexpected db response");
            }

            return r;
        }
    };
}

function PgsqlDialects<T extends Constructor<Wrapper>>(Base: T) {
    return class extends Base implements Dialects {
        async transaction() {
            return new Promise((resolve, reject) => {
                this.client.transaction((trx) => {
                    const T = Client(PgsqlDialects(Transaction));

                    resolve(new T(trx));
                }).catch((error) => {
                    reject(error);
                });
            });
        }

        async executeInsert(statement: Knex.QueryBuilder, returningId: string[] = []): Promise<InsertResult> {
            if (returningId.length) {
                statement.returning(returningId);
            }

            const result = await statement;

            return this.processInsertResult(result);
        }

        processSelectResult(result): SelectResult {
            return {
                rows: result as object[],
                original: result,
            };
        }

        processInsertResult(result): InsertResult {
            const r: InsertResult = {
                affectedRows: 0,
                original: result,
            };

            if (result.rowCount && isNumber(result.rowCount)) {
                r.affectedRows = result.rowCount;
            } else if (isArray(result)) {
                r.affectedRows = result.length;
                r.returning = result;
            } else {
                throw new Error("Unexpected db response");
            }

            return r;
        }

        processUpdateResult(result): UpdateResult {
            return this.processDeleteResult(result);
        }

        processDeleteResult(result): DeleteResult {
            const r = {
                original: result,
                affectedRows: 0,
            };
            if (isNumber(result)) {
                r.affectedRows = result;
            } else if (isArray(result)) {
                r.affectedRows = result.length;
                r["returning"] = result;
            } else {
                throw new Error("Unexpected db response");
            }

            return r;
        }
    };
}

type DispatcherFunction = (...args: any[]) => string;

let clients = Map<string, Client>();
let dispatchers = Map<string, DispatcherFunction>();

class Manager {
    factory(config: Knex.Config): Client {
        let T;

        switch (config.client) {
            case "mysql":
            case "mysql2":
                T = Client(MysqlDialects(Adapter));
                break;
            case "pg":
                T = Client(PgsqlDialects(Adapter));
                break;
            default:
                throw new Error();
        }

        return new T(config);
    }

    register(name: string, config: Knex.Config): this {
        clients = clients.set(name, this.factory(config));

        return this;
    }

    registerDispatcher(name: string, dispatcher: DispatcherFunction): this {
        dispatchers = dispatchers.set(name, dispatcher);

        return this;
    }

    get(name: string, ...args: any[]): Client {
        const dispatcher = dispatchers.get(name);
        if (dispatcher !== undefined) {
            name = dispatcher(...args);
        }

        const client = clients.get(name);
        if (client === undefined) {
            throw new Error();
        }

        return client;
    }
}

export const DBManager = new Manager();
