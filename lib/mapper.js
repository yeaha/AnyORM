"use strict";

var _ = require('underscore');
var EventEmitter = require('events').EventEmitter;
var Q = require('q');
var Type = require(__dirname+'/type');
var Services = require(__dirname+'/service/manager');

// 定义一个新的mapper
function define(factory, base) {
    base = base || Mapper;

    var NewMapper = function() {
        base.apply(this, arguments);
    };

    NewMapper.prototype = Object.create(base.prototype);
    NewMapper.prototype.constructor = NewMapper;

    _.extend(NewMapper.prototype, factory);

    return NewMapper;
};

_.extend(Mapper.prototype, EventEmitter.prototype);
function Mapper(options) {
    EventEmitter.call(this);

    var properties;
    var primary_key = [];

    _.defaults(options, {
        storage: null,
        collection: null,
        properties: {},
        readonly: false,
        strict: false,
    });

    properties = options.properties || {};
    _.each(properties, function(config, key) {
        _.defaults(config, {
            type: null,
            primary_key: false,
            auto_increase: false,
            refuse_update: false,
            allow_null: false,
            default: null,
            pattern: null,
            strict: options.strict,
        });

        if (config['primary_key']) {
            primary_key.push(key);

            config['refuse_update'] = true;
            config['allow_null'] = false;
        }

        properties[key] = config;
    });

    if (!primary_key.length)
        throw new Error('Mapper: undefined primary key!');

    options.primary_key = primary_key;

    this._options = options;

    this.on('save:before', function(data) { data.__before_save(); })
        .on('save:after', function(data) { data.__after_save(); })
        .on('insert:before', function(data) { data.__before_insert(); })
        .on('insert:after', function(data) { data.__after_insert(); })
        .on('update:before', function(data) { data.__before_update(); })
        .on('update:after', function(data) { data.__after_update(); })
        .on('delete:before', function(data) { data.__before_delete(); })
        .on('delete:after', function(data) { data.__after_delete(); });

    this.__initialize();
}

Mapper.prototype.__initialize = function() {};

Mapper.prototype.doFind = function(id) {
    throw new Error('Method not implemented!');
};

Mapper.prototype.doInsert = function(data) {
    throw new Error('Method not implemented!');
};

Mapper.prototype.doUpdate = function(data) {
    throw new Error('Method not implemented!');
};

Mapper.prototype.doDelete = function(data) {
    throw new Error('Method not implemented!');
};

Mapper.prototype.getOption = function(key, throw_error) {
    var options = this._options;

    if (!key)
        return options;

    if (key in options)
        return options[key];

    if (throw_error)
        throw new Error('Mapper: undefined option "'+key+'"');

    return false;
};

Mapper.prototype.getStorage = function() {
    var storage = this.getOption('storage', true);
    return Services.get(storage, identity);
};

Mapper.prototype.getCollection = function() {
    return this.getOption('collection', true);
};

Mapper.prototype.getPrimaryKey = function() {
    return this.getOption('primary_key');
};

Mapper.prototype.getProperty = function(key) {
    var properties = this.getOption('properties');

    if (!key) return properties;

    return (key in properties)
         ? properties[key]
         : false;
};

Mapper.prototype.getPropertyDefaultValue = function(key, config) {
    var config = config || this.getProperty(key);

    return Type.get(config['type']).getDefaultValue(config);
};

Mapper.prototype.hasProperty = function(key) {
    return (key in this.getOption('properties'));
};

Mapper.prototype.isReadonly = function() {
    return this.getOption('readonly');
};

// 把存储记录包装或更新data实例
Mapper.prototype.pack = function(record, data) {
    data = data || new (this.getOption('constructor'));

    data._data = _.extend(data._data, this._recordToProps(record));
    data._dirty = {};
    data._fresh = false;

    return data;
};

// return promise
Mapper.prototype.find = function(id, callback) {
    return this._find(id, null, callback);
};

// return promise
Mapper.prototype.refresh = function(data, callback) {
    return this._find(data.identity(), data, callback);
};

// return promise
Mapper.prototype.save = function(data, callback) {
    if (this.isReadonly())
        return Q.reject(new Error('Mapper is readonly'));

    var save;
    var is_fresh = data.isFresh();

    if (!is_fresh && !data.isDirty())
        return Q(true);

    this.emit('save:before', data);

    save = is_fresh
         ? _.bind(this._insert, this, data)
         : _.bind(this._update, this, data);

    return save()
            .then(function() {
                this.emit('save:after', data);
                callback && callback(null, data);
            }.bind(this))
            .catch(function(error) {
                callback && callback(error);
                throw error;
            });
};

