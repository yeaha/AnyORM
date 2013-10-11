'use strict';

var _ = require('underscore');
var Q = require('q');

exports.createClient = function createClient(options) {
    var args = [];

    options = options || {};
    if (options['unix_socket']) {
        args.push(options['unix_socket'], null);
        delete options['unix_socket'];

        args.push(options);
    } else {
        var port = options['port'] || null;
        var host = options['host'] || null;
        args.push(port, host);

        delete options['port'];
        delete options['host'];

        args.push(options);
    }

    var redis = require('redis');
    var client = redis.createClient.apply(redis, args);
    var database = options['database'];

    if (database)
        client.on('connect', _.bind(client.select, client, database));

    return client;
};

exports.createPool = function(client_options, pool_options) {
    return new RedisPool(client_options, pool_options);
};

function RedisPool(client_options, pool_options) {
    this._pool_options = _.defaults(pool_options, {
        name: 'redis',
        create: function(cb) {
            try {
                var client = createClient(client_options);
                cb(null, client);
            } catch (error) {
                cb(error);
            }
        },
        destroy: function(client) {
            client.end();
        }
    });

    _.each(['exit', 'SIGHUP', 'SIGINT', 'SIGQUIT'], function(event) {
        process.once(event, _.bind(this.disconnect, this));
    }, this);
}

// return promise
RedisPool.prototype.exec = function(command, args, callback) {
    var self = this;

    args = _.isUndefined(args)
         ? []
         : (_.isArray(args) ? args : [args]);

    return Q.ninvoke(this, 'acquire')
            .then(function(client) {
                return Q.npost(client, command, args)
                        .then(function(result) {
                            callback && callback(null, result);
                            return result;
                        })
                        .catch(function(error) {
                            callback && callback(error);
                            throw error;
                        });
                        .finally(function() {
                            self.release(client);
                        });
            })
            .catch(function(error) {
                callback && callback(error);
                throw error;
            });
};

// return promise
RedisPool.prototype.multi = function(callback) {
    var self = this;

    return Q.ninvoke(this, 'acquire')
            .then(function(client) {
                var multi = client.multi();

                return Q(multi)
                        .then(function(multi) {
                            callback && callback(null, multi);
                            return multi;
                        })
                        .finally(function() {
                            self.release(client);
                        });
            })
            .catch(function(error) {
                callback && callback(error);
                throw error;
            });
};

RedisPool.prototype.connect = function() {
    return this._pool
        || (this._pool = require('generic-pool').Pool(this._pool_options));
};

RedisPool.prototype.disconnect = function(callback) {
    var pool = this._pool;

    pool && pool.drain(function() {
        pool.destroyAllNow();
        delete this._pool;
        callback && callback();
    }.bind(this));
};

_.each(['acquire', 'release'], function(method) {
    RedisPool.prototype[method] = function() {
        var pool = this.connect();

        return pool[method].apply(pool, arguments);
    };
});
