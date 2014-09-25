"use strict";

var assert = require("assert");
var anyorm = require("../");
var _ = require('underscore');

describe('Mapper', function() {
    var simple_collection = {
        '4414752c-5f25-461a-9146-e250acd8f774': {
            id: '4414752c-5f25-461a-9146-e250acd8f774',
            bar: 'bbb',
        },
        '38b96b06-486c-465a-8210-03e4ffd9183b': {
            id: '38b96b06-486c-465a-8210-03e4ffd9183b',
            foo: 'f',
            bar: 'b'
        }
    };

    var SimpleMapper = anyorm.defineMapper({
        doFind: function(id) {
            return simple_collection[id] || false;
        },
        doInsert: function(data) {
            var id = data.getId();
            var record = this.unpack(data);
            simple_collection[id] = record;

            return record;
        },
        doUpdate: function(data) {
            var id = data.getId();
            var record = this.unpack(data);

            if (!simple_collection[id]) {
                throw new Error('update error, record not found');
            }

            _.extend(simple_collection[id], record);

            return record;
        },
        doDelete: function(data) {
            var id = data.getId();

            delete simple_collection[id];

            return true;
        }
    });

    it('should throw error when get undefined option', function() {
        var mapper = SimpleData.getMapper();

        assert.throws(function() {
            mapper.getOption('foobar', true);
        });
    });

    it('CRUD', function(done) {
        var id;

        var SimpleData = anyorm.defineData({
            mapper: SimpleMapper,
            attributes: {
                id: {type: 'uuid', primary_key: true},
                foo: {type: 'string', default: 'foo'},
                bar: {type: 'string'}
            }
        });

        var data = new SimpleData();
        assert.ok(data.isDirty() === true);

        data.bar = 'baz';
        data.save().then(function() {
            id = data.getId();
            assert.ok(data.isDirty() === false);

            return SimpleData.find('a0236fcb-11e5-4c92-94ea-f5a5cd6db7d1');
        }).then(function(data) {
            assert.ok(data === false);
            return SimpleData.find(id);
        }).then(function(data) {
            assert.ok(data instanceof SimpleData);
            assert.ok(data.isDirty() === false);

            data.bar ='bar';
            return data.save();
        }).then(function(data) {
            assert.ok(data.isDirty() === false);

            return data.destroy();
        }).then(function() {
            assert.ok(_.has(simple_collection, id) === false);

            return SimpleData.find('4414752c-5f25-461a-9146-e250acd8f774')
        }).then(function(data) {
            assert.ok(data.isDirty('foo') === true);
            assert.strictEqual(data.foo, 'foo');

            return data.save();
        }).then(function(data) {
            assert.ok(data.isDirty() === false);

            return SimpleData.find('4414752c-5f25-461a-9146-e250acd8f774')
        }).then(function(data) {
            assert.ok(data.isDirty() === false);

            return SimpleData.find('38b96b06-486c-465a-8210-03e4ffd9183b')
        }).then(function(data) {
            assert.ok(data.isDirty('foo') === false);

            done();
        });
    });

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
