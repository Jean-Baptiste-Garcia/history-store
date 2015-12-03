/*jslint node: true*/
/*global describe: true, it: true, beforeEach: true, afterEach: true */
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

        it('computes timeserie and returns same trends when store has not changed', function (done) {
            var q = hs.memcache(H.timeserie('status.sessionCount')),
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

        it('updates itself when new report added', function (done) {
            var q = hs.memcache(H.timeserie('status.sessionCount'));

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
            cachefolder = storageRoot + '/MyServer/trends/',
            cachefile =  cachefolder + 'anonymous.json';

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

        it('writes to cache and is not changed when queried again', function (done) {
            var q = hs.cache(H.timeserie('status.sessionCount')),
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
            var q = hs.cache(H.timeserie('status.sessionCount')),
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
            var q = hs.cache(H.timeserie('status.sessionCount')),
                stat1;

            fse.ensureDirSync(cachefolder);
            // data in cache is different from reports store
            // so it is possible to check that return trends comes from cache and not from store.
            fse.writeFileSync(cachefile, JSON.stringify([
                { date: new Date('1995-12-17T03:24:00'), sessionCount: 200},
                { date: new Date('1995-12-18T04:44:10'), sessionCount: 201},
                { date: new Date('1995-12-19T05:44:10'), sessionCount: 202}
            ]));
            stat1 = fse.statSync(cachefile);

            q.trends(function (err, trends) {
                if (err) { return done(err); }
                fse.statSync(cachefile).should.eql(stat1);
                trends.should.eql([
                    { date: new Date('1995-12-17T03:24:00'), sessionCount: 200},
                    { date: new Date('1995-12-18T04:44:10'), sessionCount: 201},
                    { date: new Date('1995-12-19T05:44:10'), sessionCount: 202}
                ]);
                hs.put({date: new Date('1995-12-20T05:44:10'), status: {sessionCount: 110, schemasCount: 20}}, function (err) {
                    if (err) {return done(err); }
                    q.trends(function (err2, trends2) {
                        if (err2) { return done(err2); }
                        trends2.should.eql([
                            {date: new Date('1995-12-17T03:24:00'), sessionCount: 200},
                            {date: new Date('1995-12-18T04:44:10'), sessionCount: 201},
                            {date: new Date('1995-12-19T05:44:10'), sessionCount: 202},
                            {date: new Date('1995-12-20T05:44:10'), sessionCount: 110}
                        ]);
                        fse.statSync(cachefile).should.not.eql(stat1);
                        //console.log(fse.statSync(cachefile));
                        done();
                    });
                });
            });
        });

        it('put data, loads from cache, put data, read, read', function (done) {
            var q = hs.cache(H.timeserie('status.sessionCount')),
                stat1;

            fse.ensureDirSync(cachefolder);
            // data in cache is different from reports store
            // so it is possible to check that return trends comes from cache and not from store.
            fse.writeFileSync(cachefile, JSON.stringify([
                { date: new Date('1995-12-17T03:24:00'), sessionCount: 200},
                { date: new Date('1995-12-18T04:44:10'), sessionCount: 201},
                { date: new Date('1995-12-19T05:44:10'), sessionCount: 202}
            ]));
            stat1 = fse.statSync(cachefile);


            hs.put({date: new Date('1995-12-20T03:44:10'), status: {sessionCount: 110, schemasCount: 20}}, function (err) {
                if (err) { return done(err); }
                q.trends(function (err, trends) {
                    if (err) { return done(err); }
                    fse.statSync(cachefile).should.not.eql(stat1);
                    trends.should.eql([
                        { date: new Date('1995-12-17T03:24:00'), sessionCount: 200},
                        { date: new Date('1995-12-18T04:44:10'), sessionCount: 201},
                        { date: new Date('1995-12-19T05:44:10'), sessionCount: 202},
                        { date: new Date('1995-12-20T03:44:10'), sessionCount: 110}
                    ]);
                    hs.put({date: new Date('1995-12-20T05:44:10'), status: {sessionCount: 130, schemasCount: 20}}, function (err) {
                        if (err) {return done(err); }
                        q.trends(function (err2, trends2) {
                            var stat2;
                            if (err2) { return done(err2); }
                            trends2.should.eql([
                                {date: new Date('1995-12-17T03:24:00'), sessionCount: 200},
                                {date: new Date('1995-12-18T04:44:10'), sessionCount: 201},
                                {date: new Date('1995-12-19T05:44:10'), sessionCount: 202},
                                {date: new Date('1995-12-20T03:44:10'), sessionCount: 110},
                                {date: new Date('1995-12-20T05:44:10'), sessionCount: 130}
                            ]);
                            stat2 = fse.statSync(cachefile);
                            stat2.should.not.eql(stat1);

                            q.trends(function (err3, trends3) {
                                if (err3) { return done(err3); }
                                trends3.should.eql([
                                    {date: new Date('1995-12-17T03:24:00'), sessionCount: 200},
                                    {date: new Date('1995-12-18T04:44:10'), sessionCount: 201},
                                    {date: new Date('1995-12-19T05:44:10'), sessionCount: 202},
                                    {date: new Date('1995-12-20T03:44:10'), sessionCount: 110},
                                    {date: new Date('1995-12-20T05:44:10'), sessionCount: 130}
                                ]);
                                fse.statSync(cachefile).should.eql(stat2);
                                done();
                            });
                        });
                    });
                });
            });
        });

    });

    describe('2 stores', function () {
        var hsA,
            cachefolderA = storageRoot + '/MyServerA/trends/',
            cachefileA =  cachefolderA + 'anonymous.json',
            hsB = historystore(storageRoot).report('MyServerB'),
            cachefolderB = storageRoot + '/MyServerB/trends/',
            cachefileB = cachefolderB + 'anonymous.json';


        beforeEach(function startAndPopulateServer(done) {
            fse.removeSync(path.resolve(storageRoot));
            hsA = historystore(storageRoot).report('MyServerA');
            hsB = historystore(storageRoot).report('MyServerB');

            var reportsA = [
                    { date: new Date('1995-12-17T03:24:00'), status: {sessionCount: 100, schemasCount: 10}},
                    { date: new Date('1995-12-18T04:44:10'), status: {sessionCount: 101, schemasCount: 5}},
                    { date: new Date('1995-12-19T05:44:10'), status: {sessionCount: 102, schemasCount: 20}}
                ],
                reportsB = [
                    {date: new Date('1995-12-14T04:44:20'), status: {sessionCount: 401, schemasCount: 10}},
                    {date: new Date('1995-12-15T05:44:20'), status: {sessionCount: 402, schemasCount: 5}}
                ];
            async.series(reportsA.map(function makePut(report) {
                return function put(callback) {
                    hsA.put(report, callback);
                };
            }), async.series(reportsB.map(function makePut(report) {
                return function put(callback) {
                    hsB.put(report, callback);
                };
            }), done));
        });


        it('dont crash when 2 stores : store1.put, store1.trends, storeB.put, storeB.trends', function (done) {
            var qA = hsA.cache(H.timeserie('status.sessionCount')),
                qB =  hsB.cache(H.timeserie('status.sessionCount')),
                statA,
                statB;
            fse.ensureDirSync(cachefolderA);

            fse.writeFileSync(cachefileA, JSON.stringify([
                { date: new Date('1995-12-17T03:24:00'), sessionCount: 200},
                { date: new Date('1995-12-18T04:44:10'), sessionCount: 201},
                { date: new Date('1995-12-19T05:44:10'), sessionCount: 202}
            ]));
            statA = fse.statSync(cachefileA);

            fse.ensureDirSync(cachefolderB);
            fse.writeFileSync(cachefileB, JSON.stringify([
                { date: new Date('1995-12-14T04:44:20'), sessionCount: 401},
                { date: new Date('1995-12-15T05:44:20'), sessionCount: 402}
            ]));
            statB = fse.statSync(cachefileB);


            hsA.put({date: new Date('1995-12-20T03:44:10'), status: {sessionCount: 110, schemasCount: 20}}, function (err) {
                if (err) { return done(err); }
                qA.trends(function (err, trendsA) {
                    var stata;
                    if (err) { return done(err); }
                    fse.statSync(cachefileA).should.not.eql(statA);
                    statA = fse.statSync(cachefileA);
                    trendsA.should.eql([
                        { date: new Date('1995-12-17T03:24:00'), sessionCount: 200},
                        { date: new Date('1995-12-18T04:44:10'), sessionCount: 201},
                        { date: new Date('1995-12-19T05:44:10'), sessionCount: 202},
                        { date: new Date('1995-12-20T03:44:10'), sessionCount: 110}
                    ]);

                    hsB.put({date: new Date('1995-12-20T05:44:20'), status: {sessionCount: 403, schemasCount: 20}}, function (err) {
                        if (err) {return done(err); }
                        qB.trends(function (err, trendsB) {
                            if (err) { return done(err); }
                            trendsB.should.eql([
                                { date: new Date('1995-12-14T04:44:20'), sessionCount: 401},
                                { date: new Date('1995-12-15T05:44:20'), sessionCount: 402},
                                { date: new Date('1995-12-20T05:44:20'), sessionCount: 403}
                            ]);
                            fse.statSync(cachefileB).should.not.eql(statB);

                            qA.trends(function (err, trendsA) {
                                if (err) { return done(err); }
                                trendsA.should.eql([
                                    {date: new Date('1995-12-17T03:24:00'), sessionCount: 200},
                                    {date: new Date('1995-12-18T04:44:10'), sessionCount: 201},
                                    {date: new Date('1995-12-19T05:44:10'), sessionCount: 202},
                                    {date: new Date('1995-12-20T03:44:10'), sessionCount: 110}
                                ]);
                                fse.statSync(cachefileA).should.eql(statA);
                                done();
                            });
                        });
                    });
                });
            });
        });
    });



    describe('with named query', function () {
        var hs,
            cachefolder = storageRoot + '/MyServer/trends/',
            cachefile =  cachefolder + 'myId.json';

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
        it('writes to cache and is not changed when queried again', function (done) {
            var q = hs.cache(H.name({id: 'myId'}).timeserie('status.sessionCount')),
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
    });

});