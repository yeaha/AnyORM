'use strict';

var anyorm = require(__dirname+'/../');
var DBMapper = anyorm.DBMapper;
var Service = anyorm.Service;

Service.define({
    master: {
        generate: function(options) {
            return new Service.DB.Adapter(options.dsn, options.pool);
        },

        dsn: 'postgres://user:password@192.168.0.2/board',
        pool: {
            max: 8,
            min: 1
        }
    },

    slave: {
        generate: function(options) {
            return new Service.DB.Adapter(options.dsn, options.pool);
        },

        dsn: 'postgres://user:password@192.168.0.3/board',
        pool: {
            max: 8,
            min: 1
        }
    },

    cache: {
        generate: function(options) {
            return Service.Redis.createPool(options.pool, options.client);
        },

        client: {
            host: '127.0.0.1',
            port: 6379,
        },

        pool: {
            max: 8,
            min: 3,
        }
    }
});

var TopicMapper = anyorm.defineMapper({
    __initialize: function() {
        // find at master before new data sync to slave
        this.on('after:insert', function(data) {
            this._set_status(data.getId(), 'at_master');
        }.bind(this));

        // find at master before saved data sync to slave
        this.on('after:update', function(data) {
            this._set_status(data.getId(), 'at_master');
        }.bind(this));

        // mark topic as deleted, avoid find in slave before sync from master
        this.on('after:delete', function(data) {
            this._set_status(data.getId(), 'deleted');
        }.bind(this));
    },

    // select from master
    selectMaster: function() {
        var db = Service.get('master');
        return DBMapper.prototype.select.call(this, db);
    },

    // select from slave
    selectSlave: function() {
        var db = Service.get('slave');
        return DBMapper.prototype.select.call(this, db);
    },

    // default select from slave
    select: function() {
        return this.selectSlave();
    },

    // auto do find in master or slave
    doFind: function(id) {
        return this._get_status(id).then(function(status) {
            if (status == 'deleted') {
                return false;
            }

            var db = (status == 'at_master') ? Service.get('master') : Service.get('slave');
            return DBMapper.prototype.doFind.call(this, id, db);
        }.bind(this));
    },

    // insert into master
    doInsert: function(data) {
        var db = Service.get('master');
        return DBMapper.prototype.doInsert.call(this, data, db);
    },

    // update master
    doUpdate: function(data) {
        var db = Service.get('master');
        return DBMapper.prototype.doUpdate.call(this, data, db);
    },

    // delete from master
    doDelete: function(data) {
        var db = Service.get('master');
        return DBMapper.prototype.doDelete.call(this, data, db);
    },

    _set_status: function(id, status) {
        var redis = Service.get('redis');
        var key = 'topic_status_'+id;

        // status cache expire after 5 minutes
        return redis.execute('setex', key, 300, status);
    },

    _get_status: function(id) {
        var redis = Service.get('redis');
        var key = 'topic_status_'+id;

        return redis.execute('get', key);
    }
}, DBMapper);

var Topic = anyorm.defineData({
    mapper: TopicMapper,
    service: 'slave',
    collection: 'board.topics',
    attributes: {
        topic_id: {type: 'integer', primary_key: true, auto_generate: true},
        subject: 'string',
        content: 'string',
        create_time: {type: 'datetime', refuse_update: true, default: 'now'}
    }
});
