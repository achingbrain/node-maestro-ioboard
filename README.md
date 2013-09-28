
# maestro-ioboard

An implementation of [ioboard](https://npmjs.org/package/ioboard) for the [Pololu Maestro](http://www.pololu.com/docs/0J40).

## Example usage

```javascript
var five = require("johnny-five"),
	IOBoard = require("ioboard"),
	MaestroIOBoard = require("pololu-maestro-ioboard"),
	PololuMaestro = require("pololu-maestro");

PololuMaestro.find(PololuMaestro.SERIAL_MODES.USB_DUAL_PORT, function(maestro) {
	new MaestroIOBoard(maestro, PololuMaestro.TYPES.MINI_MAESTRO_12, [
		IOBoard.CONSTANTS.MODES.OUTPUT,
		IOBoard.CONSTANTS.MODES.OUTPUT,
		IOBoard.CONSTANTS.MODES.OUTPUT,
		IOBoard.CONSTANTS.MODES.OUTPUT,
		IOBoard.CONSTANTS.MODES.SERVO,
		IOBoard.CONSTANTS.MODES.SERVO,
		IOBoard.CONSTANTS.MODES.SERVO,
		IOBoard.CONSTANTS.MODES.OUTPUT,
		IOBoard.CONSTANTS.MODES.PWM,
		IOBoard.CONSTANTS.MODES.OUTPUT,
		IOBoard.CONSTANTS.MODES.OUTPUT,
		IOBoard.CONSTANTS.MODES.OUTPUT
	], function(bridge) {
		// Do some johnny-five stuff
		var board = new five.Board({firmata: bridge});

		var aServo = new five.Servo(4);
		var anotherServo = new five.Servo(5);
		var anLed = new five.Led(2);
		var anotherLed = new five.Led(3);

		board.repl.inject({
			aServo: aServo,
			anotherServo: anotherServo,
			anLed: anLed,
			anotherLed: anotherLed
		});

		anLed.on();
		aServo.move(100);
		// ...etc
	});
});

```
