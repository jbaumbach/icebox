//
// Set up a BLE HM-10 from scratch
//
// Start with: configBLE(Serial1, function() {});
//
// For interaction manually: startLocalBLEEcho() 
//


//
// Poor man's async.series
//
function series(arr,done) {
  var i=0;
  function next(err, result) {
    if (((err!==undefined) && (err!==null)) || i>=arr.length)
      done(err, result);
    else
      setTimeout(function() {arr[i++](next);}, 0);
  }
  next();
}


function startLocalBLEEcho() {
  Serial1.on('data', function(data) {
    console.log(data);
  });
}

function configBLE(serial, done) {
  /*
  So, I think this is how it works.

  1. Set HM-10 baud rate: server.executeQuery("AT+BAUD8")   (see chart in docs)

  2. Set Espruino port baud rate: Serial1.setup(230400)

  It's possible things stop working at this point, try:
    a. pressing reset button on Espruino
    b. setting up baud rate back to 9600 and back.
    c. pray

  As of this writing, it looks like we're on 230400 successfully.
  */

  var buffer;
  var debug = true;

  serial.removeAllListeners('data');
  serial.on('data', function(data) {
    buffer += data;
  });


  function doQuery(str, cb) {
    buffer = '';
    serial.print(str);

    // wait for response.  it would be nice to know when it was done.
    setTimeout(function() {
      //console.log('i guess we\'re done, returning: ' + buffer);
      cb(buffer);
    }, 500);
  }

  var result = {
    baud: undefined,
    name: undefined
  };

  var defaultBaud = 9600;
  var desiredBaud = 230400;
  var desiredBleName = 'Freezer';
  var desiredBleBaudCode = 8;

  var config = {
    baud: {
      query: 'AT+BAUD?',
      want: 'OK+Get:' + desiredBleBaudCode,
      setCommand: 'AT+BAUD' + desiredBleBaudCode,
      setSuccess: 'OK+Set:' + desiredBleBaudCode
    },
    name: {
      query: 'AT+NAME?',
      want: 'OK+NAME' + desiredBleName,
      setCommand: 'AT+NAME' + desiredBleName,
      setSuccess: 'OK+Set:' + desiredBleName
    }
  };

  series([
    function getBaud1(cb) {
      // Try talking to it at the default speed 9600
      serial.setup(defaultBaud);
      doQuery(config.baud.query, function(response) {
        console.log('getBaud1 response: ' + response);
        result.baud = response;
        cb();
      });
    },
    function getBaud2(cb) {
      if (!result.baud) {
        // we have no response, let's try 230400
        serial.setup(desiredBaud);
        doQuery(config.baud.query, function(response) {
          console.log('getBaud2 response: ' + response);
          result.baud = response;
          cb();
        });
      } else {
        cb();
      }
    },
    function setBaudIfNecessary(cb) {
      if (result.baud) {
        if (result.baud != config.baud.success) {
          doQuery(config.baud.setCommand, function(response) {
            console.log('setBaud response: ' + response);
            if (response == config.baud.setSuccess) {
              cb();
            } else {
              cb('can\'t set baud rate');
            }
          });
        } else {
          cb();
        }
      } else {
        cb('crud, can\'t communicate!');
      }
    },
    function getName(cb) {
      doQuery(config.name.query, function(response) {
        console.log('getName response: ' + response);
        result.name = response;
        cb();
      });
    }
  ], function(err) {
    serial.removeAllListeners('data');
    if (err) {
      console.log('error!  ' + err);
    } else {
      console.log('completed, no errors: ' + JSON.stringify(result));
    }
    done(err, result);
  });
}

