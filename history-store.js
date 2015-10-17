/*jslint node: true, nomen: true */

module.exports = function (sroot) {
    'use strict';
    var Readable = require('stream').Readable,
        fs = require('fs'),
        fse = require('fs-extra'),
        path = require('path'),
        util = require('util'),
        async = require('async'),
        root = path.resolve(sroot),
        memcache = require('./modules/cache/cache'),
        fscache = require('./modules/cache/fscache');

    require('json.date-extensions');

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
            fs.mkdirSync(idpath);
        } catch (err) {
            if (err.code !== 'EEXIST') {
                console.log('Failed to create ', idpath, err);
                throw err;
            }
        }
        return idpath;
    }

    function readReportFile(filename, cb) {
        fs.readFile(filename, function (err, data) {
            try {
                cb(err, err ? undefined : JSON.parseWithDate(data));
            } catch (e) {
                cb(e);
            }
        });
    }

    function jsonOnly(filename) {return path.extname(filename) === '.json'; }

    function sinceStardate(startdate) {
        return startdate ?
                function (filename) {return filename.localeCompare(startdate.getTime()) >= 0; } :
                alwaysTrue;
    }

    function listOfReports(cb, reportRoot, startdate) {
        fs.readdir(reportRoot, function (err, filenames) {
            cb(err, err ? undefined :
                    filenames
                    .filter(jsonOnly)
                    .sort()
                    .filter(sinceStardate(startdate)) // FIXME would be much more efficient if splice on first index and with binarysearch / dichotomy
                    //.splice(dateIndex(startdate))
                    .map(function (filename) { return reportRoot + '/' + filename; }));
        });
    }

    // Stream

    function ReportStream(reportRoot, startdate) {
        Readable.call(this, {objectMode: true });
        this.reportRoot = reportRoot;
        this.startdate = startdate;
        this.reportIndex = 0; // current index of report
        this.reportfiles = undefined;// list of reports filename
    }

    util.inherits(ReportStream, Readable);

    ReportStream.prototype.readReport = function () {
        var self = this,
            reportfile;

        if (this.reportIndex >= this.reportfiles.length) {
            return this.push(null);
        }
        reportfile = this.reportfiles[this.reportIndex];
        readReportFile(reportfile, function (err, report) {
            if (err) {
                self.emit('error', 'Can\'t read report ' + err);
                return self.push(null);
            }
            self.reportIndex += 1;
            self.push(report);
        });
    };

    ReportStream.prototype._read = function () {
        var self = this;
        if (!this.reports) {
            listOfReports(function (err, reportfiles) {
                if (err) { return self.push(null); }

                self.reportfiles = reportfiles;
                self.readReport();
            }, this.reportRoot, this.startdate);
            return;
        }
        self.readReport();
    };

    function ReportHistory(id, customdate) {
        var dategetter = makeDateGetter(customdate),
            reportRoot,
            store;

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
            fs.writeFile(reportRoot + '/' + date.getTime() + '-' + process.hrtime()[1] + '.json', JSON.stringify(report), cb);
        }

        /*
        *  Read all reports and return them in an array
        */
        function get(cb) {
            listOfReports(function (err, reportfiles) {
                if (err) { return cb(err); }

                var readTasks = reportfiles.map(function (file) {return function (asynccallback) { readReportFile(file, asynccallback); }; });
                // Execute tasks
                async.series(readTasks, function (err, reports) {
                    cb(err, err ?
                                reports.filter(function (r) {return r; }) : // when error undefined is pushed to results
                                reports
                        );
                });
            }, reportRoot);
        }

        function stream(startdate) { return new ReportStream(reportRoot, startdate); }

        function cache(q, initvalue) { return memcache(q, store, initvalue); }
        function fsfscache(q) { return fscache(q, store); }

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
            customdate: customdate,
            dategetter: dategetter,
            cache: cache,
            fscache: fsfscache,
            folder: reportRoot
        };

        return store;
    }

    return {
        report : ReportHistory
    };

};