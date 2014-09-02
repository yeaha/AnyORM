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

    options['constructor'] = NewData;

    if (!options.mapper)
        throw new Error('Undefined option key: mapper');

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
    var _this = this;

    _.each(attributes, function(config, name) {
        Object.defineProperty(_this, name, {
            get: _this.get.bind(_this, name),
            set: function(value) {
                _this.set(name, value);
            }
        });
    });

    // 如果这里不先设置为true，会导致某些refuse_update的属性无法初始化
    this._fresh = true;
    this._values = {};
    this._dirty = {};

    values && _.each(values, function(value, name) {
        _this.set(name, value);
    });

    // 设置属性默认值
    _.each(attributes, function(config, name) {
        if (name in _this._values || config['allow_null']) {
            return true;
        }

        var default_value = mapper.getPropertyDefaultValue(name, config);
        if (default_value !== null) {
            _this._change(name, default_value);
        }
    });

    this.__initialize();
};

Data.prototype.has = function(name) {
    return this.getMapper().hasAttribute(name);
};

Data.prototype.get = function(name) {
    if (!this.has(name)) {
        throw new Error('Undefined property: '+ name);
    }

    var value = this._values[name];
    if (value === undefined) {
        return null;
    } else if (!value) {
        return value;
    }

    var config = this.getMapper().getAttribute(name);
    return config.clone
         ? Type.get(config.type).clone(value)
         : value;
};

Data.prototype.set = function(name, value) {
    var values = {};
    var strict = true;

    if (_.isObject(name)) {
        strict = false;
        values = name;
    } else {
        values[name] = value;
    }

    _.each(values, function(value, key) {
        this._set(key, value, strict);
    }.bind(this));

    return this;
};

Data.prototype.toJSON = function() {
    var mapper = this.getMapper();

    return _.chain(this._values)
            .map(function(value, name) {
                var config = mapper.getAttribute(name);
                value = Type.get(config.type).toJSON(value, config);

                return [name, value];
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
        var value = this.get(key);

        if (len === 1) {
            return value;
        }

        id[key] = value;
    }

    return id;
};

Data.prototype.refresh = function() {
    if (this.isFresh())
        return Promise.resolve(true);

    return this.getMapper().refresh(this);
};

Data.prototype.save = function() {
    return this.getMapper().save(this);
};

Data.prototype.destroy = function() {
    return this.getMapper().destroy(this);
};

// strict开关是一个安全开关
// 默认情况下，property的strict = false
// 当strict = true时, Data._set()会忽略掉那些strict = true的属性
// 这种属性只能通过data.prop = value来赋值
Data.prototype._set = function(name, value, strict) {
    var attribute = this.getMapper().getAttribute(name);

    if (!attribute) {
        if (!strict) {
            return false;
        }

        throw new Error('Undefined property: '+ name);
    }

    if (!strict && attribute.strict) {
        return false;
    }

    if (!this.isFresh() && attribute.refuse_update) {
        if (!strict) {
            return false;
        }

        throw new Error('Property '+name+' refuse update.');
    }

    if (!attribute.allow_null && value === null) {
        throw new Error('Property '+name+' not allow null.')
    }

    if (attribute.pattern && !attribute.pattern.test(value)) {
        throw new Error('Property '+name+' missmatch pattern: '+ attribute.pattern.toString());
    }

    value = this._normalize(name, value, attribute);
    value = Type.get(attribute.type).normalize(value, attribute);

    if (this.get(name) === value) {
        return false;
    }

    this._change(name, value);
    return true;
};

// 重载此方法，可以对属性值进行自定义格式化
Data.prototype._normalize = function(name, value, config) {
    // if (name == 'foo')
    //     value = do_something(value);
    return value;
};

Data.prototype._change = function(name, value) {
    this._values[name] = value;
    this._dirty[name] = true;
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
