/*jslint node: true, nomen: true */
var R = require('ramda');

module.exports = function (sroot) {
    'use strict';
    var fse = require('fs-extra'),
        path = require('path'),
        bs = require('binary-search'),
        Stream = require('./modules/stream/stream'),
        memcache = require('./modules/cache/memcache'),
        fscache = require('./modules/cache/fscache'),
        syncer,
        root = path.resolve(sroot);

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

    function ReportStore(id, customdate) {
        var dategetter = makeDateGetter(customdate),
            reportRoot,
            store,
            catalog, // contains reports: list of filenames sorted, dates: dates in ms corresponding to reports
            dirty = true;

        function buildcatalog(cb) {
            fse.readdir(reportRoot, function (err, filenames) {
                cb(err, err ?
                        undefined :
                        filenames
                        .filter(function jsonOnly(filename) { return path.extname(filename) === '.json'; })
                        .sort()
                        .map(function (filename) {
                            return {
                                date: parseInt(filename.split('-')[0], 10),
                                report: reportRoot + '/' + filename
                            };
                        })
                    );
            });
        }

        // find catalog index corresponding to startdate
        // using binary search (a is array and b is target date)
        function dateIndex(cat, startdate) {
            var index;
            if (!startdate) {return 0; }
            index = bs(cat, startdate.getTime(), function (a, b) {return a.date - b; });
            return index >= 0
                    ? index
                    : -index - 1;
        }

        // Catalog access can be asynchroneous when dirty
        function makeCatalogGetter(startdate, transform) {
            return function getCatalog(cb) {

                function sendCatalog() {
                    var cat = transform ? transform(catalog) : catalog;
                    cb(undefined, cat, dateIndex(cat, startdate));
                }

                if (!dirty) {
                    return sendCatalog();
                }

                buildcatalog(function (err, cat) {
                    if (err) {return cb(err); }
                    catalog = cat;
                    dirty = false;
                    return sendCatalog();
                });
            };
        }

        /*
        * Stores a new report
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

        /*
        * Streams reports starting at startdate
        */
        function stream(startdate, datefilter) {
            return new Stream(makeCatalogGetter(startdate, datefilter));
        }

        function getCatalog(cb, datefilter) {
            makeCatalogGetter(undefined, datefilter)(cb);
        }

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
                cb(lasterror, lasterror
                        ? reports.filter(function (r) {return r; }) // when error, undefined is pushed to results :
                        : reports);
            });
        }

        function memorycache(q, initvalue) { return memcache(q, store, initvalue); }

        function filesystemcache(q) { return fscache(q, store); }

        //
        // Initialization
        //
        try {
            fse.ensureDirSync(root);
            reportRoot = toPath(id);
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
            catalog: getCatalog,
            customdate: customdate,
            dategetter: dategetter,
            memcache: memorycache,
            cache: filesystemcache,
            markdirty: function () { dirty = true; },
            folder: reportRoot, // should be readonly
            id: id // should be readonly
        };
        return store;
    }

    syncer = require('./modules/syncer/syncer')(ReportStore, toPath);
    return {
        report: R.memoize(ReportStore),
        open: syncer.open,
        close: syncer.close
    };
};