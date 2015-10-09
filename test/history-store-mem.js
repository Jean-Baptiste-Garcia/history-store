/*jslint node: true*/
/*global describe: true, it: true */
'use strict';

var should = require('chai').should();

describe('memory history store', function () {

    it('can write and read one reports', function (done) {
        var hs = require('../history-store-mem')(),
            myReportHistory = hs.report('MyServer'),
            report = { date:  new Date('1995-12-17T03:24:00'), status: {sessionCount: 100, schemasCount: 10}};

        myReportHistory.put(report, function (err) {
            if (err) {
                done(err);
                return;
            }

            myReportHistory.get(function (err, reports) {
                if (err) {
                    done(err);
                    return;
                }
                reports.should.eql([report]);
                done();
            });
        });
    });

    it('can write and read several reports', function (done) {
        var hs = require('../history-store-mem')().report('MyReport'),
            report1 = { date: new Date('1995-12-17T03:24:00'), status: {sessionCount: 100, schemasCount: 10}},
            report2 = { date: new Date('1995-14-17T04:44:10'), status: {sessionCount: 100, schemasCount: 10}};

        hs.put(report1, function (err) {
            if (err) {
                done(err);
                return;
            }

            hs.get(function (err, reports) {
                if (err) {
                    done(err);
                    return;
                }
                reports.should.eql([report1]);

                // put second report
                hs.put(report2, function (err) {
                    if (err) {
                        done(err);
                        return;
                    }

                    hs.get(function (err, reports) {
                        if (err) {
                            done(err);
                            return;
                        }
                        reports.should.eql([report1, report2]);
                        done();
                    });
                });
            });
        });
    });

    it('can stream one report', function (done) {
        var hs = require('../history-store-mem')().report('MyReport'),
            report = { date:  new Date('1995-12-17T03:24:00'), status: {sessionCount: 100, schemasCount: 10}},
            reportCount = 0;

        hs.put(report, function (err) {
            if (err) {
                done(err);
                return;
            }

            var stream = hs.stream();
            stream.on('data', function (data) {
                data.should.eql(report);
                reportCount += 1;
            });

            stream.on('end', function (err) {
                if (err) {
                    done(err);
                    return;
                }
                reportCount.should.equal(1);
                done();
            });
        });
    });


    it('can stream two reports', function (done) {
        var hs = require('../history-store-mem')().report('MyReport'),
            report1 = { date: new Date('1995-12-17T03:24:00'), status: {sessionCount: 100, schemasCount: 10}},
            report2 = { date: new Date('1995-14-17T04:44:10'), status: {sessionCount: 100, schemasCount: 10}},
            reports = [report1, report2],
            reportCount = 0;

        hs.put(report1, function (err) {
            if (err) {
                done(err);
                return;
            }

            hs.put(report2, function (err) {
                if (err) {
                    done(err);
                    return;
                }

                var stream = hs.stream();

                stream.on('data', function (data) {
                    data.should.eql(reports[reportCount]);
                    reportCount += 1;
                });

                stream.on('end', function (err) {
                    if (err) {
                        done(err);
                        return;
                    }
                    reportCount.should.equal(2);
                    done();
                });
            });
        });
    });
});