'use strict';

var _ = require('underscore');
var Q = require('q');

function createClient(options) {
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

function RedisPool(client_options, pool_options) {
    pool_options = _.extend({
        name: 'redis',
        create: function(cb) {
            try {
                var client = createClient(client_options);
                cb(null, client);
            } catch (error) {
                console.log('catch');
                cb(error);
            }
        },
        destroy: function(client) {
            client.end();
        }
    }, pool_options);

    this._pool = require('generic-pool').Pool(pool_options);

    _.each(['exit', 'SIGHUP', 'SIGINT', 'SIGQUIT'], function(event) {
        process.on(event, _.bind(this.close, this));
    }, this);
}

// return promise
RedisPool.prototype.exec = function(command, args) {
    var self = this;

    args = _.isUndefined(args)
         ? []
         : (_.isArray(args) ? args : _.values(arguments).slice(1));

    return Q.ninvoke(this, 'acquire')
            .then(function(client) {
                return Q.npost(client, command, args)
                        .finally(function() {
                            self.release(client);
                        });
            });
};

RedisPool.prototype.close = function(callback) {
    var pool = this._pool;

    pool && pool.drain(function() {
        pool.destroyAllNow();
        delete this._pool;
        callback && callback();
    }.bind(this));
};

_.each(['acquire', 'release'], function(method) {
    RedisPool.prototype[method] = function() {
        var pool = this._pool;

        return pool[method].apply(pool, arguments);
    };
});

exports.createClient = createClient;

exports.createPool = function(client_options, pool_options) {
    return new RedisPool(client_options, pool_options);
};
