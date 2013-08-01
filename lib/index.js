var data = require(__dirname+'/data');
var mapper = require(__dirname+'/mapper');
var type = require(__dirname+'/type');

module.exports = exports = {
    defineData: data.define,
    Data: data.Data,

    defineMapper: mapper.define,
    Mapper: mapper.Mapper,
    DBMapper: mapper.DBMapper,
    CacheDBMapper: mapper.CacheDBMapper,
    RedisMapper: mapper.RedisMapper,

    defineType: type.define,

    Service: require(__dirname+'/service'),
};
