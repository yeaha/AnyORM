import { DBManager } from "../../src/index";

DBManager
    .register("mysql", {
        client: "mysql2",
        connection: {
            host: "127.0.0.1",
            user: "test",
            password: "test",
            database: "test",
        },
        pool: {
            min: 0,
            max: 3,
            idleTimeoutMillis: 100,
        },
    })
    .register("pgsql", {
        client: "pg",
        connection: {
            host: "127.0.0.1",
            user: "test",
            password: "test",
            database: "test",
        },
        pool: {
            min: 0,
            max: 3,
            idleTimeoutMillis: 100,
        },
    });
