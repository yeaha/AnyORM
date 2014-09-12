'use strict';

var assert = require('assert');
var DB = require(__dirname+'/../../lib/service/db');

describe('DB Service', function() {
    var MockAdapter = function() {};

    MockAdapter.prototype.quoteIdentifier = function(identifier) {
        if (identifier instanceof DB.Expr) {
            return identifier.toString();
        }

        return '`'+identifier+'`';
    };

    describe('Expr', function() {
        it('should return passed string', function() {
            var expr = new DB.Expr('foobar');
            assert.strictEqual(expr.toString(), 'foobar');
        });

        it('should return passed expression string', function() {
            var expr = new DB.Expr('foobar');
            var other = new DB.Expr(expr);

            assert.strictEqual(other.toString(), expr.toString());
        });
    });

    describe('Select', function() {
        var adapter = new MockAdapter;
        var select = new DB.Select(adapter, 'foobar');

        it('setColumns()', function() {
            select.reset();

            assert.equal(select.compile().text, 'SELECT * FROM `foobar`');

            select.setColumns('foo');
            assert.equal(select.compile().text, 'SELECT `foo` FROM `foobar`');

            select.setColumns('foo', 'bar');
            assert.equal(select.compile().text, 'SELECT `foo`, `bar` FROM `foobar`');

            select.setColumns(['bar', 'foo']);
            assert.equal(select.compile().text, 'SELECT `bar`, `foo` FROM `foobar`');

            select.setColumns('foo', new DB.Expr('bar as b'));
            assert.equal(select.compile().text, 'SELECT `foo`, bar as b FROM `foobar`');

            select.setColumns('*');
            assert.equal(select.compile().text, 'SELECT * FROM `foobar`');
        });

        it('where()', function() {
            select.reset().where('foo = ?', 'foo');

            var query = select.compile();
            assert.equal(query.text, 'SELECT * FROM `foobar` WHERE (foo = ?)');
            assert.equal(query.values[0], 'foo');

            select.reset().where('foo = ?', 'foo').where('bar = ?', 'bar');

            var query = select.compile();
            assert.equal(query.text, 'SELECT * FROM `foobar` WHERE (foo = ?) AND (bar = ?)');
            assert.equal(query.values[0], 'foo');
            assert.equal(query.values[1], 'bar');

            select.reset().where('foo = ? OR bar = ?', 'foo', 'bar').where('baz = ?', 'baz');

            var query = select.compile();
            assert.equal(query.text, 'SELECT * FROM `foobar` WHERE (foo = ? OR bar = ?) AND (baz = ?)');
            assert.equal(query.values[0], 'foo');
            assert.equal(query.values[1], 'bar');
            assert.equal(query.values[2], 'baz');
        });

        it('whereIn() / whereNotIn()', function() {
            select.reset().whereIn('id', [1, 2, 3]);

            var query = select.compile();
            assert.equal(query.text, 'SELECT * FROM `foobar` WHERE (`id` IN (?, ?, ?))');
            assert.equal(query.values[0], 1);
            assert.equal(query.values[1], 2);
            assert.equal(query.values[2], 3);

            select.reset().whereNotIn('foo', ['a', 'b', 'c']);

            var query = select.compile();
            assert.equal(query.text, 'SELECT * FROM `foobar` WHERE (`foo` IN (?, ?, ?))');
            assert.equal(query.values[0], 'a');
            assert.equal(query.values[1], 'b');
            assert.equal(query.values[2], 'c');

            var select_bar = (new DB.Select(adapter, 'bar')).setColumns('foo_id').whereIn('bar_id', [1, 2, 3]);
            select.reset().whereIn('id', select_bar);

            var query = select.compile();
            assert.equal(query.text, 'SELECT * FROM `foobar` WHERE (`id` IN (SELECT `foo_id` FROM `bar` WHERE (`bar_id` IN (?, ?, ?))))');
            assert.equal(query.values[0], 1);
            assert.equal(query.values[1], 2);
            assert.equal(query.values[2], 3);

            assert.throws(function() {
                select.reset().whereIn('id', null);
            }, /invalid/i);
        });

        it('group()', function() {
            select.reset().group('foo');

            var query = select.compile();
            assert.equal(query.text, 'SELECT * FROM `foobar` GROUP BY `foo`');
            assert.strictEqual(query.values.length, 0);

            select.reset().group(['foo', 'bar']);

            var query = select.compile();
            assert.equal(query.text, 'SELECT * FROM `foobar` GROUP BY `foo`, `bar`');

            select.reset().group(['foo', 'bar'], 'count(foo) > ?', 2);

            var query = select.compile();
            assert.equal(query.text, 'SELECT * FROM `foobar` GROUP BY `foo`, `bar` HAVING count(foo) > ?');
            assert.equal(query.values[0], 2);
        });

        it('order()', function() {
            select.reset().order('foo');
            var query = select.compile();
            assert.equal(query.text, 'SELECT * FROM `foobar` ORDER BY `foo`');

            select.reset().order('foo desc');
            var query = select.compile();
            assert.equal(query.text, 'SELECT * FROM `foobar` ORDER BY `foo desc`');

            select.reset().order({column: 'bar', sort: 'desc'});
            var query = select.compile();
            assert.equal(query.text, 'SELECT * FROM `foobar` ORDER BY `bar` DESC');

            select.reset().order({column: 'bar', sort: 'fdjslfdjslfjsdlfjldsf'});
            var query = select.compile();
            assert.equal(query.text, 'SELECT * FROM `foobar` ORDER BY `bar`');

            select.reset().order('foo', {column: 'bar', sort: 'desc'});
            var query = select.compile();
            assert.equal(query.text, 'SELECT * FROM `foobar` ORDER BY `foo`, `bar` DESC');

            select.reset().order('foo', {column: 'bar', sort: 'desc'}, new DB.Expr('baz asc'));
            var query = select.compile();
            assert.equal(query.text, 'SELECT * FROM `foobar` ORDER BY `foo`, `bar` DESC, baz asc');

            assert.throws(function() {
                select.reset().order({sort: 'desc'});
            });

            assert.throws(function() {
                select.reset().order(null);
            });
        });

        it('limit()', function() {
            select.reset().limit(1);
            assert.equal(select.compile().text, 'SELECT * FROM `foobar` LIMIT 1');

            select.reset().limit(-1);
            assert.equal(select.compile().text, 'SELECT * FROM `foobar` LIMIT 1');

            select.reset().limit(0);
            assert.equal(select.compile().text, 'SELECT * FROM `foobar`');
        });

        it('offset()', function() {
            select.reset().offset(1);
            assert.equal(select.compile().text, 'SELECT * FROM `foobar` OFFSET 1');

            select.reset().offset(-1);
            assert.equal(select.compile().text, 'SELECT * FROM `foobar` OFFSET 1');

            select.reset().offset(0);
            assert.equal(select.compile().text, 'SELECT * FROM `foobar`');
        });

        it('_compileFrom()', function() {
            var other_select = new DB.Select(adapter, select);
            var query = other_select.compile();
            assert.equal(query.text.replace(/`t_\d+`/, '`t_d`'), 'SELECT * FROM (SELECT * FROM `foobar`) AS `t_d`');

            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

            other_select.where('foo = ?', 'foo');
            select.reset().where('bar = ?', 'bar');

            query = other_select.compile();
            assert.equal(query.text.replace(/`t_\d+`/, '`t_d`'), 'SELECT * FROM (SELECT * FROM `foobar` WHERE (bar = ?)) AS `t_d` WHERE (foo = ?)');
            assert.equal(query.values[0], 'bar');
            assert.equal(query.values[1], 'foo');

            // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
            other_select = new DB.Select(adapter, new DB.Expr('(select * from `baz`) as `tmp`'));
            assert.equal(other_select.compile().text, 'SELECT * FROM (select * from `baz`) as `tmp`');
        });

        it('compile()', function() {
            select.reset();

            select.setColumns('foo', 'bar', new DB.Expr('count(1) AS count'))
                  .where('id > ?', 100)
                  .where('foo = ? or bar = ?', 'foo', 'bar')
                  .group(['foo', 'bar'], 'count(1) > ?', 1)
                  .order('foo', {column: 'bar', sort: 'desc'})
                  .limit(10)
                  .offset(10);

            var query = select.compile();
            assert.equal(query.text, 'SELECT `foo`, `bar`, count(1) AS count FROM `foobar` WHERE (id > ?) AND (foo = ? or bar = ?) GROUP BY `foo`, `bar` HAVING count(1) > ? ORDER BY `foo`, `bar` DESC LIMIT 10 OFFSET 10');
            assert.equal(query.values[0], 100);
            assert.equal(query.values[1], 'foo');
            assert.equal(query.values[2], 'bar');
            assert.equal(query.values[3], 1);
        });
    });

    describe('Adapter', function() {
        var mysql = new DB.Adapter('mysql://user:pass@127.0.0.1/test');
        var pgsql = new DB.Adapter('postgres://user:pass@127.0.0.1/test');
        var sqlite = new DB.Adapter('sqlite3://user:pass@127.0.0.1/test');

        it('quoteIdentifier()', function() {
            assert.equal(mysql.quoteIdentifier('foo.bar'), '`foo`.`bar`');
            assert.equal(mysql.quoteIdentifier('`foo`.`bar`'), '`foo`.`bar`');
            assert.equal(pgsql.quoteIdentifier('foo.bar'), '"foo"."bar"');
            assert.equal(sqlite.quoteIdentifier('foo.bar'), '"foo"."bar"');
        });

        it('insertStatement()', function() {
            var statement = pgsql.insertStatement('foo.bar', {id: 1, foo: 'foo', bar: new DB.Expr("'bar'")});

            assert.equal(statement.text, 'INSERT INTO "foo"."bar" ("id", "foo", "bar") VALUES (?, ?, \'bar\')');
            assert.deepEqual(statement.values, [1, 'foo']);

            var statement = pgsql.insertStatement('foo.bar', {id: 1, foo: 'foo', bar: 'bar'}, ['id', 'foo', 'bar']);
            assert.equal(statement.text, 'INSERT INTO "foo"."bar" ("id", "foo", "bar") VALUES (?, ?, ?) RETURNING "id", "foo", "bar"');
        });

        it('updateStatement()', function() {
            var statement = pgsql.updateStatement('foo.bar', {foo: new DB.Expr("'bar'"), bar: 'foo'}, 'id = ?', 1);

            assert.equal(statement.text, 'UPDATE "foo"."bar" SET "foo" = \'bar\', "bar" = ? WHERE id = ?');
            assert.deepEqual(statement.values, ['foo', 1]);
        });

        it('deleteStatement()', function() {
            var statement = pgsql.deleteStatement('foo.bar', 'id = ?', 1);

            assert.equal(statement.text, 'DELETE FROM "foo"."bar" WHERE id = ?');
            assert.deepEqual(statement.values, [1]);
        });

        describe('Postgresql adapter', function() {
            it('should replace placeholder "?" to "$n"', function() {
                var sql = 'INSERT INTO "foo"."bar" ("id", "foo", "bar") VALUES (?, ?, \'?\')';
                assert.equal(pgsql._replacePlaceholder(sql), 'INSERT INTO "foo"."bar" ("id", "foo", "bar") VALUES ($1, $2, \'?\')');
            });
        });
    });
});
