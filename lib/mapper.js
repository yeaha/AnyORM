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
        // storage: null,
        // collection: null,
        attributes: {},
        readonly: false,
        strict: false,
    });

    var attributes = options.attributes;
    var primary_key = [];

    _.each(attributes, function(config, name) {
        config = Type.normalizeConfig(config);

        if (config.strict === null) {
            config.strict = options.strict;
        }

        if (config.primary_key) {
            primary_key.push(name);

            config.refuse_update = true;
            config.allow_null = false;
        }

        attributes[name] = config;
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

Mapper.prototype.getAttribute = function(name) {
    var attributes = this.getOption('attributes');
    return attributes[name] || false;
};

Mapper.prototype.getAttributes = function(name) {
    return this.getOption('attributes');
};

Mapper.prototype.hasAttribute = function(name) {
    return !!this.getAttribute(name);
};

Mapper.prototype.isReadonly = function() {
    return this.getOption('readonly');
};

// 把存储记录包装或更新data实例
Mapper.prototype.pack = function(record, data) {
    data = data || new (this.getOption('factory'));

    if (!_.isEmpty(record)) {
        var values = {};
        _.each(this.getAttributes(), function(config, name) {
            if (name in record) {
                values[name] = Type.get(config.type).restore(record[name], config);
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

    _.each(this.getAttributes(), function(config, name) {
        if (only_dirty && !dirty[name]) {
            return false;
        }

        record[name] = Type.get(config.type).store(values[name], config);
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

    this.emit('save:before', data);

    var save = is_fresh
             ? this._insert.bind(this, data)
             : this._update.bind(this, data);

    return save()
            .then(function(data) {
                this.emit('save:after', data);

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

    this.emit('delete:before', data);

    var _delete = this.doDelete.bind(this, data);

    var _fulfilled = function() {
        this.emit('delete:after', data);

        return data;
    }.bind(this);

    return Promise.try(_delete).then(_fulfilled);
};

// return promise
Mapper.prototype._find = function(id, data) {
    var _find = this.doFind.bind(this, id);

    var _fulfilled = function(record) {
        if (!record) {
            return false;
        }

        data = this.pack(record, data);
        this.emit('found', data);

        return data;
    }.bind(this);

    return Promise.try(_find).then(_fulfilled);
};

// return promise
Mapper.prototype._insert = function(data) {
    this.emit('insert:before', data);

    try {
        this._validateData(data);
    } catch (error) {
        return Promise.reject(error);
    }

    var _insert = this.doInsert.bind(this, data);

    var _fulfilled = function(primary_values) {
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
        this.emit('insert:after', data);

        return data;
    }.bind(this);

    return Promise.try(_insert).then(_fulfilled);
};

// return promise
Mapper.prototype._update = function(data) {
    this.emit('update:before', data);

    try {
        this._validateData(data);
    } catch (error) {
        return Promise.reject(error);
    }

    var _update = this.doUpdate.bind(this, data);

    var _fulfilled = function() {
        this.pack({}, data);
        this.emit('update:after', data);

        return data;
    }.bind(this);

    return Promise.try(_update).then(_fulfilled);
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

            if (attr['auto_increase'] && is_fresh)
                break;

            if (data.hasOwnProperty(key) && data[key] !== null)
                break;

            throw new Error('Property '+key+' not allow null');
        } while (false);
    });
};
