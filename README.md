# Espruino Clear Ice Icebox

Here is code for an Espruino-powered box designed to make perfectly clear ice.  The idea is to freeze the water directionly from the 
bottom of the ice cube to the top.  The box is placed in the freezer, and a heater keeps the top of the ice cube at just
slightly higher temperature than the outside, in theory allowing the trapped air to get out.

The code works perfectly.  As for clear ice?  Eh, not so much.

Posted here in case someone has a use for it.

Notable features:

* Tracks temperature from two censors.
* Turns on the heater using a given hysteresis value
* Bluetooth LE connectivity to your iPhone (iPhone app not included here)
* BLE communication via REST-like calls

Here's a graph of a normal ice-cube freeze.

<img src="Screenshots/temps-graph.png" alt="Screenshot" />
