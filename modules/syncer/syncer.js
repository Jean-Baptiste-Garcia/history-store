// SYNCER - sync several report stores - Experimental

/*jslint node: true, nomen: true */
'use strict';

var fse = require('fs-extra');

module.exports = function syncer(ReportStore, toPath) {

    var syncPools = {};

    function createpool(id) {
        var stores = [];
        return {
            stores: stores,
            watcher: fse.watch(toPath(id), function () { console.log('watcher'); stores.forEach(function (store) { store.markdirty(); }); })
        };
    }

    function open(id, customdate) {
        var store = new ReportStore(id, customdate);
        if (!syncPools[id]) {
            syncPools[id] = createpool(id);
        }
        syncPools[id].stores.push(store);
        return store;
    }

    function close(store) {
        var id = store.id,
            pool = syncPools[id];
        if (!pool) {return; }
        pool.stores.splice(pool.stores.indexOf(store), 1);
        if (pool.stores.length === 0) {
            pool.watcher.close();
            delete syncPools[id];
        }
    }

    return {
        open: open,
        close: close
    };
};