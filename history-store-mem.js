/*jslint node: true, nomen: true */

module.exports = function () {
    'use strict';
    var Readable = require('stream').Readable,
        util = require('util'),
        reports = {};

    function ReportStream(id) {
        Readable.call(this, {objectMode: true });
        this.index = 0;
        this.idReports = reports[id];
    }

    util.inherits(ReportStream, Readable);

    ReportStream.prototype._read = function () {
        if (this.index < this.idReports.length) {
            this.push(this.idReports[this.index]);
            this.index += 1;
            return;
        }
        this.push(null);
    };

    function ReportHistory(id) {

        function put(data, cb) {
            if (!reports[id]) {
                reports[id] = [];
            }
            reports[id].push(data);
            cb();
        }

        function get(cb) {
            var data = reports[id];
            cb(undefined, data);
        }

        function stream() {
            return new ReportStream(id);
        }

        return {
            put: put,
            get: get,
            stream: stream
        };
    }

    return {
        report: ReportHistory
    };
};