// return promise
Mapper.prototype.destroy = function(data, callback) {
    if (this.isReadonly())
        return Q.reject(new Error('Mapper is readonly'));

    if (data.isFresh())
        return Q(true);

    this.emit('delete:before', data);

    return Q.try(_.bind(this.doDelete, this, data))
            .then(function() {
                this.emit('delete:after', data);
                callback && callback(null, data);
            }.bind(this))
            .catch(function(error) {
                callback && callback(error);
                throw error;
            });
};

// return promise
Mapper.prototype._find = function(id, data, callback) {
    var refresh = !!data;

    return Q.try(_.bind(this.doFind, this, id))
            .then(function(record) {
                if (!record)
                    return false;

                data = this.pack(record, data);
                !refresh && this.emit('found', data);

                callback && callback(null, data);

                return data;
            }.bind(this))
            .catch(function(error) {
                callback && callback(error);
                throw error;
            });
};

// return promise
Mapper.prototype._insert = function(data) {
    this.emit('insert:before', data);

    try {
        this._validateData(data);
    } catch (error) {
        return Q.reject(error);
    }

    return Q.try(_.bind(this.doInsert, this, data))
            .then(function(id) {
                if (!_.isObject(id))
                    id = {};

                this.pack(id, data);
                this.emit('insert:after', data);
            }.bind(this));
};

// return promise
Mapper.prototype._update = function(data) {
    this.emit('update:before', data);

    try {
        this._validateData(data);
    } catch (error) {
        return Q.reject(error);
    }

    return Q.try(_.bind(this.doUpdate, this, data))
            .then(function() {
                this.pack({}, data);
                this.emit('update:after', data);
            }.bind(this));
};

// 把存储记录转换为属性值
Mapper.prototype._recordToProps = function(record) {
    var props = {};

    _.each(this.getProperty(), function(config, key) {
        if (_.has(record, key))
            props[key] = Type.get(config['type']).restore(record[key], config);
    });

    return props;
};

// 把属性值转换为存储记录
Mapper.prototype._propsToRecord = function(props) {
    var record = {};

    _.each(this.getProperty(), function(config, key) {
        if (_.has(props, key))
            record[key] = Type.get(config['type']).store(props[key], config);
    });

    return record;
};

Mapper.prototype._validateData = function(data) {
    var keys;
    var properties = this.getProperty();

    if (data.isFresh()) {
        // check all properties
        data = data.toData();
        keys = _.keys(properties);
    } else {
        // check dirty properties
        data = data.toData(true);
        keys = _.keys(data);
    }

    for (var i = 0, key; key = keys[i++];) {
        var property = properties[key];

        do {
            if (property['allow_null'])
                break;

            if (key in data)
                break;

            if (property['primary_key'] && property['auto_increase'])
                break;

            throw new Error('Property '+key+' not allow null');
        } while (false);
    }

    return true;
};

////////////////////////////////////////////////////////////////////////////////
// database mapper implement

var DBMapper = define({
    select: function() {
        var select = this.getStorage().select(this.getCollection());

        select.setProcessor(function(record) {
            return record ? this.pack(record) : false;
        }.bind(this));

        return select;
    },
    doFind: function(id, db, table) {
        db = db || this.getStorage();
        table = table || this.getCollection();

        var select = db.select(table);
        var where = this._whereIdentity(id);
        var properties = _.keys(this.getProperty());

        return select
                .setColumns(properties)
                .where(where['expr'], where['params'])
                .getOne();
    },
    doInsert: function(data, db, table) {
        db = db || this.getStorage();
        table = table || this.getCollection();

        var record = this._propsToRecord(data.toData());

        var returning = [];
        _.each(this.getPrimaryKey(), function(key) {
            var property = this.getProperty(key);

            if (property['auto_increase'])
                returning.push(key);
        }.bind(this));

        return db.insert(table, record, returning);
    },
    doUpdate: function(data, db, table) {
        db = db || this.getStorage();
        table = table || this.getCollection();

        var record = this._propsToRecord(data.toData(true));
        var where = this._whereIdentity(data.identity());

        return db.update(table, record, where['expr'], where['params']);
    },
    doDelete: function(data, db, table) {
        db = db || this.getStorage();
        table = table || this.getCollection();

        var where = this._whereIdentity(db.identity());

        return db.delete(table, where['expr'], where['params']);
    },
    _whereIdentity: function(identity) {
        var db = this.getStorage(identity);
        var where = [];
        var params = [];
        var keys = this.getPrimaryKey();

        if (keys.length === 1 && !_.isObject(identity)) {
            var o = {};
            o[keys[0]] = identity;

            identity = o;
        }

        _.each(keys, function(property) {
            where.push(db.quoteIdentifier(property) +' = ?');

            params.push(identity[property]);
        });

        return {
            expr: where.join(' AND '),
            params: params
        };
    }
});

