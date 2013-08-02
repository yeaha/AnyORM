"use strict";

var _ = require('underscore');
var Q = require('q');
var util = require('util');
var Expr = require(__dirname+'/utils').Expr;

function Select(adapter, table) {
    this.adapter = adapter;
    this.table = table;

    this._where = [];
    this._group = {};
    this._cols = [];
}

Select.prototype.setColumns = function(cols) {
    cols = _.isUndefined(cols)
         ? []
         : (_.isArray(cols) ? cols : _.values(arguments));

    this._cols = cols;

    return this;
};

Select.prototype.where = function(where, params) {
    params = _.isUndefined(params)
           ? []
           : (_.isArray(params) ? params : _.values(arguments).slice(1));

    this._where.push([where, params]);

    return this;
};

Select.prototype.group = function(column, having, params) {
    params = _.isUndefined(params)
           ? []
           : (_.isArray(params) ? params : _.values(arguments).slice(1));

    this._group = {
        column: column,
        having: having,
        params: params
    };

    return this;
};

Select.prototype.order = function(column) {
    this._order = column;

    return this;
};

Select.prototype.limit = function(count) {
    this._limit = Math.abs(count >> 0);

    return this;
};

Select.prototype.offset = function(count) {
    this._offset = Math.abs(count >> 0);

    return this;
};

Select.prototype.compile = function() {
    var adapter = this.adapter;
    var params = [];
    var sql = 'SELECT ';

    var cols = _.map(this._cols, _.bind(adapter.quoteIdentifier, adapter)).join(',') || '*';
    sql += cols;

    var from = this._compileFrom();
    sql += ' FROM '+ from['table'];
    from['params'].length && params.push.apply(params, from['params']);

    var where = this._compileWhere();
    if (where['exprs']) {
        sql += ' WHERE '+ where['exprs'];
        where['params'].length && params.push.apply(params, where['params']);
    }

    var group = this._compileGroup();
    if (group['exprs']) {
        sql += ' '+ group['exprs'];
        group['params'].length && params.push.apply(params, group['params']);
    }

    if (this._order)
        sql += ' ORDER BY '+ this._order;

    if (this._limit)
        sql += ' LIMIT '+ this._limit;

    if (this._offset)
        sql += ' OFFSET '+ this._offset;

    return {
        sql: sql,
        params: params
    };
};

Select.prototype.setProcessor = function(processor) {
    this._processor = processor;
    return this;
};

Select.prototype.count = function(column, distinct) {
    var expr = new Expr('count(1) AS count');
    if (column) {
        column = this.quoteIdentifier(column);
        expr = distinct
             ? new Expr('count(distinct('+column+')) AS count')
             : new Expr('count('+column+') AS count');
    }

    var cols = this._cols;
    this.setColumns(expr);

    var promise = this.query();
    this._cols = cols;

    return promise.then(function(res) {
        var rows = res.rows;

        return rows.length ? row[0]['count'] : 0;
    });
};

Select.prototype.query = function(stream_mode) {
    var compile = this.compile();
    return this.adapter.query(compile['sql'], compile['params'], stream_mode);
};

Select.prototype.get = function(stream_mode) {
    var processor = this._processor;
    var rows = [];

    return this.query(true)
               .progress(function(row) {
                   if (processor)
                       row = processor(row);

                   if (!stream_mode)
                       rows.push(row);

                   return row;
               })
               .then(function() {
                   return rows;
               });
};

Select.prototype.getOne = function() {
    var limit = this._limit;
    this.limit(1);

    var promise = this.get();
    this._limit = limit;

    return promise
           .then(function(rows) {
               return rows[0];
           });
};

Select.prototype._compileFrom = function() {
    var params = [];
    var table = this.table;

    if (table instanceof Select) {
        var compile = table.compile();
        var name = this.adapter.quoteIdentifier(_.uniqueId('s_'));

        table = util.format('(%s) AS %s', compile['sql'], name);
        params = compile['params'];
    } else if (table instanceof Expr) {
        table = table.toString();
    } else {
        table = this.adapter.quoteIdentifier(table);
    }

    return {
        table: table,
        params: params
    };
};

Select.prototype._compileWhere = function() {
    var exprs = [];
    var params = [];

    _.each(this._where, function(where) {
        exprs.push(where[0]);
        where[1].length && params.push.apply(params, where[1]);
    });

    exprs = exprs.length
          ? '('+ exprs.join(') AND (') +')'
          : '';

    return {
        exprs: exprs,
        params: params
    };
};

Select.prototype._compileGroup = function() {
    var adapter = this.adapter;
    var group = this._group;
    var exprs = '';
    var params = [];

    do {
        if (!group['column'])
            break;

        var columns = _.isArray(group['column'])
                    ? group['column']
                    : [group['column']];

        columns = _.map(columns, _.bind(adapter.quoteIdentifier, adapter));
        exprs = 'GROUP BY '+ columns.join(',');

        if (!group['having'])
            break;

        exprs += ' HAVING '+ group['having'];

        params = group['params'] || [];
    } while (false);

    return {
        exprs: exprs,
        params: params
    };
};

module.exports = exports = Select;
