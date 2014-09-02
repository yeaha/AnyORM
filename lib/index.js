var PWD = __dirname;

var data = require(__dirname+'/data');
var mapper = require(__dirname+'/mapper');
var type = require(__dirname+'/type');
var service = require(__dirname+'/service');

module.exports = exports = {
    defineData: data.define,
    Data: data.Data,

    defineMapper: mapper.define,
    Mapper: mapper.Mapper,

    defineType: type.define,
    Type: type,

    defineService: service.define,
    Service: service,

    get DBMapper() {
        return require(__dirname+'/mapper/database').DBMapper;
    },

    get CacheDBMapper() {
        return require(__dirname+'/mapper/database').CacheDBMapper;
    },

    get RedisMapper() {
        return require(__dirname+'/mapper/redis');
    }
};
