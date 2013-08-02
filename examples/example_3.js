// 分库 分表

var anyorm = require('../lib');
var Service = anyorm.Service;
var DBMapper = anyorm.DBMapper;

// 定义数据库服务
Service.register({
    db: {
        constructor: function(config) {
            var Adapter = Service.DB.Adapter;
            return new Adapter(config['dsn'], config['pool']);
        },
        pool: {min: 2, max: 8, log: false}
    },
    node_0: {
        __EXTEND__: '__db__',
        dsn: 'sqlite3://'+__dirname+'/node_0.sqlite3',
    },
    node_1: {
        __EXTEND__: '__db__',
        dsn: 'sqlite3://'+__dirname+'/node_1.sqlite3',
    },
    node_2: {
        __EXTEND__: '__db__',
        dsn: 'sqlite3://'+__dirname+'/node_2.sqlite3',
    },
    topic: function(id) {
        var nodes = ['node_0', 'node_1', 'node_2'];
        return nodes[(id % 3)];
    },
});

// 分表
var TopicMapper = anyorm.defineMapper({
    _getTable: function(id) {
        return 'topic_'+ (id % 3);
    },

    doFind: function(id) {
        var doFind = DBMapper.prototype.doFind;
        var table = this._getTable(id);

        return doFind.call(this, id, null, table);
    },
    doInsert: function(data) {
        var doInsert = DBMapper.prototype.doInsert;
        var table = this._getTable(data.topic_id);

        return doInsert.call(this, data, null, table);
    },
    doUpdate: function(data) {
        var doUpdate = DBMapper.prototype.doUpdate;
        var table = this._getTable(data.topic_id);

        return doUpdate.call(this, data, null, table);
    },
    doDelete: function(data) {
        var doDelete = DBMapper.prototype.doDelete;
        var table = this._getTable(data.topic_id);

        return doDelete.call(this, data, null, table);
    },
}, DBMapper);

// 分库
var TopicMapper = anyorm.defineMapper({
    _getDB: function(id) {
        return Service.get('topic', id);
    },

    doFind: function(id) {
        var doFind = DBMapper.prototype.doFind;
        var db = this._getDB(id);

        return doFind.call(this, id, db);
    },
    doInsert: function(data) {
        var doInsert = DBMapper.prototype.doInsert;
        var db = this._getDB(data.topic_id);

        return doInsert.call(this, data, db);
    },
    doUpdate: function(data) {
        var doUpdate = DBMapper.prototype.doUpdate;
        var db = this._getDB(data.topic_id);

        return doUpdate.call(this, data, db);
    },
    doDelete: function(data) {
        var doDelete = DBMapper.prototype.doDelete;
        var db = this._getDB(data.topic_id);

        return doDelete.call(this, data, db);
    },
}, DBMapper);

var Topic = anyorm.defineData({
    mapper: TopicMapper,
    properties: {
        topic_id: {type: 'integer', primary_key: true},
        content: {type: 'string'},
        create_time: {type: 'datetime', default: 'now', refuse_update: true},
        update_time: {type: 'datetime'},
    },
});
