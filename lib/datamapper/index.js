// var Lysine = require('lysine');
// var DataMapper = Lysine.DataMapper;
//
// var User = DataMapper.defineData({
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

var data = require(__dirname +'/data');
var mapper = require(__dirname+'/mapper');
var type = require(__dirname+'/type');

module.exports = exports = {
    Data: data.Data,
    defineData: data.define,

    Mapper: mapper.Mapper,
    DBMapper: mapper.DBMapper,
    defineMapper: mapper.define,

    defineType: type.define,
};
