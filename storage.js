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




