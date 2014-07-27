/*
  Ice Box 0.1 - Espruino
  
  Todo: Open source this guy with GPL
  
*/

//
// Stuff to do on power up
//
function onInit() {
  digitalWrite([LED1,LED2,LED3],0b100);
  setTimeout("digitalWrite([LED1,LED2,LED3],0b010);", 1000);
  setTimeout("digitalWrite([LED1,LED2,LED3],0b001);", 2000);
  setTimeout("digitalWrite([LED1,LED2,LED3],0);", 3000);
}



