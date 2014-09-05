"use strict";

var Promise = require('bluebird');
var anyorm = require(__dirname +'/../../lib/index.js');
var crypto = require('crypto');

var Accounts = exports.Accounts = anyorm.defineData({
    mapper: anyorm.DBMapper,
    collection: 'bug_tracker.accounts',
    attributes: {
        account_id: {type: 'integer', primary_key: true, auto_increase: true},
        account_name: {type: String},
        first_name: {type: String},
        last_name: {type: String},
        email: {type: String},
        password_hash: {type: String},
        portrait_image: {type: String, allow_null: true},
        hourly_rate: {type: 'numeric'},
    }
});

Accounts.prototype._normalize = function(name, value, config) {
    if (name == 'password_hash') {
        value = Accounts.normalizePassword(value);
    }

    return value;
};

Accounts.prototype.selectReportBugs = function() {
    return Bugs.getMapper().select().where('reported_by = ?', this.account_id);
};

Accounts.prototype.selectAssignBugs = function() {
    return Bugs.getMapper().select().where('assigned_to = ?', this.account_id);
};

Accounts.normalizePassword = function(password) {
    return crypto.createHash('sha1').update(password).digest('hex').toString();
};

Accounts.auth = function(name, password) {
    if (!name || !password) {
        return Promise.reject(new Error('Authorize failed, require account name and password'));
    }

    var select = Accounts.getMapper()
                        .select().where('name = ? and password_hash = ?', name, Accounts.normalizePassword(password));

    return select.getOne();
};

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

var Bugs = exports.Bugs = anyorm.defineData({
    mapper: anyorm.DBMapper,
    collection: 'bug_tracker.bugs',
    attributes: {
        bug_id: {type: 'integer', primary_key: true, auto_increase: true},
        date_reported: {type: 'date', pattern: /^\d{4}\-\d{1,2}\-\d{1,2}$/},
        summary: {type: String},
        description: {type: String},
        resolution: {type: String, allow_null: true},
        reported_by: {type: 'integer'},
        assigned_to: {type: 'integer', allow_null: true},
        verified_by: {type: 'integer', allow_null: true},
        status: {type: String, default: 'NEW'},
        priority: {type: String, allow_null: true},
        hours: {type: 'numeric', allow_null: true},
    }
});

Bugs.prototype.getReportAccount = function() {
    return this.reported_by
         ? Accounts.find(this.reported_by)
         : false;
};

Bugs.prototype.getAssignUser = function() {
    return this.assigned_to
         ? Accounts.find(this.assigned_to)
         : false;
};

Bugs.prototype.selectComments = function() {
    return Comments.getMapper().select().where('bug_id = ?', this.bug_id);
};

Bugs.prototype.selectScreenshots = function() {
    return Screenshots.getMapper().select().where('bug_id = ?', this.bug_id);
};

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

var BugProduct = exports.BugProduct = anyorm.defineData({
    mapper: anyorm.DBMapper,
    collection: 'bug_tracker.bugs_products',
    attributes: {
        bug_id: {type: 'integer', primary_key: true},
        product_id: {type: 'integer'},
    }
});

BugProduct.prototype.getBug = function() {
    return Bugs.find(this.bug_id);
};

BugProduct.prototype.getProduct = function() {
    return Products.find(this.product_id);
};

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

var BugStatus = exports.BugStatus = anyorm.defineData({
    mapper: anyorm.DBMapper,
    collection: 'bug_tracker.bugs_status',
    attributes: {
        status: {type: String, primary_key: true}
    }
});

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

var Comments = exports.Comments = anyorm.defineData({
    mapper: anyorm.DBMapper,
    collection: 'comments',
    attributes: {
        comment_id: {type: 'integer', primary_key: true, auto_increase: true},
        bug_id: {type: 'integer'},
        author: {type: 'integer'},
        comment_date: {type: 'datetime', default: 'now'},
        comment: {type: String},
    }
});

Comments.prototype.getAuthor = function() {
    return Accounts.find(this.author);
};

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

var Products = exports.Products = anyorm.defineData({
    mapper: anyorm.DBMapper,
    collection: 'bug_tracker.products',
    attributes: {
        product_id: {type: 'integer', primary_key: true, auto_increase: true},
        product_name: {type: String},
    }
});

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

var Screenshots = exports.Screenshots = anyorm.defineData({
    mapper: anyorm.DBMapper,
    collection: 'bug_tracker.screenshots',
    attributes: {
        bug_id: {type: 'integer', primary_key: true},
        image_id: {type: 'integer', primary_key: true},
        screenshot_image: {type: String},
        caption: {type: String, allow_null: true},
    }
});
