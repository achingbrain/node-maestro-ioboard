var PololuMaestro = require("pololu-maestro"),
	LOG = require("winston"),
	serialport = require("serialport");

var map = function(value, in_min, in_max, out_min, out_max) {
	return (value - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
};

var PinModes = {
	INPUT: 0x00,
	OUTPUT: 0x01,
	ANALOG: 0x02,
	PWM: 0x03,
	SERVO: 0x04
};

/**
 * Talks to a Pololu Maestro servo controller.
 * The controller should have it's serial mode set to USB Dual Port.
 */
function MaestroIOBoard( commandPort, onReady ) {
	this.MODES = {
		INPUT: 0x00,
		OUTPUT: 0x01,
		ANALOG: 0x02,
		PWM: 0x03,
		SERVO: 0x04
	};
	this.I2C_MODES = {
		WRITE: 0x00,
		READ: 1,
		CONTINUOUS_READ: 2,
		STOP_READING: 3
	};
	this.STEPPER = {
		TYPE: {
			DRIVER: 1,
			TWO_WIRE: 2,
			FOUR_WIRE: 4
		},
		RUNSTATE: {
			STOP: 0,
			ACCEL: 1,
			DECEL: 2,
			RUN: 3
		},
		DIRECTION: {
			CCW: 0,
			CW: 1
		}
	};
	this.HIGH = 1;
	this.LOW = 0;

	serialport.list(function (err, ports) {
		var ttlPort = "/dev/null";

		ports.forEach(function(port, index) {
			LOG.info("looking at " + commandPort);

			if(port.comName == commandPort) {
				ttlPort = ports[index + 1].comName;
			}
		});

		LOG.info("MaestroIOBoard", "Connecting to command port", commandPort, "and ttl port", ttlPort);

		this.maestro = new PololuMaestro( commandPort, ttlPort );

		this.maestro.on("ready", function() {

			// load pin capabilities
			this.maestro.restartScriptAtSubroutine(2, function(data) {
				this.pins = [];
				var numPins = data[0];
				var offset = 1;

				for(var i = 0; i < numPins; i++) {
					var supportedModes = [PinModes.OUTPUT, PinModes.SERVO];

					if(i === 8 && numPins === 12) {
						// Mini Maestro 12 supports PWM on pin 8
						supportedModes.push(PinModes.PWM);
					} else if((numPins === 18 || numPins === 24) && i === 12) {
						// Mini Maestro 18 & 24 supports PWM on pin 12
						supportedModes.push(PinModes.PWM);
					}

					if(i < 12) {
						// some pins support being analog inputs..
						supportedModes.push(PinModes.ANALOG);
					} else {
						// the rest are digital inputs
						supportedModes.push(PinModes.INPUT);
					}

					this.pins.push({
						mode: data[offset] & 7,
						supportedModes: supportedModes,
						value : 0,
						report: 1
					});
				}

				Object.defineProperties( this, {
					analogPins: {
						get: function() {
							return [];
						}
					}
				});

				if(onReady) {
					onReady();
				}
			}.bind(this));
		}.bind(this) );

		this.maestro.on("error", function(code, message) {
			LOG.warn("Serial error detected " + code + " " + message);
		});
	}.bind(this));
}

// these methods are not supported by the Maestro Servo Controller..
["sendI2CConfig", "sendI2CWriteRequest", "sendI2CReadRequest"].forEach(function( method ) {
	MaestroIOBoard.prototype[ method ] = function() {
		this.error( "MaestroIOBoard", "Unsupported method", method );
		return this;
	};
});

/**
 * Asks the board to tell us its version.
 * @param {function} callback A function to be called when the board has reported its version.
 */
MaestroIOBoard.prototype.reportVersion = function( callback ) {
	this.maestro.restartScriptAtSubroutine(0, function(version) {
		if(callback) {
			callback(version[0]);
		}
	});
};

/**
 * Asks the board to tell us its firmware version.
 * @param {function} callback A function to be called when the board has reported its firmware version.
 */
MaestroIOBoard.prototype.queryFirmware = function( callback ) {
	LOG.info("MaestroIOBoard", "asked to report firmware version");

	this.maestro.restartScriptAtSubroutine(1, function(version) {
		LOG.info("MaestroIOBoard", "Firmware version reported as", version);

		callback(version);
	});
};

/**
 * Asks the board to read analog data.
 * @param {number} pin The pin to read analog data
 * @param {function} callback A function to call when we have the analag data.
 */
MaestroIOBoard.prototype.analogRead = function( pin, callback ) {
  LOG.info("MaestroIOBoard", "asked to do analogRead of pin " + pin);

  this.maestro.analogRead( pin, callback );
};

/**
 * Asks the board to write an analog message.
 * @param {number} pin The pin to write analog data to.
 * @param {nubmer} value The data to write to the pin between 0 and 255.
 */
MaestroIOBoard.prototype.analogWrite = function( pin, value ) {
  LOG.info("MaestroIOBoard", "asked to do analogWrite for pin " + pin + " to value " + value);

  this.maestro.set8BitTarget(pin, value);
};

/**
 * Asks the board to move a servo
 * @param {number} pin The pin the servo is connected to
 * @param {number} value The degrees to move the servo to.
 */
MaestroIOBoard.prototype.servoWrite = function( pin, degrees ) {
  LOG.info("MaestroIOBoard", "asked to do servoWrite for pin " + pin + " to degrees " + degrees);

  var value = map(degrees, 0, 180, 640, 2304);

  this.maestro.setTarget(pin, value);
};

/**
 * Asks the board to set the pin to a certain mode.
 * @param {number} pin The pin you want to change the mode of.
 * @param {number} mode The mode you want to set. Must be one of board.MODES
 */
MaestroIOBoard.prototype.pinMode = function( pin, mode ) {
  LOG.info("MaestroIOBoard", "asked to do pinMode to set pin " + pin + " to mode " + mode);
};

/**
 * Asks the board to write a value to a digital pin
 * @param {number} pin The pin you want to write a value to.
 * @param {value} value The value you want to write. Must be board.HIGH or board.LOW
 */
MaestroIOBoard.prototype.digitalWrite = function( pin, value ) {
  LOG.info("MaestroIOBoard", "asked to do digitalWrite for pin " + pin + " to value " + value);

  this.maestro.digitalWrite(pin, value ? true : false);
};

/**
 * Asks the board to read digital data
 * @param {number} pin The pin to read data from
 * @param {function} callback The function to call when data has been received
 */
MaestroIOBoard.prototype.digitalRead = function( pin, callback ) {
  LOG.info("MaestroIOBoard", "asked to do digitalRead of pin " + pin);

  this.maestro.digitalRead( pin, callback );
};

/**
 * Asks the board to tell us its capabilities
 * @param {function} callback A function to call when we receive the capabilities
 */
MaestroIOBoard.prototype.queryCapabilities = function( callback ) {
  LOG.info("MaestroIOBoard", "asked to do queryCapabilities");
};

/**
 * Asks the board to tell us its analog pin mapping
 * @param {function} callback A function to call when we receive the pin mappings.
 */
MaestroIOBoard.prototype.queryAnalogMapping = function( callback ) {
  LOG.info("MaestroIOBoard", "asked to do queryAnalogMapping");
};

/**
 * Asks the board to tell us the current state of a pin
 * @param {number} pin The pin we want to the know the state of
 * @param {function} callback A function to call when we receive the pin state.
 */
MaestroIOBoard.prototype.queryPinState = function( pin, callback ) {
  LOG.info("MaestroIOBoard", "asked to do queryPinState");
};

/**
 * Set sampling interval in millis. Default is 19 ms
 * @param {number} interval The sampling interval in ms > 10
 */
MaestroIOBoard.prototype.setSamplingInterval = function( interval ) {
  LOG.info("MaestroIOBoard", "asked to do setSamplingInterval");
};

/**
 * Set reporting on pin
 * @param {number} pin The pin to turn on/off reporting
 * @param {number} value Binary value to turn reporting on/off
 */
MaestroIOBoard.prototype.reportAnalogPin = function( pin, value ) {
  LOG.info("MaestroIOBoard", "asked to do reportAnalogPin");
};

/**
 * Set reporting on pin
 * @param {number} pin The pin to turn on/off reporting
 * @param {number} value Binary value to turn reporting on/off
 */
MaestroIOBoard.prototype.reportDigitalPin = function( pin, value ) {
  LOG.info("MaestroIOBoard", "asked to do reportDigitalPin");
};

/**
 *
 *
 */
MaestroIOBoard.prototype.pulseIn = function( opts, callback ) {
  LOG.info("MaestroIOBoard", "asked to do pulseIn");
};

/**
 * Asks the board to configure a stepper motor with the given config to allow asynchronous control of the stepper
 * @param {number} deviceNum Device number for the stepper (range 0-5, expects steppers to be setup in order from 0 to 5)
 * @param {number} type One of this.STEPPER.TYPE.*
 * @param {number} stepsPerRev Number of steps motor takes to make one revolution
 * @param {number} dirOrMotor1Pin If using EasyDriver type stepper driver, this is direction pin, otherwise it is motor 1 pin
 * @param {number} stepOrMotor2Pin If using EasyDriver type stepper driver, this is step pin, otherwise it is motor 2 pin
 * @param {number} [motor3Pin] Only required if type == this.STEPPER.TYPE.FOUR_WIRE
 * @param {number} [motor4Pin] Only required if type == this.STEPPER.TYPE.FOUR_WIRE
 */
MaestroIOBoard.prototype.stepperConfig = function( deviceNum, type, stepsPerRev, dirOrMotor1Pin, stepOrMotor2Pin, motor3Pin, motor4Pin ) {
  LOG.info("MaestroIOBoard", "asked to do stepperConfig");
};

/**
 * Asks the board to move a stepper a number of steps at a specific speed
 * (and optionally with and acceleration and deceleration)
 * speed is in units of .01 rad/sec
 * accel and decel are in units of .01 rad/sec^2
 * TODO: verify the units of speed, accel, and decel
 * @param {number} deviceNum Device number for the stepper (range 0-5)
 * @param {number} direction One of this.STEPPER.DIRECTION.*
 * @param {number} steps Number of steps to make
 * @param {number} speed
 * @param {number|function} accel Acceleration or if accel and decel are not used, then it can be the callback
 * @param {number} [decel]
 * @param {function} [callback]
 */
MaestroIOBoard.prototype.stepperStep = function( deviceNum, direction, steps, speed, accel, decel, callback ) {
  LOG.info("MaestroIOBoard", "asked to do stepperStep");
};

/**
 * Send SYSTEM_RESET to board
 */
MaestroIOBoard.prototype.reset = function() {
  LOG.info("MaestroIOBoard", "asked to do reset");
};

module.exports = MaestroIOBoard;