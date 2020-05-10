import {EventEmitter} from "../node_modules/djipevents/dist/djipevents.esm.min.js";
import {OutputChannel} from "./OutputChannel.js";
import {WebMidi} from "./WebMidi.js";

/**
 * The `Output` class represents a MIDI output port. This object is derived from the host's MIDI
 * subsystem and cannot be instantiated directly.
 *
 * You can find a list of all available `Output` objects in the
 * [WebMidi.outputs]{@link WebMidi#outputs} array.
 *
 * The `Output` class extends the
 * [EventEmitter](https://djipco.github.io/djipevents/EventEmitter.html) class from the
 * [djipevents]{@link https://djipco.github.io/djipevents/index.html} module. This means
 * it also includes methods such as
 * [addListener()](https://djipco.github.io/djipevents/EventEmitter.html#addListener),
 * [removeListener()](https://djipco.github.io/djipevents/EventEmitter.html#removeListener),
 * [hasListener()](https://djipco.github.io/djipevents/EventEmitter.html#hasListener) and several
 * others.
 *
 * @param {MIDIOutput} midiOutput `MIDIOutput` object as provided by the MIDI subsystem
 *
 * @fires Output#opened
 * @fires Output#disconnected
 * @fires Output#closed
 */
export class Output extends EventEmitter {

  constructor(midiOutput) {

    super();

    if (!midiOutput || midiOutput.type !== "output") {
      throw new TypeError("The supplied MIDIOutput is invalid.");
    }

    /**
     * A reference to the `MIDIOutput` object
     * @type {MIDIOutput}
     * @private
     */
    this._midiOutput = midiOutput;

    /**
     * Array containing the 16 {@link OutputChannel} objects available for this `Output`. The
     * channels are numbered 1 through 16.
     *
     * @type {OutputChannel[]}
     */
    this.channels = [];
    for (let i = 1; i <= 16; i++) this.channels[i] = new OutputChannel(this, i);

    this._midiOutput.onstatechange = this._onStateChange.bind(this);

  }

  /**
   * Destroys the `Output`. All listeners are removed, all channels are destroyed and the MIDI
   * subsystem is unlinked.
   * @returns {Promise<void>}
   */
  async destroy() {
    this.removeListener();
    this.channels.forEach(ch => ch.destroy());
    this.channels = [];
    this._midiOutput.onstatechange = null;
    await this.close();
    this._midiOutput = null;
  }

  /**
   * @private
   */
  _onStateChange(e) {

    let event = {
      timestamp: WebMidi.time
    };

    if (e.port.connection === "open") {

      /**
       * Event emitted when the {@link Output} has been opened by calling the
       * [open()]{@link Output#open} method.
       *
       * @event Output#opened
       * @type {Object}
       * @property {number} timestamp The moment (DOMHighResTimeStamp) when the event occurred (in
       * milliseconds since the navigation start of the document).
       * @property {string} type `"opened"`
       * @property {Output} target The object that triggered the event
       */
      event.type = "opened";
      event.target = this;
      this.emit("opened", event);

    } else if (e.port.connection === "closed" && e.port.state === "connected") {

      /**
       * Event emitted when the {@link Output} has been closed by calling the
       * [close()]{@link Output#close} method.
       *
       * @event Output#closed
       * @type {Object}
       * @property {number} timestamp The moment (DOMHighResTimeStamp) when the event occurred (in
       * milliseconds since the navigation start of the document).
       * @property {string} type `"closed"`
       * @property {Output} target The object that triggered the event
       */
      event.type = "closed";
      event.target = this;
      this.emit("closed", event);

    } else if (e.port.connection === "closed" && e.port.state === "disconnected") {

      /**
       * Event emitted when the {@link Output} becomes unavailable. This event is typically fired
       * when the MIDI device is unplugged.
       *
       * @event Output#disconnected
       * @type {Object}
       * @property {number} timestamp The moment (DOMHighResTimeStamp0 when the event occurred (in
       * milliseconds since the navigation start of the document).
       * @property {string} type `"disconnected"`
       * @property {Object} target Object with properties describing the {@link Output} that
       * triggered the event. This is not the actual `Output` as it is no longer available.
       * @property {string} target.connection `"closed"`
       * @property {string} target.id ID of the input
       * @property {string} target.manufacturer Manufacturer of the device that provided the input
       * @property {string} target.name Name of the device that provided the input
       * @property {string} target.state `"disconnected"`
       * @property {string} target.type `"output"`
       */
      event.type = "disconnected";
      event.target = {
        connection: e.port.connection,
        id: e.port.id,
        manufacturer: e.port.manufacturer,
        name: e.port.name,
        state: e.port.state,
        type: e.port.type
      };
      this.emit("disconnected", event);

    } else if (e.port.connection === "pending" && e.port.state === "disconnected") {
      // I don't see the need to forward that...
    } else {
      console.warn("This statechange event was not caught:", e.port.connection, e.port.state);
    }

  }

  /**
   * Opens the output for usage.
   *
   * @returns {Promise<Output>} The promise is fulfilled with the `Output`
   */
  async open() {

    // Explicitly opens the port for usage. This is not mandatory. When the port is not explicitly
    // opened, it is implicitly opened (asynchronously) when calling `send()` on the `MIDIOutput`.
    // We do it explicitly so that 'connected' events are dispatched immediately and we are ready to
    // send.
    try {
      await this._midiOutput.open();
      return Promise.resolve(this);
    } catch (err) {
      return Promise.reject(err);
    }

  }

  /**
   * Closes the output connection. When an output is closed, it cannot be used to send MIDI messages
   * until the output is opened again by calling [Output.open()]{@link Output#open}. You can check
   * the connection status by looking at the [connection]{@link Output#connection} property.
   *
   * @returns {Promise<void>}
   */
  async close() {

    // We close the port. This triggers a 'statechange' event which we listen to to re-trigger the
    // 'closed' event.
    if (this._midiOutput) {
      await this._midiOutput.close();
    } else {
      await Promise.resolve();
    }

  }

  /**
   * Sends a MIDI message on the MIDI output port, at the scheduled timestamp. It is usually not
   * necessary to use this method directly since it is often simpler to use one of the helper
   * methods such as `playNote()`, `stopNote()`, `sendControlChange()`, etc.
   *
   * Details on the format of MIDI messages are available in the summary of
   * [MIDI messages]{@link https://www.midi.org/specifications/item/table-1-summary-of-midi-message}
   * from the MIDI Manufacturers Association.
   *
   * @param status {Number} The MIDI status byte of the message (128-255).
   *
   * @param [data=[]] {Array} An array of unsigned integers for the message. The number of data
   * bytes varies depending on the status byte. It is perfectly legal to send no data for some
   * message types (use undefined or an empty array in this case). Each byte must be between 0 and
   * 255.
   *
   * @param [timestamp=0] {number} The timestamp (DOMHighResTimeStamp) at which to send the message.
   * You can use [WebMidi.time]{@link WebMidi#time} to retrieve the current timestamp. To send
   * immediately, leave blank or use 0.
   *
   * @throws {TypeError} Failed to execute 'send' on 'MIDIOutput': The value at index 0 is greater
   * than 0xFF.
   *
   * @throws {TypeError} Failed to execute 'send' on 'MIDIOutput': The value at index 2 is greater
   * than 0xFF.
   *
   * @throws {TypeError} Failed to execute 'send' on 'MIDIOutput': Running status is not allowed at
   * index 2.
   *
   * @throws {TypeError} Failed to execute 'send' on 'MIDIOutput': Message is incomplete.
   *
   * @throws {TypeError} Failed to execute 'send' on 'MIDIOutput': Reserved status is not allowed at
   * index 0.
   *
   * @throws {TypeError} Failed to execute 'send' on 'MIDIOutput': System exclusive message is not
   * allowed at index 0.
   *
   * @throws {TypeError} Failed to execute 'send' on 'MIDIOutput': Unexpected end of system
   * exclusive message at index 0.
   *
   * @throws {TypeError} Failed to execute 'send' on 'MIDIOutput': Unexpected status byte at index
   * 1.
   *
   * @throws {TypeError} Failed to execute 'send' on 'MIDIOutput': Unexpected status byte at index
   * 2.
   *
   * @returns {Output} Returns the `Output` object so methods can be chained.
   */
  send(status, data = [], timestamp) {
    if (!Array.isArray(data)) data = [data];
    this._midiOutput.send([status].concat(data), parseFloat(timestamp) || 0);
    return this;
  }

