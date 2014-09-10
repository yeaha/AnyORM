"use strict";

var Promise = require('bluebird');
var _ = require('underscore');
var Mapper = require(__dirname+'/../mapper');

module.exports = exports = Mapper.define({
    doFind: function(id, redis) {
        var key = this._getKey(id);

        redis = redis || this.getStorage();

        return redis.execute('hgetall', key);
    },
    doInsert: function(data, redis) {
        var key = this._getKey(data.getId());
        var record = this.unpack(data);

        redis = redis || this.getStorage();

        _.each(record, function(value, key) {
            if (value === null)
                delete record[key];
        });

        return redis.execute('exists', key).then(function(exists) {
            if (exists) {
                throw new Error('RedisMapper: duplicate key '+ key);
            }

            var args = _.flatten(_.pairs(record));
            args.unshift(key);

            return redis.execute('hmset', args);
        });
    },
    doUpdate: function(data, redis) {
        var key = this._getKey(data.getId());
        var record = this.unpack(data, true);

        var discard = [];
        _.each(record, function(value, key) {
            if (value === null) {
                delete record[key];
                discard.push(key);
            }
        });

        redis = redis || this.getStorage();

        return redis.acquire().then(function(client) {
            var multi = client.multi();

            multi.hmset(key, record);

            if (discard.length) {
                discard.unshift(key);
                multi.hdel.apply(multi, discard);
            }

            return new Promise(function(resolve, reject) {
                multi.exec(function(error, result) {
                    redis.release(client);

                    error ? reject(error) : resolve(result);
                });
            });
        });
    },
    doDelete: function(data, redis) {
        var key = this._getKey(data.getId());

        redis = redis || this.getStorage();

        return redis.execute('del', key);
    },
    _getKey: function(id) {
        if (id === null) {
            throw new Error('RedisMapper: data id is null');
        }

        var prefix = this.getOption('key_prefix');

        if (_.isObject(id)) {
            id = _.map(id, function(value, key) { return key+':'+value; }).join(';');
        }

        return prefix + id;
    }
});
