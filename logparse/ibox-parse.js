/**
 * User: jbaumbach
 * Date: 8/13/14
 * Time: 10:28 AM
 */

  
// create readings with: cat ibox-log-2014-08-12.txt | grep "temp is:" >> ibox-readings.txt
  // create chart in Excel with data: =SERIES(,,'ibox-readings-temps-only.txt'!$A$1:$A$4471,1)
  
var 
  fs = require('fs')
  , util = require('util')
  , program = require('commander')
;

program
  .version('0.0.1')
  .option('-f, --file [name]', 'Log file to parse (default: ibox-log.txt)')
  .option('-s, --skip [n]', 'Lines to skip (default: 0)')
  .parse(process.argv);

var fName = program.file || 'ibox-log.txt';
var outTemplate = './chart-template.html';
var outFName = './chart-try1.html';
var outData = '';
var lineCount = 0;
var dataItems = 0;
var maxTemp = 40;
var skip = 17;
var skipFirst = program.skip || 0;
var maxDataItems = 600;
var labels = [], tempsData = [], tempsDataExternal = [];
var maxTempFound, minTempFound;
var hour;
var heatedTimes = 0;

console.log('-- parsing "' + fName + '", skipping ' + skipFirst + ' lines --');
fs.readFile(fName, function (err, data) {
  if (err) throw err;
  var lines = data.toString().split('\n');
  var heatOn = false;
  lines.forEach(function(line) {
    // console.log('got: ' + line);
    if (line) {
      var tempMatch = line.match(/^(.*): internal:([0-9\-\. ]*), external:([0-9\-\. ]*), diff:([0-9\-\. ]*), msg:(.*)$/); // [1] + '\n';
      if (tempMatch) {
        heatOn = heatOn || (tempMatch[5].trim() === 'set heater on');
        if (heatOn) {
          //console.log('heat is on!');
        }
      }
      if (tempMatch && tempMatch[2] <= maxTemp && tempMatch[3] <= maxTemp && dataItems < maxDataItems) {
        lineCount++;
        if (lineCount % skip === 0 && lineCount >= skipFirst) {
          dataItems++;
          var time = new Date(tempMatch[1]);
          var thisHour = time.getHours();
          if (thisHour !== hour) {
            labels.push(thisHour);
            hour = thisHour;
          } else {
            if (heatOn) {
              labels.push('HEAT');
              heatOn = false;
              heatedTimes++;
            } else {
              labels.push('');
            }
          }
          var foundTemp = tempMatch[2];
          maxTempFound = Math.max(maxTempFound || foundTemp, foundTemp);
          minTempFound = Math.min(minTempFound || foundTemp, foundTemp);
          tempsData.push(foundTemp);
          tempsDataExternal.push(tempMatch[3]);
        }
      }
    }
  })
  
  fs.readFile(outTemplate, function(err, template) {
    if (err) throw err;

    var outData = template.
      toString().
      replace('<%LABELS%>', util.inspect(labels)).
      replace('<%DATA%>', util.inspect(tempsData)).
      replace('<%DATA_EXTERNAL%>', util.inspect(tempsDataExternal));
    fs.writeFile(outFName, outData, function(err) {
      if (err) throw err;
      console.log('boom - done - (' + lineCount + ') ' + dataItems + ' data items, max=' + maxTempFound + ', min=' + minTempFound + ', heatedTimes=' + heatedTimes);
    })

  })
  
});
