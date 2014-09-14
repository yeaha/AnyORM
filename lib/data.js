"use strict";

var EventEmitter = require('events').EventEmitter;
var Promise = require('bluebird');
var Type = require(__dirname+'/type');
var _ = require('underscore');
var util = require('util');

// 定义一个新的Data类
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

    NewData.find = function(id) {
        return mapper.find(id);
    };

    NewData.getMapper = NewData.prototype.getMapper = function() {
        return mapper;
    };

    return NewData;
};

var Data = exports.Data = function(values) {
    EventEmitter.call(this);

    var mapper = this.getMapper();
    var attributes = mapper.getAttributes();

    _.each(_.keys(attributes), function(key) {
        Object.defineProperty(this, key, {
            get: this._get.bind(this, key),
            set: function(value) {
                this.set(key, value, {strict: true});
            }.bind(this)
        });
    }, this);

    // 如果这里不先设置为true，会导致某些refuse_update的属性无法初始化
    this._fresh = true;
    this._values = {};
    this._dirty = {};

    values && _.each(values, function(value, key) {
        if (_.has(attributes, key)) {
            this.set(key, value, {strict: true});
        }
    }, this);

    // 设置属性默认值
    _.each(attributes, function(attribute, key) {
        if (key in this._values || attribute.allow_null) {
            return true;
        }

        var default_value = Type.get(attribute.type).getDefaultValue(attribute);
        if (default_value !== null) {
            this._change(key, default_value);
        }
    }, this);

    this.__initialize();
};

util.inherits(Data, EventEmitter);

Data.prototype.has = function(key) {
    return this.getMapper().hasAttribute(key);
};

Data.prototype.get = function(keys, options) {
    if (_.isString(keys)) {
        return this._get(keys, options);
    }

    if (_.isArray(keys)) {
        var values = {};
        _.each(keys, function(key) {
            values[key] = this._get(key, options);
        }.bind(this));

        return values;
    }

    if (_.isObject(keys)) {
        options = keys;
    }

    var values = {};
    _.each(this.getMapper().getAttributes(), function(attribute, key) {
        if (_.has(this._values, key) && !attribute.protected) {
            values[key] = this._get(key, options);
        }
    }.bind(this));

    return values;
};

Data.prototype.set = function(key, value, options) {
    options = _.defaults(options || {}, {
        strict: true
    });

    var attribute = this.getMapper().getAttribute(key);

    if (!attribute) {
        if (options.strict) {
            throw new Error('Undefined property: '+ key);
        }

        return false;
    }

    if (attribute.strict && !options.strict) {
        return false;
    }

    if (attribute.refuse_update && !this.isFresh()) {
        if (!options.strict) {
            return false;
        }

        throw new Error('Property '+key+' refuse update.');
    }

    var normalize = attribute.normalize;
    if (normalize && (typeof normalize == 'function')) {
        value = normalize.call(this, value);

        if (value === undefined) {
            throw new Error('Attribute normalize function return nothing');
        }
    }

    value = Type.get(attribute.type).normalize(value, attribute);

    if (value === null && !attribute.allow_null) {
        throw new Error('Property '+key+' not allow null.')
    }

    if (attribute.pattern && !attribute.pattern.test(value)) {
        throw new Error('Property '+key+' missmatch pattern: '+ attribute.pattern.toString());
    }

    if (this._get(key) === value) {
        return false;
    }

    this._change(key, value);
    return true;
};

Data.prototype.merge = function(values) {
    _.each(values, function(value, key) {
        this.set(key, value, {strict: false});
    }, this);

    return this;
};

Data.prototype.toJSON = function() {
    var attributes = this.getMapper().getAttributes();
    var json = {};

    _.each(this._values, function(value, key) {
        var attribute = attributes[key];

        if (!attribute.protected) {
            json[key] = Type.get(attribute.type).toJSON(value, attribute);
        }
    });

    return json;
};

Data.prototype.isFresh = function() {
    return this._fresh;
};

Data.prototype.isDirty = function() {
    return !_.isEmpty(this._dirty);
};

Data.prototype.getId = function() {
    var id = {};
    var keys = this.getMapper().getPrimaryKey();

    for (var i = 0, len = keys.length; i < len; i++) {
        var key = keys[i];
        var value = this._get(key);

        if (len === 1) {
            return value;
        }

        id[key] = value;
    }

    return id;
};

Data.prototype.refresh = function() {
    if (this.isFresh()) {
        return Promise.resolve(true);
    }

    return this.getMapper().refresh(this);
};

Data.prototype.save = function() {
    return this.getMapper().save(this);
};

Data.prototype.destroy = function() {
    return this.getMapper().destroy(this);
};

Data.prototype._get = function(key, options) {
    options = options || {};

    var attribute = this.getMapper().getAttribute(key);
    if (!attribute) {
        throw new Error('Undefined property: '+ key);
    }

    var value = this._values[key];
    if (value === undefined) {
        return null;
    } else if (!value) {
        return value;
    }

    if (options.clone === false) {
        return value;
    }

    return (attribute.clone || options.clone)
         ? Type.get(attribute.type).clone(value)
         : value;
};

Data.prototype._change = function(key, value) {
    this._values[key] = value;
    this._dirty[key] = true;
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
