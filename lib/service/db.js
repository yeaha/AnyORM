'use strict';

var Promise = require('bluebird');
var Stream = require('stream');
var _ = require('underscore');
var util = require('util');

var ArraySlice = [].slice;

var Expr = exports.Expr = function(expr) {
    if (expr instanceof Expr) {
        expr = expr.toString();
    }

    this.expr = expr;
};

Expr.prototype.toString = function() {
    return this.expr;
};

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

var Adapter = exports.Adapter = function(dsn, options) {
    this._dsn = dsn;
    this._options = options || {};

    var driver = dsn.match(/^(\w+):/)[1];

    if (_driver[driver]) {
        _.extend(this, _driver[driver]);
    }
};

Adapter.prototype.connect = function() {
    return this._adapter
        || (this._adapter = require('any-db').createPool(this._dsn, this._options));
};

Adapter.prototype.disconnect = function() {
    if (!this._adapter) {
        return Promise.resolve();
    }

    var adapter = this._adapter;
    var self = this;

    return new Promise(function(resolve) {
        adapter.close(function() {
            self._adapter = null;

            resolve();
        });
    });
};

Adapter.prototype.acquire = function(priority) {
    var pool = this.connect();

    return new Promise(function(resolve, reject) {
        pool.acquire(function(error, client) {
            error ? reject(error) : resolve(client);
        }, priority);
    });
};

Adapter.prototype.release = function(client) {
    if (this._pool) {
        this._pool.release(client);
    }
};

Adapter.prototype.quoteIdentifier = function(identifier) {
    if (identifier instanceof Expr) {
        return identifier.toString();
    }

    var symbol = this._identifier_symbol;

    if (identifier.substr(0, 1) === symbol) {
        return identifier;
    }

    return _.map(identifier.replace(new RegExp(symbol, 'g'), '').split('.'), function(s) {
        return symbol+s+symbol;
    }).join('.');
};

Adapter.prototype.select = function(table) {
    return new Select(this, table);
};

Adapter.prototype.execute = function(sql, values, options) {
    values = (values === undefined)
           ? []
           : (_.isArray(values) ? values : ArraySlice.call(arguments, 1));

    options = _.defaults(options || {}, {
        return_stream: false
    });

    var adapter = this.connect();

    if (options.return_stream) {
        return Promise.resolve(adapter.query(sql, values));
    }

    return new Promise(function(resolve, reject) {
        adapter.query(sql, values, function(error, result) {
            error ? reject(error) : resolve(result);
        });
    });
};

Adapter.prototype.insert = function(table, data) {
    var statement = this.insertStatement(table, data);
    return this.execute(statement.text, statement.values);
};

Adapter.prototype.update = function(table, data, where, where_values) {
    var statement = this.updateStatement.apply(this, arguments);
    return this.execute(statement.text, statement.values).then(function(result) { return result.rowCount; });
};

Adapter.prototype.delete = function(table, where, where_values) {
    var statement = this.deleteStatement.apply(this, arguments);
    return this.execute(statement.text, statement.values).then(function(result) { return result.rowCount; });
};

Adapter.prototype.insertStatement = function(table, data) {
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
    }.bind(this));

    var text = 'INSERT INTO %s (%s) VALUES (%s)';
    text = util.format(text, this.quoteIdentifier(table), columns.join(', '), placeholder.join(', '));

    return {
        text: text,
        values: values
    };
};

Adapter.prototype.updateStatement = function(table, data, where, where_values) {
    var exprs = [];
    var values = [];

    _.each(data, function(value, key) {
        var column = this.quoteIdentifier(key);

        if (value instanceof Expr) {
            exprs.push(util.format('%s = %s', column, value.toString()));
        } else {
            exprs.push(util.format('%s = ?', column));
            values.push(value);
        }
    }.bind(this));

    var sql = util.format('UPDATE %s SET %s', this.quoteIdentifier(table), exprs.join(', '));
    if (where) {
        sql += ' WHERE '+where;
    }

    where_values = (!where || where_values === undefined)
                 ? []
                 : (_.isArray(where_values) ? where_values : ArraySlice.call(arguments, 3));

    if (where_values.length) {
        values.push.apply(values, where_values);
    }

    return {text: sql, values: values};
};

Adapter.prototype.deleteStatement = function(table, where, where_values) {
    var values = (!where || where_values === undefined)
               ? []
               : (_.isArray(where_values) ? where_values : ArraySlice.call(arguments, 2));

    var sql = util.format('DELETE FROM %s', this.quoteIdentifier(table));

    if (where) {
        sql += ' WHERE '+where;
    }

    return {text: sql, values: values};
};

var _driver = {};

