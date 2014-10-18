'use strict';

var Promise = require('bluebird');
var anyorm = require(__dirname+'/../');
var Service = anyorm.Service;

anyorm.defineService({
    database: {
        factory: function(options) {
            return new Service.DB.Adapter(options.dsn, options.pool);
        },

        dsn: 'postgres://user:password@192.168.0.1/board',
        pool: {
            max: 8,
            min: 1
        }
    },

    redis: {
        factory: function(options) {
            return Service.Redis.createPool(options.pool, options.client);
        },

        client: {
            host: '127.0.0.1',
            port: 6379,
        },

        pool: {
            max: 8,
            min: 3,
        }
    }
});

var TopicMapper = anyorm.defineMapper({
    _getCacheKey: function(id) {
        return this.getOption('cache_prefix') + id;
    },
    _getCache: function(id) {
        var redis = Service.get('redis');
        var key = this._getCacheKey(id);

        return redis.execute('hGetAll', key);
    },
    _deleteCache: function(id) {
        var redis = Service.get('redis');
        var key = this._getCacheKey(id);

        return redis.execute('del', key);
    },
    _saveCache: function(id, record) {
        var redis = Service.get('redis');
        var key = this._getCacheKey(id);
        var ttl = this.getOption('cache_ttl');

        return redis.acquire().then(function(client) {
            return new Promise(function(resolve, reject) {
                client.multi()
                      .hmset(key, record)
                      .expire(key, ttl)
                      .exec(function(error, result) {
                          redis.release(client);

                          error ? reject(error) : resolve(reject);
                      });
            });
        });
    }
}, anyorm.CacheDBMapper);

var Topic = anyorm.defineData({
    mapper: TopicMapper,
    service: 'database',
    collection: 'board.topics',
    cache_ttl: 300, // second
    cache_prefix: 'topic:',
    attributes: {
        topic_id: {type: 'integer', primary_key: true, auto_generate: true},
        subject: 'string',
        content: 'string',
        create_time: {type: 'datetime', refuse_update: true, default: 'now'}
    }
});
