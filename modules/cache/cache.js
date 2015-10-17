/**
 cache trends of a query on store into memory
*/

/*jslint node: true */
'use strict';
module.exports = function cache(query, store, initvalue) {
    var trends = initvalue;

    function lastdate() {
        return trends ?
                store.dategetter(trends[trends.length - 1]) :
                undefined;
    }

    function append(delta) {
        if (!trends) {return delta; }
        if (!delta || delta.length === 1) {return trends; }
        return trends.concat(delta.splice(1)); // remove lastdate which was already in cached trends (lastdate computation is needed to initialize flux)
    }

    function computetrends(cb) {
        function cachecb(err, delta) {
            trends = append(delta);
            cb(err, trends);
        }
        query.fromStore(store, cachecb, lastdate());
    }
    return {
        trends: computetrends
    };
};
