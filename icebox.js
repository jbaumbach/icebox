/*
  Ice Box - Espruino
  
  Edited: 9/15/2014 JB
  
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
  
  Getting a date from local computer for Espruino - run in node REPL mode and paste in window:
  > 'setDate(' + new Date().valueOf() + ')'
  
*/

//
// Program global vars/constants
//
var programVersion = '0.3.21';
var readTempAndSaveMonitorIntervalSecs = 5;
var minTempDifferentialExternalInternal = 5.5;   // degrees celcius
var hysteresisTolerance = 0.75;                  // degrees celcius
var vibratorPower = 0.30;              // Scale of 0 to 1, 1 being max.
var vibratorOnIntervalSecs = 120;
var vibratorOnDurationSecs = 3;

//
// Pins
//
var RedLED = LED1;
var GreenLED = LED2;
var BlueLED = LED3;
var RelayWire = A0;
var tempSensorWire = A1;
var tempExternalSensorWire = C2;
var vibratorMotor = C3;

//
// Test mode.  Set to true (long button press) to mock the temperature setting 
// and simulate it dropping
//
var testMode;
var testModeIncrements = hysteresisTolerance / 3;
var testModeTemperature = -5.0;
var testModeExternalTemperature = testModeTemperature;

var shouldOutputToConsole = (process.env.CONSOLE === 'USB');

//
// Requires
//
var Clock = require('clock').Clock;
//var ow = new OneWire(tempSensorWire);
var sensor = require("DS18B20").connect(new OneWire(tempSensorWire));
var sensorExternal = require("DS18B20").connect(new OneWire(tempExternalSensorWire));


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

Pin.prototype.setOnForPeriod = function(power, durationSecs) {
  var interval;
  var self = this;
  power = Math.min(power, 1.0);

  function stop() {
    if ((typeof interval) !== "undefined") {
      clearInterval(interval);
      self.reset();
    }
  }

  interval = setInterval(function() {
    digitalPulse(self, 1, power * 20);
  }, 20);

  setTimeout(function() {
    stop();
  }, durationSecs * 1000);
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
  var logStr = getDate().toString() + ': ' + msg + '\n';
  if (shouldOutputToConsole) {
	console.log(logStr);
  }
  fs.appendFile(this.logFileName, logStr);
};

Log.prototype.clear = function() {
  fs.unlink(this.logFileName);
  return 'ok';
};

Log.prototype.show = function(options) {
//  log.log('got options: ' + options);
//  log.log('got page: ' + options.page);
  // todo: handle the fact that both print() and the data has \r 
  options = options || {};
  var chunkSize = options.chunkSize || 1024;
  var page = options.page;
//  var outputTo = options.outputTo || console;
  var f = E.openFile(this.logFileName, 'r');
  var result;
  if (page === undefined) {
    var d;
    do {
      d = f.read(chunkSize);
      if (d) {
        print(d.toString());
      }
    }
    while (d);
  } else {
    f.skip(page * chunkSize);
    result = f.read(chunkSize);
    if (result) {
      result = result.toString();
    }
  }
  f.close();
  return result;
};



//
// Monitoring
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//
function startMonitoring() {
  digitalWrite(BlueLED, 1);
  monitorInterval = setInterval(readTempsAndSave, readTempAndSaveMonitorIntervalSecs * 1000);
  vibratorInterval = setInterval(doVibration, vibratorOnIntervalSecs * 1000);
}

function stopMonitoring() {
  digitalWrite(BlueLED, 0);
  setHeater(false);
  clearInterval(monitorInterval);
  monitorInterval = null;
  clearInterval(vibratorInterval);
  vibratorInterval = null;
}


//
// General functions
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//

