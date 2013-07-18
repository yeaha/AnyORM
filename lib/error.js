var http = require('http');

exports.DataError = DataError;

exports.HttpError = HttpError;

exports.StorageError = StorageError;

// Http错误
function HttpError(code, msg) {
    Error.captureStackTrace(this, arguments.callee);
    this.name = arguments.callee.name;

    var status = http.STATUS_CODES;

    if (!code || !(code in status))
        code = 500;

    if (!msg)
        msg = status[code];

    this.message = msg;
    this.code = code;
}

HttpError.prototype = Object.create(Error.prototype);

// DataMapper Data对象错误
function DataError(msg) {
    Error.captureStackTrace(this, arguments.callee);

    this.name = arguments.callee.name;
    this.message = msg;
}

DataError.prototype = Object.create(Error.prototype);

// 存储服务错误
function StorageError(msg, code) {
    Error.captureStackTrace(this, arguments.callee);

    this.name = arguments.callee.name;
    this.message = msg;
    this.code = code;
}

StorageError.prototype = Object.create(Error.prototype);
