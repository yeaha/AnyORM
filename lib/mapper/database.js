"use strict";

var _ = require('underscore');
var Q = require('q');
var define = require(__dirname+'/../mapper').define;

var DBMapper = exports.DBMapper = define({
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
        var where = this._whereId(id);

        return select
                .where(where['text'], where['values'])
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
        var where = this._whereId(data.getId());

        return db.update(table, record, where['text'], where['values']);
    },
    doDelete: function(data, db, table) {
        db = db || this.getStorage();
        table = table || this.getCollection();

        var where = this._whereId(db.getId());

        return db.delete(table, where['text'], where['values']);
    },
    _whereId: function(id) {
        var db = this.getStorage(id);
        var exprs = [];
        var values = [];
        var keys = this.getPrimaryKey();

        if (keys.length === 1 && !_.isObject(id)) {
            var o = {};
            o[keys[0]] = id;

            id = o;
        }

        _.each(keys, function(property) {
            exprs.push(db.quoteIdentifier(property) +' = ?');

            values.push(id[property]);
        });

        return {
            text: exprs.join(' AND '),
            values: values
        };
    }
});

// database mapper with custome cache
exports.CacheDBMapper = define({
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

        return Q.fcall(_.bind(this._deleteCache, this, data.getId()))
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
                       this._deleteCache(data.getId());
                       return result;
                   }.bind(this));
    },
    doDelete: function(data) {
        return this._doDelete.apply(this, arguments)
                   .then(function(result) {
                       this._deleteCache(data.getId());
                       return result;
                   }.bind(this));
    }
}, DBMapper);
