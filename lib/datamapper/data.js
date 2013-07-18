exports.Data = Data;

var _ = require('underscore');

function Data(data, is_fresh) {
    var self = this;

    _.each(this.getMapper().getColumn(), function(config, prop) {
        this.__defineSetter__(prop, function(val) {
            self._setProp(prop, val);
        });

        this.__defineGetter__(prop, _.bind(this._getProp, this, prop));
    }, this);

    this._data = data || {};
    this._dirty = {};
    this._fresh = !!is_fresh;
}

Data.prototype.hasProp = function(prop) {
    return !!this.getMapper().getColumn(prop);
};

Data.prototype.setProps = function(data) {
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

Data.prototype._setProp = function(prop, val) {
    var config = this.getMapper().getColumn(prop);

    this._data[prop] = val;
    this._dirty[prop] = true;
};

Data.prototype._getProp = function(prop) {
    var config = this.getMapper().getColumn(prop);

    return this._data[prop] || config['default'];
};
