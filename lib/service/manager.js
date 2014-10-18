// var Service = require('anyorm').Service;
//
// Service.define({
//     __db__: {
//         generate: function(config) {
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
// //////////////////////////// OR //////////////////////////////
//
// function db_generator(config) {
//     var Adapter = require('db').Adapter;
//     return new Adapter(config['dsn'], config['options']);
// }
//
// function db_destroy(adapter) {
//     adapter.disconnect();
// }
//
// Service.define('foo', {
//     generate: db_generator,
//     destroy: db_destroy,
//
//     dsn: 'postgres://dev@127.0.0.1/test',
//     options: {min: 3, max: 10, log: true}
// });
//
// Service.define('bar', {
//     generate: db_generator,
//     destroy: db_destroy,
//
//     dsn: 'mysql://dev@127.0.0.1/test',
//     options: {min: 3, max: 10, log: true}
// });
//
// Service.define('foobar', function(id) {
//     return (id % 2) ? 'foo' : 'bar';
// });
//
// Service.get('foo');
// Service.get('bar');
//
// Service.get('foobar', 1);
// Service.get('foobar', 2);

"use strict";

var _ = require('lodash');

var _config = {};
var _instances = {};

/**
 * Define service
 *
 * @param {string|object} name
 * @param {object} config
 */
exports.define = function(name, config) {
    if (_.isPlainObject(name)) {
        _.extend(_config, name);
    } else {
        _config[name] = config;
    }
};

/**
 * Get service by name
 *
 * @param {string} name
 * @param {...*} arguments for service dispatcher function
 * @return {object} service adapter or pool
 */
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

    var generate = config.generate;
    if (generate === undefined) {
        throw new Error('Service generator function is undefined');
    }

    if (!_.isFunction(generate)) {
        throw new Error('Invalid service generator function');
    }

    var instance = generate(_.omit(config, 'generate', 'destroy'));
    if (instance === undefined) {
        throw new Error('Service generator return nothing');
    }

    if (config.destroy && _.isFunction(config.destroy)) {
        process.on('exit', function() {
            config.destroy(instance);
            delete _instances[name];
        });
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
