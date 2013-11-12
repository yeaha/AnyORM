"use strict";

var _ = require('underscore');
var EventEmitter = require('events').EventEmitter;
var Q = require('q');
var Type = require(__dirname+'/type');
var Services = require(__dirname+'/service/manager');

// 定义一个新的mapper
var define = exports.define = function(factory, base) {
    base = base || Mapper;

    var NewMapper = function() {
        base.apply(this, arguments);
    };

    NewMapper.prototype = Object.create(base.prototype);
    NewMapper.prototype.constructor = NewMapper;

    _.extend(NewMapper.prototype, factory);

    return NewMapper;
};

var Mapper = exports.Mapper = function(options) {
    EventEmitter.call(this);

    var properties;
    var primary_key = [];

    _.defaults(options, {
        storage: null,
        collection: null,
        properties: {},
        readonly: false,
        strict: false,
    });

    properties = options.properties;
    _.each(properties, function(config, key) {
        _.defaults(config, {
            type: null,
            primary_key: false,
            auto_increase: false,
            refuse_update: false,
            allow_null: false,
            default: null,
            pattern: null,
            strict: options.strict,
        });

        if (config['primary_key']) {
            primary_key.push(key);

            config['refuse_update'] = true;
            config['allow_null'] = false;
        }

        properties[key] = config;
    });

    if (!primary_key.length)
        throw new Error('Mapper: undefined primary key!');

    options.primary_key = primary_key;

    this._options = options;

    this.on('save:before', function(data) { data.__before_save(); })
        .on('save:after', function(data) { data.__after_save(); })
        .on('insert:before', function(data) { data.__before_insert(); })
        .on('insert:after', function(data) { data.__after_insert(); })
        .on('update:before', function(data) { data.__before_update(); })
        .on('update:after', function(data) { data.__after_update(); })
        .on('delete:before', function(data) { data.__before_delete(); })
        .on('delete:after', function(data) { data.__after_delete(); });

    this.__initialize();
};
_.extend(Mapper.prototype, EventEmitter.prototype);

Mapper.prototype.__initialize = function() {};

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

Mapper.prototype.getOption = function(key, throw_error) {
    var options = this._options;

    if (!key)
        return options;

    if (key in options)
        return options[key];

    if (throw_error)
        throw new Error('Mapper: undefined option "'+key+'"');

    return false;
};

Mapper.prototype.getStorage = function() {
    var storage = this.getOption('storage', true);
    return Services.get(storage);
};

Mapper.prototype.getCollection = function() {
    return this.getOption('collection', true);
};

Mapper.prototype.getPrimaryKey = function() {
    return this.getOption('primary_key');
};

Mapper.prototype.getProperty = function(key) {
    var properties = this.getOption('properties');

    if (!key) return properties;

    return (key in properties)
         ? properties[key]
         : false;
};

Mapper.prototype.getPropertyDefaultValue = function(key, config) {
    var config = config || this.getProperty(key);

    return Type.get(config['type']).getDefaultValue(config);
};

Mapper.prototype.hasProperty = function(key) {
    return (key in this.getOption('properties'));
};

Mapper.prototype.isReadonly = function() {
    return this.getOption('readonly');
};

// 把存储记录包装或更新data实例
Mapper.prototype.pack = function(record, data) {
    data = data || new (this.getOption('constructor'));

    data._data = _.extend(data._data, this._recordToProps(record));
    data._dirty = {};
    data._fresh = false;

    return data;
};

// return promise
Mapper.prototype.find = function(id) {
    return this._find(id);
};

// return promise
Mapper.prototype.refresh = function(data) {
    return this._find(data.getId(), data);
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

// return promise
Mapper.prototype._find = function(id, data) {
    return Q.try(_.bind(this.doFind, this, id))
            .then(function(record) {
                if (!record)
                    return false;

                data = this.pack(record, data);
                this.emit('found', data);

                return data;
            }.bind(this));
};

// return promise
Mapper.prototype._insert = function(data) {
    this.emit('insert:before', data);

    try {
        this._validateData(data);
    } catch (error) {
        return Q.reject(error);
    }

    return Q.try(_.bind(this.doInsert, this, data))
            .then(function(id) {
                if (!_.isObject(id))
                    id = {};

                this.pack(id, data);
                this.emit('insert:after', data);
            }.bind(this));
};

// return promise
Mapper.prototype._update = function(data) {
    this.emit('update:before', data);

    try {
        this._validateData(data);
    } catch (error) {
        return Q.reject(error);
    }

    return Q.try(_.bind(this.doUpdate, this, data))
            .then(function() {
                this.pack({}, data);
                this.emit('update:after', data);
            }.bind(this));
};

// 把存储记录转换为属性值
Mapper.prototype._recordToProps = function(record) {
    var props = {};

    _.each(this.getProperty(), function(config, key) {
        if (_.has(record, key))
            props[key] = Type.get(config['type']).restore(record[key], config);
    });

    return props;
};

// 把属性值转换为存储记录
Mapper.prototype._propsToRecord = function(props) {
    var record = {};

    _.each(this.getProperty(), function(config, key) {
        if (_.has(props, key))
            record[key] = Type.get(config['type']).store(props[key], config);
    });

    return record;
};

Mapper.prototype._validateData = function(data) {
    var keys;
    var is_fresh = data.isFresh();
    var properties = this.getProperty();

    if (is_fresh) {
        // check all properties
        data = data.toData();
        keys = _.keys(properties);
    } else {
        // check dirty properties
        data = data.toData(true);
        keys = _.keys(data);
    }

    for (var i = 0, key; key = keys[i++];) {
        var property = properties[key];

        do {
            if (property['allow_null'])
                break;

            if (property['auto_increase'] && is_fresh)
                break;

            if (data.hasOwnProperty(key) && data[key] !== null)
                break;

            throw new Error('Property '+key+' not allow null');
        } while (false);
    }

    return true;
};
