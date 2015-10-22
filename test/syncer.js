
/*jslint node: true*/
/*global describe: true, it: true, beforeEach: true, afterEach: true */
'use strict';

var should = require('chai').should(),
    assert = require('chai').assert,
    fse = require('fs-extra'),
    path = require('path'),
    store = require('../history-store'),
    storageRoot = '../tmp-history-store';


describe('synchronized stores', function () {
    beforeEach(function () {
        fse.removeSync(path.resolve(storageRoot));
    });

    it('.open(id) gives different instances', function (done) {
        var h = store(storageRoot),
            hs1 = h.open('MyReport'),
            hs2 = h.open('MyReport');
        hs1.should.not.eql(hs2);
        h.close(hs1);
        h.close(hs2);
        done();
    });

    it('writes and reads several reports in two synchronized report stores', function (done) {

        var h = store(storageRoot),
            hs1 = h.open('MyReport'),
            hs2,
            report1 = { date: new Date('1995-12-17T03:24:00'), status: {sessionCount: 100, schemasCount: 10}},
            report2 = { date: new Date('1995-12-18T04:44:10'), status: {sessionCount: 100, schemasCount: 10}};

        hs1.put(report1, function (err) {
            if (err) {
                h.close(hs1);
                return done(err);
            }
            hs1.get(function (err, reports) {
                if (err) {
                    h.close(hs1);
                    return done(err);
                }
                reports.should.eql([report1]);

                // put second report from another store instance
                hs2 = h.open('MyReport');
                hs2.put(report2, function (err) {
                    if (err) {
                        h.close(hs2);
                        h.close(hs1);
                        done(err);
                    }
                    h.close(hs2);
                    // wait for fs.watch notification
                    setTimeout(function read() {
                        hs1.get(function (err, reports) {
                            if (err) { h.close(hs1); return done(err); }
                            reports.should.eql([report1, report2]);
                            h.close(hs1);
                            done();
                        });
                    }, 1000);
                });
            });
        });
    });
});