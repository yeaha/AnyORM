// Type definitions for sql-bricks v2.0.2
// Project: https://github.com/CSNW/sql-bricks
// Definitions by: Yangyi <https://github.com/yeaha>
// TypeScript Version: 2.2

/// <reference types="node" />

type Expr = sql | Expression | object;
type joinCriteriaFunc = (leftTable: string, leftAlias: string, rightTable: string, rightAlias: string) => object;

interface ToStringOptions {
    placeholder?: string;
    values?: any[],
    value_ix?: number;
    [key: string]: any;
}

interface sql {
    toString(options?: ToStringOptions): string;
}

interface val {
    private _val: any;
}

interface Expression extends sql {
    clone(): this;
}

declare function sql(str: string, ...values: any[]): sql;

declare namespace sql {
    export interface Parameterized {
        text: string;
        values: any[];
    }

    export interface Statement {
        clone(): this;
        toParams(options?: ToStringOptions): Parameterized;
        toString(options?: ToStringOptions): string;
    }

    export interface Select extends Statement {
        select(...columns: string[]): this;
        select(columns: string[]): this;

        distinct(...columns: string[]): this;
        distinct(columns: string[]): this;

        into(tableName: string): this;
        intoTable(tableName: string): this;

        intoTemp(tableName: string): this;
        intoTempTable(tableName: string): this;

        from(...tables: string[]): this;
        from(tables: string[]): this;

        as(alias: string): this;

        join(tableName: string, onCriteria?: object): this;
        innerJoin(tableName: string, onCriteria?: object): this;
        leftJoin(tableName: string, onCriteria?: object): this;
        leftOuterJoin(tableName: string, onCriteria?: object): this;
        rightJoin(tableName: string, onCriteria?: object): this;
        righOuterJoin(tableName: string, onCriteria?: object): this;
        fullJoin(tableName: string, onCriteria?: object): this;
        fullOuterJoin(tableName: string, onCriteria?: object): this;
        naturalJoin(tableName: string): this;
        naturalInnerJoin(tableName: string): this;
        naturalLeftJoin(tableName: string): this;
        naturalLeftOuterJoin(tableName: string): this;
        naturalRightJoin(tableName: string): this;
        naturalRightOuterJoin(tableName: string): this;
        naturalFullJoin(tableName: string): this;
        naturalFullOuterJoin(tableName: string): this;
        crossJoin(tableName: string): this;

        on(...onCriteria: string[]): this;
        on(onCriteria: object): this;

        using(...columns: string[]): this;
        using(columns: string[]): this;

        where(column: string, value: any): this;
        where(criteria: object): this;
        where(whereExpr: Expr): this;
        and(column: string, value: any): this;
        and(criteria: object): this;
        and(whereExpr: Expr): this;

        groupBy(...columns: string[]): this;
        groupBy(columns: string[]): this;
        group(...columns: string[]): this;
        group(columns: string[]): this;

        having(column: string, value: any): this;
        having(criteria: object): this;
        having(whereExpr: Expr): this;

        union(...statements: Select[]): this;
        union(statements?: Select[]): this;

        unionAll(...statements: Select[]): this;
        unionAll(statements?: Select[]): this;

        intersect(...statements: Select[]): this;
        intersect(statements?: Select[]): this;

        intersectAll(...statements: Select[]): this;
        intersectAll(statements?: Select[]): this;

        except(...statements: Select[]): this;
        except(statements?: Select[]): this;

        exceptAll(...statements: Select[]): this;
        exceptAll(statements?: Select[]): this;

        orderBy(...columns: string[]): this;
        orderBy(columns: string[]): this;
        order(...columns: string[]): this;
        order(columns: string[]): this;

        forUpdate(): this;

        of(...columns: string[]): this;
        of(columns: string[]): this;

        noWait(): this;
    }

    export interface Insert extends Statement {
        into(tableName?: string, values?: object | any[]): this;
        values(...values: any[]): this;
        values(values: object | object[] | [string, any][]): this;
        select(...columns: string[]): Select;
        select(columns: string[]): Select;
    }

    export interface Update extends Statement {
        set(column: string, value: any): this;
        set(values: object): this;
        where(column: string, value: any): this;
        where(criteria: object): this;
        where(whereExpr: Expr): this;
    }

    export interface Delete extends Statement {
        from(tableName: string): this;
        using(...columns: string[]): this;
        using(columns: string[]): this;
        where(column: string, value: any): this;
        where(criteria: object): this;
        where(whereExpr: Expr): this;
    }

    export declare function val(value: any): val;

    export declare function select(...columns: string[]): Select;
    export declare function select(columns: string[]): Select;

    export declare function insert(tableName?: string, values?: object): Insert;
    export declare function insert(tableName?: string, ...columns: string[]): Insert;
    export declare function insert(tableName?: string, columns?: string[]): Insert;
    export { insert as insertInto };

    export declare function update(tableName: string, values?: object): Update;

    declare function $delete(tableName?: string): Delete;
    export { $delete as delete, $delete as deleteFrom };

    declare function $in(column: string, ...list: any[]): Expression;
    declare function $in(column: string, select: Select): Expression;
    export { $in as in };

    export declare function not(expr: Expr): Expression;
    export declare function and(...exprs: Expr[]): Expression;
    export declare function or(...expr: Expr[]): Expression;
    export declare function like(column: string, value: any, escapeChar?: string): Expression;
    export declare function between(column: string, value1: any, value2: any): Expression;
    export declare function isNull(column: string): Expression;
    export declare function isNotNull(column: string): Expression;
    export declare function exists(subquery: Select): Expression;

    export declare function aliasExpansions(aliases: object): void;

    export declare function joinCriteria(func: joinCriteriaFunc): void;
    export declare function joinCriteria(): joinCriteriaFunc | undefined;

    export declare function eq(column: string, value: any): Expression;
    export declare function equal(column: string, value: any): Expression;
    export declare function notEq(column: string, value: any): Expression;
    export declare function lt(column: string, value: any): Expression;
    export declare function lte(column: string, value: any): Expression;
    export declare function gt(column: string, value: any): Expression;
    export declare function gte(column: string, value: any): Expression;

    export declare function eqAll(column: string, select: Select): Expression;
    export declare function equalAll(column: string, select: Select): Expression;
    export declare function notEqAll(column: string, select: Select): Expression;
    export declare function ltAll(column: string, select: Select): Expression;
    export declare function lteAll(column: string, select: Select): Expression;
    export declare function gtAll(column: string, select: Select): Expression;
    export declare function gteAll(column: string, select: Select): Expression;

    export declare function eqAny(column: string, select: Select): Expression;
    export declare function equalAny(column: string, select: Select): Expression;
    export declare function notEqAny(column: string, select: Select): Expression;
    export declare function ltAny(column: string, select: Select): Expression;
    export declare function lteAny(column: string, select: Select): Expression;
    export declare function gtAny(column: string, select: Select): Expression;
    export declare function gteAny(column: string, select: Select): Expression;

    export declare function eqSome(column: string, select: Select): Expression;
    export declare function equalSome(column: string, select: Select): Expression;
    export declare function notEqSome(column: string, select: Select): Expression;
    export declare function ltSome(column: string, select: Select): Expression;
    export declare function lteSome(column: string, select: Select): Expression;
    export declare function gtSome(column: string, select: Select): Expression;
    export declare function gteSome(column: string, select: Select): Expression;
}

export = sql;
