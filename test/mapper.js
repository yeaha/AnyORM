"use strict";

var assert = require("assert");
var Data = require(__dirname+'/../lib/data.js');
var Mapper = require(__dirname+'/../lib/mapper.js');

describe('Mapper', function() {
    var SimpleMapper = Mapper.define({});

    var SimpleData = Data.define({
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
