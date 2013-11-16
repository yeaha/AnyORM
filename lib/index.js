var data = require(__dirname+'/data');
var mapper = require(__dirname+'/mapper');
var type = require(__dirname+'/type');
var service = require(__dirname+'/service');

var _exports = {
    defineData: data.define,
    Data: data.Data,

    defineMapper: mapper.define,
    Mapper: mapper.Mapper,

    defineType: type.define,

    defineService: service.define,
    Service: service,
};

_exports.__defineGetter__('DBMapper', function() {
    return require(__dirname+'/mapper/database').DBMapper;
});

_exports.__defineGetter__('CacheDBMapper', function() {
    return require(__dirname+'/mapper/database').CacheDBMapper;
});

_exports.__defineGetter__('RedisMapper', function() {
    return require(__dirname+'/mapper/redis');
});

module.exports = exports = _exports;
