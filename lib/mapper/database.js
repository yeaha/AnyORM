"use strict";

var Mapper = require(__dirname+'/../mapper');
var Promise = require('bluebird');
var _ = require('underscore');

var DBMapper = exports.DBMapper = Mapper.define({
    select: function() {
        var select = this.getService().select(this.getCollection());

        select.setProcessor(function(record) {
            return record ? this.pack(record) : false;
        }.bind(this));

        return select;
    },
    doFind: function(id, db, table) {
        db = db || this.getService();
        table = table || this.getCollection();

        var select = db.select(table);
        var where = this._whereId(id);

        return select
                .where(where['text'], where['values'])
                .getOne();
    },
    doInsert: function(data, db, table) {
        db = db || this.getService();
        table = table || this.getCollection();

        var record = this.unpack(data);
        var returning = this.getPrimaryKey();

        return db.insert(table, record, returning);
    },
    doUpdate: function(data, db, table) {
        db = db || this.getService();
        table = table || this.getCollection();

        var record = this.unpack(data, true);
        var where = this._whereId(data.getId());

        return db.update(table, record, where['text'], where['values']);
    },
    doDelete: function(data, db, table) {
        db = db || this.getService();
        table = table || this.getCollection();

        var where = this._whereId(data.getId());

        return db.delete(table, where['text'], where['values']);
    },
    _whereId: function(id) {
        var db = this.getService(id);
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
exports.CacheDBMapper = Mapper.define({
    _getCache: function(id) { throw new Error('CacheDBMapper: _getCache() not implement'); },
    _deleteCache: function(id) { throw new Error('CacheDBMapper: _deleteCache() not implement'); },
    _saveCache: function(id, record) { throw new Error('CacheDBMapper: _saveCache() not implement'); },

    __initialize: function() {
        var self = this;

        ['after:update', 'after:delete'].forEach(function(event) {
            self.on(event, function(data) {
                self._deleteCache(data.getId());
            });
        });
    },

    refresh: function(data) {
        return Promise.try(this._deleteCache, data.getId(), this)
                      .then(Mapper.Mapper.prototype.refresh.bind(this, data));
    },
    doFind: function(id) {
        var doFind = DBMapper.prototype.doFind.bind(this, id);

        return Promise.try(this._getCache, id, this).then(function(record) {
            if (record) {
                return record;
            }

            return doFind().then(function(record) {
                if (record) {
                    _.each(record, function(value, key) {
                        if (value === null) {
                            delete record[key];
                        }
                    });

                    this._saveCache(id, record);
                }

                return record;
            }.bind(this));
        }.bind(this));
    }
}, DBMapper);
