/*
  Ice Box 0.3 - Espruino
  
  Edited: 8/12/2014 10:04 PM
  
  Todo: Open source this guy with GPL

  Info
  =-=-
  LED1: red
  LED2: green
  LED3: blue
  
  
  Status Lights
  =-=-=-=-=-=-=
  Heater on: red
  System on: blue
  Taking reading: green
*/

//
// Program global vars/constants
//
var readTempAndSaveMonitorIntervalSecs = 5;
var tempSensorWire = A1;
var minTempWhileCooling = 0.83333;       // 33.5 degrees fahrenheit 
var hysteresisTolerance = 0.75;          // degrees celcius

//
// Test mode.  Set to true to mock the temperature setting and simulate it dropping
//
var testMode = false;
var testModeTemperature = minTempWhileCooling + 0.76;
var testModeIncrements = 0.25;


//
// Requires
//
var Clock = require('clock').Clock;
var ow = new OneWire(tempSensorWire);
var sensor = require("DS18B20").connect(ow);



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

// LED1.slowBlink()

Pin.prototype.slowBlink = function(times) {
  times = times || 1;
  var Hz = 50;        // don't change this
  var changeHz = 50;  // increase to make light smoother
  var blinkDurationSecs = 2;
  
  var self = this;
  var angle = (Math.PI * 1.5);
  var loop = 0;
  var changeStep = (Math.PI * blinkDurationSecs) / (changeHz * 2);  // should do full rotation in time period
  var totalRange = times * (changeHz * blinkDurationSecs);
  var brightness, pulseInterval;
  
  function pwm() {
    var pulseTime = brightness * (1000/Hz);
    if (pulseTime > 0) {
      digitalPulse(self, 1, pulseTime);
    }
    pulseInterval = setTimeout(pwm, 1000/Hz);
  }
  
  function setLightLevel() {
    brightness = Math.abs((1 + Math.sin(angle)) / 2);
    if (loop < totalRange) {
      if ((typeof pulseInterval) === "undefined") {
        pwm();
      }
      
      angle += changeStep;
      loop++;
      setTimeout(setLightLevel, 1000 / changeHz);
    } else {
      clearTimeout(pulseInterval);
      self.reset();
    }
  }
  
  setLightLevel();
};


var trunc = function(x) {
  return x < 0 ? Math.ceil(x) : Math.floor(x);
};


//
// Log class - handle logging
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//
var Log = function() {
  this.logFileName = 'ibox-log.txt';
};

Log.prototype.log = function(msg) {
  // todo: figure out how to convert an object to a string, like node's util.inspect()
  var logStr = getDate().toString() + ': ' + msg;
  console.log(logStr);
  fs.appendFile(this.logFileName, logStr);
};

Log.prototype.clear = function() {
  fs.unlink(this.logFileName);
  return 'ok';
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
  log.log('reseting storage');
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
  if (this.info.totalItems > 0) {
    log.log('saving storage: start');
  
    var infoFName = this.temperatureStorageFName.replace('[token]', 'info');
    fs.writeFile(infoFName, JSON.stringify(this.info));
  
    var page = trunc((this.info.totalItems - 1) / this.maxReadingsPerPage);
    var strData = JSON.stringify(this.temps);
    var dataFName = this.temperatureStorageFName.replace('[token]', '' + page);
    fs.writeFile(dataFName, strData);
    
    log.log('saving storage: done. page = ' + page);
  } else {
    log.log('not saving: no items');
  }
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
  
  if (!clockStatus.set && !clockStatus.warned) {
    log.log('(warning) adding readings and date is not set!');
    clockStatus.warned = true;
  }
  
  if (this.temps.length >= this.maxReadingsPerPage) {
    this.save();
    this.temps = [];
  }
  
  this.info.totalItems = (this.info.totalItems ? this.info.totalItems + 1 : 1);
  this.temps.push(reading);
  log.log('added reading, have total items: ' + this.info.totalItems);
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
// Stored monitoring data
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
  var currentTemp;
  if (testMode) {
    if (heaterIsOn) {
      testModeTemperature += testModeIncrements;
    } else {
      testModeTemperature -= testModeIncrements;
    }
    currentTemp = testModeTemperature;
  } else {
    currentTemp = sensor.getTemp();
  }
  
  if (currentTemp < minTempWhileCooling - hysteresisTolerance) {
    setHeater(true);
    log.log('turned heater on, temp is: ' + currentTemp);
  }
  
  if (currentTemp >= minTempWhileCooling + hysteresisTolerance) {
    setHeater(false);
    log.log('turned heater false, temp is: ' + currentTemp);
  }

  var reading = {
    time: getDate().toString(),
    reading: {
      internal: currentTemp,
      heaterIsOn: heaterIsOn
    }
  };
  console.log(reading);
  storage.addReading(reading);
  
  LED2.blip();
}
  

function setDate(unixDate) {
  clk.setClock(unixDate);
  log.log('set date to: ' + unixDate + ' (' + clk.getDate().toString() + ')');
  clockStatus.set = true;
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
      log.log('button click: stop monitoring');
    } else {
      //
      // Turn on
      //
      startMonitoring();
      log.log('button click: start monitoring');
    }
  }
}

// Turn the heater on or off (depending on the value of isOn)
// Also turns the red LED on and off as an indicator
function setHeater(isOn) {
  heaterIsOn = isOn;
  digitalWrite(LED1, isOn);
  digitalWrite(A0, !isOn); // 0 turns the relay on, 1 turns it off
}


//
// Stuff to do on power up
//
function onInit() {
  log.log('onInit() running');
  
  digitalWrite([LED1,LED2,LED3],0b100);
  setTimeout("digitalWrite([LED1,LED2,LED3],0b010);", 1000);
  setTimeout("digitalWrite([LED1,LED2,LED3],0b001);", 2000);
  setTimeout("digitalWrite([LED1,LED2,LED3],0);", 3000);

  // get the first bad reading out of the way
  sensor.getTemp();

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
var log = new Log();
var clockStatus = {
  set: false,
  warned: false
};
var heaterIsOn = false;

log.log('----------------------------------------------');
log.log('Starting up...');
log.log('Info: ');
log.log(' * temp reading interval (secs): ' + readTempAndSaveMonitorIntervalSecs);
log.log(' * min air temperature (celcius): ' + minTempWhileCooling);
if (testMode) {
  log.log(' * test mode!! temp reading will start at ' + testModeTemperature + ' then drop until heater comes on, then will rise');
}
log.log('----------------------------------------------');
        
// eof
