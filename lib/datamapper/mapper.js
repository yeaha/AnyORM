"use strict";

var _ = require('underscore');
var EventEmitter = require('events').EventEmitter;
var Q = require('q');
var Type = require('./type');

exports.define = define;

exports.Mapper = Mapper;

// 定义一个新的mapper
function define(factory) {
    var NewMapper = function() {
        Mapper.apply(this, arguments);
    };

    NewMapper.prototype = Object.create(Mapper.prototype);

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

    if (primary_key.length === 1)
        primary_key = primary_key[0];

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
    return Q.try(_.bind(this.doFind, this, arguments))
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

    return storage;
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
    _.each(record, function(value, key) {
        var column = this.getColumn(key);
        record[key] = Type.get(column['type']).store(value);
    }, this);

    return record;
};

// 把属性值转换为存储记录
Mapper.prototype._propsToRecord = function(props) {
    _.each(props, function(value, key) {
        var column = this.getColumn(key);
        props[name] = Type.get(column['type']).restore(value);
    });

    return props;
};

////////////////////////////////////////////////////////////////////////////////
// database mapper implement

var DBMapper = define({
    doFind: function(id) {},
    doInsert: function(data) {},
    doUpdate: function(data) {},
    doDelete: function(data) {}
});

exports.DBMapper = DBMapper;
