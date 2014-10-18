'use strict';

var anyorm = require(__dirname+'/../');
var DBMapper = anyorm.DBMapper;
var Service = anyorm.Service;

Service.define({
    'serial.db': {
        generate: function(options) {
            return new Service.DB.Adapter(options.dsn, options.pool);
        },

        dsn: 'postgres://user:password@192.168.0.2/serial',
        pool: {
            max: 8,
            min: 1
        }
    },

    'topic.db.0': {
        generate: function(options) {
            return new Service.DB.Adapter(options.dsn, options.pool);
        },

        dsn: 'postgres://user:password@192.168.0.2/board',
        pool: {
            max: 8,
            min: 1
        }
    },

    'topic.db.1': {
        generate: function(options) {
            return new Service.DB.Adapter(options.dsn, options.pool);
        },

        dsn: 'postgres://user:password@192.168.0.3/board',
        pool: {
            max: 8,
            min: 1
        }
    },

    'topic': function(topic_id) {
        if (topic_id === undefined) {
            throw new Error('Get topic database without topic id');
        }

        return 'topic.db.'+(topic_id % 2);
    }
});

var TopicMapper = anyorm.defineMapper({
    select: function() {
        throw new Error('Select topic is unsupport');
    },
    doFind: function(id) {
        var db = this.getService(id);
        return DBMapper.prototype.doFind.call(this, id, db);
    },
    doInsert: function(data) {
        var db = this.getService(data.getId());
        return DBMapper.prototype.doInsert.call(this, data, db);
    },
    doUpdate: function(data) {
        var db = this.getService(data.getId());
        return DBMapper.prototype.doUpdate.call(this, data, db);
    },
    doDelete: function(data) {
        var db = this.getService(data.getId());
        return DBMapper.prototype.doDelete.call(this, data, db);
    },
}, DBMapper);

var Topic = anyorm.defineData({
    mapper: TopicMapper,
    service: 'topic',
    collection: 'board.topics',
    attributes: {
        topic_id: {type: 'integer', primary_key: true},
        subject: 'string',
        content: 'string',
        create_time: {type: 'datetime', refuse_update: true, default: 'now'}
    }
});

Topic.prototype.__before_insert = function() {
    var db = Service.get('serial.db');
    var sql = 'select nextval("topic_id_seq") as topic_id';

    // get new topic id from id sequence
    return db.execute(sql).then(function(result) {
        var topic_id = result.rows[0]['topic_id'];
        this.topic_id = topic_id;
    }.bind(this));
};
