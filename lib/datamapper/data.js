var _ = require('underscore');
var Type = require('./type');

// 定义一个新的Data类
exports.define = function(options) {
    if (!options.mapper)
        throw new Error('Undefined option key: mapper');

    var mapper, Model;

    Model = function() {
        Data.apply(this, arguments);
    };
    options['constructor'] = Model;

    mapper = new (options.mapper)(options);

    Model.prototype = Object.create(Data.prototype);
    Model.prototype.__mapper__ = mapper;

    Model.find = function(id) {
        return mapper.find(id);
    };

    return Model;
};

exports.Data = Data;

function Data(data, is_fresh) {
    var self = this;
    var mapper = this.getMapper();

    _.each(this.getMapper().getColumn(), function(config, prop) {
        this.__defineSetter__(prop, function(value) {
            self._setProp(prop, value, true);
        });

        this.__defineGetter__(prop, _.bind(this._getProp, this, prop));
    }, this);

    this._fresh = true;
    this._data = {};
    this._dirty = {};

    this.setProps(data);

    this._fresh = (typeof is_fresh == 'undefined') ? true : !!is_fresh;
    if (!this._fresh) {
        this._dirty = {};
    } else {
        _.each(mapper.getColumn(), function(config, name) {
            if (name in this._data || config['allow_null'])
                return true;

            var default_value = mapper.getColumnDefaultValue(name);
            if (default_value === null)
                return true;

            this._changeProp(name, default_value);
        }, this);
    }
}

Data.prototype.hasProp = function(prop) {
    return !!this.getMapper().getColumn(prop);
};

Data.prototype.setProps = function(data) {
    var columns = this.getMapper().getColumn();
    var set = 0;

    _.each(data, function(value, key) {
        if (key in columns) {
            if (this._setProp(key, value))
                set++;
        }
    }, this);

    return set;
};

Data.prototype.isFresh = function() {
    return this._fresh;
};

Data.prototype.isDirty = function() {
    return !!_.keys(this._dirty).length;
};

Data.prototype.id = function() {
    var primary_key = this.getMapper().getPrimaryKey();

    if (!_.isArray(primary_key))
        return this[primary_key];

    var id = {};
    _.each(primary_key, function(name) {
        id[name] = this[name];
    }, this);

    return id;
};

Data.prototype.save = function() {
    this.getMapper().save(this);
};

Data.prototype.destroy = function() {
};

Data.prototype.getMapper = function() {
    return this.__mapper__;
};

Data.prototype._getProp = function(prop) {
    var column = this.getMapper().getColumn(prop);

    return this._data[prop] || column['default'];
};

Data.prototype._setProp = function(prop, value, strict) {
    var strict = _.isUndefined(strict) ? false : !!strict;
    var column = this.getMapper().getColumn(prop);

    if (!column)
        throw new Error('Undefined property: '+ prop);

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

    value = Type.getHelper(column['type']).normalize(value);

    if (this._data[prop] === value)
        return false;

    this._changeProp(prop, value);
    return true;
};

Data.prototype._changeProp = function(prop, value) {
    this._data[prop] = value;
    this._dirty[prop] = true;
};
