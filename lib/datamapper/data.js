"use strict";

var _ = require('underscore');
var Type = require('./type');

// 定义一个新的Data类
function define(options) {
    if (!options.mapper)
        throw new Error('Undefined option key: mapper');

    var Model = function() {
        Data.apply(this, arguments);
    };
    options['constructor'] = Model;

    var mapper = new (options.mapper)(options);

    Model.prototype = Object.create(Data.prototype);
    Model.prototype.constructor = Model;

    Model.find = function(id) {
        return mapper.find(id);
    };

    Model.getMapper = Model.prototype.getMapper = function() {
        return mapper;
    };

    return Model;
};

function Data(data, is_fresh) {
    var mapper = this.getMapper();
    var columns = mapper.getColumn();

    _.each(columns, function(config, prop) {
        this.__defineGetter__(prop, _.bind(this.get, this, [prop]));
        this.__defineSetter__(prop, function(value) {
            this.set(prop, value);
        }.bind(this));
    }, this);

    // 如果这里不先设置为true，会导致某些refuse_update的属性无法初始化
    this._fresh = true;
    this._data = {};
    this._dirty = {};

    this.set(data || {});

    this._fresh = (typeof is_fresh == 'undefined') ? true : !!is_fresh;

    if (this._fresh) {
        // 设置属性默认值
        _.each(columns, function(config, name) {
            if (name in this._data || config['allow_null'])
                return true;

            var default_value = mapper.getColumnDefaultValue(name, config);
            if (default_value === null)
                return true;

            this._change(name, default_value);
        }, this);
    } else {
        this._dirty = {};
    }
}

Data.prototype.has = function(prop) {
    return !!this.getMapper().getColumn(prop);
};

Data.prototype.get = function(prop) {
    if (!this.getMapper().getColumn(prop))
        throw new Error('Undefined property: '+ prop);

    var value = this._data[prop];
    if (_.isUndefined(value))
        value = null;

    return value;
};

Data.prototype.set = function(prop, value) {
    var data = {};
    var strict = true;

    if (_.isObject(prop)) {
        strict = false;
        data = prop;
    } else {
        data[prop] = value;
    }

    _.each(data, function(value, prop) {
        this._set(prop, value, strict);
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

Data.prototype.save = function() {
    return this.getMapper().save(this);
};

Data.prototype.destroy = function() {
    return this.getMapper().destroy(this);
};

// strict开关是一个安全开关
// 默认情况下，column的strict = false
// 当strict = true时, Data._set()会忽略掉那些strict = true的属性
// 这种属性只能通过data.prop = value来赋值
Data.prototype._set = function(prop, value, strict) {
    var column = this.getMapper().getColumn(prop);

    if (!column) {
        if (!strict) return false;
        throw new Error('Undefined property: '+ prop);
    }

    if (!strict && column['strict'])
        return false;

    if (!this.isFresh() && column['refuse_update']) {
        if (!strict) return false;
        throw new Error('Property '+prop+' refuse update.');
    }

    if (!column['allow_null'] && value === null)
        throw new Error('Property '+prop+' not allow null.');

    if (column['pattern'] && !column['pattern'].test(value))
        throw new Error('Property '+prop+' missmatch pattern: '+ column['pattern'].toString());

    value = this._normalize(prop, value, column);
    value = Type.get(column['type']).normalize(value, column);

    if (this._data[prop] === value)
        return false;

    this._change(prop, value);
    return true;
};

// 重载此方法，可以对属性值进行自定义格式化
Data.prototype._normalize = function(prop, value, config) {
    // if (prop == 'foo')
    //     value = do_something(value);
    return value;
};

Data.prototype._change = function(prop, value) {
    this._data[prop] = value;
    this._dirty[prop] = true;
};

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
