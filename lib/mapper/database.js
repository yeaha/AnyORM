"use strict";

var Mapper = require(__dirname+'/../mapper');
var Promise = require('bluebird');
var _ = require('underscore');

/**
 * @class
 */
var DBMapper = exports.DBMapper = Mapper.define({
    __decorate: function(NewData) {
        NewData.select = function() {
            return this.select.apply(this, arguments);
        }.bind(this);
    },

    /**
     * @return {Select}
     */
    select: function() {
        var select = this.getService().select(this.getCollection());

        select.setProcessor(function(record) {
            return record ? this.pack(record) : false;
        }.bind(this));

        return select;
    },

    /**
     * @param {string|number|object} id
     * @param {Adapter} [db]
     * @param {string} [table]
     * @return {Promise} Promise with found record
     */
    doFind: function(id, db, table) {
        db = db || this.getService();
        table = table || this.getCollection();

        var select = db.select(table);
        var where = this._whereId(id);

        return select
                .where(where['text'], where['values'])
                .getOne();
    },

    /**
     * @param {Data} data
     * @param {Adapter} [db]
     * @param {string} [table]
     * @return {Promise} Promise with last insert id
     */
    doInsert: function(data, db, table) {
        db = db || this.getService();
        table = table || this.getCollection();

        var record = this.unpack(data);
        var returning = this.getPrimaryKey();

        return db.insert(table, record, returning);
    },

    /**
     * @param {Data} data
     * @param {Adapter} [db]
     * @param {string} [table]
     * @return {Promise} Promise with affected row count
     */
    doUpdate: function(data, db, table) {
        db = db || this.getService();
        table = table || this.getCollection();

        var record = this.unpack(data, {dirty: true});
        var where = this._whereId(data.getId());

        return db.update(table, record, where['text'], where['values']);
    },

    /**
     * @param {Data} data
     * @param {Adapter} [db]
     * @param {string} [table]
     * @return {Promise} Promise with affected row count
     */
    doDelete: function(data, db, table) {
        db = db || this.getService();
        table = table || this.getCollection();

        var where = this._whereId(data.getId());

        return db.delete(table, where['text'], where['values']);
    },

    /**
     * @param {string|number|object} id
     * @return {object}
     */
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

/**
 * @class CacheDBMapper
 */
exports.CacheDBMapper = Mapper.define({
    /**
     * @abstract
     * @param {*} id
     * @return {Promise|object} Promise with record or record
     */
    _getCache: function(id) { throw new Error('CacheDBMapper: _getCache() not implement'); },

    /**
     * @abstract
     * @param {*} id
     */
    _deleteCache: function(id) { throw new Error('CacheDBMapper: _deleteCache() not implement'); },

    /**
     * @abstract
     * @param {*} id
     * @param {object} record
     */
    _saveCache: function(id, record) { throw new Error('CacheDBMapper: _saveCache() not implement'); },

    __initialize: function() {
        var self = this;

        // delete cache after update or delete
        ['after:update', 'after:delete'].forEach(function(event) {
            self.on(event, function(data) {
                self._deleteCache(data.getId());
            });
        });
    },

    /**
     * @param {Data} data
     * @return {Promise}
     */
    refresh: function(data) {
        return Promise.try(this._deleteCache, data.getId(), this)
                      .then(Mapper.Mapper.prototype.refresh.bind(this, data));
    },

    /**
     * If found record in cache, use it
     * Or find in database and save into cache
     *
     * @param {string|number|object} id
     * @return {Promise} Promise with found record
     */
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
