var Q = require('q');
var anyorm = require('../lib');
var Service = anyorm.Service;

// 定义数据库服务
Service.define('example', {
    constructor: function(config) {
        var Adapter = Service.DB.Adapter;
        return new Adapter(config['dsn'], config['options']);
    },
    dsn: 'sqlite3://'+__dirname+'/example.sqlite3',
    options: {min: 2, max: 8, log: false}
});

////////////////////////////////////////////////////////////////////////////////

var Blog = anyorm.defineData({
    mapper: anyorm.DBMapper,
    storage: 'example',
    collection: 'blog',
    properties: {
        blog_id: {type: 'integer', primary_key: true, auto_increase: true},
        title: {type: 'string'},
        content: {type: 'string'},
        create_time: {type: 'datetime', default: 'now', refuse_update: true},
        update_time: {type: 'datetime'},
    },
});

Blog.prototype.__before_save = function() {
    this.update_time = new Date;
};

// return promise
Blog.prototype.getTags = function() {
    var select = BlogTag.getMapper().select();
    select.setColumns('tag_id').where('blog_id = ?', this.blog_id);

    return Tag.select().whereIn('tag_id', select).get();
};

// return promise
Blog.prototype.getComments = function() {
    return this.selectComment().order('create_time desc').get();
};

// return promise
Blog.prototype.saveComment = function(data) {
    var comment = new Comment;
    comment.blog_id = this.blog_id;
    comment.set(data);

    return comment.save()
            .then(function() {
                return comment;
            });
};

// return promise
Blog.prototype.selectComment = function() {
    return Comment.getMapper().select().where('blog_id = ?', this.blog_id);
};

////////////////////////////////////////////////////////////////////////////////

var Tag = anyorm.defineData({
    mapper: anyorm.DBMapper,
    storage: 'example',
    collection: 'tag',
    properties: {
        tag_id: {type: 'integer', primary_key: true, auto_increase: true},
        tag: {type: 'string'},
    },
});

////////////////////////////////////////////////////////////////////////////////

var BlogTag = anyorm.defineData({
    mapper: anyorm.DBMapper,
    storage: 'example',
    collection: 'blog_tag',
    properties: {
        blog_id: {type: 'integer', primary_key: true},
        tag_id: {type: 'integer', primary_key: true},
    },
});

////////////////////////////////////////////////////////////////////////////////

var Comment = anyorm.defineData({
    mapper: anyorm.DBMapper,
    storage: 'example',
    collection: 'comment',
    properties: {
        comment_id: {type: 'integer', primary_key: true, auto_increase: true},
        blog_id: {type: 'integer'},
        author: {type: 'string', allow_null: true},
        ip: {type: 'string', pattern: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/},
        content: {type: 'string'},
        create_time: {type: 'datetime', default: 'now', refuse_update: true},
    },
});

// return promise
Comment.prototype.getBlog = function() {
    return Blog.find(this.blog_id);
};

////////////////////////////////////////////////////////////////////////////////

// 以下代码仅仅是例子，无法真正执行

// 新建blog
var blog = new Blog;
blog.title = blog_title;
blog.content = blog_content;
blog.save()
    .then(function() {
        console.log('save success');
    })
    .catch(function(error) {
        console.log('save failed');
    });

// 保存一条评论
var comment = {ip: '127.0.0.1', content: 'foobar'};
blog.saveComment(comment)
    .then(function(comment) {
        console.log('save comment success, new comment id is '+ comment.comment_id);

        return comment.getBlog();
    })
    .then(function(blog) {
        console.log(blog);
    })
    .catch(function(error) {
        console.log('error', error.stack);
    });

// 获得最近一条评论
blog.selectComment()
    .order('create_time desc')
    .getOne()
    .then(function(comment) {
        if (comment) {
            console.log('last comment: ', comment);
        } else {
            console.log('no comment');
        }
    })
    .catch(function(error) {
        console.log('get last comment failed');
    });

// 获得最新10条comment，以create_time倒序排序
var select = blog.selectComment().order('create_time desc').limit(10);
select.get()
    .then(function(comments) {
        console.log('get '+ comments.length +' comments');
    })
    .catch(function(error) {
        console.log('get comments failed');
    });

// 获取blog的tag和comment
// async tasks
var tasks = [
    blog.getTags(),
    blog.getComments(),
];

Q.spread(tasks, function(tags, comments) {
    console.log(tags);
    console.log(comments);
});
