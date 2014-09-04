var manager = require(__dirname+'/manager');

module.exports = exports = {
    define: manager.define,
    get: manager.get,

    get DB() {
        return require(__dirname+'/db');
    },

    get Redis() {
        return require(__dirname+'/redis');
    }
};
