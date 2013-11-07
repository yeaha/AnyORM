"use strict";

var _ = require('underscore');
var Q = require('q');
var define = require(__dirname+'/../mapper').define;

module.exports = exports =  define({
    doFind: function(id, redis) {
        var key = this._getKey(id);

        redis = redis || this.getStorage();

        return redis.exec('hgetall', key);
    },
    doInsert: function(data, redis) {
        var key = this._getKey(data.getId());
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

                        return redis.exec('hmset', [key, record]);
                    });
    },
    doUpdate: function(data, redis) {
        var key = this._getKey(data.getId());
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
        var key = this._getKey(data.getId());

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
