"use strict";

let _ = require('lodash');
let types = {};

////////////////////////////////////////////////////////////////////////////////

class Default {
    normalizeAttribute(attribute) {
        return attribute;
    }

    normalize(value, attribute) {
        return value;
    }

    store(value, attribute) {
        return value;
    }

    restore(value, attribute) {
        return (value === null) ? value : this.normalize(value);
    }

    getDefaultValue(attribute) {
        return attribute['default'];
    }

    toJSON(value, attribute) {
        return value;
    }
}

class Numeric extends Default {
}

class Integer extends Numeric {
}

class Strings extends Default {
}

class Json extends Default {
}

class Datetime extends Default {
}

class UUID extends Default {
}

////////////////////////////////////////////////////////////////////////////////

function get(type_name) {
    type_name = type_name.toLowerCase();

    switch (type_name) {
        case 'int':
            type_name = 'integer';
            break;
        case 'text':
            type_name = 'string';
            break;
    }

    return types[type_name] || types['default'];
};

function register(type_name, type) {
    types[type_name.toLowerCase()] = new type;

    return this;
};

function normalizeAttribute(attribute) {
};

////////////////////////////////////////////////////////////////////////////////

register('default', Default);
register('numeric', Numeric);
register('integer', Integer);
register('string', Strings);
register('json', Json);
register('datetime', Datetime);
register('uuid', uuid);

exports = module.exports = {
    'get': get,
    'register': register,
    'normalizeAttribute': normalizeAttribute,
    'Default': Default,
    'Numeric': Numeric,
};

