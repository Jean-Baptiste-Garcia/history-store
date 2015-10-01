/*jslint node: true*/
/*global describe: true, it: true, beforeEach: true */
'use strict';

var should = require('chai').should(),
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

        hs.put(report, function (err) {
            if (err) {
                done(err);
                return;
            }

            hs.get(function (err, reports) {
                if (err) {
                    done(err);
                    return;
                }
                reports.should.eql([report]);
                done();
            });
        });
    });

    it('can write and read one report with custom date (field)', function (done) {
        var hs = store(storageRoot).report('MyReport', 'creationdate'),
            report = { creationdate:  new Date('1995-12-17T03:24:00'), status: {sessionCount: 100, schemasCount: 10}};

        hs.put(report, function (err) {
            if (err) {
                done(err);
                return;
            }

            hs.get(function (err, reports) {
                if (err) {
                    done(err);
                    return;
                }
                reports.should.eql([report]);
                done();
            });
        });
    });


    it('reads one report when other files than json', function (done) {
        var hs = store(storageRoot).report('MyReport'),
            report = { date:  new Date('1995-12-17T03:24:00'), status: {sessionCount: 100, schemasCount: 10}};

        hs.put(report, function (err) {
            if (err) {
                done(err);
                return;
            }
            fse.writeFileSync(path.resolve(storageRoot + '/MyReport/.DSstore'), '');
            hs.get(function (err, reports) {
                if (err) {
                    done(err);
                    return;
                }
                reports.should.eql([report]);
                done();
            });
        });
    });

    it('callbacks with an error when getting bad json', function (done) {
        var hs = store(storageRoot).report('MyReport'),
            report = { date:  new Date('1995-12-17T03:24:00'), status: {sessionCount: 100, schemasCount: 10}};

        hs.put(report, function (err) {
            if (err) {
                done(err);
                return;
            }
            // set bad report
            fse.writeFileSync(path.resolve(storageRoot + '/MyReport/1441566099925-938112514.json'), '{"date":"1995-12-17T03:24:00.000Z","status":}');

            hs.get(function (err, reports) {
                if (err) {
                    reports.length.should.equals(0);
                    done();
                    return;
                }
                done(new Error('an error should have een thrown'));
            });
        });
    });

    it('callbacks with an error when getting bad json and only first report should be sent', function (done) {
        var hs = store(storageRoot).report('MyReport'),
            report = { date: new Date(), status: {sessionCount: 100, schemasCount: 10}};

        hs.put(report, function (err) {
            if (err) {
                done(err);
                return;
            }
            // set bad report
            fse.writeFileSync(path.resolve(storageRoot + '/MyReport/' + Date.now() + 10000 + '-938112514.json'), '{"date":"1995-12-17T03:24:00.000Z","status":}');
            hs.get(function (err, reports) {
                if (err) {
                    reports.should.eql([report]);
                    done();
                    return;
                }
                done(new Error('an error should be thrown'));
            });
        });
    });

    it('emits an error when streaming bad json', function (done) {
        var hs = store(storageRoot).report('MyReport'),
            report = { date:  new Date(), status: {sessionCount: 100, schemasCount: 10}},
            reportCount = 0,
            errors = 0;

        hs.put(report, function (err) {
            if (err) {
                done(err);
                return;
            }
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

    it('can write and read several reports', function (done) {
        var hs = store(storageRoot).report('MyReport'),
            report1 = { date: new Date('1995-12-17T03:24:00'), status: {sessionCount: 100, schemasCount: 10}},
            report2 = { date: new Date('1995-12-18T04:44:10'), status: {sessionCount: 100, schemasCount: 10}};

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
        var hs = store(storageRoot).report('MyReport'),
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
        var hs = store(storageRoot).report('MyReport'),
            report1 = { date: new Date('1995-12-17T03:24:00'), status: {sessionCount: 100, schemasCount: 10}},
            report2 = { date: new Date('1995-12-18T04:44:10'), status: {sessionCount: 100, schemasCount: 10}},
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