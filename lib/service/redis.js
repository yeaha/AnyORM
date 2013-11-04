'use strict';

var _ = require('underscore');
var Q = require('q');

var createClient = exports.createClient = function(options) {
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
RedisPool.prototype.exec = function(command, args) {
    args = _.isUndefined(args)
         ? []
         : (_.isArray(args) ? args : [args]);

    return Q.ninvoke(this, 'acquire')
            .then(function(client) {
                var _release = this.release.bind(this, client);

                return Q.npost(client, command, args).finally(_release);
            }.bind(this));
};

// return promise
RedisPool.prototype.multi = function() {
    return Q.ninvoke(this, 'acquire')
            .then(function(client) {
                var _release = this.release.bind(this, client);

                return Q(client.multi()).finally(_release);
            }.bind(this));
};

RedisPool.prototype.connect = function() {
    return this._pool
        || (this._pool = require('generic-pool').Pool(this._pool_options));
};

RedisPool.prototype.disconnect = function() {
    var pool = this._pool;

    pool && pool.drain(function() {
        pool.destroyAllNow();
        delete this._pool;
    }.bind(this));
};

_.each(['acquire', 'release'], function(method) {
    RedisPool.prototype[method] = function() {
        var pool = this.connect();

        return pool[method].apply(pool, arguments);
    };
});
