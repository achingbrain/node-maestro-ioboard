var PololuMaestro = require("pololu-maestro"),
	LOG = require("winston"),
	util = require("util"),
	SerialPort = require("serialport"),
	IOBoard = require("ioboard");

var map = function(value, in_min, in_max, out_min, out_max) {
	return (value - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
};

/**
 * Talks to a Pololu Maestro servo controller.
 *
 * Supports a subset of IOBoard methods.
 *
 * The controller should have it's serial mode set to USB Dual Port.
 */
function MaestroIOBoard(maestro, type, pinConfiguration, onReady) {
	if(maestro.mode != PololuMaestro.SERIAL_MODES.USB_DUAL_PORT) {
		throw "Please set your Maestro to use USB Dual Port mode";
	}

	if(!util.isArray(pinConfiguration)) {
		throw "Please pass an array of pin configurations";
	}

	if(!type.pins === pinConfiguration.length) {
		throw "Please specify all pin configurations";
	}

	this.maestro = maestro;

	// constants
	["MODES", "I2C_MODES", "STEPPER", "HIGH", "LOW"].forEach(function(property) {
		this.__defineGetter__(property, function() {
			return IOBoard.CONSTANTS[property];
		});
	}.bind(this));

	// properties
	[
		"pins", "analogPins", "version", "firmware", "currentBuffer", "versionReceived", "sp", "reportVersionTimeoutId"
	].forEach(function(property) {
			this.__defineSetter__(property, function(value) {
				this["_" + property] = value;
			}.bind(this));

			this.__defineGetter__(property, function() {
				return this["_" + property];
			}.bind(this));
		}.bind(this));

	this.analogPins = [];
	this.pins = [];

	for(var i = 0; i < type.pins; i++) {
		var supportedModes = [IOBoard.CONSTANTS.MODES.OUTPUT, IOBoard.CONSTANTS.MODES.SERVO];

		if(i === 8 && type.pins === 12) {
			// Mini Maestro 12 supports PWM on pin 8
			supportedModes.push(IOBoard.CONSTANTS.MODES.PWM);
		} else if((type.pins === 18 || type.pins === 24) && i === 12) {
			// Mini Maestro 18 & 24 supports PWM on pin 12
			supportedModes.push(IOBoard.CONSTANTS.MODES.PWM);
		}

		if(i < 12) {
			// some pins support being analog inputs..
			supportedModes.push(IOBoard.CONSTANTS.MODES.ANALOG);
		} else {
			// the rest are digital inputs
			supportedModes.push(IOBoard.CONSTANTS.MODES.INPUT);
		}

		this.pins.push({
			mode: pinConfiguration[i],
			supportedModes: supportedModes,
			value : 0,
			report: 1
		});
	}

	if(onReady) {
		onReady(this);
	}
}

//} extends IOBoard
MaestroIOBoard.prototype = Object.create(IOBoard.prototype);

/**
 * Asks the board to read analog data.
 * @param {number} pin The pin to read analog data
 * @param {function} callback A function to call when we have the analag data.
 */
MaestroIOBoard.prototype.analogRead = function( pin, callback ) {
	LOG.debug("MaestroIOBoard", "asked to do analogRead of pin " + pin);

	this.maestro.analogRead( pin, callback );
};

/**
 * Asks the board to write an analog message.
 * @param {number} pin The pin to write analog data to.
 * @param {nubmer} value The data to write to the pin between 0 and 255.
 */
MaestroIOBoard.prototype.analogWrite = function( pin, value ) {
	LOG.debug("MaestroIOBoard", "asked to do analogWrite for pin " + pin + " to value " + value);

	if(!this.pins[pin] || !this.pins[pin].supportedModes || this.pins[pin].supportedModes.indexOf(IOBoard.CONSTANTS.MODES.PWM) == -1) {
		throw "Analog write attempted to non-PWM port";
	}

	var pwm = map(value, 0, 255, 0, 1024);

	this.maestro.setPWM(pwm, 4800);
};

/**
 * Asks the board to move a servo
 * @param {number} pin The pin the servo is connected to
 * @param {number} value The degrees to move the servo to.
 */
MaestroIOBoard.prototype.servoWrite = function( pin, degrees ) {
	LOG.debug("MaestroIOBoard", "asked to do servoWrite for pin " + pin + " to degrees " + degrees);

	var value = map(degrees, 0, 180, 640, 2304);

	this.maestro.setTarget(pin, value);
};

/**
 * Asks the board to write a value to a digital pin
 * @param {number} pin The pin you want to write a value to.
 * @param {value} value The value you want to write. Must be board.HIGH or board.LOW
 */
MaestroIOBoard.prototype.digitalWrite = function( pin, value ) {
	LOG.debug("MaestroIOBoard", "asked to do digitalWrite for pin " + pin + " to value " + value);

	this.maestro.digitalWrite(pin, value ? true : false);
};

/**
 * Asks the board to read digital data
 * @param {number} pin The pin to read data from
 * @param {function} callback The function to call when data has been received
 */
MaestroIOBoard.prototype.digitalRead = function( pin, callback ) {
	LOG.debug("MaestroIOBoard", "asked to do digitalRead of pin " + pin);

	this.maestro.digitalRead( pin, callback );
};

module.exports = MaestroIOBoard;
