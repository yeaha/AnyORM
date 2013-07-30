var anyorm = require('../lib');

exports.testDefineData = function(test) {
    test.throws(
        function() {
            anyorm.defineData();
        },
        /Undefined option key: mapper/
    );

    var User = anyorm.defineData({
        mapper: anyorm.Mapper,
        columns: {
            user_id: {type: 'integer', primary_key: true, auto_increase: true},
            email: {type: 'string', refuse_update: true},
            passwd: {type: 'string', strict: true},
            create_time: {type: 'datetime', default: 'now'},
            update_time: {type: 'datetime'},
        }
    });

    var user = new User;

    test.ok(user.isFresh());

    ['user_id', 'email', 'passwd', 'create_time', 'update_time'].forEach(function(prop) {
        test.ok(user.has(prop));
    });

    ['user_id', 'email', 'passwd', 'update_time'].forEach(function(prop) {
        test.ok(user[prop] === null);
        test.ok(user.get(prop) === null);
    });

    test.ok(user.create_time instanceof Date);

    test.throws(
        function() {
            user.get('foo');
        },
        /Undefined property/
    );

    user.email = 'yangyi.cn.gz@gmail.com';
    test.equal(user.email, 'yangyi.cn.gz@gmail.com');
    test.equal(user.get('email'), 'yangyi.cn.gz@gmail.com');

    user.set({passwd: 'abc'});
    test.ok(user.passwd === null);

    user.passwd = 'abc';
    test.equal(user.passwd, 'abc');

    user.set('passwd', 'def');
    test.equal(user.passwd, 'def');

    test.done();
};
