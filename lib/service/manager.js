// var Services = require('manager');
//
// Services.register({
//     __db__: {
//         constructor: function(config) {
//             var Adapter = require('db').Adapter;
//             return new Adapter(config['dsn'], config['options']);
//         }
//     },
//     foo: {
//         __EXTEND__: '__db__',
//         dsn: 'postgres://dev@127.0.0.1/test',
//         options: {min: 3, max: 10, log: true}
//     },
//     bar: {
//         __EXTEND__: '__db__',
//         dsn: 'mysql://dev@127.0.0.1/test',
//         options: {min: 3, max: 10, log: true}
//     },
//     foobar: function(id) {
//         return (id % 2) ? 'foo' : 'bar';
//     }
// });
//
// //////////////////////////// or //////////////////////////////
//
// function db_constructor(config) {
//     var Adapter = require('db').Adapter;
//     return new Adapter(config['dsn'], config['options']);
// }
//
// Services.register('foo', {
//     constructor: db_constructor,
//     dsn: 'postgres://dev@127.0.0.1/test',
//     options: {min: 3, max: 10, log: true}
// });
//
// Services.register('bar', {
//     constructor: db_constructor,
//     dsn: 'mysql://dev@127.0.0.1/test',
//     options: {min: 3, max: 10, log: true}
// });
//
// Services.register('foobar', function(id) {
//     return (id % 2) ? 'foo' : 'bar';
// });
//
// Services.get('foo');
// Services.get('bar');
//
// Services.get('foobar', 1);
// Services.get('foobar', 2);

"use strict";

var _ = require('underscore');

var _config = {};
var _services = {};

// manager.register({...});                 // 注册一批服务配置
// manager.register(name, {...});           // 用配置信息注册一个服务
// manager.register(name, function() {});   // 注册一个路由方法
exports.register = function(name, config) {
    if (_.isObject(name)) {
        _.extend(_config, name);
    } else {
        _config[name] = config;
    }
};

exports.get = function(name, args) {
    if (name in _services)
        return _services[name];

    var config = getConfig(name);

    if (_.isFunction(config)) {
        var args = _.isUndefined(args)
                 ? []
                 : (_.isArray(args) ? args : _.values(arguments).slice(1));

        name = config.apply(null, args);

        if (!name || !_.isString(name))
            throw new Error('Service dispatcher MUST return a service name');

        config = getConfig(name);
    }

    var constructor = config['constructor'];
    delete config['constructor'];

    return _services[name] = new constructor(config);
};

function getConfig(name) {
    if (!_config[name])
        throw new Error('Undefined service: '+ name);

    var config = _config[name];
    if (!_.isFunction(config))
        config = _.clone(config);

    if (!config['__EXTEND__'])
        return config;

    config = _.defaults(config, getConfig(config['__EXTEND__']));
    delete config['__EXTEND__'];

    return config;
}
