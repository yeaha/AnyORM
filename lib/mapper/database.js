"use strict";

var _ = require('underscore');
var Q = require('q');
var define = require(__dirname+'/../mapper').define;

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

exports.DBMapper = DBMapper;
exports.CacheDBMapper = CacheDBMapper;
