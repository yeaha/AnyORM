exports.Mapper = Mapper;
exports.DBMapper = DBMapper;

var _ = require('underscore');
var Q = require('q');

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
                return data
                     ? new constructor(data, false)
                     : false;
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
