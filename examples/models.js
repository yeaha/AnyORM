var Promise = require('bluebird');
var assert = require('assert');
var anyorm = require(__dirname+'/../');
var Service = anyorm.Service;

anyorm.defineService('db', {
    generate: function(options) {
        return new Service.DB.Adapter(options.dsn, options.pool);
    },

    dsn: 'postgres://user:password@127.0.0.1/board',

    pool: {
        max: 8,
        min: 1
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

var User = anyorm.defineData({
    mapper: anyrom.DBMapper,
    service: 'db',
    collection: 'board.users',
    attributes: {
        // auto increase integer primary key
        user_id: {
            type: 'integer',
            primary_key: true,
            auto_generate: true
        },
        email: {
            type: 'email',
            strict: true,
        },
        password: {
            type: 'string',
            protected: true,
            normalize: function(password) {
                return this._normalizePassword(password);
            }
        },
        password_salt: {
            type: 'string',
            protected: true,
            default: function() {
                return this._generatePasswordSalt();
            }
        },
        lock_time: {
            type: 'datetime',
            allow_null: true,
            strict: true
        },
        create_time: {
            type: 'datetime',
            refuse_update: true,
            default: 'now'
        },
        update_time: {
            type: 'datetime',
            allow_null: true,
        }
    }
});

User.prototype.__before_update = function() {
    this.update_time = new Date;
};

User.prototype.isLocked = function() {
    return !!this.lock_time;
};

User.prototype.lock = function() {
    this.lock_time = new Date;
    return this.save();
};

User.prototype.unlock = function() {
    this.lock_time = null;
    return this.save();
};

User.prototype.checkPassword = function(password) {
    return this._normalizePassword(password) === this.password;
};

User.prototype.refreshPasswordSalt = function(password) {
    if (password === undefined) {
        throw new Error('Refresh password salt without password');
    }

    this.password_salt = this._generatePasswordSalt();
    this.password = password;
};

User.prototype._normalizePassword = function(password) {
    password += this.password_salt;

    var crypt = require('crypto');
    var hash = crypt.createHash('md5');

    return hash.update(password).digest('hex');
};

User.prototype._generatePasswordSalt = function() {
    var min = 10000000, max = 99999999;
    return Math.floor(Math.random() * (max - min)) + min;
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

    if (!email) {
        return false;
    }

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
