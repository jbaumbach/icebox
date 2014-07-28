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

var trunc = function(x) {
  return x < 0 ? Math.ceil(x) : Math.floor(x);
};


//
// Storage class - saves the temperature readings to storage
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//

var Storage = function() {
  this.temperatureStorageFName = 'ibox-temps-[token].json';
  this.maxReadingsPerPage = 24;
  this.info = {
  };
  this.temps = [];
};

Storage.prototype.reset = function() {
  var result = 'ok';
  var infoFName = this.temperatureStorageFName.replace('[token]', 'info');
  try {
    fs.unlink(infoFName);
  } catch(e) {
    // Swallow
    result = 'err: '+  e;
  }
  return result;
};

Storage.prototype.save = function() {
  var infoFName = this.temperatureStorageFName.replace('[token]', 'info');
  // console.log('writing to file: ' + infoFName + ' data ', this.info);
  fs.writeFile(infoFName, JSON.stringify(this.info));

  var page = trunc(this.info.totalItems / this.maxReadingsPerPage);
  var strData = JSON.stringify(this.temps);
  var dataFName = this.temperatureStorageFName.replace('[token]', '' + page);
  // console.log('writing to file: ' + dataFName + ' ' + this.temps.length + ' items ' + strData);
  fs.writeFile(dataFName, strData);
  LED2.blip();
};


Storage.prototype.readSummary = function() {
  var infoFName = this.temperatureStorageFName.replace('[token]', 'info');
  console.log('reading from: ' + infoFName);
  
  var storedData = fs.readFile(infoFName);
  console.log('read data: ', storedData);
  var result = JSON.parse(storedData);
  
  if (!result) {
    console.log('(error) couldn\'t parse: ' + storedData);
  }
  return result;
};

Storage.prototype.readPage = function(pageNo) {
  var dataFName = this.temperatureStorageFName.replace('[token]', '' + page);
  var page = fs.readFile(dataFName);
  var result = JSON.parse(page);
  
  if (!result) {
    console.log('(error) couldn\'t parse: ' + page);
  }
  return result;
};



Storage.prototype.addReading = function(reading) {
  if (this.temps.length >= this.maxReadingsPerPage) {
    this.save();
    this.temps = [];
  }
  
  this.info.totalItems = (this.info.totalItems ? this.info.totalItems + 1 : 1);
  this.temps.push(reading);
  console.log('have total items: ', this.info.totalItems);
  LED1.blip();
};




//
// Monitoring
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//
function startMonitoring() {
  digitalWrite(LED3, 1);
  monitorInterval = setInterval(readTempsAndSave, readTempAndSaveMonitorIntervalSecs * 1000);
}

function stopMonitoring() {
  digitalWrite(LED3, 0);
  clearInterval(monitorInterval);
  storage.save();
}

//
// Return the currently stored monitoring data
//
function resetMonitoringData() {
  return storage.reset();
}

function getMonitoringDataSummary() {
  return storage.readSummary();
}

function getMonitoringDataPage(pageNo) {
  var s = storage.readPage(pageNo);
  return s;
}


//
// General functions
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//

function readTempsAndSave() {
  var reading = {
    time: getDate().toString(),
    reading: {
      internal: '' + 5,
      external: '' + -1
    }
  };
  
  storage.addReading(reading);
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


function button1Change() {
  //
  // Only handle "buttonDown" state
  //
  if (digitalRead(BTN1) == 1) {
    
    if (monitorInterval) {
      //
      // Turn off
      //
      stopMonitoring();
    } else {
      //
      // Turn on
      //
      startMonitoring();
    }
  }
}

//
// Stuff to do on power up
//
function onInit() {
  digitalWrite([LED1,LED2,LED3],0b100);
  setTimeout("digitalWrite([LED1,LED2,LED3],0b010);", 1000);
  setTimeout("digitalWrite([LED1,LED2,LED3],0b001);", 2000);
  setTimeout("digitalWrite([LED1,LED2,LED3],0);", 3000);

  //
  // Main button turns it on and off
  //
  setWatch(button1Change, BTN1, true);

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

//
// Main program
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//


//
// Program variables
//
var storage = new Storage();
var monitorInterval;
var clk = new Clock(Date.now());


console.log(getDate().toString() + ' started up...');
