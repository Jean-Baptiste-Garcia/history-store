history-store
=============
historys-store is a server-side module used to store different versions of report.
When used with [history-trend](https://github.com/Jean-Baptiste-Garcia/history-trend), it becomes possible to compute any trend of any report over time.

This is a very simple persistent file system storage which is not intended to support huge numbers of versions.

Installation
------------

To use with node:

```bash
$ npm install history-store
```

Usage
------------
```javascript

var // creates a root store on ../history folder
    store = require('history-store')('../history'),
    // creates a store dedicated to IssueReport
    issueReportStore = store.open('IssueReport'),
    report = { date: new Date('1995-12-17T03:24:00'), issues: [{ key: 'JIRA-123', status: 'New'}, { key: 'JIRA-456', status: 'In Progress'}]};

// stores report
issueReportStore.put(report, function (err) {});

// gets all reports
issueReportStore.get(function (err, reports) {});

// it is also possible (and recommended) to stream reports individually
var stream = issueReportStore.stream();

stream.on('data', function (report) {});
stream.on('end', function (err) {});

// close report store
issueReportStore.close();

```
Report can be any js object containing primitive types (Number / String / Date) with any array/object nesting. Report is JSON stringified on file system.

### Date identification
History store needs to know date of report. By default, date is expected to be found in ```report.date```. However, it is possible to define specific access to date.
```javascript
// date identified by report.creationdate
store('../history').open('MyReport', 'creationdate')

// date identified in nested object report.status.date
store('../history').open('MyReport', 'status.date')

// date identified with a custom function computeDate(report) { ... }
store('../history').open('MyReport', computeDate)

```

## Tests
```bash
 $ npm test
```