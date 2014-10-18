'use strict';

var Promise = require('bluebird');
var anyorm = require(__dirname+'/../');

anyorm.definedType('base64', {
    // return Buffer
    normalize: function(value) {
        if (value === null) {
            return new Buffer;
        }

        if (Buffer.isBuffer(value)) {
            return value;
        }

        return new Buffer(value);
    },
    // return string
    store: function(value) {
        value = this.normalize(value);

        if (!value || !value.length) {
            return null;
        }

        return value.toString('base64');
    },
    // return Buffer
    restore: function(value) {
        if (value === null) {
            return new Buffer;
        }

        return new Buffer(value, 'base64');
    },
    // return String
    toJSON: function(value) {
        return this.store(value);
    },
    // return Buffer
    clone: function(value) {
        return Buffer.isBuffer(value) ? (new Buffer).copy(value) : value;
    }
});

var Foo = anyorm.defineData({
    mapper: anyorm.Mapper,
    service: 'foo',
    collector: 'bar',
    attributes: {
        id: {type: 'uuid', primary_key: true},
        content: {type: 'base64'}
    }
});
