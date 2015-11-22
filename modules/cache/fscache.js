/**
 cache trends of a query onto filesystem
 use a memcache to compute real trends and store to filesytem when needed
*/

/*jslint node: true */
'use strict';
var fse = require('fs-extra');

module.exports = function fscache(query, store) {
    var cachedfolder = store.folder + '/trends',
        cachefile = cachedfolder + '/' + (query.id || 'anonymous') + '.json',
        memcache;

    function computetrends(cb) {

        function memcachecb(err, trends, changed) {
            if (err) {return cb(err); }
            if (changed) {
                return fse.writeFile(cachefile, JSON.stringify(trends), function (err) {
                    cb(undefined, trends);
                });
            }
            cb(err, trends);
        }

        if (memcache) {
            return memcache.trends(memcachecb);
        }

        // Initialization
        try {
            fse.ensureDirSync(cachedfolder);
        } catch (error) {
            console.log('Failed to create query cache at ' + cachedfolder);
            throw error;
        }
        // read cache file
        fse.readFile(cachefile, function (err, data) {
            try {
                var initvalue = data ? JSON.parseWithDate(data) : undefined;
                memcache = store.memcache(query, initvalue);
                memcache.trends(memcachecb);
            } catch (e) {
                cb(e);
            }
        });
    }

    return {
        trends: computetrends
    };
};