  /**
   * Sends a MIDI [system exclusive]{@link
    * https://www.midi.org/specifications-old/item/table-4-universal-system-exclusive-messages}
   * (*sysex*) message. The generated message will automatically be prepended with the *sysex byte*
   * (0xF0) and terminated with the *end of sysex byte* (0xF7).
   *
   * To use the `sendSysex()` method, system exclusive message support must have been enabled. To
   * do so, you must set the `sysex` option to `true` when calling `WebMidi.enable()`:
   *
   * ```js
   * WebMidi.enable({sysex: true})
   *   .then(() => console.log("System exclusive messages are enabled");
   * ```
   *
   * Note that, depending on browser, version and platform, it is generally necessary to serve the
   * page over HTTPS to enable sysex support.
   *
   * ##### Examples
   *
   * If you want to send a sysex message to a Korg device connected to the first output, you would
   * use the following code:
   *
   * ```js
   * WebMidi.outputs[0].sendSysex(0x42, [0x1, 0x2, 0x3, 0x4, 0x5]);
   * ```
   *
   * The parameters can be specified using any number notation (decimal, hex, binary, etc.).
   * Therefore, the code below is equivalent to the code above:
   *
   * ```js
   * WebMidi.outputs[0].sendSysex(66, [1, 2, 3, 4, 5]);
   * ```
   *
   * The above code sends the byte values 1, 2, 3, 4 and 5 to Korg devices (hex 42 is the same as
   * decimal 66).
   *
   * Some manufacturers are identified using 3 bytes. In this case, you would use a 3-position array
   * as the first parameter. For example, to send the same sysex message to a
   * *Native Instruments* device:
   *
   * ```js
   * WebMidi.outputs[0].sendSysex([0x00, 0x21, 0x09], [0x1, 0x2, 0x3, 0x4, 0x5]);
   * ```
   * There is no limit for the length of the data array. However, it is generally suggested to keep
   * system exclusive messages to 64Kb or less.
   *
   * @param manufacturer {number|number[]} An unsigned integer or an array of three unsigned
   * integers between 0 and 127 that identify the targeted manufacturer. The *MIDI Manufacturers
   * Association* maintains a full list of
   * [Manufacturer ID Numbers](https://www.midi.org/specifications-old/item/manufacturer-id-numbers)
   * .
   *
   * @param [data=number[]] {Array} An array of unsigned integers between 0 and 127. This is the
   * data you wish to transfer.
   *
   * @param {Object} [options={}]
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @throws {DOMException} Failed to execute 'send' on 'MIDIOutput': System exclusive message is
   * not allowed.
   *
   * @throws {TypeError} Failed to execute 'send' on 'MIDIOutput': The value at index x is greater
   * than 0xFF.
   *
   * @returns {Output} Returns the `Output` object so methods can be chained.
   */
  sendSysex(manufacturer, data, options = {}) {

    manufacturer = [].concat(manufacturer);

    data = manufacturer.concat(data, WebMidi.MIDI_SYSTEM_MESSAGES.sysexend);
    this.send(WebMidi.MIDI_SYSTEM_MESSAGES.sysex, data, WebMidi.convertToTimestamp(options.time));

    return this;

  };

  /**
   * Clears all messages that have been queued but not yet delivered.
   *
   * Warning: this method has been defined in the specification but has not been implemented yet. As
   * soon as browsers implement it, it will work.
   *
   * @returns {Output} Returns the `Output` object so methods can be chained.
   */
  clear() {
    if (this._midiOutput.clear) {
      this._midiOutput.clear();
    } else {
      console.warn("The 'clear()' method has not yet been implemented in your environment.");
    }
    return this;
  }

  /**
   * Sends a MIDI **timecode quarter frame** message. Please note that no processing is being done
   * on the data. It is up to the developer to format the data according to the
   * [MIDI Timecode](https://en.wikipedia.org/wiki/MIDI_timecode) format.
   *
   * @param value {number} The quarter frame message content (integer between 0 and 127).
   *
   * @param {Object} [options={}]
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @returns {Output} Returns the `Output` object so methods can be chained.
   */
  sendTimecodeQuarterFrame(value, options = {}) {
    this.send(
      WebMidi.MIDI_SYSTEM_MESSAGES.timecode,
      value,
      WebMidi.convertToTimestamp(options.time)
    );
    return this;
  };

  /**
   * Sends a **ong position** MIDI message. The value is expressed in MIDI beats (between 0 and
   * 16383) which are 16th note. Position 0 is always the start of the song.
   *
   * @param [value=0] {number} The MIDI beat to cue to (integer between 0 and 16383).
   *
   * @param {Object} [options={}]
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @returns {Output} Returns the `Output` object so methods can be chained.
   *
   * @since 3.0.0
   */
  setSongPosition(value, options = {}) {

    value = Math.floor(value) || 0;

    var msb = (value >> 7) & 0x7F;
    var lsb = value & 0x7F;

    this.send(
      WebMidi.MIDI_SYSTEM_MESSAGES.songposition,
      [msb, lsb],
      WebMidi.convertToTimestamp(options.time)
    );
    return this;

  }

  /**
   * @private
   * @deprecated since version 3.0
   */
  sendSongPosition(value, options = {}) {
    this.setSongPosition(value, options);
    console.warn(
      "The sendSongPosition() method has been deprecated. Use setSongPosition() instead."
    );
    return this;
  }

  /**
   * Sends a **song select** MIDI message.
   *
   * **Note**: since version 3.0, the song number is an integer between 1 and 128. In versions 1.0
   * and 2.0, the number was between 0 and 127. This change aligns WebMidi.js with most devices that
   * use a numbering scheme starting at 1.
   *
   * @param value {number} The number of the song to select (integer between 1 and 128).
   *
   * @param {Object} [options={}]
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @throws The song number must be between 1 and 128.
   *
   * @returns {Output} Returns the `Output` object so methods can be chained.
   *
   * @since 3.0.0
   */
  setSong(value, options = {}) {

    value = parseInt(value);
    if (isNaN(value) || !(value >= 1 && value <= 128)) {
      throw new RangeError("The program value must be between 1 and 128");
    }

    this.send(
      WebMidi.MIDI_SYSTEM_MESSAGES.songselect,
      [value],
      WebMidi.convertToTimestamp(options.time)
    );

    return this;

  }

