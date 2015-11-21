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

function ReportStream(getCatalog) {
    var self = this;
    Readable.call(this, {objectMode: true });
    this.reportIndex = -1; // current index of report
    this.catalog = undefined;
    this.getCatalog = getCatalog;
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
    if (this.catalog) {
        this.readReport();
    } else {
        var self = this;
        this.getCatalog(function (err, catalog, startIndex) {
            if (err) {return self.push(null); }
            self.reportIndex = startIndex;
            self.catalog = catalog;
            //console.log('yes', catalog, this, self);
            self.readReport();
        });
    }
};

module.exports = ReportStream;