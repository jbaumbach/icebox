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

