/*
  Ice Box 0.1 - Espruino
  
  Todo: Open source this guy with GPL

  Info
  =-=-
  LED1: red
  LED2: green
  LED3: blue
  
*/

//
// Requires
//
var Clock = require('clock').Clock;


//
// Program constants
//
var readTempAndSaveMonitorIntervalSecs = 3;

//
// Class Extensions (prototypes)
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//

//
// Briefly blink an LED
//
// Example:  LED2.blip();    // blip the green LED
//
Pin.prototype.blip = function() {
  var self = this;
  digitalWrite(self, 1);
  setTimeout(function() {
    digitalWrite(self, 0);
  }, 500);
};


/*
function initStorage() {
  try {
    fs.unlink(temperatureStorageFName);
  } catch (e) {
    // Swallow
  }  
}
*/


//
// Storage class - saves the temperature readings to storage
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//

var Storage = function() {
  this.temperatureStorageFName = 'ibox-temps.json';
  this.maxReadings = 512;
  this.data = {
    info: {
      nop: 'not implemented yet'
    },
    temps: []
  };
};

/*
    */

Storage.prototype.reset = function() {
  var result = 'ok';
  try {
    fs.unlink(this.temperatureStorageFName);
  } catch(e) {
    // Swallow
    result = 'err: '+  e;
  }
  return result;
};

Storage.prototype.save = function() {
  var strData = JSON.stringify(this.data);
  fs.writeFile(this.temperatureStorageFName, strData);
  LED2.blip();
};


Storage.prototype.read = function() {
  var storedData = fs.readFile(this.temperatureStorageFName);
  var result = JSON.parse(storedData);
  
  if (!result) {
    console.log('(error) couldn\'t parse: ' + storedData);
  }
  return result;
};


Storage.prototype.addReading = function(reading) {
  if (this.data.temps.length > maxReadings) {
    // Zap the oldest one
  }
  this.data.temps.push(reading);
  console.log('added: ', reading);
};



//
// Main program
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//



//
// Stuff to do on power up
//
function onInit() {
  digitalWrite([LED1,LED2,LED3],0b100);
  setTimeout("digitalWrite([LED1,LED2,LED3],0b010);", 1000);
  setTimeout("digitalWrite([LED1,LED2,LED3],0b001);", 2000);
  setTimeout("digitalWrite([LED1,LED2,LED3],0);", 3000);
  return 'Boo freakin\' ya!';
}

//
// Usually takes about 4 seconds, not too bad
//
function perfTest() {
  for (var i = 0; i < 10000; i++) {
    if (i % 1000 === 0) {
      console.log(i);
    }
  }
}

function startMonitoring() {
  
  function readTempsAndSave() {
    var reading = {
      time: getDate(),
      reading: {
        internal: 5,
        external: -1 
      }
    };
    
    storage.addReading(reading);
    storage.save();
  }
  
  monitorInterval = setInterval(readTempsAndSave, readTempAndSaveMonitorIntervalSecs * 1000);
}

function stopMonitoring() {
  clearInterval(monitorInterval);
}

function setDate(unixDate) {
  clk.setClock(unixDate);
}

//
// Returns a date object
//
function getDate() {
  return clk.getDate();
}


//
// Return the currently stored monitoring data
//
function getMonitoringData() {
  return storage.read();
}

function resetMonitoringData() {
  return storage.reset();
}

var storage = new Storage();
var monitorInterval;
var clk = new Clock(Date.now());

console.log(getDate().toString() + ' started up...');
