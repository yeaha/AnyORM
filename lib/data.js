"use strict";

var EventEmitter = require('events').EventEmitter;
var Promise = require('bluebird');
var Type = require(__dirname+'/type');
var _ = require('lodash');
var util = require('util');

/**
 * Define new data class
 *
 * @param {object} options
 * @param {Mapper} options.mapper Mapper class
 * @param {string} options.service Storage service name, see Service.define
 * @param {string} options.collection Record collection name in storage service, e.g. table name in database
 * @param {object} options.attributes
 * @param {boolean} [options.readonly=false]
 * @param {boolean} [options.strict=false]
 * @param {*} [options.*] Any thing you want
 * @param {Data} [baseData] Parent data class
 * @return {function} New data class constructor
 */
var define = exports.define = function(options, baseData) {
    options = options || {};
    baseData = baseData || Data;

    var NewData = function() {
        baseData.apply(this, arguments);
    };

    util.inherits(NewData, baseData);

    if (baseData !== Data) {
        var base_options = baseData.getMapper().getOptions();
        var attributes = _.extend({}, base_options['attributes'] || {}, options['attributes'] || {});

        options = _.defaults(options, base_options);
        options['attributes'] = attributes;
    }

    options['factory'] = NewData;

    if (!options.mapper) {
        throw new Error('Undefined option key: mapper');
    }

    var mapper = new (options.mapper)(options);

    /**
     * @static
     * @param {string|number|object} id
     * @return {Promise}
     */
    NewData.find = function(id) {
        return mapper.find(id);
    };

    /**
     * @static
     * @return {Mapper}
     */
    NewData.getMapper = NewData.prototype.getMapper = function() {
        return mapper;
    };

    mapper.__decorate(NewData);

    return NewData;
};

/**
 * @class
 * @param {object} values
 * @param {object} [options]
 * @param {boolean} [options.fresh=true]
 */
var Data = exports.Data = function(values, options) {
    EventEmitter.call(this);

    var defaults = {fresh: true};
    options = options ? _.defaults(options, defaults) : defaults;

    var mapper = this.getMapper();
    var attributes = mapper.getAttributes();

    _.each(_.keys(attributes), function(key) {
        Object.defineProperty(this, key, {
            get: this.get.bind(this, key),
            set: function(value) {
                this.set(key, value, {strict: true});
            }.bind(this)
        });
    }, this);

    this._fresh = options.fresh;
    this._values = {};
    this._dirty = {};

    values && _.each(values, function(value, key) {
        if (_.has(attributes, key)) {
            this.set(key, value, {strict: true, force: true});
        }
    }, this);

    if (this.isFresh()) {
        // set default value
        _.each(attributes, function(attribute, key) {
            if (key in this._values) {
                return;
            }

            var default_value = this._getDefaultValue(attribute);
            if (default_value !== null) {
                this._change(key, default_value);
            }
        }, this);
    } else {
        this._dirty = {};
    }

    this.__initialize();
};

util.inherits(Data, EventEmitter);

/**
 * Check if data has defined property
 *
 * @param {string} key Property name
 * @return {boolean}
 */
Data.prototype.has = function(key) {
    return this.getMapper().hasAttribute(key);
};

/**
 * Set data property value
 *
 * @param {string} key Property name
 * @param {*} value Proerty value
 * @param {object} [options]
 * @param {boolean} [options.strict=true]
 * @param {boolean} [options.force=false] force ignore "refuse_update" rule
 *
 * @throws property is undefined and options.strict is true
 * @throws change a "refuse_update" property when data is not fresh and options.strict is true
 * @throws set null to not "allow_null" property
 * @throws value not pass regexp test
 *
 * @return {boolean}
 */
Data.prototype.set = function(key, value, options) {
    var defaults = {force: false, strict: true};
    options = options ? _.defaults(options, defaults) : defaults;

    var attribute = this.getMapper().getAttribute(key);

    if (!attribute) {
        if (options.strict) {
            throw new Error('Undefined property: '+ key);
        }

        return this;
    }

    if (attribute.strict && !options.strict) {
        return this;
    }

    if (!options.force && attribute.refuse_update && !this.isFresh()) {
        if (!options.strict) {
            return this;
        }

        throw new Error('Property '+key+' refuse update.');
    }

    if (value === '') {
        value = null;
    }

    if (value === null) {
        if (!attribute.allow_null) {
            throw new Error('Property '+key+' not allow null.')
        }
    } else {
        var normalize = attribute.normalize;
        if (normalize && (typeof normalize == 'function')) {
            value = normalize.call(this, value);

            if (value === undefined) {
                throw new Error('Attribute normalize function return nothing');
            }
        }

        value = Type.get(attribute.type).normalize(value, attribute);

        if (value === undefined) {
            throw new Error('Type normalize function return nothing');
        }

        if (attribute.pattern && !attribute.pattern.test(value)) {
            throw new Error('Property '+key+' missmatch pattern: '+ attribute.pattern.toString());
        }
    }

    if (_.has(this._values, key)) {
        if (this._values[key] === value) {
            return this;
        }
    } else {
        if (value === null && attribute.allow_null) {
            return this;
        }
    }

    this._change(key, value);

    return this;
};

