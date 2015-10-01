history-store
=============
historys-store is a server-side module used to store on file system different versions of reports.
When used with [history-trend](https://github.com/Jean-Baptiste-Garcia/history-trend), it becomes possible to compute any trend of any report over time.

This is a very naive storage not intended to support huge numbers of versions.

Installation
------------

**Soon** To use with node:

```bash
$ npm install history-store
```

Usage
------------
```javascript

var // creates a root store on ../history folder
    store = require('history-store')('../history'),
    // creates a store dedicated to MyReport
    myReportStore = store.report('MyReport'),
    report = { date:  new Date('1995-12-17T03:24:00'), status: {sessionCount: 100, schemasCount: 10}};

// stores report
myReportStore.put(report, function (err) {});

// gets all reports
myReportStore.get(function (err, reports) {});

// it is also possible (and recommended) to stream reports individually
var stream = myReportStore.stream();

stream.on('data', function (report) {});
stream.on('end', function (err) {});

```
Report can be any js object containing primitive types (Number / String / Date) with any array/object nesting. Report is JSON stringified on file system.
