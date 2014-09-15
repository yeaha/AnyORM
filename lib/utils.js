'use strict';

var Stream = require('stream');
var Util = require('util');

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

exports.toISO8601 = function(time) {
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

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

var clone = exports.clone = function(source) {
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

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

var Expr = exports.Expr = function(expr) {
    if (expr instanceof Expr) {
        expr = expr.toString();
    }

    this.expr = expr;
};

Expr.prototype.toString = function() {
    return this.expr;
};

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

var TransformStream = exports.TransformStream = function(transform, options) {
    if (typeof transform != 'function') {
        throw new Error('Unexpected stream transform function');
    }

    Stream.Transform.call(this, options || {});

    this._transform = transform;
}
Util.inherits(TransformStream, Stream.Transform);
