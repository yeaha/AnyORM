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

var _ = require('underscore');

var data = require(__dirname +'/data');
var mapper = require(__dirname+'/mapper');
var type = require(__dirname+'/type');

module.exports = exports = _.extend({}, data, mapper, type);

exports.defineData = data.define;
exports.defineMapper = mapper.define;
