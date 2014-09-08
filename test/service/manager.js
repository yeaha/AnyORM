"use strict";

var manager = require(__dirname+'/../../lib/service/manager');
var assert = require('assert');

describe('Service manager', function() {
    var TestService = function(config) {
        this.config = config;
    }

    manager.define({
        foo: {
            factory: function(config) {
                return new TestService(config);
            },
            name: 'foo',
        },
        bar: {
            __EXTEND__: 'foo',
            name: 'bar',
        },
        foobar: function(id) {
            return (id % 2) ? 'foo' : 'bar';
        }
    });

    it('should throw error when get undefined service', function() {
        assert.throws(function() {
            manager.get('baz');
        }, /undefined/i);
    });

    it('should throw error when service factory is undefined', function() {
        assert.throws(function() {
            manager.define('baz', {name: 'baz'});
            manager.get('baz');
        }, /factory/);
    });

    it('should throw error when service factory return noting', function() {
        assert.throws(function() {
            manager.define('baz', {
                factory: function() {},
                name: 'baz'
            });
            manager.get('baz');
        }, /factory/);
    });

    it('should throw error when service dispatcher return nothing', function() {
        assert.throws(function() {
            manager.define('baz', function(id) {});
            manager.get('baz', 1);
        }, /dispatcher/);
    });

    it('should return service instance by name', function() {
        var foo = manager.get('foo');
        assert.ok(foo instanceof TestService);
        assert.equal(foo.config.name, 'foo');
    });

    it('should extends config by "__EXTEND__"', function() {
        var bar = manager.get('bar');
        assert.ok(bar instanceof TestService);
        assert.equal(bar.config.name, 'bar');
    });

    it('should return service instance by dispatcher function', function() {
        var foo = manager.get('foobar', 1);
        assert.ok(foo instanceof TestService);
        assert.equal(foo.config.name, 'foo');

        var bar = manager.get('foobar', 2);
        assert.ok(bar instanceof TestService);
        assert.equal(bar.config.name, 'bar');
    });
});
