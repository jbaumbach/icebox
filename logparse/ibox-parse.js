/**
 * User: jbaumbach
 * Date: 8/13/14
 * Time: 10:28 AM
 */

  
// create readings with: cat ibox-log-2014-08-12.txt | grep "temp is:" >> ibox-readings.txt
  // create chart in Excel with data: =SERIES(,,'ibox-readings-temps-only.txt'!$A$1:$A$4471,1)
  
var 
  fs = require('fs')
  util = require('util')
;

var fName = '/Users/jbaumbach/Desktop/ibox-log-2014-08-31.txt';
var outTemplate = '/Users/jbaumbach/Desktop/chart-template.html';
var outFName = '/Users/jbaumbach/Desktop/chart-try1.html';
var outData = '';
var lineCount = 0;
var dataItems = 0;
var maxTemp = 40;
var skip = 17;
var skipFirst = 0;
var maxDataItems = 600;
var labels = [], tempsData = [];
var maxTempFound, minTempFound;
var hour;

fs.readFile(fName, function (err, data) {
  if (err) throw err;
  var lines = data.toString().split('\n');
  lines.forEach(function(line) {
    // console.log('got: ' + line);
    if (line) {
      var tempMatch = line.match(/^(.*): .*temp is: (.*)$/); // [1] + '\n';
      if (tempMatch && tempMatch[2] <= maxTemp && dataItems < maxDataItems) {
        lineCount++;
        if (lineCount % skip === 0 && lineCount >= skipFirst) {
          dataItems++;
          var time = new Date(tempMatch[1]);
          var thisHour = time.getHours();
          if (thisHour !== hour) {
            labels.push(thisHour);
            hour = thisHour;
          } else {
            labels.push('');
          }
          var foundTemp = tempMatch[2];
          maxTempFound = Math.max(maxTempFound || foundTemp, foundTemp);
          minTempFound = Math.min(minTempFound || foundTemp, foundTemp);
          tempsData.push(foundTemp);
        }
      }
    }
  })
  
  fs.readFile(outTemplate, function(err, template) {
    if (err) throw err;

    var outData = template.
      toString().
      replace('<%LABELS%>', util.inspect(labels)).
      replace('<%DATA%>', util.inspect(tempsData));
    
    fs.writeFile(outFName, outData, function(err) {
      if (err) throw err;
      console.log('boom - done - (' + lineCount + ') ' + dataItems + ' data items, max=' + maxTempFound + ', min=' + minTempFound);
    })

  })
  
});
