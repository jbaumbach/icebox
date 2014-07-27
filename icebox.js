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

console.log('Startup Complete!');
