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
        it('should be fresh', function() {
            var data = new SimpleData;
            assert(data.isFresh());
        });

        it('should be dirty when initialize with values', function() {
            var NewData = anyorm.defineData({
                mapper: anyorm.Mapper,
                attributes: {
                    id: {type: 'integer', primary_key: true},
                    foo: String
                }
            });

            var data = new NewData({foo: 'foo'});
            assert(data.isDirty());
        });

        it('should set default value after initialize', function() {
            var NewData = anyorm.defineData({
                mapper: anyorm.Mapper,
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

        it('should unchange when the value is strict equal default value', function() {
            var NewData = anyorm.defineData({
                mapper: anyorm.Mapper,
                attributes: {
                    id: {type: 'integer', primary_key: true},
                    foo: {type: String, default: 'foo'},
                }
            });

            var data = NewData.getMapper().pack({id: 1});
            assert(data.isDirty() === false);

            data.foo = 'foo';
            assert(data.isDirty() === false);

            data.foo = 'bar';
            assert(data.isDirty() === true);
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

        it('should return clone value when object type attribute config "clone" is true', function() {
            var NewData = anyorm.defineData({
                mapper: anyorm.Mapper,
                attributes: {
                    id: {type: 'integer', primary_key: true},
                    foo: {type: 'datetime', default: 'now'},
                    bar: {type: 'datetime', default: 'now', clone: false},
                    x: 'json',
                    y: {type: 'json', clone: false},
                }
            });

            var data = new NewData({
                x: [1, 2, 3],
                y: {a: 1, b: 2, c: 3}
            });

            assert.notStrictEqual(data.foo, data.foo);
            assert.strictEqual(data.bar, data.bar);

            assert.notStrictEqual(data.x, data.x);
            assert.strictEqual(data.y, data.y);
        });

        it('should not include attribute "protected" property in toJSON() result', function() {
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
        });
    });
});