_driver['postgres'] = {
    _identifier_symbol: '"',

    execute: function(sql, values, options) {
        sql = this._replacePlaceholder(sql);
        return Adapter.prototype.execute.call(this, sql, values, options);
    },

    insert: function(table, data, returning) {
        returning = (returning === undefined)
                  ? []
                  : (_.isArray(returning) ? returning : [returning]);

        if (!returning.length) {
            return Adapter.prototype.insert.call(this, table, data);
        }

        var statement = this.insertStatement(table, data, returning);
        var sql = statement.text;
        var values = statement.values;

        return this.execute(sql, values).then(function(result) {
            return result.rows[0];
        });
    },

    insertStatement: function(table, data, returning) {
        returning = (returning === undefined)
                  ? []
                  : (_.isArray(returning) ? returning : [returning]);

        var statement = Adapter.prototype.insertStatement.call(this, table, data);
        if (!returning.length) {
            return statement;
        }

        var sql = statement.text;
        returning = (returning[0] == '*')
                  ? '*'
                  : _.map(returning, this.quoteIdentifier.bind(this)).join(', ');

        sql += ' RETURNING '+ returning;

        return {text: sql, values: statement.values};
    },

    // 'foo = ? and bar = ?' -> 'foo = $1 and bar = $2'
    _replacePlaceholder: function(sql) {
        if (sql.indexOf('?') === -1) {
            return sql;
        }

        var counter = 1;
        var quote = false;
        var backslash_repeat = 0;
        var result = '';

        for (var c, p, i = 0, len = sql.length; i < len; i++) {
            c = sql[i];

            if (c === '\\') {
                if (p === '\\') {
                    backslash_repeat += 1;
                } else {
                    backslash_repeat = 1;
                }
            } else if (c === "'" && (p !== '\\' || backslash_repeat % 2 === 0)) {
                quote = !quote;
            } else if (c === '?' && !quote) {
                c = '$'+(counter++);
            }

            result += c;

            p = c;
        }

        return result;
    }
};

_driver['mysql'] = {
    _identifier_symbol: '`',

    insert: function(table, data, returning) {
        var promise = Adapter.prototype.insert.call(table, data, returning);

        if (returning) {
            return promise.then(function(result) {
                return result.insertId;
            });
        }

        return promise;
    }
};

_driver['sqlite3'] = {
    _identifier_symbol: '"',

    insert: function(table, data, returning) {
        if (!returning) {
            return Adapter.prototype.insert.call(this, table, data);
        }

        var self = this;
        var query = this.insertStatement(table, data);

        return this.acquire().then(function(conn) {
            return new Promise(function(resolve, reject) {
                conn.query(query.text, query.values, function(error, result) {
                    if (error) {
                        self.release(conn);
                        reject(error);
                        return;
                    }

                    conn.query('SELECT last_insert_rowid() AS last_id', function(error, result) {
                        self.release(conn);

                        if (error) {
                            reject(error);
                            return;
                        }

                        resolve(result.rows[0]['last_id']);
                    });
                });
            });
        });
    }
};

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

var Select = exports.Select = function(adapter, table) {
    this._adapter = adapter;
    this._table = table;

    this.reset();
};

Select.prototype.reset = function() {
    this._clause = {
        columns: [],
        where: [],
        group: {},
        order: [],
        limit: 0,
        offset: 0
    };

    return this;
};

Select.prototype.setColumns = function(columns) {
    if (columns !== undefined) {
        if (columns == '*') {
            this._clause.columns = [];
        } else {
            this._clause.columns = _.isArray(columns) ? columns : ArraySlice.call(arguments);
        }
    }

    return this;
};

Select.prototype.where = function(where, values) {
    values = (values === undefined)
           ? []
           : (_.isArray(values) ? values : ArraySlice.call(arguments, 1));

    this._clause.where.push([where, values]);

    return this;
};

Select.prototype.whereIn = function(column, relation) {
    this._whereInclude(column, relation, true);
    return this;
};

Select.prototype.whereNotIn = function(column, relation) {
    this._whereInclude(column, relation, true);
    return this;
};

Select.prototype.group = function(columns, having, values) {
    columns = _.isArray(columns) ? columns : [columns];

    values = (values === undefined)
           ? []
           : (_.isArray(values) ? values : ArraySlice.call(arguments, 2));

    this._clause.group = {
        columns: columns,
        having: having,
        values: values
    };

    return this;
};

// select.order('foo')
//     => ORDER BY `foo`
//
// select.order('foo desc') // WRONG!!!
//     => ORDER BY `foo desc`
//
// select.order({bar: 'desc'})
//     => ORDER BY `bar` DESC
//
// select.order('foo', {bar: 'desc'})
//     => ORDER BY `foo`, `bar` DESC
//
// select.order('foo', {bar: 'desc'}, new Expr('baz asc'))
//     => order by `foo`, `bar` DESC, baz asc
Select.prototype.order = function(expression) {
    var args = _.isArray(expression) ? expression : ArraySlice.call(arguments);
    var adapter = this._adapter;

    var order_by = [];

    _.each(args, function(expression) {
        if (expression instanceof Expr) {
            order_by.push(expression.toString());
        } else if (_.isString(expression)) {
            order_by.push(adapter.quoteIdentifier(expression));
        } else if (_.isObject(expression)) {
            _.each(expression, function(sort, column) {
                column = adapter.quoteIdentifier(column);
                sort = (sort.toUpperCase() == 'DESC') ? 'DESC' : '';

                order_by.push(sort ? (column+' '+sort) : column);
            });
        } else {
            throw new Error('Invalid "ORDER BY" expression');
        }
    });

    this._clause.order = order_by;

    return this;
};

