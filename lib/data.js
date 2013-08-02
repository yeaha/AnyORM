"use strict";

var _ = require('underscore');
var Type = require(__dirname+'/type');

// 定义一个新的Data类
function define(options, base) {
    options = options || {};
    base = base || Data;

    var Model = function() {
        base.apply(this, arguments);
    };
    Model.prototype = Object.create(base.prototype);
    Model.prototype.constructor = Model;

    if (base !== Data) {
        var base_options = base.getMapper().getOption();
        var properties = _.extend({}, base_options['properties'] || {}, options['properties'] || {});

        options = _.extend({}, base_options, options);
        options['properties'] = properties;
    }

    options['constructor'] = Model;

    if (!options.mapper)
        throw new Error('Undefined option key: mapper');

    var mapper = new (options.mapper)(options);

    Model.find = function(id) {
        return mapper.find(id);
    };

    Model.getMapper = Model.prototype.getMapper = function() {
        return mapper;
    };

    return Model;
};

function Data(data) {
    var mapper = this.getMapper();
    var properties = mapper.getProperty();

    _.each(properties, function(config, key) {
        this.__defineGetter__(key, _.bind(this.get, this, [key]));
        this.__defineSetter__(key, function(value) {
            this.set(key, value);
        }.bind(this));
    }, this);

    // 如果这里不先设置为true，会导致某些refuse_update的属性无法初始化
    this._fresh = true;
    this._data = {};
    this._dirty = {};

    this.set(data || {});

    // 设置属性默认值
    _.each(properties, function(config, key) {
        if (key in this._data || config['allow_null'])
            return true;

        var default_value = mapper.getPropertyDefaultValue(key, config);
        if (default_value === null)
            return true;

        this._change(key, default_value);
    }, this);

    this.__initialize();
}

Data.prototype.has = function(key) {
    return this.getMapper().hasProperty(key);
};

Data.prototype.get = function(key) {
    if (!this.has(key))
        throw new Error('Undefined property: '+ key);

    var value = this._data[key];
    return _.isUndefined(value) ? null : value;
};

Data.prototype.set = function(key, value) {
    var data = {};
    var strict = true;

    if (_.isObject(key)) {
        strict = false;
        data = key;
    } else {
        data[key] = value;
    }

    _.each(data, function(value, key) {
        this._set(key, value, strict);
    }, this);

    return this;
};

Data.prototype.toData = function(only_dirty) {
    if (!only_dirty)
        return this._data;

    // 只返回被修改过的属性
    var dirty = this._dirty;
    var data = {};

    _.each(this._data, function(value, key) {
        if (key in dirty)
            data[key] = value;
    });

    return data;
};

Data.prototype.isFresh = function() {
    return this._fresh;
};

Data.prototype.isDirty = function() {
    return !!_.keys(this._dirty).length;
};

Data.prototype.identity = function() {
    var id = {};
    var keys = this.getMapper().getPrimaryKey();

    for (var i = 0, len = keys.length; i < len; i++) {
        var key = keys[i];
        var value = this.get(key);

        if (len === 1)
            return value;

        id[key] = value;
    }

    return id;
};

Data.prototype.refresh = function() {
    if (this.isFresh())
        return Q(true);

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
Data.prototype._set = function(key, value, strict) {
    var property = this.getMapper().getProperty(key);

    if (!property) {
        if (!strict) return false;
        throw new Error('Undefined property: '+ key);
    }

    if (!strict && property['strict'])
        return false;

    if (!this.isFresh() && property['refuse_update']) {
        if (!strict) return false;
        throw new Error('Property '+key+' refuse update.');
    }

    if (!property['allow_null'] && value === null)
        throw new Error('Property '+key+' not allow null.');

    if (property['pattern'] && !property['pattern'].test(value))
        throw new Error('Property '+key+' missmatch pattern: '+ property['pattern'].toString());

    value = this._normalize(key, value, property);
    value = Type.get(property['type']).normalize(value, property);

    if (this._data[key] === value)
        return false;

    this._change(key, value);
    return true;
};

// 重载此方法，可以对属性值进行自定义格式化
Data.prototype._normalize = function(key, value, config) {
    // if (key == 'foo')
    //     value = do_something(value);
    return value;
};

Data.prototype._change = function(key, value) {
    this._data[key] = value;
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

exports.define = define;
exports.Data = Data;
