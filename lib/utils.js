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
