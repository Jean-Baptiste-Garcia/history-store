/**
 cache trends of a query on store onto filesystem
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
        function fscb(err, trends) {
            if (err) {
                return cb(err);
            }
            if (trends.length !== trendslength) {

                return fse.writeFile(cachefile, JSON.stringify(trends), function (err) {
                    if (!err) {trendslength = trends.length; }
                    cb(undefined, trends);
                });
            }
            cb(err, trends);
        }

        if (!memcache) {

            try {
                fse.ensureDirSync(cachedfolder);
                cachefile = cachedfolder + '/trends.json';
            } catch (error) {
                console.log('Failed to create query cache at ' + cachedfolder);
                throw error;
            }

            fse.readFile(cachefile, function (err, data) {
                var initvalue;
                try {
                    //console.log(err, data);
                    initvalue = data ? JSON.parseWithDate(data) : undefined;
                    trendslength = initvalue ? initvalue.length : 0;
                    memcache = store.cache(query, initvalue);
                    memcache.trends(fscb);
                } catch (e) {
                    cb(e);
                }

            });
            return;
        }
        console.log(cachedfolder);
        memcache.trends(fscb);

    }

    return {
        trends: computetrends
    };
};