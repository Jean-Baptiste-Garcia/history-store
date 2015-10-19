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

function ReportStream(listreports) {
    Readable.call(this, {objectMode: true });
    this.listreports = listreports;
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
    if (!this.reportfiles) {
        this.listreports(function (err, reportfiles) {
            if (err) { return self.push(null); }

            self.reportfiles = reportfiles;
            self.readReport();
        });
        return;
    }
    self.readReport();
};

module.exports = ReportStream;