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

Select.prototype.where = function(where, values) {
    values = _.isUndefined(values)
           ? []
           : (_.isArray(values) ? values : _.values(arguments).slice(1));

    this._where.push([where, values]);

    return this;
};

Select.prototype.whereIn = function(column, relation) {
    return this._whereIncludes(column, relation, true);
};

Select.prototype.whereNotIn = function(column, relation) {
    return this._whereIncludes(column, relation, false);
};

Select.prototype.group = function(column, having, values) {
    values = _.isUndefined(values)
           ? []
           : (_.isArray(values) ? values : _.values(arguments).slice(1));

    this._group = {
        column: column,
        having: having,
        values: values
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
    var values = [];
    var text = 'SELECT ';

    var cols = _.map(this._cols, _.bind(adapter.quoteIdentifier, adapter)).join(',') || '*';
    text += cols;

    var from = this._compileFrom();
    text += ' FROM '+ from['table'];
    from['values'].length && values.push.apply(values, from['values']);

    var where = this._compileWhere();
    if (where['exprs']) {
        text += ' WHERE '+ where['exprs'];
        where['values'].length && values.push.apply(values, where['values']);
    }

    var group = this._compileGroup();
    if (group['exprs']) {
        text += ' '+ group['exprs'];
        group['values'].length && values.push.apply(values, group['values']);
    }

    if (this._order)
        text += ' ORDER BY '+ this._order;

    if (this._limit)
        text += ' LIMIT '+ this._limit;

    if (this._offset)
        text += ' OFFSET '+ this._offset;

    return {
        text: text,
        values: values
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
    return this.adapter.query(compile['text'], compile['values'], stream_mode);
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

Select.prototype._whereIncludes = function(column, relation, include) {
    var query = [], values = [];

    column = this.adapter.quoteIdentifier(column);

    if (relation instanceof Select) {
        var compile = relation.compile();

        query = compile['text'];
        values = compile['values'];
    } else if (_.isArray(relation)) {
        _.each(relation, function(value) {
            query.push('?');
            values.push(value);
        });

        query = query.join(',');
    } else {
        throw new Error('Invalid relation');
    }

    var expr = include
             ? util.format('%s IN (%s)', column, query)
             : util.format('%s NOT IN (%s)', column, query);

    this._where.push([expr, values]);

    return this;
};

Select.prototype._compileFrom = function() {
    var values = [];
    var table = this.table;

    if (table instanceof Select) {
        var compile = table.compile();
        var name = this.adapter.quoteIdentifier(_.uniqueId('s_'));

        table = util.format('(%s) AS %s', compile['text'], name);
        values = compile['values'];
    } else if (table instanceof Expr) {
        table = table.toString();
    } else {
        table = this.adapter.quoteIdentifier(table);
    }

    return {
        table: table,
        values: values
    };
};

Select.prototype._compileWhere = function() {
    var exprs = [];
    var values = [];

    _.each(this._where, function(where) {
        exprs.push(where[0]);
        where[1].length && values.push.apply(values, where[1]);
    });

    exprs = exprs.length
          ? '('+ exprs.join(') AND (') +')'
          : '';

    return {
        exprs: exprs,
        values: values
    };
};

Select.prototype._compileGroup = function() {
    var adapter = this.adapter;
    var group = this._group;
    var exprs = '';
    var values = [];

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

        values = group['values'] || [];
    } while (false);

    return {
        exprs: exprs,
        values: values
    };
};

module.exports = exports = Select;
