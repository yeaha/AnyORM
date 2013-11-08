var Service = require('../lib').Service;

var Adapter = function(options) {
    this.options = options;
};

Adapter.prototype.getName = function() {
    return this.options['name'];
};

////////////////////////////////////////////////////////////////////////////////

exports.testRegister = function(test) {
    Service.define('foo', {
        constructor: function(options) {
            return new Adapter(options);
        },
        name: 'foo'
    });

    Service.define({
        bar: {
            __EXTEND__: 'foo',
            name: 'bar'
        }
    });

    test.equal(Service.get('foo').getName(), 'foo');
    test.equal(Service.get('bar').getName(), 'bar');

    test.done();
};

exports.testDispatch = function(test) {
    Service.define('foobar', function(id) {
        return (id % 2) ? 'foo' : 'bar';
    });

    test.equal(Service.get('foobar', 1).getName(), 'foo');
    test.equal(Service.get('foobar', 2).getName(), 'bar');

    test.done();
};
