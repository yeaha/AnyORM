// 自定义mapper，在数据库前加一层缓存

var Q = require('q');
var anyorm = require('../lib');
var Service = anyorm.Service;

// 定义数据库服务
Service.register({
    redis: {
        constructor: function(config) {
            return Service.Redis.createPool(config['client'], config['pool']);
        },
        client: {host: '127.0.0.1', port: 6379},
        pool: {min: 2, max: 8}
    },
    db: {
        constructor: function(config) {
            var Adapter = Service.DB.Adapter;
            return new Adapter(config['dsn'], config['pool']);
        },
        dsn: 'sqlite3://'+__dirname+'/example.sqlite3',
        pool: {min: 2, max: 8, log: false}
    },
});

var UserMapper = anyorm.defineMapper({
    _getCache: function(id) {
        var redis = Service.get('redis');
        var key = this._getCacheKey(id);

        return redis.exec('hgetall', key);
    },
    _deleteCache: function(id) {
        var redis = Service.get('redis');
        var key = this._getCacheKey(id);

        return redis.exec('del', key);
    },
    _saveCache: function(id, record) {
        var redis = Service.get('redis');
        var key = this._getCacheKey(id);
        var ttl = this.getOption('cache_ttl');

        return redis.multi()
                .then(function(multi) {
                    multi.hmset(key, record);
                    multi.expire(key, ttl);

                    return Q.ninvoke(multi, 'exec');
                });
    },
    _getCacheKey: function(id) {
        var prefix = this.getOption('cache_key');

        return prefix+id;
    },
}, anyorm.CacheDBMapper);

var User = anyorm.defineData({
    mapper: UserMapper,
    storage: 'db',
    collection: 'user',
    properties: {
        user_id: {type: 'integer', primary_key: true, auto_increase: true},
        email: {type: 'string', refuse_update: true, pattern: /@/},
        passwd: {type: 'string'},
        create_time: {type: 'datetime', default: 'now', refuse_update: true},
        update_time: {type: 'datetime'},
    },
    cache_key: 'user:data:',
    cache_ttl: 300,
});

User.prototype._normalize = function(key, value, config) {
    if (key == 'passwd')
        return md5(value + this.create_time.getTime());
    return value;
};

function md5(str) {
    var md5sum = require('crypto').createHash('md5');
    return md5sum.update(str).digest('hex');
}
