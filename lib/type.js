"use strict";

var Utils = require(__dirname+'/utils');
var _ = require('underscore');
var uuid = require('node-uuid');
var types = {};

var get = exports.get = function(type) {
    type = get_type_name(type);

    if (!type) {
        return Default;
    }

    return types[type] || Default;
};

var define = exports.define = function(type, factory, baseType) {
    return types[type] = _.defaults(factory, baseType || Default);
};

exports.normalizeAttribute = function(attribute) {
    var type = get_type_name(attribute);

    if (type) {
        attribute = {type: type};
    } else {
        attribute = attribute || {};
    }

    attribute = get(attribute.type).normalizeAttribute(attribute);

    attribute = _.defaults(attribute, {
        allow_null: false,
        auto_generate: false,
        clone: false,
        default: null,
        normalize: null,
        pattern: null,
        primary_key: false,
        protected: false,
        refuse_update: false,
        strict: null,
        type: null,
    });

    if (attribute.primary_key) {
        attribute.allow_null = false;
        attribute.refuse_update = true;
    }

    if (attribute.strict === null) {
        attribute.strict = attribute.protected;
    }

    return attribute;
};

// 默认类型
var Default = {
    normalizeAttribute: function(attribute) {
        return attribute;
    },
    // 赋值时格式化
    normalize: function(value, attribute) {
        return (value === '') ? null : value;
    },
    // 保存到存储服务
    store: function(value, attribute) {
        return value;
    },
    // 从存储服务恢复
    restore: function(value, attribute) {
        return this.normalize(value, attribute);
    },
    getDefaultValue: function(attribute) {
        return attribute['default'];
    },
    toJSON: function(value, attribute) {
        return value;
    },
    clone: function(value) {
        return (value && value === Object(value))
             ? Utils.clone(value)
             : value;
    }
};

var Numeric = define('numeric', {
    normalize: function(value, attribute) {
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
    normalize: function(value, attribute) {
        value = Numeric.normalize(value);

        return (value === null) ? null : value >> 0;
    }
});

define('string', {
    normalize: function(value, attribute) {
        if (value === null || value === '')
            return null;

        return value.toString();
    }
});

define('datetime', {
    normalizeAttribute: function(attribute) {
        return _.defaults(attribute, {
            clone: true
        });
    },
    normalize: function(value, attribute) {
        if (value === null || value === '')
            return null;

        if (value instanceof Date)
            return value;

        attribute = attribute || {};
        if (attribute['unix_timestamp'] && /^\d+$/.test(value))
            value = value * 1000;   // to millisecond

        value = new Date(value);
        if (Number.isNaN(value.getTime())) {
            throw new Error('Invalid datetime value');
        }

        return value;
    },
    store: function(value, attribute) {
        if (!(value instanceof Date))
            return value;

        attribute = attribute || {};

        return attribute['unix_timestamp']
             ? (value.getTime() / 1000) >> 0
             : Utils.toISO8601(value);
    },
    getDefaultValue: function(attribute) {
        attribute = attribute || {};

        var default_value = attribute['default'];
        if (default_value == 'now')
            return new Date;

        return this.normalize(default_value, attribute);
    },
    toJSON: function(value, attribute) {
        return this.store(value, attribute);
    },
    clone: function(value) {
        return new Date(value.getTime());
    }
});

define('json', {
    normalizeAttribute: function(attribute) {
        return _.defaults(attribute, {
            clone: true,
            default: {},
            strict: true,
        });
    },
    normalize: function(value, attribute) {
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
    store: function(value, attribute) {
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

define('uuid', {
    normalizeAttribute: function(attribute) {
        return _.defaults(attribute, {
            auto_generate: attribute.primary_key,
            upper: false,
        });
    },
    getDefaultValue: function(attribute) {
        if (!attribute.auto_generate) {
            return attribute.default;
        }

        var id = uuid.v4();
        return attribute.upper ? id.toUpperCase(id) : id;
    }
});

function get_type_name(alias) {
    var name;

    if (!alias) {
        return name;
    }

    var type = Object.prototype.toString.call(alias);

    if (type === '[object Function]') {
        if (alias === String) {
            name = 'string';
        } else if (alias === Number) {
            name = 'numeric';
        } else if (alias === Date) {
            name = 'datetime';
        }
    } else if (type === '[object String]') {
        alias = alias.toLowerCase();

        if (alias == 'text') {
            name = 'string';
        } else if (alias == 'int') {
            name = 'integer';
        } else {
            name = alias;
        }
    }

    return name;
}
