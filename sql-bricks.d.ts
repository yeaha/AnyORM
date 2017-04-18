// Type definitions for sql-bricks v2.0.2
// Project: https://github.com/CSNW/sql-bricks
// Definitions by: Yangyi <https://github.com/yeaha>
// TypeScript Version: 2.2

type Expr = Sql | Expression | object;
type joinCriteriaFunc = (leftTable: string, leftAlias: string, rightTable: string, rightAlias: string) => object;

interface ToStringOptions {
    placeholder?: string;
    values?: any[],
    value_ix?: number;
    [key: string]: any;
}

interface Sql {
    toString(options?: ToStringOptions): string;
}

interface Val {
    _val: any;
}

interface Expression extends Sql {
    clone(): this;
}

declare function sql(str: string, ...values: any[]): Sql;

declare namespace sql {
    interface Parameterized {
        text: string;
        values: any[];
    }

    interface Statement extends Expression {
        toParams(options?: ToStringOptions): Parameterized;
    }

    interface Foobar {
        foo();
    }

    interface Select extends Statement {
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

    interface Insert extends Statement {
        into(tableName?: string, values?: object | any[]): this;
        values(...values: any[]): this;
        values(values: object | object[] | [string, any][]): this;
        select(...columns: string[]): Select;
        select(columns: string[]): Select;
    }

    interface Update extends Statement {
        set(column: string, value: any): this;
        set(values: object): this;
        where(column: string, value: any): this;
        where(criteria: object): this;
        where(whereExpr: Expr): this;
    }

    interface Delete extends Statement {
        from(tableName: string): this;
        using(...columns: string[]): this;
        using(columns: string[]): this;
        where(column: string, value: any): this;
        where(criteria: object): this;
        where(whereExpr: Expr): this;
    }

    function val(value: any): Val;

    function select(...columns: string[]): Select;
    function select(columns: string[]): Select;

    function insert(tableName?: string, values?: object): Insert;
    function insert(tableName?: string, ...columns: string[]): Insert;
    function insert(tableName?: string, columns?: string[]): Insert;
    // export { insert as insertInto };

    function update(tableName: string, values?: object): Update;

    function $delete(tableName?: string): Delete;
    // export { $delete as delete, $delete as deleteFrom };

    function $in(column: string, ...list: any[]): Expression;
    function $in(column: string, select: Select): Expression;
    // export { $in as in };

    function not(expr: Expr): Expression;
    function and(...exprs: Expr[]): Expression;
    function or(...expr: Expr[]): Expression;
    function like(column: string, value: any, escapeChar?: string): Expression;
    function between(column: string, value1: any, value2: any): Expression;
    function isNull(column: string): Expression;
    function isNotNull(column: string): Expression;
    function exists(subquery: Select): Expression;

    function aliasExpansions(aliases: object): void;

    function joinCriteria(func: joinCriteriaFunc): void;
    function joinCriteria(): joinCriteriaFunc | undefined;

    function eq(column: string, value: any): Expression;
    function equal(column: string, value: any): Expression;
    function notEq(column: string, value: any): Expression;
    function lt(column: string, value: any): Expression;
    function lte(column: string, value: any): Expression;
    function gt(column: string, value: any): Expression;
    function gte(column: string, value: any): Expression;

    function eqAll(column: string, select: Select): Expression;
    function equalAll(column: string, select: Select): Expression;
    function notEqAll(column: string, select: Select): Expression;
    function ltAll(column: string, select: Select): Expression;
    function lteAll(column: string, select: Select): Expression;
    function gtAll(column: string, select: Select): Expression;
    function gteAll(column: string, select: Select): Expression;

    function eqAny(column: string, select: Select): Expression;
    function equalAny(column: string, select: Select): Expression;
    function notEqAny(column: string, select: Select): Expression;
    function ltAny(column: string, select: Select): Expression;
    function lteAny(column: string, select: Select): Expression;
    function gtAny(column: string, select: Select): Expression;
    function gteAny(column: string, select: Select): Expression;

    function eqSome(column: string, select: Select): Expression;
    function equalSome(column: string, select: Select): Expression;
    function notEqSome(column: string, select: Select): Expression;
    function ltSome(column: string, select: Select): Expression;
    function lteSome(column: string, select: Select): Expression;
    function gtSome(column: string, select: Select): Expression;
    function gteSome(column: string, select: Select): Expression;
    function foobar(): Foobar;
}

export = sql;
