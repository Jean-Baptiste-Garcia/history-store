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
        id_path = {};

    require('json.date-extensions');

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
        var idpath = id_path[id];
        if (!idpath) {
            idpath = root + '/' + id;
            id_path[id] = idpath;
            try {
                fs.mkdirSync(idpath);
            } catch (err) {
                if (err.code !== 'EEXIST') {
                    console.log('failed to create ', idpath, err);
                    throw err;
                }
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
        if (!startdate) {
            return function () {
                return true;
            };
        }
        return function (filename) {
            return filename.localeCompare(startdate.getTime()) >= 0;
        };
    }

    function listOfReports(cb, id, startdate) {
        var reportRoot = toPath(id);
        fs.readdir(reportRoot, function (err, filenames) {
            cb(err, err ? undefined :
                    filenames
                    .filter(jsonOnly)
                    .sort()
                    .filter(sinceStardate(startdate)) // more efficient if splice on first index and with binarysearch
                    .map(function (filename) { return reportRoot + '/' + filename; }));
        });
    }

    function ReportStream(id, startdate) {
        Readable.call(this, {objectMode: true });
        this.index = 0;
        this.reportsId = id;
        this.startdate = startdate;
    }

    util.inherits(ReportStream, Readable);

    ReportStream.prototype.readReport = function () {
        var self = this;

        if (this.index >= this.files.length) {
            this.push(null);
            return;
        }

        readReportFile(this.files[this.index], function (err, report) {
            if (err) {
                self.emit('error', 'Can\'t read report ' + err);
                self.push(null);
                return;
            }
            self.index += 1;
            self.push(report);
        });
    };

    ReportStream.prototype._read = function () {
        var self = this;
        if (!this.files) {
            listOfReports(function (err, files) {
                if (err) {
                    self.push(null);
                    return;
                }

                self.files = files;
                self.readReport();
            }, this.reportsId, this.startdate);
            return;
        }
        self.readReport();
    };

    function ReportHistory(id, customdate) {
        var dategetter;

        /*
        * Store report
        */
        function put(report, cb) {
            var reportsPath = toPath(id),
                date = dategetter(report);

            if (typeof date === 'string') {
                // this may happen when data to put comes from client side (rest post api call)
                date = new Date(date);
            }
            // it appeared that Date.now() resolution in ms, is not enough to avoid 2 different data saved in same file name
            // so nanoseconds are added just to avoid this situation
            // in unit tests you can have :
            // 1441216630351-612441275.json
            // 1441216630351-613168640.json
            fs.writeFile(reportsPath + '/' + date.getTime() + '-' + process.hrtime()[1] + '.json', JSON.stringify(report), cb);
        }

        /*
        *  Read all reports and return them in an array
        */
        function get(cb) {
            var tasks;

            listOfReports(function (err, files) {
                if (err) {
                    cb(err);
                    return;
                }

                tasks = files.map(function (file) {return function (asynccallback) { readReportFile(file, asynccallback); }; });
                // Execute tasks
                async.series(tasks, function (err, results) {
                    cb(err, err ?
                                results.filter(function (r) {return r; }) : // when error undefined is pushed to results
                                results
                        );
                });
            }, id);
        }

        function stream(startdate) {
            var s = new ReportStream(id, startdate);
            s.customdate = customdate;
            return s;
        }

        //
        // Initialization
        //
        dategetter = makeDateGetter(customdate);

        try {
            fse.ensureDirSync(root);
        } catch (error) {
            console.log('Failed to create history storage root at ' + root);
            throw error;
        }

        if ((process.env.NODE_ENV || 'development') !== 'development') {
            console.log('History storage root is', root);
        }

        return {
            put: put,
            get: get,
            stream: stream
        };
    }

    return {
        report : ReportHistory
    };

};