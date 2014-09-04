/**
 * Service.define('redis', {
 *     generator: function(options) {
 *         return Service.Redis.createClient(options);
 *     },
 *     host: '127.0.0.1',
 *     port: 6379,
 *     connect_timeout: 3000,
 * });
 *
 * var redis = Service.get('redis');
 * redis.set('foo', 'bar');
 * redis.quit();
 *
 * //////////////////////////////////////////////////////////////////////
 *
 * Service.define('redis', {
 *     generator: function(config) {
 *         return Service.Redis.createPool(config.pool, config.client);
 *     },
 *     pool: {
 *         max: 10,
 *         min: 3
 *     },
 *     client: {
 *         host: '127.0.0.1',
 *         port: 6379,
 *         database: 1,
 *         connect_timeout: 3000,
 *     }
 * });
 *
 * var redis = Service.get('redis');
 *
 * redis.execute('ping')
 *      .then(function(result) {
 *          console.log(result);
 *      })
 *      .catch(function(error) {
 *          console.log(error);
 *      })
 *      .finally(function() {
 *          redis.disconnect();
 *      });
 */

'use strict';

var Promise = require('bluebird');
var _ = require('underscore');

var createClient = exports.createClient = function(options) {
    options = options || {};

    var args;
    if (options.unix_socket) {
        var unix_socket = options.unix_socket;
        delete options.unix_socket;

        args = [unix_socket, options];
    } else {
        var port = options.port || 6379;
        var host = options.host || '127.0.0.1';

        delete options.port;
        delete options.host;

        args = [port, host, options];
    }

    var redis = require('redis');
    var client = redis.createClient.apply(redis, args);
    var database = options['database'];

    if (database) {
        client.on('connect', _.bind(client.select, client, database));
    }

    return client;
};

exports.createPool = function(pool_options, client_options) {
    return new RedisPool(pool_options, client_options);
};

function RedisPool(pool_options, client_options) {
    this._pool_options = _.defaults(pool_options || {}, {
        name: 'redis',
        create: function(callback) {
            try {
                var client = createClient(client_options);

                callback(null, client);
            } catch (error) {
                callback(error);
            }
        },
        destroy: function(client) {
            client.quit();
        }
    });
}

RedisPool.prototype.connect = function() {
    return this._pool
        || (this._pool = require('generic-pool').Pool(this._pool_options));
};

// return promise
RedisPool.prototype.disconnect = function() {
    var pool = this._pool;

    if (!pool) {
        return Promise.resolve(true);
    }

    var self = this;
    return new Promise(function(resolve) {
        pool.drain(function() {
            pool.destroyAllNow(function() {
                self._pool = null;

                resolve(true);
            });
        });
    });
};

// return promise
RedisPool.prototype.acquire = function(priority) {
    var pool = this.connect();

    return new Promise(function(resolve, reject) {
        pool.acquire(function(error, client) {
            error ? reject(error) : resolve(client);
        }, priority);
    });
};

RedisPool.prototype.release = function(client) {
    return this._pool
         ? this._pool.release(client)
         : false;
};

// return promise
RedisPool.prototype.execute = function(cmd, args) {
    args = args === undefined
         ? []
         : (_.isArray(args) ? args : Array.prototype.slice.call(arguments, 1));

    var self = this;
    return this.acquire().then(function(client) {
        return new Promise(function(resolve, reject) {
            client.send_command(cmd, args, function(error, result) {
                self.release(client);
                error ? reject(error) : resolve(result);
            });
        });
    });
};
