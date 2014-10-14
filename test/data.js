"use strict";

var assert = require("assert");
var anyorm = require('../');

describe('Data', function() {
    var SimpleData = anyorm.defineData({
        mapper: anyorm.Mapper,
        attributes: {
            id: {type: 'integer', primary_key: true, auto_generate: true},
        }
    });

    describe('Define', function() {
        it('should throw error when options without "mapper"', function() {
            assert.throws(function() {
                anyorm.defineData({});
            });
        });

        it('should throw error when primary_key is undefined', function() {
            assert.throws(function() {
                anyorm.defineData({
                    mapper: anyorm.Mapper
                });
            });

            assert.doesNotThrow(function() {
                anyorm.defineData({
                    mapper: anyorm.Mapper,
                    attributes: {
                        id: {type: 'integer', primary_key: true}
                    }
                });
            });
        });

        it('should inherit parent Data options', function() {
            var FooMapper = anyorm.defineMapper({});
            var FooData = anyorm.defineData({
                mapper: FooMapper,
                collection: 'foo',
                attributes: {
                    id: {type: 'integer', primary_key: true},
                    foo: String
                }
            });

            var foo = new FooData;
            assert(foo.has('foo') === true);
            assert(foo.has('bar') === false);
            assert.equal(foo.getMapper().getCollection(), 'foo');

            var BarData = anyorm.defineData({
                collection: 'bar',
                attributes: {
                    bar: String
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
        var NewData = anyorm.defineData({
            mapper: anyorm.Mapper,
            attributes: {
                id: {type: 'uuid', primary_key: true, auto_generate: true},
                foo: {type: 'string', refuse_update: true},
            }
        });

        it('with default options', function() {
            var data = new NewData({foo: 'bar'});

            assert.ok(data.isFresh() === true);
            assert.ok(data.isDirty('foo') === true);
            assert.ok(data.isDirty('id') === true);
            assert.ok(data.id);
        });

        it('options.fresh = false', function() {
            var data = new NewData({foo: 'bar'}, {fresh: false});

            assert.ok(data.isFresh() === false);
            assert.ok(data.isDirty() === false);
        });
    });

    describe('Set property', function() {
        it('should throw error when property is refuse_update', function() {
            var NewData = anyorm.defineData({
                mapper: anyorm.Mapper,
                attributes: {
                    id: {type: 'integer', primary_key: true},
                    foo: String,
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
                data.bar = 'test';
            }, /refuse/i);

            // not throw error when strict mode is off
            assert.doesNotThrow(function() {
                data.merge({bar: 'test'});
            });

            assert(data.isDirty() === false);

            // not throw error when option "force" is on
            assert.doesNotThrow(function() {
                data.set('bar', 'baz', {force: true});
            });

            assert(data.isDirty('bar') === true);

            // refuse_update not work on fresh instance
            assert.doesNotThrow(function() {
                var data = new NewData;
                data.bar = 'bar';
            });
        });

        it('should throw error when property is "primary_key"', function() {
            assert.throws(function() {
                var data = SimpleData.getMapper().pack({id: 1});
                data.id = 2;
            }, /refuse/);

            // fresh instance can set primary key
            assert.doesNotThrow(function() {
                var data = new SimpleData;
                data.id = 1;
            });
        });

        it('should throw error when set null to not "allow_null" property', function() {
            var NewData = anyorm.defineData({
                mapper: anyorm.Mapper,
                attributes: {
                    id: {type: 'integer', primary_key: true},
                    foo: {type: String, allow_null: true},
                    bar: {type: String, allow_null: false}
                }
            });
            var data = new NewData;

            assert.throws(function() {
                data.bar = null;
            });

            assert.doesNotThrow(function() {
                data.foo = null;
            });
        });

        it('should throws error when attribute normailze function return nothing', function() {
            var NewData = anyorm.defineData({
                mapper: anyorm.Mapper,
                attributes: {
                    id: {type: 'integer', primary_key: true},
                    passwd: {
                        type: String,
                        normalize: function(value) {
                        }
                    }
                }
            });

            var data = new NewData;

            assert.throws(function() {
                data.passwd = 'abc';
            });
        });

        it('should unchange when the value is strict equal current value', function() {
            var NewData = anyorm.defineData({
                mapper: anyorm.Mapper,
                attributes: {
                    id: {type: 'integer', primary_key: true},
                    foo: String,
                    bar: {type: String, allow_null: true},
                    baz: 'integer'
                }
            });

            var data = NewData.getMapper().pack({
                id: 1,
                foo: 'foo',
                baz: 0
            });

            assert(data.isDirty() === false);

            data.foo = 'foo';
            assert(data.isDirty() === false);

            data.bar = null;
            assert(data.isDirty() === false);

            data.baz = 0;
            assert(data.isDirty() === false);

            data.foo = 'bar';
            assert(data.isDirty() === true);
        });

        it('should unchange when the value is strict equal old value', function() {
            var NewData = anyorm.defineData({
                mapper: anyorm.Mapper,
                attributes: {
                    id: {type: 'integer', primary_key: true},
                    foo: {type: String, default: 'foo'},
                }
            });

            var data = NewData.getMapper().pack({id: 1, foo: 'bar'});
            assert(data.isDirty() === false);

            data.foo = 'bar';
            assert(data.isDirty() === false);
        });

        it('should set normalized value by attribute normalize function', function() {
            var NewData = anyorm.defineData({
                mapper: anyorm.Mapper,
                attributes: {
                    id: {type: 'integer', primary_key: true},
                    passwd: {
                        type: String,
                        normalize: function(value) {
                            return value + 'abc';
                        }
                    }
                }
            });

            var data = new NewData;
            data.passwd = 'passwd';
            assert.equal(data.passwd, 'passwdabc');
        });

        it('should ignore merge when attribute "strict" is true', function() {
            var NewData = anyorm.defineData({
                mapper: anyorm.Mapper,
                attributes: {
                    id: {type: 'integer', primary_key: true},
                    foo: {type: String, strict: true},
                    bar: String,
                }
            });

            var data = new NewData;

            data.merge({
                foo: 'foo',
                bar: 'bar'
            });

            assert.strictEqual(data.foo, null);
            assert.strictEqual(data.bar, 'bar');

            data.foo = 'foo';
            assert.strictEqual(data.foo, 'foo');
        });

        it('should change Data to dirty after change property value', function() {
            var NewData = anyorm.defineData({
                mapper: anyorm.Mapper,
                attributes: {
                    id: {type: 'integer', primary_key: true},
                    foo: {type: String},
                    bar: String,
                }
            });

            var data = NewData.getMapper().pack({});
            assert.ok(data.isDirty() === false);

            data.foo = 'foo';
            assert.ok(data.isDirty() === true);
            assert.ok(data.isDirty('foo') === true);
            assert.ok(data.isDirty('bar') === false);
        });
    });

    describe('Get property', function() {
        describe('.getId()', function() {
            it('should return "primary_key" value', function() {
                var data = new SimpleData;
                assert.strictEqual(data.getId(), null);

                data.id = 1;
                assert.strictEqual(data.getId(), 1);
            });

            it('should return as object when multiple "primary_key"', function() {
                var NewData = anyorm.defineData({
                    mapper: anyorm.Mapper,
                    attributes: {
                        foo_id: {type: 'integer', primary_key: true, auto_generate: true},
                        bar_id: {type: 'integer', primary_key: true}
                    }
                });

                var data = new NewData;
                var id = data.getId();

                assert.equal(typeof id, 'object');
                assert.strictEqual(id.foo_id, null);
                assert.strictEqual(id.bar_id, null);

                data.foo_id = 1;
                data.bar_id = 2;

                id = data.getId();
                assert.strictEqual(id.foo_id, 1);
                assert.strictEqual(id.bar_id, 2);
            });
        });

        it('should return clone value when type is object', function() {
            var NewData = anyorm.defineData({
                mapper: anyorm.Mapper,
                attributes: {
                    id: {type: 'integer', primary_key: true},
                    foo: {type: 'datetime', default: 'now'},
                    bar: 'json',
                }
            });

            var data = new NewData({
                x: [1, 2, 3],
                y: {a: 1, b: 2, c: 3}
            });

            assert.notStrictEqual(data.foo, data.foo);
            assert.notStrictEqual(data.bar, data.bar);
        });

        it('should return values when "keys" argument is array', function() {
            var NewData = anyorm.defineData({
                mapper: anyorm.Mapper,
                attributes: {
                    id: {type: 'integer', primary_key: true},
                    foo: {type: String},
                    bar: {type: String, protected: true},
                }
            });

            var data = new NewData;
            data.foo = 'foo';
            data.bar = 'bar';

            assert.equal(data.get('foo'), 'foo');
        });

        it('should not include attribute "protected" property in toJSON() and get() result', function() {
            var NewData = anyorm.defineData({
                mapper: anyorm.Mapper,
                attributes: {
                    id: {type: 'integer', primary_key: true},
                    foo: {type: String},
                    bar: {type: String, protected: true},
                }
            });

            var data = new NewData;
            data.foo = 'foo';
            data.bar = 'bar';

            assert.deepEqual(data.toJSON(), {foo: 'foo'});
            assert.equal(data.bar, 'bar');

            assert.deepEqual(data.pick(), {foo: 'foo'});
            assert.deepEqual(data.pick('foo'), {foo: 'foo'});
            assert.deepEqual(data.pick(['foo', 'bar']), {foo: 'foo', bar: 'bar'});
        });
    });
});
