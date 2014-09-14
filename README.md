架构
=========================================================

AnyORM是一个以[DataMapper](http://en.wikipedia.org/wiki/Data_mapper_pattern)模式实现的ORM库，整个库由四部分构成：Data、Mapper、Type、Service。

### Data（数据）

Data主要承载业务逻辑封装，关注数据在具体业务逻辑中的使用。

和ActiveRecord模式的ORM不同之处在于，Data不关心存储服务细节，这些细节都委托给Mapper处理。

这种把业务逻辑和存储服务隔离开的一个好处就是，当业务发展过程中需要迁移到另外一种存储服务之后，业务逻辑层不需要经受太多的改动。

无论数据实际是存储在PostgreSQL这样的关系式数据库，还是在MongoDB这样的NoSQL数据库，最终这些数据都具有大致相同的API。

把数据从PostgreSQL迁移到MongoDB这种情况，完全不改动已有代码基本上是不可能的，我们只能追求如何改得更少，改起来更方便。

### Mapper（业务数据和存储数据之间的映射）

Data和Service的中间层，负责从存储服务中读取数据并打包为Data实例，也负责把Data内的数据存储到存储服务。

AnyORM已经封装了常用的关系式数据库Mapper，可以直接使用，也可以根据需要封装自己的Mapper class。

### Type（数据类型）

数据类型封装，负责处理数据从存储服务到程序执行空间内的转换，数据有效性等等细节处理。

例如create_time在程序内以javascript Date数据类型的形式存在，但是保存到数据库内需要转换为ISO8601的格式（比如 2014-01-01T00:00:00Z），这种转换由预定义的数据类型方法透明的处理，在Data使用时不需要再费事的自行处理。

AnyORM除了提供一系列常用的数据类型之外，还支持自定义数据类型，满足不同业务的实际需求。

### Service（存储服务读写）

存储服务封装，AnyORM已经提供了常用的关系式数据库（MySQL、PostgreSQL、SQLite3）和Redis服务。

另外Service模块还提供了一个小巧灵活的Service管理模块，实现多个数据源的管理工作。

快速开始
=========================================================

我将以一个简单的留言板应用进行展示，此应用包含两个Model，用户(User)和帖子(Topic)，所有的数据存储在PostgreSQL数据库中，数据库服务器的地址是127.0.0.1，数据库的名字是"borad"。


### 定义Service

``` javascript
var anyorm = require('anyorm');
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
```

### 定义Data

``` javascript
var User = anyorm.defineData({
    mapper: anyorm.DBMapper,
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
            type: 'string',
            pattern: /^[a-z\.\-]+@[a-z\.\-]+\.[a-z]{2,3}$/i,
            strict: true,
            normalize: function(email) {
                return email.toLowerCase();
            }
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
        register_time: {
            type: 'datetime',
            refuse_update: true,
            default: 'now'
        }
    }
});

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
    var ts = (this.register_time.getTime() / 1000) >> 0;
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
    return Topic.getMapper().select().where('reply_topic = ?', this.getId());
};

// return promise
Topic.post = function(user, topic, reply_topic_id) {
    var topic = new Topic;

    topic.author = user.getId();
    topic.subject = topic.subject;
    topic.content = topic.content;

    if (reply_topic_id) {
        topic.reply_topic = reply_topic_id;
    }

    return topic.save();
};
```

### 定义Mapper

上面的User class已经使用了现成的DBMapper

为了展示如何使用自定义Mapper，这里将利用另外一个现成的DBCacheMapper来为User数据增加一层缓存

当User.find(id)时，会先在缓存中查询，一旦命中就不需要再到数据库内查询。当没有命中缓存时，把数据库的查询结果缓存起来，下次直接使用。当修改了User数据时，删除已经缓存的老数据。

缓存机制对于User是透明的，不会改变User的使用方式。

``` javascript
var Promise = require('bluebird');

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

// UserMapper继承自anyorm.CacheDBMapper
// CacheDBMapper继承自DBMapper
// CacheDBMapper需要自行实现缓存读写细节
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

var User = defineData({
    mapper: UserMapper,
    // 缓存有效时间，单位：秒
    cache_ttl: 300,
    // 其它配置
    // ...
});
```

### 自定义Type

``` javascript
var assert = require('assert');

// 定义新的数据类型
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

// 现在可以声明email字段的数据类型是"email"
var User = anyorm.defineData({
    // 其它配置
    // ...
    attributes: {
        email: {type: 'email'},
        // 其它字段
        // ...
    }
});
```

### 使用

注册新用户

``` javascript
User.register('Foo@example.com', 'my password')
    .then(function(user) {
        console.log('User register success!')
    })
    .catch(function(error) {
        console.log('User register failed');
        console.log(error);
    });
```

登录验证
``` javascript
User.login('foo@example.com', 'my password').then(function(user) {
    if (user) {
        console.log('Login success');
    } else {
        console.log('Login failed');
    }
}).catch(function(error) { console.log(error); });
```

修改密码
``` javascript
User.findByEmail('foo@example.com')
    .then(function(user) {
        // password赋值后会自动转换为md5值
        user.password = 'new password';

        return user.save();
    })
    .catch(function(error) {
        console.log(error);
    });
```

留言
``` javascript
var post = {
    subject: 'hello world!';
    content: 'bla bla bla ...';
};

Topic.post(user, post).save().then(function(topic) {
    console.log('Topic post success');
    console.log(topic);

    return topic.getAuthor();
}).then(function(author) {
    console.log('Author is', author.email);
}).catch(function(error) { console.log(error); });
```

查询留言
``` javascript
user.selectTopic().then(function(topics) {
    for (var i = 0; topic = topics[i++];) {
        console.log(topic);
    }
}).catch(function(error) { console.log(error); });

// 如果查询结果很大，一次性载入会很耗费内存，可以用stream的方式来处理
User.selectTopic({return_stream: true}).then(function(stream) {
    return new Promise(function(resolve, reject) {
        stream.on('data', function() {
            var topic = stream.ready();
            console.log(topic);
        });

        stream.on('error', reject);

        stream.on('end', resolve);
    });
}).catch(function(error) { console.log(error); });
```
