"use strict";

var EventEmitter = require('events').EventEmitter;
var Promise = require('bluebird');
var Services = require(__dirname+'/service/manager');
var Type = require(__dirname+'/type');
var _ = require('underscore');
var util = require('util');

/**
 * Define new mapper class
 *
 * @param {object} factory
 * @param {Mapper} [baseMapper] - Parent mapper class
 * @return {function} - New mapper class constructor
 */
var define = exports.define = function(factory, baseMapper) {
    baseMapper = baseMapper || Mapper;

    var NewMapper = function() {
        baseMapper.apply(this, arguments);
    };

    util.inherits(NewMapper, baseMapper);
    _.extend(NewMapper.prototype, factory);

    return NewMapper;
};

/**
 * @class
 *
 * @param {object} options
 * @param {Mapper} options.mapper
 * @param {string} options.service
 * @param {string} options.collection
 * @param {object} options.attributes
 * @param {boolean} [options.readonly=false]
 * @param {boolean} [options.strict=false]
 */
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

/**
 * @protected
 */
Mapper.prototype.__initialize = function() {};

/**
 * Bind decorate methods to data class
 *
 * @protected
 * @param {Data} NewData
 */
Mapper.prototype.__decorate = function(NewData) {};

/**
 * @param {string} key
 * @throws option is undefined
 * @return {mixed}
 */
Mapper.prototype.getOption = function(key) {
    var options = this._options;

    if (key in options) {
        return options[key];
    }

    throw new Error('Mapper: undefined option "'+key+'"');
};

/**
 * Get all options
 *
 * @return {object}
 */
Mapper.prototype.getOptions = function() {
    return this._options;
};

/**
 * Get storage service instance
 *
 * @throws option "service" is undefined
 * @return {object}
 */
Mapper.prototype.getService = function() {
    var service = this.getOption('service', true);
    return Services.get(service);
};

/**
 * Get record collection name in storage service
 *
 * @throws option "collection" is undefined
 * @return {string}
 */
Mapper.prototype.getCollection = function() {
    return this.getOption('collection', true);
};

/**
 * Get "primary_key" property name
 *
 * @return {array}
 */
Mapper.prototype.getPrimaryKey = function() {
    return this.getOption('primary_key');
};

/**
 * Get property's attribute
 *
 * @param {string} key
 * @return {object|false} Return false if property is undefined
 */
Mapper.prototype.getAttribute = function(key) {
    var attributes = this.getOption('attributes');
    return attributes[key] || false;
};

/**
 * Get all property attributes
 *
 * @return {object}
 */
Mapper.prototype.getAttributes = function() {
    return this.getOption('attributes');
};

/**
 * Check if property is exists
 *
 * @param {string} key Property name
 * @return {boolean}
 */
Mapper.prototype.hasAttribute = function(key) {
    return !!this.getAttribute(key);
};

/**
 * Check this mapper is readonly
 *
 * @return {boolean}
 */
Mapper.prototype.isReadonly = function() {
    return this.getOption('readonly');
};

/**
 * Pack values into Data instance
 *
 * @param {object} record
 * @param {Data} [data]
 * @return {Data}
 */
Mapper.prototype.pack = function(record, data) {
    data = data || new (this.getOption('factory'));

    if (!_.isEmpty(record)) {
        var values = {};

        _.each(record, function(value, key) {
            if (value !== null) {
                var attr = this.getAttribute(key);
                value = Type.get(attr.type).restore(value, attr);
            }

            values[key] = value;
        }, this);

        data._values = _.extend(data._values, values);
    }

    data._dirty = {};
    data._fresh = false;

    return data;
};

/**
 * Unpack values from Data instance
 *
 * @param {Data} data
 * @param {boolean} [only_dirty]
 * @return {object}
 */
Mapper.prototype.unpack = function(data, only_dirty) {
    var record = {};

    _.each(data._values, function(value, key) {
        if (only_dirty && !data.isDirty(key)) {
            return false;
        }

        if (value !== null) {
            var attr = this.getAttribute(key);
            value = Type.get(attr.type).store(value, attr);
        }

        record[key] = value;
    }, this);

    return record;
};

/**
 * Find data by primary key
 *
 * @param {string|number|object} id
 * @return {Promise}
 */
Mapper.prototype.find = function(id) {
    return this._find(id);
};

/**
 * Fetch data from storage service and refresh Data instance
 *
 * @param {Data} data
 * @return {Promise}
 */
Mapper.prototype.refresh = function(data) {
    return this._find(data.getId(), data);
};

/**
 * Save data into storage service
 *
 * @param {Data} data
 * @return {Promise}
 */
Mapper.prototype.save = function(data) {
    if (this.isReadonly()) {
        return Promise.reject(new Error('Mapper is readonly'));
    }

    var is_fresh = data.isFresh();

    if (!is_fresh && !data.isDirty()) {
        return Promise.resolve(data);
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

/**
 * Delete data from storage service
 *
 * @param {Data} data
 * @return {Promise}
 */
Mapper.prototype.destroy = function(data) {
    if (this.isReadonly()) {
        return Promise.reject(new Error('Mapper is readonly'));
    }

    if (data.isFresh()) {
        return Promise.resolve(data);
    }

    this.emit('before:delete', data);

    return Promise.try(this.doDelete, data, this).then(function() {
        this.emit('after:delete', data);

        return data;
    }.bind(this));
};

/**
 * @protected
 * @param {string|number|object} id
 * @param {Data} [data]
 * @return {Promise}
 */
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

/**
 * @protected
 * @param {Data} data
 * @return {Promise}
 */
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

/**
 * @protected
 * @param {Data} data
 * @return {Promise}
 */
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

/**
 * Check if all data is valid
 *
 * @protected
 * @param {Data} data
 */
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