/**
 * Merge values into data
 * Auto ignore undefined property
 * Auto ignore property with attribute "strict" is true
 *
 * @param {object} values
 * @return {Data}
 */
Data.prototype.merge = function(values) {
    _.each(values, function(value, key) {
        this.set(key, value, {strict: false});
    }, this);

    return this;
};

/**
 * Get property value
 *
 * @param {string} key
 *
 * @throws property is undefined
 *
 * @return {?*}
 */
Data.prototype.get = function(key) {
    var attribute = this.getMapper().getAttribute(key);
    if (!attribute) {
        throw new Error('Undefined property: '+ key);
    }

    var value = this._values[key];
    if (value === undefined) {
        return this._getDefaultValue(attribute);
    }

    return value
         ? Type.get(attribute.type).clone(value)
         : value;
};

/**
 * @example
 * data.pick('foo', 'bar');
 * data.pick(['foo', 'bar']);
 * data.pick();
 *
 * @param {string...|array} [keys]
 * @return {object}
 */
Data.prototype.pick = function(keys) {
    if (keys === undefined) {
        var attributes = this.getMapper().getAttributes();
        keys = _.filter(_.keys(attributes), function(key) {
            var attribute = attributes[key];

            return !attribute.protected && _.has(this._values, key);
        }, this);
    } else {
        keys = _.isArray(keys) ? keys : _.toArray(arguments);
    }

    var values = {};
    _.each(keys, function(key) {
        if (_.has(this._values, key)) {
            values[key] = this.get(key);
        }
    }, this);

    return values;
};

/**
 * Get all properties as json
 *
 * @return {object}
 */
Data.prototype.toJSON = function() {
    var attributes = this.getMapper().getAttributes();
    var json = {};

    _.each(this.pick(), function(value, key) {
        var attribute = attributes[key];
        json[key] = Type.get(attribute.type).toJSON(value, attribute);
    });

    return json;
};

/**
 * Check if data is unsaved
 *
 * @return {boolean}
 */
Data.prototype.isFresh = function() {
    return this._fresh;
};

/**
 * Check if there is any property is changed
 * If pass property name, check passed property only
 *
 * @param {string} [key]
 * @return {boolean}
 */
Data.prototype.isDirty = function(key) {
    return key ? _.has(this._dirty, key) : !_.isEmpty(this._dirty);
};

/**
 * Get primary key value
 *
 * @return {string|number|object} Return object if multiple primary key
 */
Data.prototype.getId = function() {
    var id = {};
    var keys = this.getMapper().getPrimaryKey();

    for (var i = 0, len = keys.length; i < len; i++) {
        var key = keys[i];
        var value = this.get(key);

        if (len === 1) {
            return value;
        }

        id[key] = value;
    }

    return id;
};

/**
 * Fetch data from storage service and overwrite current values
 * cancel all unsaved dirty value
 *
 * @return {Promise}
 */
Data.prototype.refresh = function() {
    if (this.isFresh()) {
        return Promise.resolve(this);
    }

    return this.getMapper().refresh(this);
};

/**
 * Save data into storage service
 *
 * @return {Promise}
 */
Data.prototype.save = function() {
    return this.getMapper().save(this);
};

/**
 * Delete data from storage service
 *
 * @return {Promise}
 */
Data.prototype.destroy = function() {
    return this.getMapper().destroy(this);
};

/**
 * Change property value and mark the property to dirty
 *
 * @protected
 * @param {string} key
 * @param {*} value
 */
Data.prototype._change = function(key, value) {
    this._values[key] = value;
    this._dirty[key] = true;

    this.emit('change', key);
};

/**
 * Get property default value
 *
 * @param {object} attribute
 * @return {*}
 */
Data.prototype._getDefaultValue = function(attribute) {
    var value = Type.get(attribute.type).getDefaultValue(attribute);
    return _.isFunction(value) ? value.call(this) : value;
};

Data.prototype.__initialize = function() {};
Data.prototype.__before_save = function() {};
Data.prototype.__after_save = function() {};
Data.prototype.__before_insert = function() {};
Data.prototype.__after_insert = function() {};
Data.prototype.__before_update = function() {};
Data.prototype.__after_update = function() {};
Data.prototype.__before_delete = function() {};
Data.prototype.__after_delete = function() {};