// database mapper with custome cache
var CacheDBMapper = define({
    _getCache: function(id) { throw new Error('Method not implement'); },
    _deleteCache: function(id) { throw new Error('Method not implement'); },
    _saveCache: function(id, record) { throw new Error('Method not implement'); },

    _doFind: function() {
        return DBMapper.prototype.doFind.apply(this, arguments);
    },
    _doUpdate: function() {
        return DBMapper.prototype.doUpdate.apply(this, arguments);
    },
    _doDelete: function() {
        return DBMapper.prototype.doDelete.apply(this, arguments);
    },

    refresh: function(data) {
        var refresh = _.bind(Mapper.prototype.refresh, this, arguments);

        return Q.fcall(_.bind(this._deleteCache, this, data.identity()))
                .then(function() {
                    return refresh();
                });
    },
    doFind: function(id) {
        var doFind = _.bind(this._doFind, this, arguments);

        return Q.fcall(_.bind(this._getCache, this, id))
                .then(function(record) {
                    if (record) return record;

                    return doFind()
                               .then(function(record) {
                                   if (record) {
                                       _.each(record, function(value, key) {
                                           if (value === null)
                                               delete record[key];
                                       });

                                       this._saveCache(id, record);
                                   }

                                   return record;
                               }.bind(this));
                }.bind(this));
    },
    doUpdate: function(data) {
        return this._doUpdate.apply(this, arguments)
                   .then(function(result) {
                       this._deleteCache(data.identity());
                       return result;
                   }.bind(this));
    },
    doDelete: function(data) {
        return this._doDelete.apply(this, arguments)
                   .then(function(result) {
                       this._deleteCache(data.identity());
                       return result;
                   }.bind(this));
    }
}, DBMapper);

////////////////////////////////////////////////////////////////////////////////
// redis mapper implement

var RedisMapper = define({
    doFind: function(id, redis) {
        var key = this._getKey(id);

        redis = redis || this.getStorage();

        return redis.exec('hgetall', key);
    },
    doInsert: function(data, redis) {
        var key = this._getKey(data.identity());
        var record = this._propsToRecord(data.toData());

        redis = redis || this.getStorage();

        _.each(record, function(value, key) {
            if (value === null)
                delete record[key];
        });

        return redis.exec('exists', key)
                    .then(function(exists) {
                        if (exists)
                            throw new Error('RedisMapper: duplicate key '+ key);

                        return redis.exec('hmset', key, record);
                    });
    },
    doUpdate: function(data, redis) {
        var key = this._getKey(data.identity());
        var record = this._propsToRecord(data.toData(true));

        var discard = [];
        _.each(record, function(value, key) {
            if (value !== null)
                return true;

            delete record[key];
            discard.push(key);
        });

        redis = redis || this.getStorage();

        return redis.multi()
                    .then(function(multi) {
                        multi.hmset(key, record);

                        if (discard.length) {
                            discard.unshift(key);
                            multi.hdel.apply(multi, discard);
                        }

                        return Q.ninvoke(multi, 'exec');
                    });
    },
    doDelete: function(data, redis) {
        var key = this._getKey(data.identity());

        redis = redis || this.getStorage();

        return redis.exec('del', key);
    },
    _getKey: function(id) {
        if (id === null)
            throw new Error('RedisMapper: data id is null');

        var prefix = this.getOption('key_prefix', true);

        if (_.isObject(id))
            id = _.map(id, function(value, key) { return key+':'+value; }).join(':');

        return prefix + id;
    }
});

exports.define = define;
exports.Mapper = Mapper;
exports.DBMapper = DBMapper;
exports.CacheDBMapper = CacheDBMapper;
exports.RedisMapper = RedisMapper;
