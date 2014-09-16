'use strict';

var Promise = require('bluebird');
var Stream = require('stream');
var Utils = require(__dirname+'/../utils');
var Expr = Utils.Expr;
var _ = require('underscore');
var format = require('util').format;

var ArraySlice = [].slice;

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

/**
 * @class
 * @see https://github.com/grncdr/node-any-db
 *
 * @param {string} dsn
 * @param {object} options
 */
var Adapter = exports.Adapter = function(dsn, options) {
    this._dsn = dsn;
    this._options = options || {};

    var driver = dsn.match(/^(\w+):/)[1];

    if (_driver[driver]) {
        _.extend(this, _driver[driver]);
    }
};

/**
 * @see https://github.com/coopernurse/node-pool
 *
 * @return {object} Database connection pool
 */
Adapter.prototype.connect = function() {
    return this._adapter
        || (this._adapter = require('any-db').createPool(this._dsn, this._options));
};

/**
 * Disconnect all connection in pool
 *
 * @return {Promise}
 */
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

/**
 * Acquire connection from pool
 *
 * @param {number} priority
 * @return {Promise} Promise of connection
 */
Adapter.prototype.acquire = function(priority) {
    var pool = this.connect();

    return new Promise(function(resolve, reject) {
        pool.acquire(function(error, client) {
            error ? reject(error) : resolve(client);
        }, priority);
    });
};

/**
 * Release connection to pool
 *
 * @param {object} client
 */
Adapter.prototype.release = function(client) {
    if (this._pool) {
        this._pool.release(client);
    }
};

/**
 * quote database identifier string, table name and column name
 *
 * @param {string} identifier
 * @return {string}
 */
Adapter.prototype.quoteIdentifier = function(identifier) {
    if (identifier instanceof Expr) {
        return identifier.toString();
    }

    var symbol = this._identifier_symbol;

    return _.map(identifier.replace(new RegExp(symbol, 'g'), '').split('.'), function(s) {
        return symbol+s.trim()+symbol;
    }).join('.');
};

/**
 * @param {string|Select|Expr} table
 * @return {Select}
 */
Adapter.prototype.select = function(table) {
    return new Select(this, table);
};

/**
 * @example
 * var sql = 'select * from `foobar`';
 * adapter.execute(sql).then(function(result) {
 *     result.rows.forEach(function(row) {
 *         console.log(row);
 *     });
 * });
 *
 * adapter.execute(sql, [], {return_stream: true}).then(function(stream) {
 *     stream.on('data', function(row) {
 *         console.log(row);
 *     });
 * });
 *
 * @param {string} sql
 * @param {...*} [values]
 * @param {object} [options]
 * @param {boolean} [options.return_stream=false]
 * @return {Promise}
 */
Adapter.prototype.execute = function(sql, values, options) {
    values = (values === undefined)
           ? []
           : (_.isArray(values) ? values : [values]);

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

/**
 * @example
 * adapter.insert('foobar', {...});
 *
 * @param {string} table
 * @param {object} data
 * @return {Promise}
 */
Adapter.prototype.insert = function(table, data) {
    var statement = this.insertStatement(table, data);
    return this.execute(statement.text, statement.values);
};

/**
 * @example
 * adapter.update('foobar', {...}, 'id = ?', 123).then(function(count) {
 *     console.log('affected', count)
 * });
 *
 * @param {string} table
 * @param {object} data
 * @param {string} [where]
 * @param {...*} [where_values]
 * @return {Promise}
 */
Adapter.prototype.update = function(table, data, where, where_values) {
    var statement = this.updateStatement.apply(this, arguments);
    return this.execute(statement.text, statement.values).then(function(result) { return result.rowCount; });
};

/**
 * @example
 * adapter.delete('foobar', 'id = ?', 123).then(function(count) {
 *     console.log('affected', count)
 * });
 *
 * @param {string} table
 * @param {string} [where]
 * @param {...*} [where_values]
 * @return {Promise}
 */
Adapter.prototype.delete = function(table, where, where_values) {
    var statement = this.deleteStatement.apply(this, arguments);
    return this.execute(statement.text, statement.values).then(function(result) { return result.rowCount; });
};

/**
 * @param {string} table
 * @param {object} data
 * @return {object} {text: 'INSERT INTO ...', values: [...]}
 */
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
    text = format(text, this.quoteIdentifier(table), columns.join(', '), placeholder.join(', '));

    return {
        text: text,
        values: values
    };
};

/**
 * @param {string} table
 * @param {object} data
 * @param {string} [where]
 * @param {...*} [where_values]
 * @return {object} {text: 'UPDATE ...', values: [...]}
 */
