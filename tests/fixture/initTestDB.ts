import * as faker from "faker";
import { CreateTableBuilder } from "knex";
import { random } from "lodash";
import { DBClient, DBManager } from "../../src/index";
import "./dbservers";

const mysql = DBManager.get("mysql");

mysql.client
    .schema
    .createTableIfNotExists("users", createTableUsers)
    .then(() => {
        console.log("mysql: create table `test`.`usres`");

        return insertTestUsers(mysql);
    })
    .catch((error) => {
        console.log(error);
    });

///////////////////////////////////////////////////////////////////////////////

const pgsql = DBManager.get("pgsql");

pgsql.client
    .schema
    .createTableIfNotExists("users", createTableUsers)
    .then(() => {
        console.log(`pgsql: create table "public"."users"@test`);

        return insertTestUsers(pgsql);
    })
    .catch((error) => {
        console.log(error);
    });

///////////////////////////////////////////////////////////////////////////////

function createTableUsers(table: CreateTableBuilder): void {
    table.increments("user_id").primary();
    table.string("email", 64).unique().index("ix_user_name").notNullable();
    table.string("password", 32).notNullable();
    table.string("password_salt", 8).notNullable();
    table.dateTime("create_time").notNullable();
    table.dateTime("update_time").nullable();
}

function insertTestUsers(db: DBClient) {
    const p = [] as any[];

    for (let i = 0; i < 20; i++) {
        const randomNum = random(10000000, 99999999);

        p.push(db.insert("users", {
            email: faker.internet.email().toLowerCase(),
            password: db.client.raw("md5('" + randomNum + "')"),
            password_salt: random(10000000, 99999999),
            create_time: db.client.raw("now()"),
        }));
    }

    return Promise.all(p);
}
