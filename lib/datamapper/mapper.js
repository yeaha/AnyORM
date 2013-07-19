exports.Mapper = Mapper;
exports.DBMapper = DBMapper;

var _ = require('underscore');
var Q = require('q');
var Type = require('./type');

function Mapper(options) {
    var columns;
    var primary_key = [];

    options = _.extend({
        storage: null,
        collection: null,
        columns: {},
        readonly: false
    }, options);

    columns = options.columns;
    _.each(columns, function(config, name) {
        config = _.extend({
            type: null,
            primary_key: false,
            auto_increase: false,
            refuse_update: false,
            allow_null: false,
            default: null,
            pattern: null,
            strict: false
        }, config);

        if (config['primary_key']) {
            primary_key.push(name);

            config['refuse_update'] = true;
            config['allow_null'] = false;
        }

        columns[name] = config;
    });

    if (!primary_key.length)
        throw new Error('Undefined primary key!');

    if (primary_key.length === 1)
        primary_key = primary_key[0];

    options.primary_key = primary_key;

    this._options = options;
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

Mapper.prototype.getOption = function(key) {
    var options = this._options;
    if (!key) return options;

    return (key in options) ? options[key] : false;
};

Mapper.prototype.find = function(id) {
    var constructor = this.getOption('constructor');

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
    var storage = this.getOption('storage');

    if (!storage)
        throw new Error('Undefined data storage');

    return storage;
};

Mapper.prototype.getCollection = function() {
    var collection = this.getOption('collection');

    if (!collection)
        throw new Error('Undefined data collection');

    return collection;
};

Mapper.prototype.getPrimaryKey = function() {
    return this.getOption('primary_key');
};

Mapper.prototype.getColumn = function(name) {
    var columns = this.getOption('columns');

    if (!name) return columns;

    return (name in columns)
         ? columns[name]
         : false;
};

Mapper.prototype.getColumnDefaultValue = function(name) {
    var config = this.getColumn(name);

    return Type.getHelper(config['type']).getDefaultValue(config);
};

Mapper.prototype.isReadonly = function() {
    return this.getOption('readonly');
};

////////////////////////////////////////////////////////////////////////////////
// database mapper implement

function DBMapper() {
    Mapper.apply(this, arguments);
}

DBMapper.prototype = Object.create(Mapper.prototype);

DBMapper.prototype._doFind = function(id) {
};

DBMapper.prototype._doInsert = function(data) {
};

DBMapper.prototype._doUpdate = function(data) {
};

DBMapper.prototype._doDelete = function(data) {
};
