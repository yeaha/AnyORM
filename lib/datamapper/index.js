// var Lysine = require('lysine');
// var DataMapper = Lysine.DataMapper;
//
// var UserMapper = DataMapper.defineMapper({
//     doFind: function(id) {},
//     doInsert: function(data) {},
//     doUpdate: function(data) {},
//     doDelete: function(data) {}
// });
//
// var User = DataMapper.defineData({
//     mapper: UserMapper,
//     storage: 'db',
//     collection: 'users.entity',
//     columns: {
//         id: {type: 'integer', primary_key: true, auto_increase: true},
//         email: {type: 'string'},
//         passwd: {type: 'string'},
//         create_time: {type: 'datetime', default: 'now'}
//     }
// });
//
// var user = new User;
// user.email = 'yangyi.cn.gz@gmail.com';
// user.passwd = 'foobar';
//
// user.save() // return promise
//     .then(
//         function() {
//             console.log('save success');
//
//             user.destroy() // return promise
//                 .then(
//                     function() { console.log('delete success'); },
//                     function(error) { console.log(error); }
//                 );
//         },
//         function(error) { console.log(error); }
//     );
//
//
// User.find(123) // return promise
//     .then(
//         function(user) { console.log(user); },
//         function(error) { console.log(error); }
//     );

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