function readTempsAndSave() {
  var currentTemp, externalTemp, currentDifferential;
  if (testMode) {
    if (heaterIsOn) {
      testModeTemperature += testModeIncrements;
    } else {
      testModeTemperature -= testModeIncrements;
    }
    currentTemp = testModeTemperature;
    externalTemp = testModeExternalTemperature;
  } else {
    currentTemp = sensor.getTemp();
    externalTemp = sensorExternal.getTemp();
  }

  var logMessage = 'internal: ' + currentTemp + ', external: ' + externalTemp;

  if (currentTemp && externalTemp && currentTemp <= 30 && externalTemp <= 30) {
    currentDifferential = currentTemp - externalTemp;
    logMessage += ', diff: ' + currentDifferential;
    if (currentTemp > 0.0) {
      logMessage += ', msg: not freezing yet - waiting';
    } else if (currentDifferential < minTempDifferentialExternalInternal - hysteresisTolerance) {
      logMessage += ', msg: set heater on';
      setHeater(true);
    } else if (currentDifferential >= minTempDifferentialExternalInternal + hysteresisTolerance) {
      logMessage += ', msg: set heater off';
      setHeater(false);
    } else {
      logMessage += ', msg: in hysteresis, keep status quo';
    }
  } else {
    logMessage += ', msg: (error) can\'t get a temp or sane value(s) - set heater off just in case';
    setHeater(false);
  }

  log.log(logMessage);

  GreenLED.blip();
}

