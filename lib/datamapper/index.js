// var Lysine = require('lysine');
// var DataMapper = Lysine.DataMapper;
//
// var User = DataMapper.define({
//     mapper: DataMapper.DBMapper,
//     storage: 'db',
//     collection: 'users.entity',
//     columns: {
//         id: {type: 'integer', primary_key: true, auto_increase: true},
//         email: {type: 'string'},
//         passwd: {type: 'string'},
//         create_time: {type: 'datetime', default: 'now'}
//     }
// });

var _ = require('underscore');
var Data = require('./data').Data;

// 定义一个新的Data类
function define(options) {
    if (!options.mapper)
        throw new Error('Undefined option key: mapper');

    var mapper, Model;

    Model = function() {
        Data.apply(this, arguments);
    };
    options['constructor'] = Model;

    mapper = new (options.mapper)(options);

    Model.prototype = Object.create(Data.prototype);
    Model.prototype.__mapper__ = mapper;

    Model.find = function(id) {
        return mapper.find(id);
    };

    return Model;
};

module.exports = {
    define: define,
};

_.each(['./data', './mapper', './type'], function(file) {
    var exports = require(file);
    _.extend(module.exports, exports);
});
