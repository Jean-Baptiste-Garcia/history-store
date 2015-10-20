/*jslint node: true, nomen: true */

module.exports = function (sroot) {
    'use strict';
    var fse = require('fs-extra'),
        path = require('path'),
        Stream = require('./modules/stream/stream'),
        memcache = require('./modules/cache/memcache'),
        fscache = require('./modules/cache/fscache'),
        root = path.resolve(sroot);

    function alwaysTrue() {return true; }

    // returns a function to access value for given a path
    // path like 'key1.key2.key3' --> obj[key1][key2][key3]
    function makeDateGetter(customdate) {
        if (!customdate) { return function (report) {return report.date; }; }

        function getter(path) {
            var paths = path.split('.');

            switch (paths.length) {
            case 0:
                throw 'bad path ' + path;
            case 1:
                return function (obj) {return obj[path]; };
            case 2:
                return function (obj) {return obj[paths[0]][paths[1]]; };
            default:
                return function deepValue(obj) {
                    var current = obj,
                        index = 0;

                    while (index < paths.length) {
                        current = current[paths[index]];
                        if (current === undefined) {
                            return undefined;
                        }
                        index += 1;
                    }
                    return current;
                };
            }
        }

        switch (typeof customdate) {
        case 'string':
            return getter(customdate);
        case 'function':
            return customdate;
        default:
            throw new Error('Unknown date getter type ' + typeof customdate);
        }
    }

    function toPath(id) {
        var idpath = root + '/' + id;
        try {
            fse.mkdirSync(idpath);
        } catch (err) {
            if (err.code !== 'EEXIST') {
                console.log('Failed to create ', idpath, err);
                throw err;
            }
        }
        return idpath;
    }

    function jsonOnly(filename) {return path.extname(filename) === '.json'; }

    function sinceStardate(startdate) {
        return startdate ?
                function (filename) {return filename.localeCompare(startdate.getTime()) >= 0; } :
                alwaysTrue;
    }

    function ReportStore(id, customdate) {
        var dategetter = makeDateGetter(customdate),
            reportRoot,
            store,
            reports,
            dirty = true,
            watcher;

        // is dirty, when a put occurred and/or when watch raised an event
        // if dirty, recompute reportList
        // then look for startdate
        // return slice of reportList
        function listreports(startdate) {
            return function (cb) {

                if (!dirty) {
                    return cb(undefined, reports.filter(sinceStardate(startdate)).map(function (filename) { return reportRoot + '/' + filename; }));
                }

                fse.readdir(reportRoot, function (err, filenames) {
                    dirty = false;
                    reports = filenames
                            .filter(jsonOnly)
                            .sort();
                    cb(err, err ? undefined :
                            reports
                            .filter(sinceStardate(startdate)) // FIXME would be much more efficient if splice on first index and with binarysearch / dichotomy
                            //.splice(dateIndex(startdate))
                            .map(function (filename) { return reportRoot + '/' + filename; }));
                });
            };
        }

        /*
        * Store report
        */
        function put(report, cb) {
            var date = dategetter(report);

            if (typeof date === 'string') {
                // this may happen when data to put comes from client side (rest post api call)
                date = new Date(date);
            }
            // it appeared that Date.now() resolution in ms, is not enough to avoid 2 different data saved in same file name
            // so nanoseconds are added just to avoid this situation
            // in unit tests you can have :
            // 1441216630351-612441275.json
            // 1441216630351-613168640.json
            dirty = true;
            fse.writeFile(reportRoot + '/' + date.getTime() + '-' + process.hrtime()[1] + '.json', JSON.stringify(report), cb);
        }

        function stream(startdate) { return new Stream(listreports(startdate)); }

        /*
        *  Read all reports and return them in an array
        */
        function get(cb) {
            var reports = [],
                lasterror,
                reportstream = stream();

            reportstream.on('data',  function (report) {reports.push(report); });
            reportstream.on('error', function (err) {lasterror = err; });
            reportstream.on('end', function () {
                cb(lasterror, lasterror ?
                        reports.filter(function (r) {return r; }) : // when error, undefined is pushed to results :
                        reports);
            });
        }

        function memorycache(q, initvalue) { return memcache(q, store, initvalue); }

        function filesystemcache(q) { return fscache(q, store); }

        function close() { watcher.close(); }

        //
        // Initialization
        //
        try {
            fse.ensureDirSync(root);
            reportRoot = toPath(id);
            watcher = fse.watch(reportRoot, function (event, filename) {dirty = true; console.log('.'); });
        } catch (error) {
            console.log('Failed to create history storage root at ' + root);
            throw error;
        }

        if ((process.env.NODE_ENV || 'development') !== 'development') {
            console.log('History storage root is', root);
        }

        store = {
            put: put,
            get: get,
            stream: stream,
            customdate: customdate,
            dategetter: dategetter,
            memcache: memorycache,
            cache: filesystemcache,
            folder: reportRoot,
            close : close
        };
        return store;
    }

    return {
        open : ReportStore
    };
};


