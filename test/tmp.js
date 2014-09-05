"use strict";

var Promise = require('bluebird');
var anyorm = require(__dirname+'/../lib');
var Service = anyorm.Service;

Service.define({
    '__redis__': {
        generator: function(options) {
            return Service.Redis.createClient(options);
        },
    },
    'foo': {
        __EXTEND__: '__redis__',
        host: '127.0.0.1',
        port: 6379,
        connect_timeout: 3000,
    },
    'bar': {
        __EXTEND__: '__redis__',
        host: '192.168.0.2',
        port: 6379,
        connect_timeout: 100,
        retry_max_delay: 100,
    }
});

var redis = Service.get('bar');

['connect', 'ready', 'error', 'end', 'drain', 'idle'].forEach(function(ev) {
    redis.on(ev, function() {
        console.log(ev, arguments);
    });
});

redis.ping(function(error, result) {
    console.log(result);
});
redis.quit();
