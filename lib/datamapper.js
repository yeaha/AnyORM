// var Lysine = require('lysine');
// var DataMapper = Lysine.DataMapper;
//
// var User = DataMapper.define({
//     mapper: DataMapper.DBMapper,
//     storage: 'db',
//     collection: 'users.entity',
//     columns: {
//         id: {type: 'integer', primary_key: true, auto_increase: true},
//         email: {type: 'string'},
//         passwd: {type: 'string'},
//         create_time: {type: 'datetime', default: 'now'}
//     }
// });

var _ = require('underscore');
var Q = require('q');
var StorageError = require('./error').StorageError;

function define(meta) {
    var Model = function() {
        this.__mapper__ = mapper;

        Data.apply(this, arguments);
    };
    var mapper = new (meta.mapper)(Model, meta.storage, meta.collection, meta.columns);

    Model.prototype = Object.create(Data.prototype);
    Model.prototype.constructor = Model;

    Model.find = function(id) {
        return mapper.find(id);
    };

    return Model;
};

////////////////////////////////////////////////////////////////////////////////

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

////////////////////////////////////////////////////////////////////////////////

function Mapper(constructor, storage, collection, columns) {
    var defaults = {
            type: null,
            primary_key: false,
            auto_increase: false,
            refuse_update: false,
            allow_null: false,
            default: null,
            pattern: null,
            strict: false
        };
    var primary_key = [];

    _.each(columns, function(config, name) {
        config = _.extend({}, defaults, config);

        if (config['primary_key']) {
            primary_key.push(name);

            config['refuse_update'] = true;
            config['allow_null'] = false;
        }
    });

    if (!primary_key.length)
        throw new Error('Primary key undefined!');

    if (primary_key.length === 1)
        primary_key = primary_key[0];

    this._storage = storage || null;
    this._collection = collection || null;
    this._columns = columns;
    this._constructor = constructor;
}

Mapper.prototype._doFind = function(id) {
    throw new Error('Method not implemented!');
};

Mapper.prototype._doInsert = function(data) {
    throw new Error('Method not implemented!');
};

Mapper.prototype._doUpdate = function(data) {
    throw new Error('Method not implemented!');
};

Mapper.prototype._doDelete = function(data) {
    throw new Error('Method not implemented!');
};

Mapper.prototype.find = function(id) {
    var constructor = this._constructor;

    return Q.fcall(_.bind(this._doFind, this), id)
            .then(function(data) {
                return new constructor(data, false);
            });
};

Mapper.prototype.save = function(data) {
    var is_fresh = data.isFresh();

    if (!is_fresh && !data.isDirty())
        return true;

    if (this.isReadonly())
        throw new Error('Mapper is readonly!');

    return is_fresh ? this._doInsert(data) : this._doUpdate(data);
};

Mapper.prototype.destroy = function(data) {
    if (this.isReadonly())
        throw new Error('Mapper is readonly!');

    if (data.isFresh())
        return true;

    return this._doDelete(data);
};

Mapper.prototype.getStorage = function() {
    return this._storage;
};

Mapper.prototype.getCollection = function() {
    return this._collection;
};

Mapper.prototype.getPrimaryKey = function() {
    return this._primary_key;
};

Mapper.prototype.getColumn = function(name) {
    if (!name)
        return this._columns;

    return (name in this._columns)
         ? this._columns[name]
         : false;
};

Mapper.prototype.isReadonly = function() {
    return this._read_only;
};

////////////////////////////////////////////////////////////////////////////////
// database mapper implement

function DBMapper() {
    Mapper.apply(this, arguments);
}

DBMapper.prototype = Object.create(Mapper.prototype);
DBMapper.prototype.constructor = DBMapper;

DBMapper.prototype._doFind = function(id) {
};

DBMapper.prototype._doInsert = function(data) {
};

DBMapper.prototype._doUpdate = function(data) {
};

DBMapper.prototype._doDelete = function(data) {
};

////////////////////////////////////////////////////////////////////////////////

exports.define = define;

exports.Data = Data;

exports.Mapper = Mapper;

exports.DBMapper = DBMapper;
