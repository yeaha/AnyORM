import { CreateTableBuilder } from "knex";
import { DBManager } from "../../src/index";
import "./dbservers";

const mysql = DBManager.get("mysql");

mysql.client
    .schema
    .createTableIfNotExists("users", createTableUsers)
    .then(() => {
        console.log("mysql: create table `test`.`usres`");
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