Select.prototype.limit = function(count) {
    count = Math.abs(count >> 0);

    this._clause.limit = count;
    return this;
};

Select.prototype.offset = function(count) {
    count = Math.abs(count >> 0);

    this._clause.offset = count;
    return this;
};

Select.prototype.compile = function() {
    var adapter = this._adapter;
    var text = 'SELECT ';
    var values = [];

    var columns = _.map(this._clause.columns, adapter.quoteIdentifier.bind(adapter)).join(', ') || '*';
    text += columns;

    var from = this._compileFrom();
    text += ' FROM '+ from.text;
    if (from.values.length) {
        values.push.apply(values, from.values);
    }

    var where = this._compileWhere();
    if (where.text) {
        text += ' WHERE '+ where.text;

        if (where.values.length) {
            values.push.apply(values, where.values);
        }
    }

    var group = this._compileGroup();
    if (group.text) {
        text += ' '+group.text;

        if (group.values.length) {
            values.push.apply(values, group.values);
        }
    }

    if (this._clause.order.length) {
        text += ' ORDER BY '+(this._clause.order.join(', '));
    }

    if (this._clause.limit) {
        text += ' LIMIT '+this._clause.limit;
    }

    if (this._clause.offset) {
        text += ' OFFSET '+this._clause.offset;
    }

    return {
        text: text,
        values: values
    };
};

Select.prototype.setProcessor = function(processor) {
    this._processor = processor;
    return this;
};

Select.prototype.execute = function(options) {
    var query = this.compile();
    return this._adapter.execute(query.text, query.values, options);
};

Select.prototype.get = function(options) {
    var processor = this._processor;

    return this.execute(options).then(function(result) {
        var is_stream = (result instanceof Stream);

        if (!processor) {
            return is_stream ? result : result.rows;
        }

        if (is_stream) {
            return result.pipe(new ProcessorStream(processor));
        } else {
            return _.map(result.rows, processor);
        }
    });
};

Select.prototype.getOne = function() {
    var limit = this._clause.limit;
    this.limit(1);

    var promise = this.get();
    this.limit(limit);

    return promise.then(function(rows) { return rows[0]; });
};

Select.prototype._whereInclude = function(column, relation, include) {
    var text = [];
    var values = [];

    column = this._adapter.quoteIdentifier(column);

    if (relation instanceof Select) {
        var query = relation.compile();

        text = query.text;
        values = query.values;
    } else if (_.isArray(relation)) {
        _.each(relation, function(value) {
            text.push('?');
            values.push(value);
        });

        text = text.join(', ');
    } else {
        throw new Error('Invalid relation');
    }

    var expr = include
             ? util.format('%s IN (%s)', column, text)
             : util.format('%s NOT IN (%s)', column, text);

    this._clause.where.push([expr, values]);
    return this;
};

Select.prototype._compileFrom = function() {
    var text, values = [];
    var relation = this._table;

    if (relation instanceof Select) {
        var query = relation.compile();
        var name = this._adapter.quoteIdentifier(_.uniqueId('t_'));

        text = util.format('(%s) AS %s', query.text, name);
        values = query.values;
    } else if (relation instanceof Expr) {
        text = relation.toString();
    } else {
        text = this._adapter.quoteIdentifier(relation);
    }

    return {
        text: text,
        values: values
    };
};

Select.prototype._compileWhere = function() {
    var text = [];
    var values = [];

    _.each(this._clause.where, function(where) {
        text.push(where[0]);

        if (where[1].length) {
            values.push.apply(values, where[1]);
        }
    });

    text = text.length
          ? '('+ text.join(') AND (') +')'
         : '';

    return {
        text: text,
        values: values
    }
};

Select.prototype._compileGroup = function() {
    var adapter = this._adapter;
    var expression = this._clause.group;
    var text = '';
    var values = [];

    do {
        if (!expression.columns || !expression.columns.length) {
            break;
        }

        var columns = _.map(expression.columns, adapter.quoteIdentifier.bind(adapter)).join(', ');
        text = 'GROUP BY '+ columns;

        if (!expression.having) {
            break;
        }

        text += ' HAVING '+ expression.having;

        values = expression.values;
    } while (false);

    return {
        text: text,
        values: values
    }
};

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

util.inherits(ProcessorStream, Stream.Transform);
function ProcessorStream(processor) {
    Stream.Transform.call(this, {
        objectMode: true
    });

    this._processor = processor;
}

ProcessorStream.prototype._transform = function(row, encoding, done) {
    try {
        row = this._processor(row);
    } catch (error) {
        this.emit('error', error);
        return;
    }

    this.push(row);
    done();
};
