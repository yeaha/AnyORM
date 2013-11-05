"use strict";

var _ = require('underscore');
var util = require('util');
var Q = require('q');
var Expr = require(__dirname+'/utils').Expr;
var Select = require(__dirname+'/select');
var _driver = {};

var Adapter = module.exports = exports = function(dsn, options) {
    this._dsn = dsn;
    this._options = options;

    var driver = dsn.match(/^(\w+):/)[1];

    if (_driver[driver])
        _.extend(this, _driver[driver]);

    _.each(['exit', 'SIGHUP', 'SIGINT', 'SIGQUIT'], function(event) {
        process.once(event, _.bind(this.disconnect, this));
    }, this);
};

Adapter.prototype.connect = function() {
    return this._pool
        || (this._pool = require('any-db').createPool(this._dsn, this._options));
};

Adapter.prototype.disconnect = function() {
    if (!this._pool) return true;

    this._pool.close();
    delete this._pool;
};

Adapter.prototype.quote = function(value) {
    if (value instanceof Expr)
        return value.toString();

    if (value === null || _.isUndefined(value))
        return 'NULL';

    value = value.replace("'", "\\'");

    return "'"+value+"'";
};

Adapter.prototype.quoteIdentifier = function(identifier) {
    if (identifier instanceof Expr)
        return identifier.toString();

    var symbol = this._identifier_symbol;

    if (identifier.substr(0, 1) === symbol)
        return identifier;

    identifier = identifier.replace(symbol, '').split('.');
    return _.map(identifier, function(s) { return symbol+s+symbol; }).join('.');
};

Adapter.prototype.select = function(table) {
    return new Select(this, table);
};

Adapter.prototype.query = function(sql, values, stream_mode) {
    var callback = stream_mode ? null : function() {};
    var defered = Q.defer();

    if (values === null || _.isUndefined(values))
        values = [];

    this.connect().query(sql, values, callback)
        .on('row', function(row) { defered.notify(row); })
        .on('end', _.bind(defered.resolve, defered))
        .on('error', function(error) {
            error.sql = sql;
            error.values = values;

            defered.reject(error);
        });

    return defered.promise;
};

// returning: 需要返回自增长ID值的字段
Adapter.prototype.insert = function(table, data, returning) {
    var statement = this._insertStatement(table, data);
    var sql = statement['sql'];
    var values = statement['values'];

    if (_.isUndefined(returning)) {
        returning = [];
    } else if (!_.isArray(returning)) {
        returning = [returning];
    }

    var self = this;
    var pool = this.connect();

    return Q.ninvoke(pool, 'acquire').then(function(conn) {
        var _release = pool.release.bind(pool, conn);

        var _done = function() {
            if (!returning.length)
                return true;

            var queue = [];
            _.each(returning, function(column) {
                var sql = self._lastIdStatement(table, column);
                queue.push(Q.ninvoke(conn, 'query', sql));
            });

            return Q.spread(queue, function() {
                var values = _.map(arguments, function(res) {
                    var rows = res.rows;
                    return rows.length ? rows[0]['last_id'] : null;
                });

                return _.object(returning, values);
            });
        };

        return Q.ninvoke(conn, 'query', sql, values)
                .then(_success)
                .finally(_release);
    });
};

Adapter.prototype.update = function(table, data, where, where_values) {
    var sql = 'UPDATE %s SET %s';
    var set = [];
    var values = [];

    _.each(data, function(value, key) {
        var column = this.quoteIdentifier(key);

        if (value instanceof Expr) {
            set.push(util.format('%s = %s', column, value.toString()));
        } else {
            set.push(util.format('%s = ?', column));
            values.push(value);
        }
    }, this);

    sql = util.format(sql, this.quoteIdentifier(table), set.join(','));

    if (where)
        sql += ' WHERE '+ where;

    where_values = (!where || _.isUndefined(where_values))
                 ? []
                 : (_.isArray(where_values) ? where_values : _.values(arguments).slice(3));

    values.push.apply(values, where_values);

    return this.query(sql, values);
};

Adapter.prototype.delete = function(table, where, where_values) {
    var sql = util.format('DELETE FROM %s', this.quoteIdentifier(table));
    var values = (!where || _.isUndefined(where_values))
               ? []
               : (_.isArray(where_values) ? where_values : _.values(arguments).slice(2));

    if (where)
        sql += ' WHERE '+ where;

    return this.query(sql, values);
};

Adapter.prototype._insertStatement = function(table, data) {
    var sql = 'INSERT INTO %s (%s) VALUES (%s)';
    var columns = [];
    var values = [];
    var placeholder = [];

    _.each(data, function(value, key) {
        columns.push(this.quoteIdentifier(key));

        if (value instanceof Expr) {
            placeholder.push(value.toString());
        } else {
            placeholder.push('?');
            values.push(value);
        }
    }, this);

    sql = util.format(sql, this.quoteIdentifier(table), columns.join(','), placeholder.join(','));

    return {
        sql: sql,
        values: values
    };
};

_driver['postgres'] = {
    _identifier_symbol: '"',

    query: function(sql, values, stream_mode) {
        sql = this._replacePlaceholder(sql);

        return Adapter.prototype.query.apply(this, [sql, values, stream_mode]);
    },

    insert: function(table, data, returning) {
        var statement = this._insertStatement(table, data);
        var sql = statement['sql'];
        var values = statement['values'];

        if (_.isUndefined(returning)) {
            returning = [];
        } else if (!_.isArray(returning)) {
            returning = [returning];
        }

        if (returning.length)
            sql += ' RETURNING '
                + _.map(returning, _.bind(this.quoteIdentifier, this)).join(',');

        var promise = this.query(sql, values);
        if (!returning.length)
            return promise;

        return Q.when(promise)
                .then(function(res) {
                    return res.rows[0];
                });
    },

    // 把sql语句内的"?"占位符，替换成$1...$n
    _replacePlaceholder: function(sql) {
        if (sql.indexOf('?') === -1)
            return sql;

        var counter = 1;
        var quote = false;
        var replaced = [];

        for (var c, p, i = 0, len = sql.length; i < len; i++) {
            c = sql[i];

            if (c == "'" && p != '\\')
                quote = !quote;

            if (c == '?' && !quote)
                c = '$'+(counter++);

            replaced.push(c);

            p = c;
        }

        return replaced.join('');
    },

    // 查询字段自增ID值的语句
    _lastIdStatement: function(table, column) {
        if (!table || !column)
            return 'SELECT LASTVAL() AS last_id';

        table = table.replace(this._identifier_symbol, '').split('.');

        var schema = '';
        if (table.length === 2) {
            schema = table[0];
            table = table[1];
        } else {
            table = table[0];
        }

        var sequence = util.format('%s_%s_seq', table, column);
        if (schema)
            sequence = schema+'.'+sequence;

        return util.format("SELECT CURRVAL('%s') AS last_id", this.quoteIdentifier(sequence));
    },
};

_driver['mysql'] = {
    _identifier_symbol: '`',

    _lastIdStatement: function() {
        return 'SELECT last_insert_id() AS last_id';
    }
};

_driver['sqlite3'] = {
    _identifier_symbol: '"',

    _lastIdStatement: function() {
        return 'SELECT last_insert_rowid() AS last_id';
    }
};
