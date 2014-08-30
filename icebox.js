/*
  Ice Box - Espruino
  
  Edited: 8/29/2014 JB
  
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
var programVersion = '0.3.9';
var readTempAndSaveMonitorIntervalSecs = 5;
var minTempWhileCooling = -3.50;       // degrees celcius
var hysteresisTolerance = 0.75;       // degrees celcius
var vibratorPower = 0.60;              // Scale of 0 to 1, 1 being max.

//
// Pins
//
var RedLED = LED1;
var GreenLED = LED2;
var BlueLED = LED3;
var RelayWire = A0;
var tempSensorWire = A1;
var vibratorMotor = C3;

//
// Test mode.  Set to true (long button press) to mock the temperature setting 
// and simulate it dropping
//
var testMode;
var testModeIncrements = hysteresisTolerance / 3;
var testModeTemperature = minTempWhileCooling;


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
  console.log(logStr);
  fs.appendFile(this.logFileName, logStr);
};

Log.prototype.clear = function() {
  fs.unlink(this.logFileName);
  return 'ok';
};



//
// Monitoring
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//
function startMonitoring() {
  digitalWrite(BlueLED, 1);
  monitorInterval = setInterval(readTempsAndSave, readTempAndSaveMonitorIntervalSecs * 1000);
}

function stopMonitoring() {
  digitalWrite(BlueLED, 0);
  setHeater(false);
  clearInterval(monitorInterval);
  monitorInterval = null;
  storage.save();
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
  
  if (currentTemp) {
    if (currentTemp < minTempWhileCooling - hysteresisTolerance) {
      log.log('turning/keeping heater on, temp is: ' + currentTemp);
      setHeater(true);
    } else if (currentTemp >= minTempWhileCooling + hysteresisTolerance) {
      log.log('turning/keeping heater off, temp is: ' + currentTemp);
      setHeater(false);
    } else {
      log.log('within hysteresisTolerance, temp is: ' + currentTemp);
    }
  } else {
    log.log('can\'t get currentTemp, turning/keeping heater off');
    setHeater(false);
  }

  var reading = {
    time: getDate().toString(),
    reading: {
      internal: currentTemp,
      heaterIsOn: heaterIsOn
    }
  };
  console.log(reading);
  
  GreenLED.blip();
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
    testMode = (buttonPressedDuration > 1.0);
    startMonitoring();
    log.log('button click: start monitoring');
    if (testMode) {
      log.log(' * test mode!! temp reading will start at ' + testModeTemperature + ' then drop until heater comes on, then will rise');
      RedLED.blip();
      vibratorMotor.setOnForPeriod(vibratorPower / 2.0, 0.25);
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


//
// Stuff to do on power up
//
function onInit() {
  log.log('onInit() running');
  
  // get the first bad reading out of the way
  sensor.getTemp();

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

}

function clearAll() {
  log.clear();
  return 'ok';
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
var clk = new Clock(Date.now());
var log = new Log();
var clockStatus = {
  set: false,
  warned: false
};
var heaterIsOn = false;

log.log('\n\n');
log.log('----------------------------------------------');
log.log('Starting up, version: ' + programVersion);
log.log('Info: ');
log.log(' * temp reading interval (secs): ' + readTempAndSaveMonitorIntervalSecs);
log.log(' * min air temperature (celcius): ' + minTempWhileCooling);
log.log('----------------------------------------------');
        
// eof