Adapter.prototype.updateStatement = function(table, data, where, where_values) {
    var exprs = [];
    var values = [];

    _.each(data, function(value, key) {
        var column = this.quoteIdentifier(key);

        if (value instanceof Expr) {
            exprs.push(format('%s = %s', column, value.toString()));
        } else {
            exprs.push(format('%s = ?', column));
            values.push(value);
        }
    }.bind(this));

    var sql = format('UPDATE %s SET %s', this.quoteIdentifier(table), exprs.join(', '));
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

/**
 * @param {string} table
 * @param {string} [where]
 * @param {...*} [where_values]
 * @return {object} {text: 'DELETE FROM ...', values: [...]}
 */
Adapter.prototype.deleteStatement = function(table, where, where_values) {
    var values = (!where || where_values === undefined)
               ? []
               : (_.isArray(where_values) ? where_values : ArraySlice.call(arguments, 2));

    var sql = format('DELETE FROM %s', this.quoteIdentifier(table));

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

    /**
     * @example
     * adapter.insert('foo', {...}, ['id', 'create_time']).then(function(row) {
     *     console.log(row.id);
     *     console.log(row.create_time);
     * })
     *
     * @param {string} table
     * @param {object} data
     * @param {...*} [returning] Return column value after insert
     * @return {Promise}
     */
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

    /**
     * @param {string} table
     * @param {object} data
     * @param {...*} returning
     * @return {string}
     */
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

    /**
     * Replace "?" to "$n"
     *
     * @protected
     * @param {string} sql
     * @return {string}
     */
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

    /**
     * @example
     * adapter.insert('foobar', {...}, true).then(function(id) {
     *     console.log('last insert id', id);
     * });
     *
     * adapter.insert('foobar', {...}).then(function(count) {
     *     console.log('affected', count);
     * });
     *
     * @param {string} table
     * @param {object} data
     * @param {boolean} [returning] If true, promise with last insert id
     * @result {Promise}
     */
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

    /**
     * @param {string} table
     * @param {object} data
     * @param {boolean} [returning]
     * @return {Promise}
     */
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

/**
 * @class
 * @param {Adapter} adapter
 * @param {string|Select|Expr} table
 */
var Select = exports.Select = function(adapter, table) {
    this._adapter = adapter;
    this._table = table;

    this.reset();
};

/**
 * Reset all sql clause
 */
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

/**
 * @example
 * select.setColumns('*');
 * select.setColumns('foo', 'bar');
 * select.setColumns(['foo', 'bar']);
 * select.setColumns(new Expr('count(1) as count'));
 *
 * @param {string|array|Expr} columns
 * @return {Select}
 */
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

/**
 * @example
 * // WHERE (foo = ?) AND (bar = ?)
 * select.where('foo = ?', 'foo').where('bar = ?', 'bar');
 *
 * // WHERE (foo = ? and bar = ?)
 * select.where('foo = ? and bar = ?', 'foo', 'bar');
 *
 * // WHERE (foo = ? or bar = ?) AND (baz = ?)
 * select.where('foo = ? or bar = ?', 'foo', 'bar').where('baz = ?', 'baz');
 *
 * @param {string} where
 * @param {...*} values
 * @return {Select}
 */
Select.prototype.where = function(where, values) {
    values = (values === undefined)
           ? []
           : (_.isArray(values) ? values : ArraySlice.call(arguments, 1));

    this._clause.where.push([where, values]);

    return this;
};

/**
 * @example
 * // WHERE `id` IN (?, ?, ?)
 * select.whereIn('id', [1, 2, 3]);
 *
 * // SELECT * FROM `foo` WHERE `id` IN (SELECT `foo_id` FROM `bar`)
 * var foo = adapter.select('foo');
 * var bar = adapter.select('bar');
 * foo.whereIn('id', bar.setColumns('foo_id'));
 *
 * @param {string} column
 * @param {array|Select} relation
 * @return {Select}
 */
Select.prototype.whereIn = function(column, relation) {
    this._whereInclude(column, relation, true);
    return this;
};

/**
 * @example
 * // WHERE `id` NOT IN (?, ?, ?)
 * select.whereNotIn('id', [1, 2, 3]);
 *
 * // SELECT * FROM `foo` WHERE `id` NOT IN (SELECT `foo_id` FROM `bar`)
 * var foo = adapter.select('foo');
 * var bar = adapter.select('bar');
 * foo.whereNotIn('id', bar.setColumns('foo_id'));
 *
 * @param {string} column
 * @param {array|Select} relation
 * @return {Select}
 */
Select.prototype.whereNotIn = function(column, relation) {
    this._whereInclude(column, relation, true);
    return this;
};

/**
 * @example
 * // GROUP BY `foo` HAVING count(1) > ?
 * select.group('foo', 'count(1) > ?', 1);
 *
 * // GROUP BY `foo`, `bar`
 * select.group(['foo', 'bar']);
 *
 * @param {string|array} columns
 * @param {string} [having]
 * @param {...*} [values]
 * @return {Select}
 */
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

/**
 * @example
 * // ORDER BY `foo`
 * select.order('foo')
 *
 * // WRONG!!!
 * // ORDER BY `foo desc`
 * select.order('foo desc')
 *
 * // ORDER BY `bar` DESC
 * select.order({bar: 'desc'})
 *
 * // ORDER BY `foo`, `bar` DESC
 * select.order('foo', {bar: 'desc'})
 *
 * // ORDER BY `foo`, `bar` DESC, baz asc
 * select.order('foo', {bar: 'desc'}, new Expr('baz asc'))
 *
 * @param {string|object} expression
 * @return {Select}
 */
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

/**
 * @param {number} count
 * @return {Select}
 */
Select.prototype.limit = function(count) {
    count = Math.abs(count >> 0);

    this._clause.limit = count;
    return this;
};

/**
 * @param {number} count
 * @return {Select}
 */
Select.prototype.offset = function(count) {
    count = Math.abs(count >> 0);

    this._clause.offset = count;
    return this;
};

/**
 * @return {object} {text: '...', values: [...]}
 */
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

/**
 * @example
 * select.setProcessor(function(row) {
 *     row._id = _.('r_');
 *     return row;
 * });
 *
 * select.get().then(function(rows) {
 *     rows.forEach(function(row) {
 *         console.log(row._id);
 *     });
 * });
 *
 * select.get({return_stream}).then(function(stream) {
 *     stream.on('data', function(row) {
 *         console.log(row._id);
 *     });
 * });
 *
 * @param {function} processor
 * @return {Select}
 */
Select.prototype.setProcessor = function(processor) {
    this._processor = processor;
    return this;
};

/**
 * @see Adapter.execute
 * @param {object} [options]
 * @return {Promise}
 */
Select.prototype.execute = function(options) {
    var query = this.compile();
    return this._adapter.execute(query.text, query.values, options);
};

/**
 * @example
 * select.get().then(function(rows) {
 *     rows.forEach(function(row) {
 *         console.log(row);
 *     });
 * });
 *
 * select.get({return_stream: true}).then(function(stream) {
 *     stream.on('data', function(row) {
 *         console.log(row);
 *     });
 * });
 *
 * @param {object} [options]
 * @return {Promise}
 */
Select.prototype.get = function(options) {
    var processor = this._processor;

    return this.execute(options).then(function(result) {
        var is_stream = (result instanceof Stream);

        if (!processor) {
            return is_stream ? result : result.rows;
        }

        if (!is_stream) {
            return _.map(result.rows, processor);
        }

        var transform = new Utils.TransformStream(function(row, encoding, done) {
            try {
                row = processor(row);
            } catch (error) {
                this.emit('error', error);
                return;
            }

            this.push(row);
            done();
        }, {objectMode: true});

        return result.pipe(transform);
    });
};

/**
 * @example
 * select.getOne().then(function(row) {
 *     console.log(row);
 * });
 *
 * @return {Promise}
 */
Select.prototype.getOne = function() {
    var limit = this._clause.limit;
    this.limit(1);

    var promise = this.get();
    this.limit(limit);

    return promise.then(function(rows) { return rows[0]; });
};

/**
 * @param {number} current
 * @param {number} size
 * @param {object} [options]
 * @return {Promise}
 */
Select.prototype.getPage = function(current, size, options) {
    var limit = this._clause.limit;
    var offset = this._clause.offset;

    var promise = this.limit(size).offset((current - 1) * size).get(options);

    this.limit(limit).offset(offset);

    return promise;
};

/**
 * @param {number} current
 * @param {number} size
 * @param {number} [total]
 * @return {Promise}
 */
Select.prototype.getPageInfo = function(current, size, total) {
    function _pages(current, size, total) {
        var page_count = Math.ceil(total / size) || 1;

        if (current > page_count) {
            current = page_count;
        } else if (current < 1) {
            current = 1;
        }

        var info = {
            items: total,
            size: size,
            from: 0,
            to: 0,
            first: 1,
            previous: null,
            current: current,
            next: null,
            last: page_count
        };

        if (info.current > info.first) {
            info.previous = info.current - 1;
        }

        if (info.current < info.last) {
            info.next = info.current + 1;
        }

        if (info.items) {
            info.from = (info.current - 1) * size + 1;
            info.to = (info.current == info.last)
                     ? info.items
                     : info.current * size;
        }

        return info;
    }

    var promise = total ? Promise.resolve(total) : this.count();

    return promise.then(function(total) {
        return _pages(current, size, total);
    });
};

/**
 * @return {Promise}
 */
Select.prototype.count = function() {
    var columns = this._clause.columns;

    var promise = this.setColumns(new Expr('count(1) as count')).execute();

    this._clause.columns = columns;

    return promise.then(function(res) {
        return res.rows[0]['count'];
    });
};

/**
 * @protected
 * @param {string} column
 * @param {array|Select} relation
 * @param {boolean} include
 * @return {Select}
 */
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
             ? format('%s IN (%s)', column, text)
             : format('%s NOT IN (%s)', column, text);

    this._clause.where.push([expr, values]);
    return this;
};

/**
 * @protected
 * @return {object} {text: '...', values: [...]}
 */
Select.prototype._compileFrom = function() {
    var text, values = [];
    var relation = this._table;

    if (relation instanceof Select) {
        var query = relation.compile();
        var name = this._adapter.quoteIdentifier(_.uniqueId('t_'));

        text = format('(%s) AS %s', query.text, name);
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

/**
 * @protected
 * @return {object} {text: '...', values: [...]}
 */
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

/**
 * @protected
 * @return {object} {text: '...', values: [...]}
 */
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