  /**
   * @private
   * @deprecated since version 3.0
   */
  sendSongSelect(value, options = {}) {
    this.setSong(value, options);
    console.warn(
      "The sendSongSelect() method has been deprecated. Use setSong() instead."
    );
    return this;
  }

  /**
   * Sends a MIDI **tune request** real-time message.
   *
   * @param {Object} [options={}]
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @returns {Output} Returns the `Output` object so methods can be chained.
   *
   * @since 3.0.0
   */
  sendTuneRequest(options = {}) {
    this.send(
      WebMidi.MIDI_SYSTEM_MESSAGES.tunerequest,
      undefined,
      WebMidi.convertToTimestamp(options.time)
    );
    return this;
  }

  /**
   * Sends a MIDI **clock* real-time message. According to the standard, there are 24 MIDI Clocks
   * for every quarter note.
   *
   * @param {Object} [options={}]
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @returns {Output} Returns the `Output` object so methods can be chained.
   */
  sendClock(options = {}) {
    this.send(
      WebMidi.MIDI_SYSTEM_MESSAGES.clock,
      undefined,
      WebMidi.convertToTimestamp(options.time)
    );
    return this;
  };

  /**
   * Sends a **start** real-time message. A MIDI Start message starts the playback of the current
   * song at beat 0. To start playback elsewhere in the song, use the
   * [sendContinue()]{@link Output#sendContinue} method.
   *
   * @param {Object} [options={}]
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @returns {Output} Returns the `Output` object so methods can be chained.
   */
  sendStart(options = {}) {
    this.send(
      WebMidi.MIDI_SYSTEM_MESSAGES.start,
      undefined,
      WebMidi.convertToTimestamp(options.time)
    );
    return this;
  };

  /**
   * Sends a **continue** real-time message. This resumes song playback where it was previously
   * stopped or where it was last cued with a song position message. To start playback from the
   * start, use the [sendStart()]{@link Output#sendStart}` method.
   *
   * @param {Object} [options={}]
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @returns {WebMidi} Returns the `WebMidi` object so methods can be chained.
   */
  sendContinue(options = {}) {
    this.send(
      WebMidi.MIDI_SYSTEM_MESSAGES.continue,
      undefined,
      WebMidi.convertToTimestamp(options.time)
    );
    return this;
  };

  /**
   * Sends a **stop** real-time message. This tells the device connected to this output to stop
   * playback immediately (or at the scheduled time).
   *
   * @param {Object} [options={}]
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @returns {Output} Returns the `Output` object so methods can be chained.
   */
  sendStop(options = {}) {
    this.send(
      WebMidi.MIDI_SYSTEM_MESSAGES.stop,
      undefined,
      WebMidi.convertToTimestamp(options.time)
    );
    return this;
  };

  /**
   * Sends an **active sensing** real-time message. This tells the device connected to this port
   * that the connection is still good. Active sensing messages should be sent every 300 ms if there
   * was no other activity on the MIDI port.
   *
   * @param {Object} [options={}]
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @returns {Output} Returns the `Output` object so methods can be chained.
   */
  sendActiveSensing(options = {}) {
    this.send(
      WebMidi.MIDI_SYSTEM_MESSAGES.activesensing,
      [],
      WebMidi.convertToTimestamp(options.time)
    );
    return this;
  };

  /**
   * Sends a **reset** real-time message. This tells the device connected to this output that it
   * should reset itself to a default state.
   *
   * @param {Object} [options={}]
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @returns {Output} Returns the `Output` object so methods can be chained.
   */
  sendReset(options = {}) {
    this.send(
      WebMidi.MIDI_SYSTEM_MESSAGES.reset,
      undefined,
      WebMidi.convertToTimestamp(options.time)
    );
    return this;
  };

  /**
   * @private
   * @deprecated since version 3.0
   */
  sendTuningRequest(options = {}) {
    this.sendTuneRequest(options);
    console.warn(
      "The sendTuningRequest() method has been deprecated. Use sendTuningRequest() instead."
    );
    return this;
  }

  /**
   * Sends a MIDI **key aftertouch** message to the specified channel(s) at the scheduled time. This
   * is a key-specific aftertouch. For a channel-wide aftertouch message, use
   * [setChannelAftertouch()]{@link Output#setChannelAftertouch}.
   *
   * @param note {number|string|Array}  The note for which you are sending an aftertouch value. The
   * notes can be specified in one of two ways. The first way is by using the MIDI note number (an
   * integer between 0 and 127). The second way is by using the note name followed by the octave
   * (C3, G#4, F-1, Db7). The octave range should be between -1 and 9. The lowest note is C-1 (MIDI
   * note number 0) and the highest note is G9 (MIDI note number 127). It is also possible to use
   * an array of note names and/or numbers.
   *
   * @param [pressure=0.5] {number} The pressure level (between 0 and 1). An invalid pressure value
   * will silently trigger the default behaviour. If the `rawValue` option is set to `true`, the
   * pressure can be defined by using an integer between 0 and 127.
   *
   * @param channel {number|number[]} An integer between 1 and 16 or an array of such integers
   * representing the channel(s) to listen on.
   *
   * @param {Object} [options={}]
   *
   * @param {boolean} [options.rawValue=false] A boolean indicating whether the value should be
   * considered a float between 0 and 1.0 (default) or a raw integer between 0 and 127.
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @return {Output} Returns the `Output` object so methods can be chained.
   *
   * @since 3.0.0
   */
  setKeyAftertouch(note, pressure, channel, options = {}) {

    WebMidi.sanitizeChannels(channel).forEach(ch => {
      this.channels[ch].setKeyAftertouch(note, pressure, options);
    });

    return this;

  };

  /**
   * @private
   * @deprecated since version 3.0
   */
  sendKeyAftertouch(note, channel, pressure, options = {}) {
    this.setKeyAftertouch(note, pressure, channel, options);
    console.warn(
      "The sendKeyAftertouch() method has been deprecated. Use setKeyAftertouch() instead."
    );
    return this;
  }

