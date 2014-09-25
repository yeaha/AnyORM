"use strict";

var assert = require("assert");
var anyorm = require("../");

describe('Mapper', function() {
    var SimpleMapper = anyorm.defineMapper({});

    var SimpleData = anyorm.defineData({
        mapper: SimpleMapper,
        attributes: {
            id: {type: 'integer', primary_key: true, auto_generate: true},
            a: Number,
            b: 'integer',
            c: {type: 'string', default: 'foobar'},
            d: {type: 'datetime', unix_timestamp: true},
            e: 'json'
        }
    });

    it('should throw error when get undefined option', function() {
        var mapper = SimpleData.getMapper();

        assert.throws(function() {
            mapper.getOption('foobar', true);
        });
    });

    it('unpack()', function() {
        var data = new SimpleData;
        data.merge({
            a: 1.2,
            b: 100,
            c: 'foobar',
            d: 1409564951,
        });

        data.e = {x: 'x', y: 'y'};

        var record = data.getMapper().unpack(data);
        assert.deepEqual(record, {
            a: 1.2,
            b: 100,
            c: 'foobar',
            d: 1409564951,
            e: '{"x":"x","y":"y"}'
        });

        data._dirty = {};
        assert.deepEqual(data.getMapper().unpack(data, true), {});

        data._dirty = {a: true, b: true, c: true};
        assert.deepEqual(data.getMapper().unpack(data, true), {
            a: 1.2,
            b: 100,
            c: 'foobar',
        });
    });

    describe('pack()', function() {
        it('should pack into Data', function() {
            var mapper = SimpleData.getMapper();

            var data = mapper.pack({
                a: 1.2,
                b: 100,
                c: 'foobar',
                d: 1409564951,
                e: '{"x":"x","y":"y"}'
            });

            assert.ok(data.isFresh() === false);
            assert.ok(data.isDirty() === false);

            assert.ok(data.d instanceof Date);
            assert.ok(data.e.x === 'x');

            data.c = 'foo';
            assert.ok(data.isDirty() === true);

            mapper.pack({c: 'bar'}, data);
            assert.ok(data.isDirty() === false);
            assert.ok(data.c === 'bar');
        });

        it('should keep unchanged property as dirty', function() {
            var mapper = SimpleData.getMapper();
            var data = mapper.pack({a: 1});

            assert.ok(data.isDirty('a') === false);
            assert.ok(data.isDirty('c') === true);
        });

        it('should ignore undefined property', function() {
            var mapper = SimpleData.getMapper();
            var data = mapper.pack({a: 0, x: 1});

            assert.ok(data._values.hasOwnProperty('a'))
            assert.ok(!data._values.hasOwnProperty('x'))
        });
    });
});
