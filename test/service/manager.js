"use strict";

var assert = require('assert');
var anyorm = require('../../');
var Service = anyorm.Service;

describe('Service manager', function() {
    var TestService = function(config) {
        this.config = config;
    }

    Service.define({
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
            Service.get('baz');
        }, /undefined/i);
    });

    it('should throw error when service factory is undefined', function() {
        assert.throws(function() {
            Service.define('baz', {name: 'baz'});
            Service.get('baz');
        }, /factory/);
    });

    it('should throw error when service factory return noting', function() {
        assert.throws(function() {
            Service.define('baz', {
                factory: function() {},
                name: 'baz'
            });
            Service.get('baz');
        }, /factory/);
    });

    it('should throw error when service dispatcher return nothing', function() {
        assert.throws(function() {
            Service.define('baz', function(id) {});
            Service.get('baz', 1);
        }, /dispatcher/);
    });

    it('should return service instance by name', function() {
        var foo = Service.get('foo');
        assert.ok(foo instanceof TestService);
        assert.equal(foo.config.name, 'foo');
    });

    it('should extends config by "__EXTEND__"', function() {
        var bar = Service.get('bar');
        assert.ok(bar instanceof TestService);
        assert.equal(bar.config.name, 'bar');
    });

    it('should return service instance by dispatcher function', function() {
        var foo = Service.get('foobar', 1);
        assert.ok(foo instanceof TestService);
        assert.equal(foo.config.name, 'foo');

        var bar = Service.get('foobar', 2);
        assert.ok(bar instanceof TestService);
        assert.equal(bar.config.name, 'bar');
    });
});
