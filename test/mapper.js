"use strict";

var assert = require("assert");
var anyorm = require("../");

describe('Mapper', function() {
    var SimpleMapper = anyorm.defineMapper({});

    var SimpleData = anyorm.defineData({
        mapper: SimpleMapper,
        attributes: {
            id: {type: 'integer', primary_key: true, auto_increase: true}
        }
    });

    it('should throw error when get undefined option', function() {
        var mapper = SimpleData.getMapper();

        assert.throws(function() {
            mapper.getOption('foobar', true);
        });
    });
});
