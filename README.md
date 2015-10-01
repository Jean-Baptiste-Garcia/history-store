history-store
=============
historys-store is a server-side module used to store on filesystem different report versions.
This is a very naive storage not intended to support huge numbers of versions.
When used with history-trend, it becomes possible to compute any trend of any report over time.


Installation
------------

To use with node:

```bash
$ npm install history-storage
```

Example :
```javascript
var store = require('history-store')('../history'), // creates a store on ../history folder
    myReportStore = store.report('MyReport'), // creates a store dedicated to MyReport
    report = { date:  new Date('1995-12-17T03:24:00'), status: {sessionCount: 100, schemasCount: 10}};

myReportStore.put(report, function (err) {}); // stores report
myReportStore.get(function (err, reports) {}); // get all reports

// it is also possible to stream reports individually
var stream = myReportStore.stream();

stream.on('data', function (report) {});

stream.on('end', function (err) {});

```
Report can be any js object containing primitive types (Number / String / Date) with any array/object nesting. They are stringified.