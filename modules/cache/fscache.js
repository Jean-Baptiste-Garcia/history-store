/**
 cache trends of a query onto filesystem
 use a memcache to compute real trends and store to filesytem when needed
*/

/*jslint node: true */
'use strict';
var fse = require('fs-extra');

module.exports = function fscache(query, store) {
    var cachedfolder = store.folder + '/' + (query.id || 'anonymous'),
        trendslength,
        memcache,
        cachefile;

    function computetrends(cb) {

        function memcachecb(err, trends) {
            if (err) {return cb(err); }
            if (trends.length !== trendslength) {
                // cache file needs to be updated
                return fse.writeFile(cachefile, JSON.stringify(trends), function (err) {
                    if (!err) {trendslength = trends.length; }
                    cb(undefined, trends);
                });
            }
            cb(err, trends);
        }

        if (!memcache) {
            // Initialization
            try {
                fse.ensureDirSync(cachedfolder);
                cachefile = cachedfolder + '/trends.json';
            } catch (error) {
                console.log('Failed to create query cache at ' + cachedfolder);
                throw error;
            }
            // read cache file
            fse.readFile(cachefile, function (err, data) {
                try {
                    var initvalue = data ? JSON.parseWithDate(data) : undefined;
                    trendslength = initvalue ? initvalue.length : 0;
                    memcache = store.cache(query, initvalue);
                    memcache.trends(memcachecb);
                } catch (e) {
                    cb(e);
                }
            });
            return;
        }
        memcache.trends(memcachecb);
    }

    return {
        trends: computetrends
    };
};