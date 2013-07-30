var manager = require(__dirname+'/manager');

var _exports = {
    get: manager.get,
    register: manager.register,
};

_exports.__defineGetter__('Redis', function() { return require(__dirname+'/redis'); });
_exports.__defineGetter__('DB', function() { return require(__dirname+'/db'); });

module.exports = exports = _exports;