function doVibration() {
  if (testMode) {
    log.log('no good vibrations - test mode!');
  } else {
    log.log('turning on vibration');
    vibratorMotor.setOnForPeriod(vibratorPower, vibratorOnDurationSecs);
  }
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


function button1Change(e) {
  var buttonPressedDuration = (e.time - e.lastTime);
  log.log('button1Change: duration=' + buttonPressedDuration + ', now=' + e.state);

  var validClick = false;
  //
  // Turn on
  //
  if (buttonPressedDuration < 1.0) {
    validClick = true;
  } else if (buttonPressedDuration < 5.0) {
    validClick = true;
    testMode = true;
  } else {
    log.log('ignoring inexplicably long button press duration');
  }

  if (validClick) {
    if (monitorInterval) {
      //
      // Turn off
      //
      stopMonitoring();
      log.log('button click: stop monitoring');
    } else {
      startMonitoring();
      log.log('button click: start monitoring');
      if (testMode) {
        log.log(' * test mode!! temp reading will start at ' + testModeTemperature + ' then drop until heater comes on, then will rise');
        RedLED.blip();
        // Blip the motor on startup
        vibratorMotor.setOnForPeriod(vibratorPower * 0.75, 0.25);
      }
    }
  }
}


// Turn the heater on or off (depending on the value of isOn)
// Also turns the red LED on and off as an indicator
function setHeater(isOn) {
  heaterIsOn = isOn;
  digitalWrite(RedLED, isOn);
  digitalWrite(RelayWire, !isOn); // 0 turns the relay on, 1 turns it off
}


function clearAll() {
  log.clear();
  return 'ok';
}


//
// Nano Serial Server
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//

var serverInputBuffer = '';
var request; // = Serial1;
var response; // = Serial1;

function startNanoServer() {
  if (request) {
    log.log('crap!  we already have request assigned.');
  }
  request = Serial1;
  response = Serial1;
  var consoleIsOn = process.env.CONSOLE;
  if (consoleIsOn === 'USB') {
    log.log('Console on USB, setting nanoServer to Serial1');
    USB.setConsole();
  } else if (consoleIsOn === 'Serial1') {
    log.log('Console on Serial1, setting it to Serial2');
    Serial2.setConsole();
  } else {
    log.log('Console on ' + consoleIsOn + ', not sure what to do');
  }

  //
  // Set up Bluetooth listener
  //
  request.on('data', nanoServer);
}

var routes = {};

function nanoServer(data) {
  var eol = 'x';  // '\r';
  serverInputBuffer+=data;
  var idx = serverInputBuffer.indexOf(eol);
  while (idx >= 0) {
    var line = serverInputBuffer.substr(0,idx);
    serverInputBuffer = serverInputBuffer.substr(idx+1);
    nanoRouter(line);
    idx = serverInputBuffer.indexOf(eol);
  }
}

function nanoRespond(code, msg) {
  var result = code + ' ' + msg;
  log.log(result);
  response.println(result);
}

function nanoRouter(line) {
  var verbItem = 0; var resourceItem = 1; var dataItem = 2;
  var meta = line.split(' ');

  if (meta && meta.length >= 2) {
    var resource = meta[resourceItem];
    if (routes[resource]) {
      var verb = meta[verbItem];
      var func = routes[resource][verb];
      if (func) {
        var params = meta.length > 2 ? meta[dataItem] : null;
        if (params) {
          try {
            //log.log('about to parse: ' + params);
            params = JSON.parse(params);
            //log.log('parsed ok!');
          } catch (e) {
            // huh, not JSON
            //log.log('crap, no parsie: ' + e);
          }
        }
        func(params);
      } else {
        nanoRespond('404', 'resource ' + resource + ' has no action ' + verb);
      }
    } else {
      nanoRespond('404', 'unknown resource: ' + resource);
    }
  } else {
    nanoRespond('422', 'cannot process line: ' + line);
  }
}


routes.temps = {
  get: function(params) {
    var result = {
      internal: sensor.getTemp(),
      external: sensorExternal.getTemp()
    };
    nanoRespond('200', JSON.stringify(result));
  }
};

routes.status = {
  get: function(params) {
    var result = {
      programVersion: programVersion,
      heaterIsOn: !!heaterIsOn,
      isMonitoring: !!monitorInterval,
      clockIsSet: !!clockStatus.set,
      currentTime: getDate().toString()
    };
    nanoRespond('200', JSON.stringify(result));
  }
};

// todo: figure out why this crashes WebIDE when plugged in
routes.button = {
  post: function(params) {
    if (params == 'short') {
      button1Change({ time: 0.5, lastTime: 0, state: 'artificalShort' });
      nanoRespond('200', JSON.stringify({msg:'ok'}));
    } else if (params == 'long') {
      button1Change({ time: 3.5, lastTime: 0, state: 'artificalLong' });
      nanoRespond('200', JSON.stringify({msg:'ok'}));
    } else {
      nanoRespond('422', JSON.stringify({msg:'should be "short" or "long"'}));
    }
  }
};

routes.log = {
  get: function(params) {
    var result = log.show(params);
    log.log('got result: ' + result);
    nanoRespond('200', JSON.stringify({ params: params, data: result }));
  }
};

//
// Stuff to do on power up
//
function onInit() {

  shouldOutputToConsole = (process.env.CONSOLE === 'USB');

  log.log('onInit() running, output to console: ' + !!shouldOutputToConsole);

  //
  // Main button turns it on and off
  //
  //
  // Only handle "buttonDown" state.  Long press (> 1 second) enters test mode
  //
  setWatch(button1Change, BTN1, { repeat: true, edge:'falling', debounce:10 });

  //
  // Just in case
  //
  setHeater(false);

  //
  // ooOOoo - pretty colors
  //
  digitalWrite([LED1,LED2,LED3],0b100);
  setTimeout("digitalWrite([LED1,LED2,LED3],0b010);", 1000);
  setTimeout("digitalWrite([LED1,LED2,LED3],0b001);", 2000);
  setTimeout("digitalWrite([LED1,LED2,LED3],0);", 3000);

  //
  // Turn on Bluetooth listener.
  //
  startNanoServer();
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
var monitorInterval;
var vibratorInterval;
var clk = new Clock(Date.now());
var log = new Log();
var clockStatus = {
  set: false,
  warned: false
};
var heaterIsOn = false;

//
// Fresh log file
//
clearAll();

// get the first bad reading out of the way
sensor.getTemp();
sensorExternal.getTemp();

log.log('\n\n');
log.log('----------------------------------------------');
log.log('Starting up, version: ' + programVersion);
log.log('Info: ');
log.log(' * temp reading interval (secs): ' + readTempAndSaveMonitorIntervalSecs);
log.log(' * max temp differential (celcius): ' + minTempDifferentialExternalInternal);
log.log(' * hysteresis tolerance (celcius): ' + hysteresisTolerance);
log.log(' * vibration power (0.0 - 1.0): ' + vibratorPower);
log.log(' * vibration interval (secs): ' + vibratorOnIntervalSecs);
log.log(' * vibration duration (secs): ' + vibratorOnDurationSecs);
log.log(' * CONSOLE: ' + process.env.CONSOLE);

log.log('----------------------------------------------');

// eof
