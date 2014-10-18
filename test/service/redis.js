"use strict";

var Promise = require('bluebird');
var anyorm = require(__dirname+'/../../');
var Service = anyorm.Service;
var assert = require('assert');

describe('Redis', function() {
    Service.define({
        'redis': {
            generate: function(options) {
                return Service.Redis.createClient(options);
            },
            host: '127.0.0.1',
            port: 6379,
        },
        'redis_pool': {
            generate: function(options) {
                return Service.Redis.createPool(options.pool, options.client);
            },
            pool: {
                max: 5,
                min: 2,
            },
            client: {
                host: '127.0.0.1',
                port: 6379,
            }
        }
    });

    it('client', function(done) {
        this.timeout(1000);

        var redis = Service.get('redis');

        redis.ping(function(error, result) {
            assert.equal(result, 'PONG');
        });

        redis.quit(done);
    });

    it('pool', function(done) {
        this.timeout(2000);

        var redis = Service.get('redis_pool');

        redis.execute('ping')
            .then(function(result) {
                assert.equal(result, 'PONG')
            })
            .finally(function() {
                redis.disconnect().then(function() { done(); });
            });
    });
});