  /**
   * Sends a MIDI **control change** message to the specified channel(s) at the scheduled time. The
   * control change message to send can be specified numerically or by using one of the following
   * common names:
   *
   *  * `bankselectcoarse` (#0)
   *  * `modulationwheelcoarse` (#1)
   *  * `breathcontrollercoarse` (#2)
   *  * `footcontrollercoarse` (#4)
   *  * `portamentotimecoarse` (#5)
   *  * `dataentrycoarse` (#6)
   *  * `volumecoarse` (#7)
   *  * `balancecoarse` (#8)
   *  * `pancoarse` (#10)
   *  * `expressioncoarse` (#11)
   *  * `effectcontrol1coarse` (#12)
   *  * `effectcontrol2coarse` (#13)
   *  * `generalpurposeslider1` (#16)
   *  * `generalpurposeslider2` (#17)
   *  * `generalpurposeslider3` (#18)
   *  * `generalpurposeslider4` (#19)
   *  * `bankselectfine` (#32)
   *  * `modulationwheelfine` (#33)
   *  * `breathcontrollerfine` (#34)
   *  * `footcontrollerfine` (#36)
   *  * `portamentotimefine` (#37)
   *  * `dataentryfine` (#38)
   *  * `volumefine` (#39)
   *  * `balancefine` (#40)
   *  * `panfine` (#42)
   *  * `expressionfine` (#43)
   *  * `effectcontrol1fine` (#44)
   *  * `effectcontrol2fine` (#45)
   *  * `holdpedal` (#64)
   *  * `portamento` (#65)
   *  * `sustenutopedal` (#66)
   *  * `softpedal` (#67)
   *  * `legatopedal` (#68)
   *  * `hold2pedal` (#69)
   *  * `soundvariation` (#70)
   *  * `resonance` (#71)
   *  * `soundreleasetime` (#72)
   *  * `soundattacktime` (#73)
   *  * `brightness` (#74)
   *  * `soundcontrol6` (#75)
   *  * `soundcontrol7` (#76)
   *  * `soundcontrol8` (#77)
   *  * `soundcontrol9` (#78)
   *  * `soundcontrol10` (#79)
   *  * `generalpurposebutton1` (#80)
   *  * `generalpurposebutton2` (#81)
   *  * `generalpurposebutton3` (#82)
   *  * `generalpurposebutton4` (#83)
   *  * `reverblevel` (#91)
   *  * `tremololevel` (#92)
   *  * `choruslevel` (#93)
   *  * `celestelevel` (#94)
   *  * `phaserlevel` (#95)
   *  * `databuttonincrement` (#96)
   *  * `databuttondecrement` (#97)
   *  * `nonregisteredparametercoarse` (#98)
   *  * `nonregisteredparameterfine` (#99)
   *  * `registeredparametercoarse` (#100)
   *  * `registeredparameterfine` (#101)
   *
   * Note: as you can see above, not all control change message have a matching common name. This
   * does not mean you cannot use the others. It simply means you will need to use their number
   * instead of their name.
   *
   * To view a list of all available `control change` messages, please consult "Table 3 - Control
   * Change Messages" from the [MIDI Messages](
   * https://www.midi.org/specifications/item/table-3-control-change-messages-data-bytes-2)
   * specification.
   *
   * @param controller {number|string} The MIDI controller name or number (0-119).
   *
   * @param [value=0] {number} The value to send (0-127).
   *
   * @param channel {number|number[]} An integer between 1 and 16 or an array of such integers
   * representing the channel(s) to listen on.
   *
   * @param {Object} [options={}]
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @throws {RangeError} Controller numbers must be between 0 and 119.
   * @throws {RangeError} Invalid controller name.
   *
   * @return {Output} Returns the `Output` object so methods can be chained.
   */
  sendControlChange(controller, value, channel, options = {}) {

    WebMidi.sanitizeChannels(channel).forEach(ch => {
      this.channels[ch].sendControlChange(controller, value, options);
    });

    return this;

  };

  /**
   * Sends a pitch bend range message to the specified channel(s) at the scheduled time so that they
   * adjust the range used by their pitch bend lever. The range is specified by using the
   * `semitones` and `cents` parameters. For example, setting the `semitones` parameter to `12`
   * means that the pitch bend range will be 12 semitones above and below the nominal pitch.
   *
   * @param semitones {number} The desired adjustment value in semitones (between 0 and 127). While
   * nothing imposes that in the specification, it is very common for manufacturers to limit the
   * range to 2 octaves (-12 semitones to 12 semitones).
   *
   * @param [cents=0] {number} The desired adjustment value in cents (integer between 0-127).
   *
   * @param channel {number|number[]} An integer between 1 and 16 or an array of such integers
   * representing the channel(s) to listen on.
   *
   * @param {Object} [options={}]
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @throws {RangeError} The msb value must be between 0 and 127.
   * @throws {RangeError} The lsb value must be between 0 and 127.
   *
   * @returns {Output} Returns the `Output` object so methods can be chained.
   *
   * @since 3.0.0
   */
  setPitchBendRange(semitones, cents, channel, options = {}) {

    WebMidi.sanitizeChannels(channel).forEach(ch => {
      this.channels[ch].setPitchBendRange(semitones, cents, options);
    });

    return this;

  }

  /**
   * Sets the specified MIDI registered parameter to the desired value. The value is defined with
   * up to two bytes of data (msb, lsb) that each can go from 0 to 127.
   *
   * MIDI
   * [registered parameters]
   * (https://www.midi.org/specifications-old/item/table-3-control-change-messages-data-bytes-2)
   * extend the original list of control change messages. The MIDI 1.0 specification lists only a
   * limited number of them. Here are the original registered parameters with the identifier that
   * can be used as the first parameter of this function:
   *
   *  * Pitchbend Range (0x00, 0x00): `"pitchbendrange"`
   *  * Channel Fine Tuning (0x00, 0x01): `"channelfinetuning"`
   *  * Channel Coarse Tuning (0x00, 0x02): `"channelcoarsetuning"`
   *  * Tuning Program (0x00, 0x03): `"tuningprogram"`
   *  * Tuning Bank (0x00, 0x04): `"tuningbank"`
   *  * Modulation Range (0x00, 0x05): `"modulationrange"`
   *
   * Note that the **Tuning Program** and **Tuning Bank** parameters are part of the *MIDI Tuning
   * Standard*, which is not widely implemented.
   *
   * Another set of extra parameters have been later added for 3D sound controllers. They are:
   *
   *  * Azimuth Angle (0x3D, 0x00): `"azimuthangle"`
   *  * Elevation Angle (0x3D, 0x01): `"elevationangle"`
   *  * Gain (0x3D, 0x02): `"gain"`
   *  * Distance Ratio (0x3D, 0x03): `"distanceratio"`
   *  * Maximum Distance (0x3D, 0x04): `"maximumdistance"`
   *  * Maximum Distance Gain (0x3D, 0x05): `"maximumdistancegain"`
   *  * Reference Distance Ratio (0x3D, 0x06): `"referencedistanceratio"`
   *  * Pan Spread Angle (0x3D, 0x07): `"panspreadangle"`
   *  * Roll Angle (0x3D, 0x08): `"rollangle"`
   *
   * @param parameter {string|number[]} A string identifying the parameter's name (see above) or a
   * two-position array specifying the two control bytes (e.g. `[0x65, 0x64]`) that identify the
   * registered parameter.
   *
   * @param [data=[]] {number|number[]} A single integer or an array of integers with a maximum
   * length of 2 specifying the desired data.
   *
   * @param channel {number|number[]} An integer between 1 and 16 or an array of such integers
   * representing the channel(s) to listen on.
   *
   * @param {Object} [options={}]
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @returns {Output} Returns the `Output` object so methods can be chained.
   */
  setRegisteredParameter(parameter, data, channel, options = {}) {

    WebMidi.sanitizeChannels(channel).forEach(ch => {
      this.channels[ch].setRegisteredParameter(parameter, data, options);
    });

    return this;

  }

  /**
   * Sends a MIDI **channel aftertouch** message to the specified channel(s). For key-specific
   * aftertouch, you should instead use [setKeyAftertouch()]{@link Output#setKeyAftertouch}.
   *
   * @param [pressure=0.5] {number} The pressure level (between 0 and 1). An invalid pressure value
   * will silently trigger the default behaviour. If the `rawValue` option is set to `true`, the
   * pressure can be defined by using an integer between 0 and 127.
   *
   * @param channel {number|number[]} An integer between 1 and 16 or an array of such integers
   * representing the channel(s) to listen on.
   *
   * @param {Object} [options={}]
   *
   * @param {boolean} [options.rawValue=false] A boolean indicating whether the value should be
   * considered a float between 0 and 1.0 (default) or a raw integer between 0 and 127.
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @return {Output} Returns the `Output` object so methods can be chained.
   * @since 3.0.0
   */
  setChannelAftertouch(pressure, channel, options = {}) {

    WebMidi.sanitizeChannels(channel).forEach(ch => {
      this.channels[ch].setChannelAftertouch(pressure, options);
    });

    return this;

  }

