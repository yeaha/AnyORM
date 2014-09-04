// var Services = require('manager');
//
// Services.define({
//     __db__: {
//         generator: function(config) {
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
// function db_generator(config) {
//     var Adapter = require('db').Adapter;
//     return new Adapter(config['dsn'], config['options']);
// }
//
// Services.define('foo', {
//     generator: db_generator,
//     dsn: 'postgres://dev@127.0.0.1/test',
//     options: {min: 3, max: 10, log: true}
// });
//
// Services.define('bar', {
//     generator: db_generator,
//     dsn: 'mysql://dev@127.0.0.1/test',
//     options: {min: 3, max: 10, log: true}
// });
//
// Services.define('foobar', function(id) {
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
var _instances = {};

exports.define = function(name, config) {
    if (_.isObject(name)) {
        _.extend(_config, name);
    } else {
        _config[name] = config;
    }
};

var get = exports.get = function(name, args) {
    if (_instances[name]) {
        return _instances[name];
    }

    var config = get_config(name);

    if (_.isFunction(config)) {
        args = (args === undefined)
             ? []
             : (_.isArray(args) ? args : Array.prototype.slice.call(arguments, 1));

        name = config.apply(null, args);

        if (name === undefined) {
            throw new Error('Service dispatcher MUST return a service name');
        }

        return get(name);
    }

    var generator = config.generator;
    if (!generator) {
        throw new Error('Service generator function is undefined');
    }

    var instance = generator(_.omit(config, 'generator'));
    if (instance === undefined) {
        throw new Error('Service generator return nothing');
    }

    return _instances[name] = instance;
};

function get_config(name) {
    if (!_config[name]) {
        throw new Error('Undefined service: '+ name);
    }

    var config = _config[name];

    if (_.isFunction(config)) {
        return config;
    }

    if (!config['__EXTEND__']) {
        return config;
    }

    config = _.defaults(config, get_config(config['__EXTEND__']));
    delete config['__EXTEND__'];

    return config;
}
