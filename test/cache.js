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


/*
        function fscache(query, store) {
            var folder = store.root + '/' + query.id,
                lastdate,
                cache,
                cachefile;

            function computetrends(cb) {
                function fscb(err, trends) {
                    if (cache.lastdate !== lastdate) {
                        // save trends to file if cache.lastate != this.lastdate
                        fs.write(cachefile, {trends: trends, lastdate: cache.lastdate})
                    }

                    cb(err, trends)
                }

                if (!cache) {
                    // load from fs and cache.trends = fs.trends & cache.lastdate = fs.lastdate
                    // initialize cache with (trends and lastdate)
                    return cb(err, fs.trends);
                }

                cache.computetrends(fscb);

            }

            return {
                trends: computetrends
            };
        }*/


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