  /**
   * @private
   * @deprecated since version 3.0
   */
  sendChannelAftertouch(pressure, channel, options = {}) {
    this.setChannelAftertouch(pressure, channel, options);
    console.warn(
      "The sendChannelAftertouch() method has been deprecated. Use setChannelAftertouch() instead."
    );
    return this;
  }

  /**
   * Sends a MIDI **pitch bend** message to the specified channel(s) at the scheduled time.
   *
   * @param value {number} The intensity level of the bend (between -1.0 and 1.0). A value of zero
   * means no bend. If the `rawValue` option is set to `true`, the intensity can be defined by using
   * an integer between 0 and 127. In this case, a value of 64 means no bend.
   *
   * @param channel {number|number[]} An integer between 1 and 16 or an array of such integers
   * representing the channel(s) to listen on.
   *
   * @param {Object} [options={}]
   *
   * @param {boolean} [options.rawValue=false] A boolean indicating whether the value should be
   * considered as a float between -1.0 and 1.0 (default) or as raw integer between 0 and 127.
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @throws {RangeError} Pitch bend value must be between -1.0 and 1.0.
   *
   * @returns {Output} Returns the `Output` object so methods can be chained.
   *
   * @since 3.0.0
   */
  setPitchBend(value, channel, options = {}) {

    WebMidi.sanitizeChannels(channel).forEach(ch => {
      this.channels[ch].setPitchBend(value, options);
    });

    return this;

  }

  /**
   * @private
   * @deprecated since version 3.0
   */
  sendPitchBend(bend, channel, options = {}) {
    this.setPitchBend(bend, channel, options);
    console.warn(
      "The sendPitchBend() method has been deprecated. Use setPitchBend() instead."
    );
    return this;
  }

  /**
   * Sends a MIDI **program change** message to the specified channel(s) at the scheduled time.
   *
   * **Note**: since version 3.0, the program number is an integer between 1 and 128. In versions
   * 1.0 and 2.0, the number was between 0 and 127. This change aligns WebMidi.js with most devices
   * that use a numbering scheme starting at 1.
   *
   * @param [program=1] {number} The MIDI patch (program) number (1-128)
   *
   * @param channel {number|number[]} An integer between 1 and 16 or an array of such integers
   * representing the channel(s) to listen on.
   *
   * @param {Object} [options={}]
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @throws {TypeError} Failed to execute 'send' on 'MIDIOutput': The value at index 1 is greater
   * than 0xFF.
   *
   * @return {Output} Returns the `Output` object so methods can be chained.
   *
   * @since 3.0.0
   */
  setProgram(program, channel, options = {}) {

    WebMidi.sanitizeChannels(channel).forEach(ch => {
      this.channels[ch].setProgram(program, options);
    });

    return this;

  }

  /**
   * @private
   * @deprecated since version 3.0
   */
  sendProgramChange(program, channel, options = {}) {

    console.warn(
      "The sendProgramChange() method has been deprecated. Use setProgram() instead."
    );

    return this.setProgram(program, channel, options);

  }

  /**
   * Sends a **modulation depth range** message to the specified channel(s) so that they adjust the
   * depth of their modulation wheel's range. The range can be specified with the `semitones`
   * parameter, the `cents` parameter or by specifying both parameters at the same time.
   *
   * @param [semitones=0] {number} The desired adjustment value in semitones (integer between
   * 0 and 127).
   *
   * @param [cents=0] {number} The desired adjustment value in cents (integer between 0 and 127).
   *
   * @param channel {number|number[]} An integer between 1 and 16 or an array of such integers
   * representing the channel(s) to listen on.
   *
   * @param {Object} [options={}]
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @throws {RangeError} The msb value must be between 0 and 127
   * @throws {RangeError} The lsb value must be between 0 and 127
   *
   * @return {Output} Returns the `Output` object so methods can be chained.
   *
   * @since 3.0.0
   */
  setModulationRange(semitones, cents, channel, options = {}) {

    WebMidi.sanitizeChannels(channel).forEach(ch => {
      this.channels[ch].setModulationRange(semitones, cents, options);
    });

    return this;

  };

  /**
   * Sends a master tuning message to the specified channel(s). The value is decimal and must be
   * larger than -65 semitones and smaller than 64 semitones.
   *
   * Because of the way the MIDI specification works, the decimal portion of the value will be
   * encoded with a resolution of 14bit. The integer portion must be between -64 and 63
   * inclusively. This function actually generates two MIDI messages: a **Master Coarse Tuning** and
   * a **Master Fine Tuning** RPN messages.
   *
   * @param [value=0.0] {number} The desired decimal adjustment value in semitones (-65 < x < 64)
   *
   * @param channel {number|number[]} An integer between 1 and 16 or an array of such integers
   * representing the channel(s) to listen on.
   *
   * @param {Object} [options={}]
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @throws {RangeError} The value must be a decimal number between larger than -65 and smaller
   * than 64.
   *
   * @return {Output} Returns the `Output` object so methods can be chained.
   *
   * @since 3.0.0
   */
  setMasterTuning(value, channel, options = {}) {

    WebMidi.sanitizeChannels(channel).forEach(ch => {
      this.channels[ch].setMasterTuning(value, options);
    });

    return this;

  }

  /**
   * Sets the MIDI tuning program to use. Note that the **Tuning Program** parameter is part of the
   * *MIDI Tuning Standard*, which is not widely implemented.
   *
   * **Note**: since version 3.0, the program number is an integer between 1 and 128. In versions
   * 1.0 and 2.0, the number was between 0 and 127. This change aligns WebMidi.js with most devices
   * that use a numbering scheme starting at 1.
   *
   * @param value {number} The desired tuning program (1-128).
   *
   * @param channel {number|number[]} An integer between 1 and 16 or an array of such integers
   * representing the channel(s) to listen on.
   *
   * @param {Object} [options={}]
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @throws {RangeError} The program value must be between 1 and 128.
   *
   * @return {Output} Returns the `Output` object so methods can be chained.
   *
   * @since 3.0.0
   */
  setTuningProgram(value, channel, options = {}) {

    WebMidi.sanitizeChannels(channel).forEach(ch => {
      this.channels[ch].setTuningProgram(value, options);
    });

    return this;

  }

  /**
   * Sets the MIDI tuning bank to use. Note that the **Tuning Bank** parameter is part of the
   * *MIDI Tuning Standard*, which is not widely implemented.
   *
   * **Note**: since version 3.0, the bank number is an integer between 1 and 128. In versions
   * 1.0 and 2.0, the number was between 0 and 127. This change aligns WebMidi.js with most devices
   * that use a numbering scheme starting at 1.
   *
   * @param value {number} The desired tuning bank (1-128).
   *
   * @param channel {number|number[]} An integer between 1 and 16 or an array of such integers
   * representing the channel(s) to listen on.
   *
   * @param {Object} [options={}]
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @throws {RangeError} The bank value must be between 1 and 128.
   *
   * @return {Output} Returns the `Output` object so methods can be chained.
   *
   * @since 3.0.0
   */
  setTuningBank(value, channel, options = {}) {

    WebMidi.sanitizeChannels(channel).forEach(ch => {
      this.channels[ch].setTuningBank(value, options);
    });

    return this;

  };

