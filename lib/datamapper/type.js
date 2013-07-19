var _ = require('underscore');

var helper = {
    mixed: new Mixed,
    numeric: new Numeric,
    integer: new Integer,
    text: new Text,
    datetime: new Datetime
};

exports.getHelper = function(type) {
    type = type.toLowerCase();

    if (type == 'int') {
        type = 'integer';
    } else if (type == 'string') {
        type = 'text';
    }

    return helper[type] || helper['mixed'];
};

exports.registerType = function(type, type_helper) {
    helper[type] = type_helper;
};

function Mixed() {}

_.extend(Mixed.prototype, {
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
        return value;
    },
    getDefaultValue: function(config) {
        return config['default'];
    }
});

function Numeric() {}

_.extend(Integer.prototype, Mixed.prototype, {
    normalize: function(value, config) {
        if (value === null || value === '')
            return null;

        value = value * 1;

        return _.isNaN(value) ? 0 : value;
    }
});

function Integer() {}

_.extend(Integer.prototype, Mixed.prototype, {
    normalize: function(value, config) {
        if (value === null || value === '')
            return null;

        return (value * 1) >> 0;
    }
});

function Text() {}

_.extend(Text.prototype, Mixed.prototype, {
    normalize: function(value, config) {
        if (value === null || value === '')
            return null;

        return value.toString();
    }
});

function Datetime() {}

_.extend(Datetime.prototype, Mixed.prototype, {
    normalize: function(value, config) {
        return this._create(value, config);
    },
    store: function(value, config) {
        if (!(value instanceof Date))
            return value;

        return config['unix_timestamp']
             ? (value.getTime() / 1000) >> 0
             : toISO8601(value);
    },
    restore: function(value, config) {
        return this._create(value, config);
    },
    getDefaultValue: function(config) {
        var default_value = config['default'];

        if (default_value == 'now' || !default_value)
            return new Date;

        return this._create(default_value, config);
    },
    _create: function(value, config) {
        console.log('create datetime');
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
