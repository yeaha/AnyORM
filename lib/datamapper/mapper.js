"use strict";

var _ = require('underscore');
var EventEmitter = require('events').EventEmitter;
var Q = require('q');
var Type = require(__dirname+'/type');
var Services = require(__dirname+'/../service/manager');

exports.define = define;

exports.Mapper = Mapper;

// 定义一个新的mapper
function define(factory) {
    var NewMapper = function() {
        Mapper.apply(this, arguments);
    };

    NewMapper.prototype = Object.create(Mapper.prototype);
    NewMapper.prototype.constructor = NewMapper;

    _.extend(NewMapper.prototype, factory);

    return NewMapper;
};

_.extend(Mapper.prototype, EventEmitter.prototype);
function Mapper(options) {
    EventEmitter.call(this);

    var columns;
    var primary_key = [];

    options = _.extend({
        storage: null,
        collection: null,
        columns: {},
        readonly: false
    }, options);

    columns = options.columns;
    _.each(columns, function(config, name) {
        config = _.extend({
            type: null,
            primary_key: false,
            auto_increase: false,
            refuse_update: false,
            allow_null: false,
            default: null,
            pattern: null,
            strict: false
        }, config);

        if (config['primary_key']) {
            primary_key.push(name);

            config['refuse_update'] = true;
            config['allow_null'] = false;
        }

        columns[name] = config;
    });

    if (!primary_key.length)
        throw new Error('Undefined primary key!');

    options.primary_key = primary_key;

    this._options = options;
}

Mapper.prototype.doFind = function(id) {
    throw new Error('Method not implemented!');
};

Mapper.prototype.doInsert = function(data) {
    throw new Error('Method not implemented!');
};

Mapper.prototype.doUpdate = function(data) {
    throw new Error('Method not implemented!');
};

Mapper.prototype.doDelete = function(data) {
    throw new Error('Method not implemented!');
};

Mapper.prototype.getOption = function(key) {
    var options = this._options;
    if (!key) return options;

    return (key in options) ? options[key] : false;
};

// 把存储记录包装或更新data实例
Mapper.prototype.pack = function(record, data) {
    var props = this._recordToProps(record);
    data = data || new (this.getOption('constructor'));

    data._data = _.extend(data._data, props);
    data._dirty = {};
    data._fresh = false;

    return data;
};

// return promise
Mapper.prototype.find = function(id) {
    return Q.try(_.bind(this.doFind, this, id))
            .then(function(record) {
                if (!record)
                    return false;

                var data = this.pack(record);
                this.emit('found', data);

                return data;
            }.bind(this));
};

// return promise
Mapper.prototype.save = function(data) {
    if (this.isReadonly())
        return Q.reject(new Error('Mapper is readonly'));

    var save;
    var is_fresh = data.isFresh();

    if (!is_fresh && !data.isDirty())
        return Q(true);

    this.emit('save:before', data);

    save = is_fresh
         ? _.bind(this._insert, this, data)
         : _.bind(this._update, this, data);

    return save()
            .then(function() {
                this.emit('save:after', data);
            }.bind(this));
};

// return promise
Mapper.prototype.destroy = function(data) {
    if (this.isReadonly())
        return Q.reject(new Error('Mapper is readonly'));

    if (data.isFresh())
        return Q(true);

    this.emit('delete:before', data);

    return Q.try(_.bind(this.doDelete, this, data))
                .then(function() {
                    this.emit('delete:after', data);
                }.bind(this));
};

Mapper.prototype.getStorage = function() {
    var storage = this.getOption('storage');

    if (!storage)
        throw new Error('Undefined data storage');

    return Services.get(storage);
};

Mapper.prototype.getCollection = function() {
    var collection = this.getOption('collection');

    if (!collection)
        throw new Error('Undefined data collection');

    return collection;
};

Mapper.prototype.getPrimaryKey = function() {
    return this.getOption('primary_key');
};

Mapper.prototype.getColumn = function(name) {
    var columns = this.getOption('columns');

    if (!name) return columns;

    return (name in columns)
         ? columns[name]
         : false;
};

Mapper.prototype.getColumnDefaultValue = function(name) {
    var config = this.getColumn(name);

    return Type.get(config['type']).getDefaultValue(config);
};

Mapper.prototype.isReadonly = function() {
    return this.getOption('readonly');
};

// return promise
Mapper.prototype._insert = function(data) {
    this.emit('insert:before', data);

    return Q.try(_.bind(this.doUpdate, this, data))
                .then(function(id) {
                    if (!_.isObject(id))
                        id = {};

                    this.pack(id, data);
                    this.emit('insert:after', data);
                });
};

// return promise
Mapper.prototype._update = function(data) {
    this.emit('update:before', data);

    return Q.try(_.bind(this.doUpdate, this, data))
                .then(function() {
                    this.pack({}, data);
                    this.emit('update:after', data);
                }.bind(this));
};

// 把存储记录转换为属性值
Mapper.prototype._recordToProps = function(record) {
    var props = {};

    _.each(record, function(value, key) {
        var column = this.getColumn(key);
        props[key] = Type.get(column['type']).restore(value);
    }, this);

    return props;
};

// 把属性值转换为存储记录
Mapper.prototype._propsToRecord = function(props) {
    var record = {};

    _.each(props, function(value, key) {
        var column = this.getColumn(key);
        record[name] = Type.get(column['type']).store(value);
    }, this);

    return record;
};

////////////////////////////////////////////////////////////////////////////////
// database mapper implement

var DBMapper = define({
    select: function() {
        var select = this.getStorage().select(this.getCollection());

        select.setProcessor(function(record) {
            return record ? this.pack(record) : false;
        }.bind(this));

        return select;
    },
    doFind: function(id) {
        var select = this.getStorage().select(this.getCollection());
        var where = this.whereId(id);
        var columns = _.keys(this.getColumn());

        return select
                .setColumns(columns)
                .where(where['expr'], where['params'])
                .getOne();
    },
    doInsert: function(data) {
        var db = this.getStorage();
        var table = this.getCollection();
        var record = this._propsToRecord(data.getProps());

        var returning = [];
        _.each(this.getPrimaryKey(), function(key) {
            var column = this.getColumn(key);

            if (column['auto_increase'])
                returning.push(key);
        }.bind(this));

        return db.insert(table, record, returning);
    },
    doUpdate: function(data) {
        var db = this.getStorage();
        var table = this.getCollection();
        var record = this._propsToRecord(data.getProps(true));
        var where = this.whereId(data.id());

        return db.update(table, record, where['expr'], where['params']);
    },
    doDelete: function(data) {
        var db = this.getStorage();
        var table = this.getCollection();
        var where = this.whereId(data.id());

        return db.delete(table, where['expr'], where['params']);
    },
    whereId: function(id) {
        var db = this.getStorage();
        var where = [];
        var params = [];
        var keys = this.getPrimaryKey();

        if (keys.length === 1 && !_.isObject(id)) {
            var oid = {};
            oid[keys[0]] = id;

            id = oid;
        }

        _.each(keys, function(column) {
            where.push(db.quoteIdentifier(column) +' = ?');

            params.push(id[column]);
        });

        return {
            expr: where.join(' AND '),
            params: params
        };
    }
});

exports.DBMapper = DBMapper;