  /**
   * Sends a MIDI **channel mode** message to the specified channel(s). The channel mode message to
   * send can be specified numerically or by using one of the following common names:
   *
   *   * `"allsoundoff"` (#120)
   *   * `"resetallcontrollers"` (#121)
   *   * `"localcontrol"` (#122)
   *   * `"allnotesoff"` (#123)
   *   * `"omnimodeoff"` (#124)
   *   * `"omnimodeon"` (#125)
   *   * `"monomodeon"` (#126)
   *   * `"polymodeon"` (#127)
   *
   * It should be noted that, per the MIDI specification, only `localcontrol` and `monomodeon` may
   * require a value that's not zero. For that reason, the `value` parameter is optional and
   * defaults to 0.
   *
   * To make it easier, all channel mode messages have a matching helper method:
   *
   *   - [turnSoundOff()]{@link OutputChannel#turnSoundOff}
   *   - [resetAllControllers()]{@link OutputChannel#resetAllControllers}
   *   - [setLocalControl()]{@link OutputChannel#turnSoundOff}
   *   - [turnNotesOff()]{@link OutputChannel#turnNotesOff}
   *   - [setOmniMode()]{@link OutputChannel#setOmniMode}
   *   - [setPolyphonicMode()]{@link OutputChannel#setPolyphonicMode}
   *
   * @param command {number|string} The numerical identifier of the channel mode message (integer
   * between 120-127) or its name as a string.
   *
   * @param [value] {number} The value to send (integer between 0-127).
   *
   * @param channel {number|number[]} An integer between 1 and 16 or an array of such integers
   * representing the channel(s) to listen on.
   *
   * @param {Object} [options={}]
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @throws {TypeError} Invalid channel mode message name.
   * @throws {RangeError} Channel mode controller numbers must be between 120 and 127.
   * @throws {RangeError} Value must be an integer between 0 and 127.
   *
   * @return {Output} Returns the `Output` object so methods can be chained.
   *
   */
  sendChannelMode(command, value, channel, options = {}) {

    WebMidi.sanitizeChannels(channel).forEach(ch => {
      this.channels[ch].sendChannelMode(command, value, options);
    });

    return this;

  }


  /**
   * Sends an **all sound off** channel mode message. This will silence all sounds playing on that
   * channel but will not prevent new sounds from being triggered.
   *
   * @param channel {number|number[]} An integer between 1 and 16 or an array of such integers
   * representing the channel(s) to listen on.
   *
   * @param {Object} [options={}]
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @returns {Output}
   *
   * @since 3.0.0
   */
  turnSoundOff(channel, options = {}) {

    WebMidi.sanitizeChannels(channel).forEach(ch => {
      this.channels[ch].turnSoundOff(options);
    });

    return this;

  }

  /**
   * Sends an **all note soff** channel mode message. This will turn all currently playing notes
   * off. However, this does not prevent new notes from being played.
   *
   * @param channel {number|number[]} An integer between 1 and 16 or an array of such integers
   * representing the channel(s) to listen on.
   *
   * @param {Object} [options={}]
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @returns {Output}
   *
   * @since 3.0.0
   */
  turnNotesOff(channel, options = {}) {

    WebMidi.sanitizeChannels(channel).forEach(ch => {
      this.channels[ch].turnNotesOff(options);
    });

    return this;

  }

  /**
   * Sends a **reset all controllers** channel mode message. This resets all controllers, such as
   * the pitch bend, to their default value.
   *
   * @param channel {number|number[]} An integer between 1 and 16 or an array of such integers
   * representing the channel(s) to listen on.
   *
   * @param {Object} [options={}]
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @returns {Output}
   */
  resetAllControllers(channel, options = {}) {

    WebMidi.sanitizeChannels(channel).forEach(ch => {
      this.channels[ch].resetAllControllers(options);
    });

    return this;

  }

  /**
   * Sets the polyphonic mode. In `"poly"` mode (usually the default), multiple notes can be played
   * and heard at the same time. In `"mono"` mode, only one note will be heard at once even if
   * multiple notes are being played.
   *
   * @param mode {string} The mode to use: `"mono"` or `"poly"`.
   *
   * @param channel {number|number[]} An integer between 1 and 16 or an array of such integers
   * representing the channel(s) to listen on.
   *
   * @param {Object} [options={}]
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @return {Output} Returns the `Output` object so methods can be chained.
   *
   * @since 3.0.0
   */
  setPolyphonicMode(mode, channel, options = {}) {

    WebMidi.sanitizeChannels(channel).forEach(ch => {
      this.channels[ch].setPolyphonicMode(mode, options);
    });

    return this;

  }


  /**
   * Turns local control on or off. Local control is usually enabled by default. If you disable it,
   * the instrument will no longer trigger its own sounds. It will only send the MIDI messages to
   * its out port.
   *
   * @param [state=false] {boolean} Whether to activate local control (`true`) or disable it
   * (`false`).
   *
   * @param channel {number|number[]} An integer between 1 and 16 or an array of such integers
   * representing the channel(s) to listen on.
   *
   * @param {Object} [options={}]
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @return {Output} Returns the `Output` object so methods can be chained.
   *
   * @since 3.0.0
   */
  setLocalControl(state, channel, options = {}) {

    WebMidi.sanitizeChannels(channel).forEach(ch => {
      this.channels[ch].setLocalControl(state, options);
    });

    return this;

  }

  /**
   * Sets OMNI mode to `"on"` or `"off"` for the specified channel(s). MIDI's OMNI mode causes the
   * instrument to respond to messages from all channels.
   *
   * It should be noted that support for OMNI mode is not as common as it used to be.
   *
   * @param [state] {boolean} Whether to activate OMNI mode (`true`) or not (`false`).
   *
   * @param channel {number|number[]} An integer between 1 and 16 or an array of such integers
   * representing the channel(s) to listen on.
   *
   * @param {Object} [options={}]
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @throws {TypeError} Invalid channel mode message name.
   * @throws {RangeError} Channel mode controller numbers must be between 120 and 127.
   * @throws {RangeError} Value must be an integer between 0 and 127.
   *
   * @return {Output} Returns the `Output` object so methods can be chained.
   *
   * @since 3.0.0
   */
  setOmniMode(state, channel, options = {}) {

    WebMidi.sanitizeChannels(channel).forEach(ch => {
      this.channels[ch].setOmniMode(state, options);
    });

    return this;

  }

