/*jslint node: true*/
/*global describe: true, it: true, beforeEach: true, afterEach: true */
'use strict';

var should = require('chai').should(),
    assert = require('chai').assert,
    fse = require('fs-extra'),
    path = require('path'),
    store = require('../history-store'),
    storageRoot = '../tmp-history-store';

describe('fs history store', function () {

    beforeEach(function () {
        fse.removeSync(path.resolve(storageRoot));
    });

    it('can write and read one report', function (done) {

        var hs = store(storageRoot).report('MyReport'),
            report = { date:  new Date('1995-12-17T03:24:00'), status: {sessionCount: 100, schemasCount: 10}};

        assert.isUndefined(hs.customdate);
        hs.dategetter(report).should.equal(report.date);
        hs.put(report, function (err) {
            if (err) {return done(err); }

            hs.get(function (err, reports) {
                if (err) {return done(err); }
                reports.should.eql([report]);
                done();
            });
        });
    });

    it('handles string date in report', function (done) {
        var hs = store(storageRoot).report('MyReport'),
            report = { date: '1995-12-17T03:24:00', status: {sessionCount: 100, schemasCount: 10}};

        hs.put(report, function (err) {
            if (err) {return done(err); }

            hs.get(function (err, reports) {
                if (err) {return done(err); }
                report.date = new Date(report.date);
                reports.should.eql([report]);
                done();
            });
        });
    });

    it('can write and read one report with custom date (field)', function (done) {
        var hs = store(storageRoot).report('MyReport', 'creationdate'),
            report = { creationdate:  new Date('1995-12-17T03:24:00'), status: {sessionCount: 100, schemasCount: 10}};

        hs.customdate.should.eql('creationdate');
        hs.dategetter(report).should.equal(report.creationdate);
        hs.put(report, function (err) {
            if (err) {return done(err); }

            hs.get(function (err, reports) {
                if (err) {return done(err); }
                reports.should.eql([report]);
                done();
            });
        });
    });


    it('filters other files than json', function (done) {
        var hs = store(storageRoot).report('MyReport'),
            report = { date:  new Date('1995-12-17T03:24:00'), status: {sessionCount: 100, schemasCount: 10}};

        hs.put(report, function (err) {
            if (err) {return done(err); }
            fse.writeFileSync(path.resolve(storageRoot + '/MyReport/.DSstore'), '');
            hs.get(function (err, reports) {
                if (err) {return done(err); }
                reports.should.eql([report]);
                done();
            });
        });
    });

    it('callbacks an error when getting bad json', function (done) {
        var hs = store(storageRoot).report('MyReport'),
            report = { date:  new Date('1995-12-17T03:24:00'), status: {sessionCount: 100, schemasCount: 10}};

        hs.put(report, function (err) {
            if (err) {return done(err); }
            // set bad report
            fse.writeFileSync(path.resolve(storageRoot + '/MyReport/1441566099925-938112514.json'), '{"date":"1995-12-17T03:24:00.000Z","status":}');

            hs.get(function (err, reports) {
                if (err) {
                    reports.length.should.equals(0);
                    return done();
                }
                done(new Error('an error should have been thrown'));
            });
        });
    });

    it('callbacks an error when getting bad json and only first report should be sent', function (done) {
        var hs = store(storageRoot).report('MyReport'),
            report = { date: new Date(), status: {sessionCount: 100, schemasCount: 10}};

        hs.put(report, function (err) {
            if (err) {return done(err); }
            // set bad report
            fse.writeFileSync(path.resolve(storageRoot + '/MyReport/' + Date.now() + 10000 + '-938112514.json'), '{"date":"1995-12-17T03:24:00.000Z","status":}');
            hs.get(function (err, reports) {
                if (err) {
                    reports.should.eql([report]);
                    return done();
                }
                done(new Error('an error should have been thrown'));
            });
        });
    });

    it('emits an error when streaming bad json', function (done) {
        var hs = store(storageRoot).report('MyReport'),
            report = { date:  new Date(), status: {sessionCount: 100, schemasCount: 10}},
            reportCount = 0,
            errors = 0;

        hs.put(report, function (err) {
            if (err) {return done(err); }
            // set bad report
            fse.writeFileSync(path.resolve(storageRoot + '/MyReport/' + Date.now() + 10000 + '-938112514.json'), '{"date":"1995-12-17T03:24:00.000Z","status":}');

            var stream = hs.stream();
            stream.on('data', function (data) {
                data.should.eql(report);
                reportCount += 1;
            });

            stream.on('error', function (err) {
                errors += 1;
                err.should.eql('Can\'t read report Error: JSON content could not be parsed');
            });

            stream.on('end', function () {
                errors.should.eql(1);
                reportCount.should.eql(1); // bad report is more recent than correct one
                done();
            });
        });
    });

    it('writes and reads several reports', function (done) {
        var hs = store(storageRoot).report('MyReport'),
            report1 = { date: new Date('1995-12-17T03:24:00'), status: {sessionCount: 100, schemasCount: 10}},
            report2 = { date: new Date('1995-12-18T04:44:10'), status: {sessionCount: 100, schemasCount: 10}};

        hs.put(report1, function (err) {
            if (err) {return done(err); }

            hs.get(function (err, reports) {
                if (err) {return done(err); }
                reports.should.eql([report1]);

                // put second report
                hs.put(report2, function (err) {
                    if (err) {return done(err); }

                    hs.get(function (err, reports) {
                        if (err) {return done(err); }
                        reports.should.eql([report1, report2]);
                        done();
                    });
                });
            });
        });
    });

    it.skip('writes and reads several reports and two report stores', function (done) {

        var hs = store(storageRoot).report('MyReport'),
            hs2,
            report1 = { date: new Date('1995-12-17T03:24:00'), status: {sessionCount: 100, schemasCount: 10}},
            report2 = { date: new Date('1995-12-18T04:44:10'), status: {sessionCount: 100, schemasCount: 10}};

        hs.put(report1, function (err) {
            if (err) {return done(err); }
            hs.get(function (err, reports) {
                if (err) {return done(err); }
                reports.should.eql([report1]);

                // put second report from another store instance
                hs2 = store(storageRoot).report('MyReport');
                hs2.put(report2, function (err) {
                    if (err) {
                        hs2.close();
                        done(err);
                    }
                    hs2.close();
                    // wait for watch notification
                    setTimeout(function read() {
                        hs.get(function (err, reports) {
                            if (err) {return done(err); }
                            reports.should.eql([report1, report2]);
                            done();
                        });
                    }, 1500);
                });
            });
        });
    });


    it('streams one report', function (done) {
        var hs = store(storageRoot).report('MyReport'),
            report = { date:  new Date('1995-12-17T03:24:00'), status: {sessionCount: 100, schemasCount: 10}},
            reportCount = 0;

        hs.put(report, function (err) {
            if (err) {return done(err); }

            var stream = hs.stream();
            stream.on('data', function (data) {
                data.should.eql(report);
                reportCount += 1;
            });

            stream.on('end', function (err) {
                if (err) {return done(err); }
                reportCount.should.equal(1);
                done();
            });
        });
    });

    it('streams two reports', function (done) {
        var hs = store(storageRoot).report('MyReport'),
            report1 = { date: new Date('1995-12-17T03:24:00'), status: {sessionCount: 100, schemasCount: 10}},
            report2 = { date: new Date('1995-12-18T04:44:10'), status: {sessionCount: 100, schemasCount: 10}},
            reports = [report1, report2],
            reportCount = 0;

        hs.put(report1, function (err) {
            if (err) {return done(err); }

            hs.put(report2, function (err) {
                if (err) {return done(err); }

                var stream = hs.stream();

                stream.on('data', function (data) {
                    data.should.eql(reports[reportCount]);
                    reportCount += 1;
                });

                stream.on('end', function (err) {
                    if (err) {return done(err); }
                    reportCount.should.equal(2);
                    done();
                });
            });
        });
    });

    it('works when storage folder already exists', function (done) {
        var hs = store(storageRoot).report('MyReport'),
            hs2,
            report = { date:  new Date('1995-12-17T03:24:00'), status: {sessionCount: 100, schemasCount: 10}};

        hs.put(report, function (err) {
            if (err) {return done(err); }

            hs.get(function (err, reports) {
                if (err) {return done(err); }
                reports.should.eql([report]);

                hs2 = store(storageRoot).report('MyReport'); // used to raise an exception
                done();
            });
        });
    });

    it('raises an exception when storage folder cannot be created', function (done) {
        var hs;
        try {
            hs = store('/*dsdqsd/').report('MyReport');
            done(new Error('should have raised an exception'));
        } catch (e) {
            assert.isUndefined(hs);
            done();
        }
    });

    // TODO add test when pushed report has invalid date new Date('1995-14-17T04:44:10')

    describe('with stream startdate', function () {
        var async = require('async'),
            S,
            hs,
            reports = [
                {date: new Date('1995-12-17T03:24:00'), status: {sessionCount: 100, schemasCount: 10}},
                {date: new Date('1995-12-18T04:44:09'), status: {sessionCount: 100, schemasCount: 10}},
                {date: new Date('1995-12-18T04:44:10'), status: {sessionCount: 100, schemasCount: 10}},
                {date: new Date('1995-12-18T04:44:11'), status: {sessionCount: 100, schemasCount: 10}},
                {date: new Date('1995-12-18T04:54:20'), status: {sessionCount: 100, schemasCount: 10}}
            ];
        beforeEach(function startAndPopulateServer(done) {
            fse.removeSync(path.resolve(storageRoot));
            S = store(storageRoot);
            hs = S.report('MyServer');
            async.series(reports.map(function makePut(report) {
                return function put(callback) {
                    hs.put(report, callback);
                };
            }), done);
        });

        it('streams expected reports with existing startdate', function (done) {
            var stream = hs.stream(new Date('1995-12-18T04:44:10')),
                reportCount = 0,
                startIndex = 2;

            stream.on('data', function (data) {
                data.should.eql(reports[startIndex + reportCount]);
                reportCount += 1;
            });

            stream.on('end', function (err) {
                if (err) {done(err); }
                reportCount.should.equal(3);
                done();
            });
        });

        it('streams expected reports with non existing startdate', function (done) {
            var stream = hs.stream(new Date('1995-12-17T03:25:00')),
                reportCount = 0,
                startIndex = 1;

            stream.on('data', function (data) {
                data.should.eql(reports[startIndex + reportCount]);
                reportCount += 1;
            });

            stream.on('end', function (err) {
                if (err) {return done(err); }
                reportCount.should.equal(4);
                done();
            });
        });


        it('streams expected reports with startdate older than first date', function (done) {
            var stream = hs.stream(new Date('1994-12-18T04:44:10')),
                reportCount = 0,
                startIndex = 0;

            stream.on('data', function (data) {
                data.should.eql(reports[startIndex + reportCount]);
                reportCount += 1;
            });

            stream.on('end', function (err) {
                if (err) {return done(err); }
                reportCount.should.equal(5);
                done();
            });
        });

        it('streams no reports when startdate is in future', function (done) {
            var stream = hs.stream(new Date('1998-12-18T04:44:10')),
                reportCount = 0,
                startIndex = 1000;

            stream.on('data', function (data) {
                data.should.eql(reports[startIndex + reportCount]);
                reportCount += 1;
            });

            stream.on('end', function (err) {
                if (err) {return done(err); }
                reportCount.should.equal(0);
                done();
            });
        });

    });
});