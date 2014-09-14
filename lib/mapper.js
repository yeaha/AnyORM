"use strict";

var EventEmitter = require('events').EventEmitter;
var Promise = require('bluebird');
var Services = require(__dirname+'/service/manager');
var Type = require(__dirname+'/type');
var _ = require('underscore');
var util = require('util');

// 定义一个新的mapper
var define = exports.define = function(factory, baseMapper) {
    baseMapper = baseMapper || Mapper;

    var NewMapper = function() {
        baseMapper.apply(this, arguments);
    };

    util.inherits(NewMapper, baseMapper);
    _.extend(NewMapper.prototype, factory);

    return NewMapper;
};

var Mapper = exports.Mapper = function(options) {
    EventEmitter.call(this);

    _.defaults(options, {
        // service: null,
        // collection: null,
        attributes: {},
        readonly: false,
        strict: false,
    });

    var attributes = options.attributes;
    var primary_key = [];

    _.each(attributes, function(attribute, key) {
        attribute = Type.normalizeAttribute(attribute);

        if (attribute.strict === null) {
            attribute.strict = options.strict;
        }

        if (attribute.primary_key) {
            primary_key.push(key);
        }

        attributes[key] = attribute;
    });

    if (!primary_key.length) {
        throw new Error('Mapper: undefined primary key!');
    }

    options.primary_key = primary_key;

    this._options = options;

    this.on('before:save', function(data) { data.__before_save(); })
        .on('after:save', function(data) { data.__after_save(); })
        .on('before:insert', function(data) { data.__before_insert(); })
        .on('after:insert', function(data) { data.__after_insert(); })
        .on('before:update', function(data) { data.__before_update(); })
        .on('after:update', function(data) { data.__after_update(); })
        .on('before:delete', function(data) { data.__before_delete(); })
        .on('after:delete', function(data) { data.__after_delete(); });

    this.__initialize();
};

util.inherits(Mapper, EventEmitter);

['doFind', 'doInsert', 'doUpdate', 'doDelete'].forEach(function(method) {
    Mapper.prototype[method] = function() {
        return new Error(method +' not implemented!');
    };
});

Mapper.prototype.__initialize = function() {};

Mapper.prototype.getOption = function(key) {
    var options = this._options;

    if (key in options) {
        return options[key];
    }

    throw new Error('Mapper: undefined option "'+key+'"');
};

Mapper.prototype.getOptions = function() {
    return this._options;
};

Mapper.prototype.getService = function() {
    var service = this.getOption('service', true);
    return Services.get(service);
};

Mapper.prototype.getCollection = function() {
    return this.getOption('collection', true);
};

Mapper.prototype.getPrimaryKey = function() {
    return this.getOption('primary_key');
};

Mapper.prototype.getAttribute = function(key) {
    var attributes = this.getOption('attributes');
    return attributes[key] || false;
};

Mapper.prototype.getAttributes = function() {
    return this.getOption('attributes');
};

Mapper.prototype.hasAttribute = function(key) {
    return !!this.getAttribute(key);
};

Mapper.prototype.isReadonly = function() {
    return this.getOption('readonly');
};

// 把存储记录包装或更新data实例
Mapper.prototype.pack = function(record, data) {
    data = data || new (this.getOption('factory'));

    if (!_.isEmpty(record)) {
        var values = {};
        _.each(this.getAttributes(), function(attribute, key) {
            if (key in record) {
                values[key] = Type.get(attribute.type).restore(record[key], attribute);
            }
        });

        data._values = _.extend(data._values, values);
    }

    data._dirty = {};
    data._fresh = false;

    return data;
};

Mapper.prototype.unpack = function(data, only_dirty) {
    var record = {};
    var dirty = data._dirty;
    var values = data._values;

    _.each(this.getAttributes(), function(attribute, key) {
        if (only_dirty && !dirty[key]) {
            return false;
        }

        record[key] = Type.get(attribute.type).store(values[key], attribute);
    });

    return record;
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
    if (this.isReadonly()) {
        return Promise.reject(new Error('Mapper is readonly'));
    }

    var is_fresh = data.isFresh();

    if (!is_fresh && !data.isDirty()) {
        return Promise.resolve(true);
    }

    this.emit('before:save', data);

    var save = is_fresh
             ? this._insert.bind(this, data)
             : this._update.bind(this, data);

    return save()
            .then(function(data) {
                this.emit('after:save', data);

                return data;
            }.bind(this));
};

// return promise
Mapper.prototype.destroy = function(data) {
    if (this.isReadonly()) {
        return Promise.reject(new Error('Mapper is readonly'));
    }

    if (data.isFresh()) {
        return Promise.resolve(true);
    }

    this.emit('before:delete', data);

    return Promise.try(this.doDelete, data, this).then(function() {
        this.emit('after:delete', data);

        return data;
    }.bind(this));
};

// return promise
Mapper.prototype._find = function(id, data) {
    return Promise.try(this.doFind, id, this).then(function(record) {
        if (!record) {
            return false;
        }

        data = this.pack(record, data);
        this.emit('found', data);

        return data;
    }.bind(this));
};

// return promise
Mapper.prototype._insert = function(data) {
    this.emit('before:insert', data);

    try {
        this._validateData(data);
    } catch (error) {
        return Promise.reject(error);
    }

    return Promise.try(this.doInsert, data, this).then(function(primary_values) {
        // 所有未赋值的主键属性
        var keys = _.filter(this.getPrimaryKey(), function(key) {
            return !data[key];
        });

        var values = {};
        if (_.isObject(primary_values)) {
            values = _.pick(primary_values, keys);
        } else {
            // 不支持insert ... returning 的数据库就只能返回last insert id
            // 如果有多个auto increase的主键就无法赋值
            if (keys.length > 1) {
                throw new Error('Mapper: multiple primary key with one insert id');
            }

            values[keys[0]] = primary_values;
        }

        this.pack(values, data);
        this.emit('after:insert', data);

        return data;
    }.bind(this));
};

// return promise
Mapper.prototype._update = function(data) {
    this.emit('before:update', data);

    try {
        this._validateData(data);
    } catch (error) {
        return Promise.reject(error);
    }

    return Promise.try(this.doUpdate, data, this).then(function() {
        this.pack({}, data);
        this.emit('after:update', data);

        return data;
    }.bind(this));
};

Mapper.prototype._validateData = function(data) {
    var keys;
    var is_fresh = data.isFresh();
    var attributes = this.getAttributes();

    if (is_fresh) {
        // check all properties
        data = this.unpack(data);
        keys = Object.keys(attributes);
    } else {
        // check dirty properties
        data = this.unpack(data, true);
        keys = Object.keys(data);
    }

    _.each(keys, function(key) {
        var attr = attributes[key];

        do {
            if (attr['allow_null'])
                break;

            if (attr['auto_generate'] && is_fresh)
                break;

            if (data.hasOwnProperty(key) && data[key] !== null)
                break;

            throw new Error('Property '+key+' not allow null');
        } while (false);
    });
};