  /**
   * Sets a non-registered parameter to the specified value. The NRPN is selected by passing in a
   * two-position array specifying the values of the two control bytes. The value is specified by
   * passing in a single integer (most cases) or an array of two integers.
   *
   * NRPNs are not standardized in any way. Each manufacturer is free to implement them any way
   * they see fit. For example, according to the Roland GS specification, you can control the
   * **vibrato rate** using NRPN (1, 8). Therefore, to set the **vibrato rate** value to **123** you
   * would use:
   *
   * ```js
   * WebMidi.outputs[0].setNonRegisteredParameter([1, 8], 123);
   * ```
   *
   * Obviously, you should select a channel so the message is not sent to all channels. For
   * instance, to send to channel 1 of the first output port, you would use:
   *
   * ```js
   * WebMidi.outputs[0].setNonRegisteredParameter([1, 8], 123, 1);
   * ```
   *
   * In some rarer cases, you need to send two values with your NRPN messages. In such cases, you
   * would use a 2-position array. For example, for its **ClockBPM** parameter (2, 63), Novation
   * uses a 14-bit value that combines an MSB and an LSB (7-bit values). So, for example, if the
   * value to send was 10, you could use:
   *
   * ```js
   * WebMidi.outputs[0].setNonRegisteredParameter([2, 63], [0, 10], [1]);
   * ```
   *
   * For further implementation details, refer to the manufacturer"s documentation.
   *
   * @param parameter {number[]} A two-position array specifying the two control bytes (0x63,
   * 0x62) that identify the non-registered parameter.
   *
   * @param [data=[]] {number|number[]} An integer or an array of integers with a length of 1 or 2
   * specifying the desired data.
   *
   * @param channel {number|number[]} An integer between 1 and 16 or an array of such integers
   * representing the channel(s) to listen on.
   *
   * @param {Object} [options={}]
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @throws {RangeError} The control value must be between 0 and 127.
   * @throws {RangeError} The msb value must be between 0 and 127
   *
   * @returns {Output} Returns the `Output` object so methods can be chained.
   */
  setNonRegisteredParameter(parameter, data, channel, options = {}) {

    WebMidi.sanitizeChannels(channel).forEach(ch => {
      this.channels[ch].setNonRegisteredParameter(parameter, data, options);
    });

    return this;

  }

  /**
   * Increments the specified MIDI registered parameter by 1. Here is the full list of parameter
   * names that can be used with this method:
   *
   *  * Pitchbend Range (0x00, 0x00): `"pitchbendrange"`
   *  * Channel Fine Tuning (0x00, 0x01): `"channelfinetuning"`
   *  * Channel Coarse Tuning (0x00, 0x02): `"channelcoarsetuning"`
   *  * Tuning Program (0x00, 0x03): `"tuningprogram"`
   *  * Tuning Bank (0x00, 0x04): `"tuningbank"`
   *  * Modulation Range (0x00, 0x05): `"modulationrange"`
   *  * Azimuth Angle (0x3D, 0x00): `"azimuthangle"`
   *  * Elevation Angle (0x3D, 0x01): `"elevationangle"`
   *  * Gain (0x3D, 0x02): `"gain"`
   *  * Distance Ratio (0x3D, 0x03): `"distanceratio"`
   *  * Maximum Distance (0x3D, 0x04): `"maximumdistance"`
   *  * Maximum Distance Gain (0x3D, 0x05): `"maximumdistancegain"`
   *  * Reference Distance Ratio (0x3D, 0x06): `"referencedistanceratio"`
   *  * Pan Spread Angle (0x3D, 0x07): `"panspreadangle"`
   *  * Roll Angle (0x3D, 0x08): `"rollangle"`
   *
   * @param parameter {String|number[]} A string identifying the parameter's name (see above) or a
   * two-position array specifying the two control bytes (0x65, 0x64) that identify the registered
   * parameter.
   *
   * @param channel {number|number[]} An integer between 1 and 16 or an array of such integers
   * representing the channel(s) to listen on.
   *
   * @param {Object} [options={}]
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @throws Error The specified parameter is not available.
   *
   * @returns {Output} Returns the `Output` object so methods can be chained.
   */
  incrementRegisteredParameter(parameter, channel, options = {}) {

    WebMidi.sanitizeChannels(channel).forEach(ch => {
      this.channels[ch].incrementRegisteredParameter(parameter, options);
    });

    return this;

  }

  /**
   * Decrements the specified MIDI registered parameter by 1. Here is the full list of parameter
   * names that can be used with this method:
   *
   *  * Pitchbend Range (0x00, 0x00): `"pitchbendrange"`
   *  * Channel Fine Tuning (0x00, 0x01): `"channelfinetuning"`
   *  * Channel Coarse Tuning (0x00, 0x02): `"channelcoarsetuning"`
   *  * Tuning Program (0x00, 0x03): `"tuningprogram"`
   *  * Tuning Bank (0x00, 0x04): `"tuningbank"`
   *  * Modulation Range (0x00, 0x05): `"modulationrange"`
   *  * Azimuth Angle (0x3D, 0x00): `"azimuthangle"`
   *  * Elevation Angle (0x3D, 0x01): `"elevationangle"`
   *  * Gain (0x3D, 0x02): `"gain"`
   *  * Distance Ratio (0x3D, 0x03): `"distanceratio"`
   *  * Maximum Distance (0x3D, 0x04): `"maximumdistance"`
   *  * Maximum Distance Gain (0x3D, 0x05): `"maximumdistancegain"`
   *  * Reference Distance Ratio (0x3D, 0x06): `"referencedistanceratio"`
   *  * Pan Spread Angle (0x3D, 0x07): `"panspreadangle"`
   *  * Roll Angle (0x3D, 0x08): `"rollangle"`
   *
   * @param parameter {String|number[]} A string identifying the parameter"s name (see above) or a
   * two-position array specifying the two control bytes (0x65, 0x64) that identify the registered
   * parameter.
   *
   * @param channel {number|number[]} An integer between 1 and 16 or an array of such integers
   * representing the channel(s) to listen on.
   *
   * @param {Object} [options={}]
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @throws TypeError The specified parameter is not available.
   *
   * @returns {Output} Returns the `Output` object so methods can be chained.
   */
  decrementRegisteredParameter(parameter, channel, options = {}) {

    WebMidi.sanitizeChannels(channel).forEach(ch => {
      this.channels[ch].decrementRegisteredParameter(parameter, options);
    });

    return this;

  };

  /**
   * Sends a **note off** message for the specified notes on the specified channel(s). The first
   * parameter is the note. It can be a single value or an array of the following valid values:
   *
   *  - A MIDI note number (integer between `0` and `127`)
   *  - A note name, followed by the octave (e.g. `"C3"`, `"G#4"`, `"F-1"`, `"Db7"`)
   *  - A {@link Note} object
   *
   *  The execution of the **note off** command can be delayed by using the `time` property of the
   * `options` parameter.
   *
   * When using {@link Note} objects, the release velocity defined in the {@link Note} objects has
   * precedence over the one specified via the method's `options` parameter.
   *
   * @param note {number|string|Note|number[]|string[]|Note[]} The note(s) to stop. The notes can be
   * specified by using a MIDI note number (0-127), a note name (e.g. C3, G#4, F-1, Db7), a
   * {@link Note} object or an array of the previous types. When using a note name, octave range
   * must be between -1 and 9. The lowest note is C-1 (MIDI note number 0) and the highest
   * note is G9 (MIDI note number 127).
   *
   * @param [channel] {number|number[]} The MIDI channel number (between `1` and `16`) or an array
   * of channel numbers.
   *
   * @param {Object} [options={}]
   *
   * @param {boolean} [options.rawValue=false] Controls whether the release velocity is set using
   * integers between `0` and `127` (`true`) or a decimal number between `0` and `1` (`false`,
   * default).
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @param {number} [options.release=0.5] The velocity at which to release the note (between `0`
   * and `1`). If the `rawValue` option is `true`, the value should be specified as an integer
   * between `0` and `127`. An invalid velocity value will silently trigger the default of `0.5`.
   *
   * @returns {Output} Returns the `Output` object so methods can be chained.
   */
  sendNoteOff(note, channel, options) {

    WebMidi.sanitizeChannels(channel).forEach(ch => {
      this.channels[ch].sendNoteOff(note, options);
    });

    return this;

  }

