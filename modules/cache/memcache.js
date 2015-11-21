/**
 cache trends of a query on store into memory
*/

/*jslint node: true */
'use strict';
module.exports = function cache(query, store, initvalue) {
    var trends = initvalue;

    function changeDate(catalog) {

        function diffIndex() {
            var index;
            // NOTE : try to loop from last date (should be more efficient)
            for (index = 0; index < trends.length; index += 1) {
                if (catalog[index].date !== store.dategetter(trends[index]).getTime()) {
                    //console.log('here', index);
                    return index;
                }
            }
            return index;
        }

        if (!trends) {
            return {
                index: 0,
                date : undefined
            };
        }
        var index = diffIndex();

        return {
            index: index,
            recomputeDate: store.dategetter(trends[index - 1])
        };
    }

    function appendFromDate(delta, index) {
       // console.log('index', index);
    //    console.log('trends', trends);
    //    console.log('delta', delta);

        if (!trends) {return delta; }
        if (!delta || delta.length === 1) {return trends; }
        if (index === trends.length) { // just new data
            return trends.concat(delta.splice(1));
        }
        return trends.slice(0, index).concat(delta.splice(1));
    }

    function computetrends(cb) {

        function catalogCb(err, catalog) {
            var change = changeDate(catalog);

            function cachecb(err, delta) {
                trends = appendFromDate(delta, change.index);
                cb(err, trends);
            }

            query.fromStore(store, cachecb, change.recomputeDate);
        }

        query.catalog(store, catalogCb);

    }
    return {
        trends: computetrends
    };
};
