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
                    if (err) {
                        console.error('ERROR : failed to write trends cache file at', cachefile, err);
                    }
                    // failing to write to cache should not prevent to get trends
                    cb(undefined, trends);
                });
            }
            cb(err, trends);
        }

        function initcache(next) {

            fse.readFile(cachefile, function (err, data) {
                if (err && err.code !== 'ENOENT') {
                    console.error('ERROR: failed to read cache file at', cachefile, err);
                }
                try {
                    var filecontent = err ? undefined : data,
                        initvalue = filecontent ? JSON.parseWithDate(filecontent) : undefined;
                    memcache = store.memcache(query, initvalue);
                    next();
                } catch (e) {
                    console.log('fscache failure ', e);
                    cb(e);
                }
            });
        }

        if (memcache) {
            memcache.trends(memcachecb);
        } else {
            initcache(function () {memcache.trends(memcachecb); });
        }
    }

    // Initialization
    try {
        fse.ensureDirSync(cachedfolder);
    } catch (error) {
        console.log('Failed to create query cache at ' + cachedfolder);
        throw error;
    }

    return {
        trends: computetrends
    };
};