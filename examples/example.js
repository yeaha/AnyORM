var Promise = require('bluebird');
var assert = require('assert');
var anyorm = require(__dirname+'/../');
var Service = anyorm.Service;

// 一旦定义好名字为"db"的服务之后，以后就可以用 Service.get('db') 来使用这个服务。
anyorm.defineService('db', {
    // 数据库服务实例化方法
    factory: function(options) {
        return new Service.DB.Adapter(options.dsn, options.pool);
    },

    // 数据库配置
    dsn: 'postgres://user:password@127.0.0.1/board',

    // 连接池配置
    pool: {
        max: 8,
        min: 1
    }
});

// 定义缓存使用的Redis服务
anyorm.defineService('redis', {
    factory: function(options) {
        return Service.Redis.createPool(options.pool, options.client);
    },

    // redis配置
    client: {
        host: '127.0.0.1',
        port: 6379,
    },

    // redis连接池配置
    pool: {
        max: 8,
        min: 3,
    }
});

anyorm.defineType('email', {
    normalize: function(value) {
        if (value === '' || value === null) {
            return null;
        }

        assert.equal(typeof value, 'string', 'email不是字符串');

        value = value.trim();
        if (value === '') {
            return null;
        }

        assert.ok(/^[a-z\.\-]+@[a-z\.\-]+\.[a-z]{2,3}$/i.test(value), '非法的email');

        return value.toLowerCase();
    }
});

var UserMapper = anyorm.defineMapper({
    _getCacheKey: function(id) {
        return 'user:'+id;
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

var User = anyorm.defineData({
    mapper: UserMapper,
    service: 'db',
    collection: 'board.users',
    attributes: {
        // 整数类型的自增长主键
        user_id: {
            type: 'integer',
            primary_key: true,
            auto_generate: true
        },
        // 用户名
        email: {
            type: 'email',
            strict: true,
        },
        // 密码
        password: {
            type: 'string',
            strict: true,
            normalize: function(password) {
                return this._normalizePassword(password);
            }
        },
        // 账号被锁定的时间，默认不锁定
        lock_time: {
            type: 'datetime',
            allow_null: true,
            strict: true
        },
        // 注册时间，保存后不允许更新
        create_time: {
            type: 'datetime',
            refuse_update: true,
            default: 'now'
        },
        // 最后修改时间
        update_time: {
            type: 'datetime',
            allow_null: true,
        }
    }
});

User.prototype.__before_update = function() {
    this.update_time = new Date;
};

User.prototype.checkPassword = function(password) {
    return this._normalizePassword(password) === this.password;
};

User.prototype.isLocked = function() {
    return !!this.lock_time;
};

User.prototype.lock = function() {
    this.lock = new Date;
    return this.save();
};

User.prototype.unlock = function() {
    this.lock = null;
    return this.save();
};

// 以create_time为slat，把密码转换为md5
User.prototype._normalizePassword = function(password) {
    // unix timestamp
    var ts = (this.create_time.getTime() / 1000) >> 0;
    password = password + ts;

    var crypt = require('crypto');
    var hash = crypt.createHash('md5');

    return hash.update(password).digest('hex');
};

// return promise
User.register = function(email, password) {
    return User.findByEmail(email).then(function(user) {
        if (user) {
            throw new Error('Email已经被注册');
        }

        var user = new User;
        user.email = email;
        user.password = password;

        return user.save();
    });
};

// return promise
User.findByEmail = function(email) {
    email = email.trim();
    assert.ok(email !== '', 'Email不允许为空');

    return User.getMapper().select().where('email = ?', email.toLowerCase()).getOne();
};

// return promise
User.login = function(email, password) {
    return User.findByEmail(email).then(function(user) {
        if (!user || !user.checkPassword(password)) {
            return false;
        }

        return user;
    });
};

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

var Topic = anyorm.defineData({
    mapper: anyorm.DBMapper,
    service: 'db',
    collection: 'board.topics',
    attributes: {
        topic_id: {type: 'integer', primary_key: true, auto_generate: true},
        author: 'integer',
        reply_topic: {type: 'integer', allow_null: true},
        subject: 'string',
        content: 'string',
        create_time: {type: 'datetime', refuse_update: true, default: 'now'}
    }
});

// return promise
Topic.prototype.getAuthor = function() {
    return User.find(this.author);
};

// return Service.DB.Select
Topic.prototype.selectReply = function() {
    return this.getMapper().select().where('reply_topic = ?', this.getId());
};

// return promise
Topic.post = function(user, post) {
    var topic = new Topic;

    topic.author = user.getId();
    topic.merge(post);

    return topic.save();
};