// var Utils = require(__dirname+'/utils');
// var _ = require('lodash');
// var uuid = require('node-uuid');
// var types = {};
//
// /**
//  * Get type helper by type name
//  *
//  * @param {string|object} type
//  * @return {object}
//  */
// var get = exports.get = function(type) {
//     type = get_type_name(type);
//
//     if (!type) {
//         return Default;
//     }
//
//     return types[type] || Default;
// };
//
// /**
//  * Define custom type
//  *
//  * @param {string} type New type name
//  * @param {object} factory New type helper functions
//  * @param {object} [baseType] New type can extend from other type, optional
//  * @return {object}
//  */
// var define = exports.define = function(type, factory, baseType) {
//     return types[type] = _.defaults(factory, baseType || Default);
// };
//
// /**
//  * @param {object} attribute
//  * @return {object}
//  */
// exports.normalizeAttribute = function(attribute) {
//     var type = get_type_name(attribute);
//
//     if (type) {
//         attribute = {type: type};
//     } else {
//         attribute = attribute || {};
//     }
//
//     attribute = get(attribute.type).normalizeAttribute(attribute);
//
//     attribute = _.defaults(attribute, {
//         allow_null: false,
//
//         // auto generate value while insert, e.g. auto increase primary key in database
//         auto_generate: false,
//
//         default_value: null,
//
//         // custom normalize function, called before type normalize function
//         // see Data.set()
//         normalize: null,
//
//         // regexp, check before set value
//         // see Data.set()
//         pattern: null,
//
//         primary_key: false,
//
//         // SECURITY feature
//         // auto excluded by Data.toJSON() and Data.pick()
//         // enable this on "password" property
//         protected: false,
//
//         // refuse change after insert, e.g. create time
//         refuse_update: false,
//
//         // SECURITY feature
//         // "strict" property can only set by <code>data[prop] = value</code> or <code>data.set(prop, value, {strict: true})</code>
//         // Data.merge() will auto ignore "strict" property, so you can safely merge user data
//         // see Data.set()
//         strict: null,
//
//         // type name, if type is undefined, "Default" type will be used
//         type: null,
//     });
//
//     if (attribute.allow_null) {
//         attribute.default_value = null;
//     }
//
//     if (attribute.primary_key) {
//         attribute.allow_null = false;
//         attribute.refuse_update = true;
//         attribute.strict = true;
//     }
//
//     if (attribute.protected && attribute.strict === null) {
//         attribute.strict = true;
//     }
//
//     return attribute;
// };
//
// var Default = {
//     /**
//      * @param {object} attribute
//      * @return {object}
//      */
//     normalizeAttribute: function(attribute) {
//         return attribute;
//     },
//
//     /**
//      * @see Data.set()
//      * @param {*} value
//      * @param {object} attribute
//      * @return {*}
//      */
//     normalize: function(value, attribute) {
//         return value;
//     },
//
//     /**
//      * Encode to storage firendly data
//      *
//      * @see Mapper.unpack()
//      * @param {*} value
//      * @param {object} attribute
//      * @return {*}
//      */
//     store: function(value, attribute) {
//         return value;
//     },
//
//     /**
//      * Decode data fetch from storage
//      *
//      * @see Mapper.pack()
//      * @param {*} value
//      * @param {object} attribute
//      * @return {*}
//      */
//     restore: function(value, attribute) {
//         if (value === null) {
//             return value;
//         }
//
//         return this.normalize(value, attribute);
//     },
//
//     /**
//      * @param {object} attribute
//      * @return {*}
//      */
//     getDefaultValue: function(attribute) {
//         return attribute.default_value;
//     },
//
//     /**
//      * Get JSON stringify friendly value
//      *
//      * @see Data.toJSON()
//      * @param {*} value
//      * @param {object} attribute
//      * @return {*}
//      */
//     toJSON: function(value, attribute) {
//         return value;
//     },
//
//     /**
//      * Return clone of passed value
//      *
//      * @see Data.get()
//      * @param {*} value
//      * @param {object} attribute
//      * @return {*}
//      */
//     clone: function(value) {
//         return _.isObject(value) ? _.cloneDeep(value) : value;
//     }
// };
//
// var Numeric = define('numeric', {
//     /**
//      * @return {number}
//      */
//     normalize: function(value, attribute) {
//         value = value * 1;
//
//         if (value === Infinity) {
//             throw new Error('Infinity number');
//         } else if (Number.isNaN(value)) {
//             throw new Error('Not a number');
//         }
//
//         return value;
//     }
// });
//
// define('integer', {
//     /**
//      * @return {integer}
//      */
//     normalize: function(value, attribute) {
//         value = Numeric.normalize(value);
//
//         return (value === null) ? null : value >> 0;
//     }
// });
//
// define('string', {
//     /**
//      * @return {string}
//      */
//     normalize: function(value, attribute) {
//         return value.toString();
//     }
// });
//
// define('datetime', {
//     /**
//      * @return {Date}
//      */
//     normalize: function(value, attribute) {
//         if (value instanceof Date) {
//             return value;
//         }
//
//         attribute = attribute || {};
//         if (attribute['unix_timestamp'] && /^\d+$/.test(value)) {
//             value = value * 1000;   // to millisecond
//         }
//
//         value = new Date(value);
//         return this._filterInvalid(value);
//     },
//
//     /**
//      * @return {string|number}
//      */
//     store: function(value, attribute) {
//         this._filterInvalid(value);
//
//         attribute = attribute || {};
//
//         return attribute['unix_timestamp']
//              ? (value.getTime() / 1000) >> 0
//              : Utils.toISO8601(value);
//     },
//
//     /**
//      * @return {?Date}
//      */
//     getDefaultValue: function(attribute) {
//         attribute = attribute || {};
//
//         var default_value = attribute.default_value;
//         if (default_value == 'now')
//             return new Date;
//
//         return this.normalize(default_value, attribute);
//     },
//
//     /**
//      * @return {string}
//      */
//     toJSON: function(value, attribute) {
//         return this.store(value, attribute);
//     },
//
//     /**
//      * @return {Date}
//      */
//     clone: function(value) {
//         return new Date(value.getTime());
//     },
//
//     /**
//      * @protected
//      * @param {*} date
//      * @return {date}
//      */
//     _filterInvalid: function(date) {
//         if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
//             throw new Error('Invalid datetime');
//         }
//
//         return date;
//     }
// });
//
// define('json', {
//     // default enable "strict"
//     normalizeAttribute: function(attribute) {
//         return _.defaults(attribute, {
//             strict: true,
//         });
//     },
//
//     /**
//      * @return {object}
//      * @throws value is not object
//      */
//     normalize: function(value, attribute) {
//         if (_.isObject(value)) {
//             return value;
//         }
//
//         if (value === null) {
//             return {};
//         }
//
//         value = JSON.parse(value);
//         if (!_.isObject(value)) {
//             throw new Error('Invalid json value');
//         }
//
//         return value;
//     },
//
//     /**
//      * @return {?string}
//      */
//     store: function(value, attribute) {
//         if (_.isObject(value) && _.isEmpty(value)) {
//             return null;
//         }
//
//         return JSON.stringify(value);
//     },
//
//     /**
//      * @return {object}
//      */
//     restore: function(value, attribute) {
//         if (value === null) {
//             return {};
//         }
//
//         return this.normalize(value, attribute);
//     },
//
//     getDefaultValue: function(attribute) {
//         return {};
//     },
// });
//
// define('uuid', {
//     normalizeAttribute: function(attribute) {
//         return _.defaults(attribute, {
//             auto_generate: attribute.primary_key,
//             upper: false,
//         });
//     },
//     getDefaultValue: function(attribute) {
//         if (!attribute.auto_generate) {
//             return attribute.default_value;
//         }
//
//         var id = uuid.v4();
//         return attribute.upper ? id.toUpperCase(id) : id;
//     }
// });
//
// function get_type_name(alias) {
//     var name;
//
//     if (!alias) {
//         return name;
//     }
//
//     var type = Object.prototype.toString.call(alias);
//
//     if (type === '[object Function]') {
//         if (alias === String) {
//             name = 'string';
//         } else if (alias === Number) {
//             name = 'numeric';
//         } else if (alias === Date) {
//             name = 'datetime';
//         }
//     } else if (type === '[object String]') {
//         alias = alias.toLowerCase();
//
//         if (alias == 'text') {
//             name = 'string';
//         } else if (alias == 'int') {
//             name = 'integer';
//         } else {
//             name = alias;
//         }
//     }
//
//     return name;
// }
