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

    this.__initialize();
};

util.inherits(Mapper, EventEmitter);

// abstract methods
['doFind', 'doInsert', 'doUpdate', 'doDelete'].forEach(function(method) {
    Mapper.prototype[method] = function() {
        return new Error('Mapper: '+ method +' not implemented!');
    };
});

// event methods
_.each({
    '__before_save': 'before:save',
    '__after_save': 'after:save',
    '__before_insert': 'before:insert',
    '__after_insert': 'after:insert',
    '__before_update': 'before:update',
    '__after_update': 'after:update',
    '__before_delete': 'before:delete',
    '__after_delete': 'after:delete',
}, function(event, method) {
    Mapper.prototype[method] = function(data) {
        return Promise.try(data[method].bind(data))
                      .then(this.emit.bind(this, event, data));
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
 * @return {boolean}
 */
Mapper.prototype.hasOption = function(key) {
    return _.has(this.options, key);
};

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
 * Pack stored record into Data instance
 *
 * @param {object} record
 * @param {Data} [data]
 * @return {Data}
 */
Mapper.prototype.pack = function(record, data) {
    var values = {};

    _.each(record, function(value, key) {
        var attr = this.getAttribute(key);

        if (!attr) {
            return false;
        }

        if (value !== null) {
            value = Type.get(attr.type).restore(value, attr);
        }

        values[key] = value;
    }, this);

    if (data) {
        data._values = _.extend(data._values, values);
    } else {
        data = new (this.getOption('factory'))(null, {fresh: false});
        data._values = values;
    }

    data._dirty = {};
    data._fresh = false;

    return data;
};

/**
 * Unpack values from Data instance
 *
 * @param {Data} data
 * @param {object} [options]
 * @param {boolean} [options.dirty=false] only return dirty values
 * @return {object}
 */
Mapper.prototype.unpack = function(data, options) {
    options = _.defaults(options || {}, {dirty: false});

    var record = {};

    _.each(data._values, function(value, key) {
        if (options.dirty && !data.isDirty(key)) {
            return false;
        }

        var attr = this.getAttribute(key);
        if (!attr) {
            return false;
        }

        if (value !== null) {
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

    this.__before_save(data);

    var save = is_fresh
             ? this._insert.bind(this, data)
             : this._update.bind(this, data);

    return save()
            .then(function(data) {
                this.__after_save(data);

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

    this.__before_delete(data);

    return Promise.try(this.doDelete, data, this).then(function() {
        this.__after_delete(data);

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
    this.__before_insert(data);

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
        this.__after_insert(data);

        return data;
    }.bind(this));
};

/**
 * @protected
 * @param {Data} data
 * @return {Promise}
 */
Mapper.prototype._update = function(data) {
    this.__before_update(data);

    try {
        this._validateData(data);
    } catch (error) {
        return Promise.reject(error);
    }

    return Promise.try(this.doUpdate, data, this).then(function() {
        this.pack({}, data);

        this.__after_update(data);

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
    var keys, record;
    var is_fresh = data.isFresh();
    var attributes = this.getAttributes();

    if (is_fresh) {
        // check all values
        record = this.unpack(data);
        keys = Object.keys(attributes);
    } else {
        // check dirty values
        record = this.unpack(data, {dirty: true});
        keys = Object.keys(record);
    }

    _.each(keys, function(key) {
        var attr = attributes[key];

        do {
            if (attr['allow_null'])
                break;

            if (attr['auto_generate'] && is_fresh)
                break;

            if (record.hasOwnProperty(key) && record[key] !== null)
                break;

            throw new Error('Property '+key+' not allow null');
        } while (false);
    });
};
