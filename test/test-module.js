var anyorm = require('../lib');

exports.testSubModules = function(test) {
    var mods = [
            'defineData', 'Data',
            'defineMapper', 'Mapper', 'DBMapper', 'CacheDBMapper',
            'defineType',
            'Service'
        ];

    mods.forEach(function(mod) {
        test.ok(mod in anyorm, mod +' not exist!');
    });

    test.done();
};
