/*jslint node: true*/
/*global describe: true, it: true, beforeEach: true */
'use strict';
var should = require('chai').should(),
    assert = require('chai').assert,
    fse = require('fs-extra'),
    path = require('path'),
    async = require('async'),
    R = require('ramda'),
    historystore = require('../../history-store'),
    storageRoot = '../tmp-history-store',
    H = require('../../history-trend');

describe('mem cached history-trend', function () {
    describe('with default store', function () {
        var hs;

        beforeEach(function startAndPopulateServer(done) {
            fse.removeSync(path.resolve(storageRoot));
            hs = historystore(storageRoot).report('MyServer');

            var reports = [
                    { date: new Date('1995-12-17T03:24:00'), status: {sessionCount: 100, schemasCount: 10}},
                    { date: new Date('1995-12-18T04:44:10'), status: {sessionCount: 101, schemasCount: 5}},
                    { date: new Date('1995-12-19T05:44:10'), status: {sessionCount: 102, schemasCount: 20}}
                ];
            async.series(reports.map(function makePut(report) {
                return function put(callback) {
                    hs.put(report, callback);
                };
            }), done);
        });

        it('computes timeserie and has same trends when store has not changed', function (done) {
            var q = hs.cache(H.timeserie('status.sessionCount')),
                trends1;

            q.trends(function (err, trends) {
                if (err) { return done(err); }
                trends.should.eql([
                    { date: new Date('1995-12-17T03:24:00'), sessionCount: 100},
                    { date: new Date('1995-12-18T04:44:10'), sessionCount: 101},
                    { date: new Date('1995-12-19T05:44:10'), sessionCount: 102}
                ]);
                trends1 = trends;

                q.trends(function (err2, trends2) {
                    if (err2) { return done(err2); }
                    trends2.should.equal(trends1); // trends2 === trends1
                    done();
                });
            });
        });

        it('computes timeserie when new report added', function (done) {
            var q = hs.cache(H.timeserie('status.sessionCount'));

            q.trends(function (err, trends) {
                if (err) {return done(err); }
                hs.put({date: new Date('1995-12-20T05:44:10'), status: {sessionCount: 110, schemasCount: 20}}, function (err) {
                    if (err) {return done(err); }
                    q.trends(function (err, trends) {
                        if (err) {return done(err); }
                        trends.should.eql([
                            {date: new Date('1995-12-17T03:24:00'), sessionCount: 100},
                            {date: new Date('1995-12-18T04:44:10'), sessionCount: 101},
                            {date: new Date('1995-12-19T05:44:10'), sessionCount: 102},
                            {date: new Date('1995-12-20T05:44:10'), sessionCount: 110}
                        ]);
                        done();
                    });
                });
            });

        });

    });
});

describe('fs cached history-trend', function () {
    describe('with anonymous query', function () {
        var hs,
            cachefolder = storageRoot + '/MyServer/anonymous/',
            cachefile =  cachefolder + 'trends.json';

        beforeEach(function startAndPopulateServer(done) {
            fse.removeSync(path.resolve(storageRoot));
            hs = historystore(storageRoot).report('MyServer');

            var reports = [
                    { date: new Date('1995-12-17T03:24:00'), status: {sessionCount: 100, schemasCount: 10}},
                    { date: new Date('1995-12-18T04:44:10'), status: {sessionCount: 101, schemasCount: 5}},
                    { date: new Date('1995-12-19T05:44:10'), status: {sessionCount: 102, schemasCount: 20}}
                ];
            async.series(reports.map(function makePut(report) {
                return function put(callback) {
                    hs.put(report, callback);
                };
            }), done);
        });

        // with empty cache and put then read that cache is correctly updated
        // populate cache and check that results start with cached value


        it('writes to cache and is not changed when queried again', function (done) {
            var q = hs.fscache(H.timeserie('status.sessionCount')),
                trends1;

            q.trends(function (err, trends) {
                if (err) { return done(err); }
                var cacheddata = fse.readFileSync(cachefile),
                    stat = fse.statSync(cachefile);
                //console.log(stat);
                JSON.parseWithDate(cacheddata).should.eql([
                    { date: new Date('1995-12-17T03:24:00'), sessionCount: 100},
                    { date: new Date('1995-12-18T04:44:10'), sessionCount: 101},
                    { date: new Date('1995-12-19T05:44:10'), sessionCount: 102}
                ]);
                q.trends(function (err2, trends2) {
                    if (err2) { return done(err2); }
                    fse.statSync(cachefile).should.eql(stat);
                    done();
                });
            });
        });

        it('updates cache after put', function (done) {
            var q = hs.fscache(H.timeserie('status.sessionCount')),
                trends1;

            q.trends(function (err, trends) {
                if (err) { return done(err); }
                var cacheddata = fse.readFileSync(cachefile),
                    stat = fse.statSync(cachefile);
               // console.log(stat);
                JSON.parseWithDate(cacheddata).should.eql([
                    { date: new Date('1995-12-17T03:24:00'), sessionCount: 100},
                    { date: new Date('1995-12-18T04:44:10'), sessionCount: 101},
                    { date: new Date('1995-12-19T05:44:10'), sessionCount: 102}
                ]);
                hs.put({date: new Date('1995-12-20T05:44:10'), status: {sessionCount: 110, schemasCount: 20}}, function (err) {
                    if (err) {return done(err); }
                    q.trends(function (err2, trends2) {
                        if (err2) { return done(err2); }
                        trends2.should.eql([
                            {date: new Date('1995-12-17T03:24:00'), sessionCount: 100},
                            {date: new Date('1995-12-18T04:44:10'), sessionCount: 101},
                            {date: new Date('1995-12-19T05:44:10'), sessionCount: 102},
                            {date: new Date('1995-12-20T05:44:10'), sessionCount: 110}
                        ]);
                        fse.statSync(cachefile).should.not.eql(stat);
                        //console.log(fse.statSync(cachefile));
                        done();
                    });
                });
            });
        });

        it('loads from cache', function (done) {
            var q = hs.fscache(H.timeserie('status.sessionCount')),
                trends1;

            fse.ensureDirSync(cachefolder);
            fse.writeFileSync(cachefile, JSON.stringify([
                { date: new Date('1995-12-17T03:24:00'), sessionCount: 200},
                { date: new Date('1995-12-18T04:44:10'), sessionCount: 201},
                { date: new Date('1995-12-19T05:44:10'), sessionCount: 202}
            ]));

            q.trends(function (err, trends) {
                if (err) { return done(err); }
                var cacheddata = fse.readFileSync(cachefile),
                    stat = fse.statSync(cachefile);
                //console.log(stat);
                trends.should.eql([
                    { date: new Date('1995-12-17T03:24:00'), sessionCount: 200},
                    { date: new Date('1995-12-18T04:44:10'), sessionCount: 201},
                    { date: new Date('1995-12-19T05:44:10'), sessionCount: 202}
                ]);
                done();
            });
        });

    });
});