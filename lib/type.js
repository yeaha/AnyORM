"use strict";

var _ = require('underscore');
var types = {};

exports.get = function(type) {
    if (!type)
        return Mixed;

    if (typeof type == 'string')
        type = type.toLowerCase();

    if (type === Number) {
        type = 'numeric';
    } else if (type === Date) {
        type = 'datetime';
    } else if (type === String || type == 'string') {
        type = 'text';
    } else if (type === 'int') {
        type = 'integer';
    }

    return types[type] || Mixed;
};

var define = exports.define = function(type, factory, parent) {
    return types[type] = _.defaults(factory, parent || Mixed);
};

// 默认类型
var Mixed = {
    normalizeConfig: function(config) {
        return config;
    },
    // 赋值时格式化
    normalize: function(value, config) {
        return (value === '') ? null : value;
    },
    // 保存到存储服务
    store: function(value, config) {
        return value;
    },
    // 从存储服务恢复
    restore: function(value, config) {
        return this.normalize(value, config);
    },
    getDefaultValue: function(config) {
        return config['default'];
    },
    toJSON: function(value, config) {
        return value;
    },
    clone: function(value) {
        return (value && value === Object(value))
             ? clone(value)
             : value;
    }
};

var Numeric = define('numeric', {
    normalize: function(value, config) {
        if (value === null || value === '')
            return null;

        value = value * 1;
        if (value === Infinity) {
            throw new Error('Infinity number');
        }

        return Number.isNaN(value) ? 0 : value;
    }
});

define('integer', {
    normalize: function(value, config) {
        value = Numeric.normalize(value);

        return (value === null) ? null : value >> 0;
    }
});

define('text', {
    normalize: function(value, config) {
        if (value === null || value === '')
            return null;

        return value.toString();
    }
});

define('datetime', {
    normalizeConfig: function(config) {
        return _.defaults(config, {
            clone: true
        });
    },
    normalize: function(value, config) {
        if (value === null || value === '')
            return null;

        if (value instanceof Date)
            return value;

        config = config || {};
        if (config['unix_timestamp'] && /^\d+$/.test(value))
            value = value * 1000;   // to millisecond

        value = new Date(value);
        if (Number.isNaN(value.getTime())) {
            throw new Error('Invalid datetime value');
        }

        return value;
    },
    store: function(value, config) {
        if (!(value instanceof Date))
            return value;

        config = config || {};

        return config['unix_timestamp']
             ? (value.getTime() / 1000) >> 0
             : toISO8601(value);
    },
    getDefaultValue: function(config) {
        config = config || {};

        var default_value = config['default'];
        if (default_value == 'now')
            return new Date;

        return this.normalize(default_value, config);
    },
    toJSON: function(value, config) {
        return this.store(value, config);
    },
    clone: function(value) {
        return new Date(value.getTime());
    }
});

define('json', {
    normalizeConfig: function(config) {
        return _.defaults(config, {
            clone: true,
            default: {},
            strict: true,
        });
    },
    normalize: function(value, config) {
        if (value === null || value === '')
            return null;

        if (_.isObject(value)) {
            return value;
        }

        value = JSON.parse(value);
        if (!_.isObject(value)) {
            throw new Error('Invalid json value');
        }

        return value;
    },
    store: function(value, config) {
        if (value === null)
            return null;

        if (_.isObject(value) && _.isEmpty(value))
            return null;

        return JSON.stringify(value);
    },
    toJSON: function(value) {
        return this.clone(value);
    }
});

function toISO8601(time) {
    var _fix = function(n) { return n >= 10 ? n : '0'+n.toString(); }
    var offset = time.getTimezoneOffset();

    var hour = _fix(Math.abs((offset / 60) >> 0));
    var minute = _fix(Math.abs(offset % 60));

    return time.getFullYear()
            +'-'+ _fix(time.getMonth()+1)
            +'-'+ _fix(time.getDate())
            +'T'+ _fix(time.getHours())
            +':'+ _fix(time.getMinutes())
            +':'+ _fix(time.getSeconds())
            + ((offset <= 0) ? '+' : '-')
            + hour +':'+ minute;
}

function clone(source) {
    var el;
    var is_array = Array.isArray(source);
    var obj = is_array ? [] : {};

    if (is_array) {
        for (var i = 0, len = source.length; i < len; i++) {
            el = source[i];
            obj.push((el === Object(el)) ? clone(el) : el);
        }
    } else {
        for (var key in source) {
            el = source[key];
            obj[key] = (el === Object(el)) ? clone(el) : el;
        }
    }

    return obj;
}
