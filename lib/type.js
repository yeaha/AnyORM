"use strict";

var _ = require('underscore');
var helper = {};

exports.get = function(type) {
    if (type)
        type = type.toLowerCase();

    if (type == 'int') {
        type = 'integer';
    } else if (type == 'string') {
        type = 'text';
    }

    return helper[type] || Mixed;
};

exports.define = define;

function define(type, factory) {
    helper[type] = _.extend({}, Mixed, factory);
};

// 默认类型
var Mixed = {
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
    }
};

define('numeric', {
    normalize: function(value, config) {
        if (value === null || value === '')
            return null;

        value = value * 1;

        return _.isNaN(value) ? 0 : value;
    }
});

define('integer', {
    normalize: function(value, config) {
        if (value === null || value === '')
            return null;

        return (value * 1) >> 0;
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
    normalize: function(value, config) {
        if (value === null || value === '')
            return null;

        if (value instanceof Date)
            return value;

        if (config['unix_timestamp'] && /^\d+$/.test(value))
            value = value * 1000;   // to millisecond

        value = new Date(value);
        if (_.isNaN(value.getTime()))   // invalide date
            throw new Error('Invalid datetime value');

        return value;
    },
    store: function(value, config) {
        if (!(value instanceof Date))
            return value;

        return config['unix_timestamp']
             ? (value.getTime() / 1000) >> 0
             : toISO8601(value);
    },
    getDefaultValue: function(config) {
        var default_value = config['default'];

        if (default_value == 'now')
            return new Date;

        return this.normalize(default_value, config);
    }
});

function toISO8601(time) {
    var hour, minute;
    var offset = time.getTimezoneOffset();

    hour = _fix(Math.abs((offset / 60) >> 0));
    minute = _fix(Math.abs(offset % 60));

    return time.getFullYear()
     +'-'+ _fix(time.getMonth()+1)
     +'-'+ _fix(time.getDate())
     +'T'+ _fix(time.getHours())
     +':'+ _fix(time.getMinutes())
     +':'+ _fix(time.getSeconds())
     + ((offset <= 0) ? '+' : '-')
     + hour +':'+ minute;

    function _fix(n) {
        if (n >= 10) return n;

        return '0'+ n.toString();
    }
}
