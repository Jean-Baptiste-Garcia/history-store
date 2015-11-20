// Report Stream

/*jslint node: true, nomen: true */
'use strict';
var Readable = require('stream').Readable,
    fs = require('fs'),
    util = require('util');

require('json.date-extensions');

function readReportFile(filename, cb) {
    fs.readFile(filename, function (err, data) {
        try {
            cb(err, err ? undefined : JSON.parseWithDate(data));
        } catch (e) {
            cb(e);
        }
    });
}

function ReportStream(catalogCallback) {
    Readable.call(this, {objectMode: true });
    this.catalogCallback = catalogCallback;
    this.reportIndex = 0; // current index of report
    this.catalog = undefined;
}

util.inherits(ReportStream, Readable);

ReportStream.prototype.readReport = function () {
    var self = this,
        reportfile;

    if (this.reportIndex >= this.catalog.length) {
        return this.push(null);
    }
    reportfile = this.catalog[this.reportIndex].report;
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
    if (!this.catalog) {
        this.catalogCallback(function (err, catalog, startIndex) {
            if (err) {return self.push(null); }

            self.catalog = catalog;
            self.reportIndex = startIndex;
            self.readReport();
        });
        return;
    }
    self.readReport();
};

module.exports = ReportStream;