  /**
   * This is an alias to the [sendNoteOff()]{@link Output#sendNoteOff} method.
   *
   * @see {@link Output#sendNoteOff}
   *
   * @param note
   * @param channel
   * @param options
   * @returns {Output}
   */
  stopNote(note, channel, options) {

    WebMidi.sanitizeChannels(channel).forEach(ch => {
      this.channels[ch].stopNote(note, options);
    });

    return this;

  }

  /**
   * Plays a note or an array of notes on the specified channel(s). The first parameter is the note
   * to play. It can be a single value or an array of the following valid values:
   *
   *  - A MIDI note number (integer between `0` and `127`)
   *  - A note name, followed by the octave (e.g. `"C3"`, `"G#4"`, `"F-1"`, `"Db7"`)
   *  - A {@link Note} object
   *
   * The `playNote()` method sends a **note on** MIDI message for all specified notes on all
   * specified channels. If a `duration` is set in the `options` parameter or in the {@link Note}
   * object's [duration]{@link Note#duration} property, it will also schedule a **note off** message
   * to end the note after said duration. If no `duration` is set, the note will simply play until
   * a matching **note off** message is sent with [stopNote()]{@link Output#stopNote} or
   * [sendNoteOff()]{@link Output#sendNoteOff}.
   *
   *  The execution of the **note on** command can be delayed by using the `time` property of the
   * `options` parameter.
   *
   * When using {@link Note} objects, the durations and velocities defined in the {@link Note}
   * objects have precedence over the ones specified via the method's `options` parameter.
   *
   * **Note**: As per the MIDI standard, a **note on** message with an attack velocity of `0` is
   * functionally equivalent to a **note off** message.
   *
   * @param note {number|string|Note|number[]|string[]|Note[]} The note(s) to play. The notes can be
   * specified by using a MIDI note number (0-127), a note name (e.g. C3, G#4, F-1, Db7), a
   * {@link Note} object or an array of the previous types. When using a note name, octave range
   * must be between -1 and 9. The lowest note is C-1 (MIDI note number 0) and the highest
   * note is G9 (MIDI note number 127).
   *
   * @param [channel] {number|number[]} The MIDI channel number (between `1` and `16`) or an array
   * of channel numbers.
   *
   * @param {Object} [options={}]
   *
   * @param {number} [options.duration=undefined] The number of milliseconds (integer) after which a
   * **note off** message will be scheduled. If left undefined, only a **note on** message is sent.
   *
   * @param {boolean} [options.rawValue=false] Controls whether the attack and release velocities
   * are set using integers between `0` and `127` (`true`) or a decimal number between `0` and `1`
   * (`false`, default).
   *
   * @param {number} [options.release=0.5] The velocity at which to release the note (between `0`
   * and `1`). If the `rawValue` option is `true`, the value should be specified as an integer
   * between `0` and `127`. An invalid velocity value will silently trigger the default of `0.5`.
   * This is only used with the **note off** event triggered when `options.duration` is set.
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @param {number} [options.attack=0.5] The attack velocity to use when playing the note (between
   * `0` and `1`). If the `rawValue` option is `true`, the value should be specified as an integer
   * between `0` and `127`. An invalid velocity value will silently trigger the default of `0.5`.
   *
   * @returns {Output} Returns the `Output` object so methods can be chained.
   */
  playNote(note, channel, options = {}) {

    // Compatibility warning
    if (options.rawVelocity) {
      console.warn("The 'rawVelocity' option is deprecated. Use 'rawAttack' instead.");
    }
    if (options.velocity) {
      console.warn("The 'velocity' option is deprecated. Use 'velocity' instead.");
    }

    WebMidi.sanitizeChannels(channel).forEach(ch => {
      this.channels[ch].playNote(note, options);
    });

    return this;

  }

  /**
   * Sends a **note on** message for the specified notes on the specified channel(s). The first
   * parameter is the note. It can be a single value or an array of the following valid values:
   *
   *  - A MIDI note number (integer between `0` and `127`)
   *  - A note name, followed by the octave (e.g. `"C3"`, `"G#4"`, `"F-1"`, `"Db7"`)
   *  - A {@link Note} object
   *
   *  The execution of the **note on** command can be delayed by using the `time` property of the
   * `options` parameter.
   *
   * When using {@link Note} objects, the attack velocity defined in the {@link Note} objects has
   * precedence over the one specified via the method's `options` parameter. Also, the `duration` is
   * ignored. If you want to also send a **note off** message, use the
   * [playNote()]{@link Output#playNote} method instead.
   *
   * **Note**: As per the MIDI standard, a **note on** message with an attack velocity of `0` is
   * functionally equivalent to a **note off** message.
   *
   * @param note {number|string|Note|number[]|string[]|Note[]} The note(s) to play. The notes can be
   * specified by using a MIDI note number (0-127), a note name (e.g. C3, G#4, F-1, Db7), a
   * {@link Note} object or an array of the previous types. When using a note name, octave range
   * must be between -1 and 9. The lowest note is C-1 (MIDI note number 0) and the highest
   * note is G9 (MIDI note number 127).
   *
   * @param [channel] {number|number[]} The MIDI channel number (between `1` and `16`) or an array
   * of channel numbers.
   *
   * @param {Object} [options={}]
   *
   * @param {boolean} [options.rawValue=false] Controls whether the attack velocity is set using
   * integers between `0` and `127` (`true`) or a decimal number between `0` and `1` (`false`,
   * default).
   *
   * @param {number|string} [options.time] If `time` is a string prefixed with `"+"` and followed by
   * a number, the message will be delayed by that many milliseconds. If the value is a number
   * (DOMHighResTimeStamp), the operation will be scheduled for that time. If `time` is omitted, or
   * in the past, the operation will be carried out as soon as possible.
   *
   * @param {number} [options.attack=0.5] The velocity at which to play the note (between `0` and
   * `1`). If the `rawValue` option is `true`, the value should be specified as an integer
   * between `0` and `127`. An invalid velocity value will silently trigger the default of `0.5`.
   *
   * @returns {Output} Returns the `Output` object so methods can be chained.
   */
  sendNoteOn(note, channel, options = {}) {

    WebMidi.sanitizeChannels(channel).forEach(ch => {
      this.channels[ch].sendNoteOn(note, options);
    });

    return this;

  }

  /**
   * Name of the MIDI output
   *
   * @type {string}
   * @readonly
   */
  get name() {
    return this._midiOutput.name;
  }

  /**
   * ID string of the MIDI output. The ID is host-specific. Do not expect the same ID on different
   * platforms. For example, Google Chrome and the Jazz-Plugin report completely different IDs for
   * the same port.
   *
   * @type {string}
   * @readonly
   */
  get id() {
    return this._midiOutput.id;
  }

  /**
   * Output port's connection state: `"pending"`, `"open"` or `"closed"`.
   *
   * @type {string}
   * @readonly
   */
  get connection() {
    return this._midiOutput.connection;
  }

  /**
   * Name of the manufacturer of the device that makes this output port available.
   *
   * @type {string}
   * @readonly
   */
  get manufacturer() {
    return this._midiOutput.manufacturer;
  }

  /**
   * State of the output port: `"connected"` or `"disconnected"`.
   *
   * @type {string}
   * @readonly
   */
  get state() {
    return this._midiOutput.state;
  }

  /**
   * Type of the output port (`"output"`)
   *
   * @type {string}
   * @readonly
   */
  get type() {
    return this._midiOutput.type;
  }

}