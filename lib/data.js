"use strict";

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
    var mapper = this.getMapper();
    var attributes = mapper.getAttributes();

    _.each(_.keys(attributes), function(key) {
        Object.defineProperty(this, key, {
            get: this._get.bind(this, key),
            set: function(value) {
                this._set(key, value, true);
            }.bind(this)
        });
    }, this);

    // 如果这里不先设置为true，会导致某些refuse_update的属性无法初始化
    this._fresh = true;
    this._values = {};
    this._dirty = {};

    values && _.each(values, function(value, key) {
        if (_.has(attributes, key)) {
            this._set(key, value, true);
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

Data.prototype.has = function(key) {
    return this.getMapper().hasAttribute(key);
};

Data.prototype.merge = function(values) {
    _.each(values, function(value, key) {
        this._set(key, value, false);
    }, this);

    return this;
};

Data.prototype.toJSON = function() {
    var mapper = this.getMapper();

    return _.chain(this._values)
            .map(function(value, key) {
                var attribute = mapper.getAttribute(key);
                value = Type.get(attribute.type).toJSON(value, attribute);

                return [key, value];
            })
            .object()
            .value();
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

Data.prototype._get = function(key, clone) {
    if (!this.has(key)) {
        throw new Error('Undefined property: '+ key);
    }

    var value = this._values[key];
    if (value === undefined) {
        return null;
    } else if (!value) {
        return value;
    }

    if (clone === false) {
        return value;
    }

    var attribute = this.getMapper().getAttribute(key);
    return (attribute.clone || clone)
         ? Type.get(attribute.type).clone(value)
         : value;
};

// strict开关是一个安全开关
// 默认情况下，property的strict = false
// 当strict = true时, Data._set()会忽略掉那些strict = true的属性
// 这种属性只能通过data.prop = value来赋值
Data.prototype._set = function(key, value, strict) {
    var attribute = this.getMapper().getAttribute(key);

    if (!attribute) {
        if (!strict) {
            return false;
        }

        throw new Error('Undefined property: '+ key);
    }

    if (!strict && attribute.strict) {
        return false;
    }

    if (!this.isFresh() && attribute.refuse_update) {
        if (!strict) {
            return false;
        }

        throw new Error('Property '+key+' refuse update.');
    }

    if (!attribute.allow_null && value === null) {
        throw new Error('Property '+key+' not allow null.')
    }

    if (attribute.pattern && !attribute.pattern.test(value)) {
        throw new Error('Property '+key+' missmatch pattern: '+ attribute.pattern.toString());
    }

    var normalize = attribute.normalize;
    if (normalize && (typeof normalize == 'function')) {
        value = normalize(value);

        if (value === undefined) {
            throw new Error('Attribute normalize function return nothing');
        }
    }

    value = Type.get(attribute.type).normalize(value, attribute);

    if (this._get(key) === value) {
        return false;
    }

    this._change(key, value);
    return true;
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
