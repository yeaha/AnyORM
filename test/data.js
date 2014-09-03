"use strict";

var assert = require("assert");
var Data = require(__dirname+'/../lib/data.js');
var Mapper = require(__dirname+'/../lib/mapper.js');

describe('Data', function() {
    var SimpleData = Data.define({
        mapper: Mapper.Mapper,
        attributes: {
            id: {type: 'integer', primary_key: true, auto_increase: true},
        }
    });

    describe('Define', function() {
        it('should throw error when options without "mapper"', function() {
            assert.throws(function() {
                Data.define({});
            });
        });

        it('should throw error when primary_key is undefined', function() {
            assert.throws(function() {
                Data.define({
                    mapper: Mapper.Mapper
                });
            });

            assert.doesNotThrow(function() {
                Data.define({
                    mapper: Mapper.Mapper,
                    attributes: {
                        id: {type: 'integer', primary_key: true}
                    }
                });
            });
        });

        it('should inherit parent Data options', function() {
            var FooMapper = Mapper.define({});
            var FooData = Data.define({
                mapper: FooMapper,
                collection: 'foo',
                attributes: {
                    id: {type: 'integer', primary_key: true},
                    foo: {type: String}
                }
            });

            var foo = new FooData;
            assert(foo.has('foo') === true);
            assert(foo.has('bar') === false);
            assert.equal(foo.getMapper().getCollection(), 'foo');

            var BarData = Data.define({
                collection: 'bar',
                attributes: {
                    bar: {type: String}
                }
            }, FooData);

            var bar = new BarData;
            assert(bar.has('foo') === true);
            assert(bar.has('bar') === true);
            assert(bar.getMapper() instanceof FooMapper);
            assert.equal(bar.getMapper().getCollection(), 'bar');
        });
    });

    describe('New instance', function() {
        it('should be fresh', function() {
            var data = new SimpleData;
            assert(data.isFresh());
        });

        it('should be dirty when initialize with values', function() {
            var NewData = Data.define({
                mapper: Mapper.Mapper,
                attributes: {
                    id: {type: 'integer', primary_key: true},
                    foo: {type: String}
                }
            });

            var data = new NewData({foo: 'foo'});
            assert(data.isDirty());
        });

        it('should set default value after initialize', function() {
            var NewData = Data.define({
                mapper: Mapper.Mapper,
                attributes: {
                    id: {type: 'integer', primary_key: true},
                    a: {type: 'integer', default: 0},
                    b: {type: String, default: 'foo'},
                }
            });

            var data = new NewData;
            assert.strictEqual(data._values['id'], undefined);
            assert.strictEqual(data._values['a'], 0);
            assert.strictEqual(data._values['b'], 'foo');

            assert(data.isDirty());
        });
    });

    describe('Set property', function() {
        it('should throw error when property is undefined', function() {
            var data = new SimpleData;

            assert.throws(function() {
                data.set('foo', 1);
            }, /undefined property/i);

            // not throw error when strict mode is off
            assert.doesNotThrow(function() {
                data.set({foo: 1});
            });
        });

        it('should throw error when property is refuse_update', function() {
            var NewData = Data.define({
                mapper: Mapper.Mapper,
                attributes: {
                    id: {type: 'integer', primary_key: true},
                    foo: {type: String},
                    bar: {type: String, refuse_update: true}
                }
            });

            var mapper = NewData.getMapper();
            var data = mapper.pack({
                id: 1,
                foo: 'foo',
                bar: 'bar'
            });

            assert.throws(function() {
                data.set('bar', 'test');
            }, /refuse/i);

            // not throw error when strict mode is off
            assert.doesNotThrow(function() {
                data.set({bar: 'test'});
            });

            assert(data.isDirty() === false);

            // refuse_update not work on fresh instance
            assert.doesNotThrow(function() {
                var data = new NewData;
                data.set('bar', 'bar');
            });
        });

        it('should throw error when property is "primary_key"', function() {
            assert.throws(function() {
                var data = SimpleData.getMapper().pack({id: 1});
                data.set('id', 2);
            }, /refuse/);

            // fresh instance can set primary key
            assert.doesNotThrow(function() {
                var data = new SimpleData;
                data.set('id', 1);
            });
        });

        it('should throw error when set null to not "allow_null" property', function() {
            var NewData = Data.define({
                mapper: Mapper.Mapper,
                attributes: {
                    id: {type: 'integer', primary_key: true},
                    foo: {type: String, allow_null: true},
                    bar: {type: String, allow_null: false}
                }
            });
            var data = new NewData;

            assert.throws(function() {
                data.set('bar', null);
            });

            assert.doesNotThrow(function() {
                data.set('foo', null);
            });
        });

        it('should unchange when the value is strict equal current value', function() {
            var NewData = Data.define({
                mapper: Mapper.Mapper,
                attributes: {
                    id: {type: 'integer', primary_key: true},
                    foo: {type: String},
                    bar: {type: String, allow_null: true},
                    baz: {type: 'integer'}
                }
            });

            var data = NewData.getMapper().pack({
                id: 1,
                foo: 'foo',
                baz: 0
            });

            assert(data.isDirty() === false);

            data.set('foo', 'foo');
            assert(data.isDirty() === false);

            data.set('bar', null);
            assert(data.isDirty() === false);

            data.set('baz', 0);
            assert(data.isDirty() === false);

            data.set('foo', 'bar');
            assert(data.isDirty() === true);
        });

        it('should unchange when the value is strict equal default value', function() {
            var NewData = Data.define({
                mapper: Mapper.Mapper,
                attributes: {
                    id: {type: 'integer', primary_key: true},
                    foo: {type: String, default: 'foo'},
                }
            });

            var data = NewData.getMapper().pack({id: 1});
            assert(data.isDirty() === false);

            data.set('foo', 'foo');
            assert(data.isDirty() === false);

            data.set('foo', 'bar');
            assert(data.isDirty() === true);
        });
    });

    describe('Get property', function() {
        describe('.getId()', function() {
            it('should return "primary_key" value', function() {
                var data = new SimpleData;
                assert.strictEqual(data.getId(), null);

                data.set('id', 1);
                assert.strictEqual(data.getId(), 1);
            });

            it('should return as object when multiple "primary_key"', function() {
                var NewData = Data.define({
                    mapper: Mapper.Mapper,
                    attributes: {
                        foo_id: {type: 'integer', primary_key: true, auto_increase: true},
                        bar_id: {type: 'integer', primary_key: true}
                    }
                });

                var data = new NewData;
                var id = data.getId();

                assert.equal(typeof id, 'object');
                assert.strictEqual(id.foo_id, null);
                assert.strictEqual(id.bar_id, null);

                data.set('foo_id', 1);
                data.set('bar_id', 2);

                id = data.getId();
                assert.strictEqual(id.foo_id, 1);
                assert.strictEqual(id.bar_id, 2);
            });
        });

        it('should return clone value when object type attribute config "clone" is true', function() {
            var NewData = Data.define({
                mapper: Mapper.Mapper,
                attributes: {
                    id: {type: 'integer', primary_key: true},
                    foo: {type: 'datetime', default: 'now'},
                    bar: {type: 'datetime', default: 'now', clone: false},
                    x: {type: 'json'},
                    y: {type: 'json', clone: false},
                }
            });

            var data = new NewData({
                x: [1, 2, 3],
                y: {a: 1, b: 2, c: 3}
            });

            assert.notStrictEqual(data.get('foo'), data.get('foo'));
            assert.strictEqual(data.get('bar'), data.get('bar'));

            assert.notStrictEqual(data.get('x'), data.get('x'));
            assert.strictEqual(data.get('y'), data.get('y'));
        });
    });
});
