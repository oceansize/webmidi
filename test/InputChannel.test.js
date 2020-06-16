const expect = require("chai").expect;
const midi = require("midi");
const {WebMidi} = require("../dist/webmidi.cjs.js");

// Create virtual MIDI input port. Being an external device, the virtual device's output is seen as
// an input from WebMidi's perspective. To avoid confusion, the property names adopt WebMidi's point
// of view.
let VIRTUAL_INPUT = {
  PORT: new midi.Output(),
  NAME: "Virtual input"
};

let WEBMIDI_INPUT;

describe("InputChannel Object", function() {

  before(function () {
    VIRTUAL_INPUT.PORT.openVirtualPort(VIRTUAL_INPUT.NAME);
  });

  after(function () {
    VIRTUAL_INPUT.PORT.closePort();
  });

  beforeEach("Check support and enable", async function () {
    await WebMidi.enable();
    WEBMIDI_INPUT = WebMidi.getInputByName(VIRTUAL_INPUT.NAME);
  });

  afterEach("Disable WebMidi.js", async function () {
    await WebMidi.disable();
  });

  it("should dispatch 'midimessage' events for all channel voice MIDI messages", function (done) {

    // Arrange
    let event = "midimessage";
    let messages = [
      [0x80, 48, 87],     // Note off
      [0x90, 52, 64],     // Note on
      [0xA0, 60, 83],     // Key pressure
      [0xB0, 67, 92],     // Control change
      [0xC0, 88],         // Program change
      [0xD0, 93],         // Channel aftertouch
      [0xE0, 95, 101],    // Pitch bend
      [0xB0, 120, 0],     // All sound off
      [0xB0, 121, 0],     // reset all controllers
      [0xB0, 122, 0],     // Local control off
      [0xB0, 122, 127],   // Local control on
      [0xB0, 123, 0],     // All notes off
      [0xB0, 126, 0],     // Mono mode on (poly mode off)
      [0xB0, 127, 0]      // Mono mode off (poly mode on)
    ];
    let channel = WEBMIDI_INPUT.channels[1];
    let index = 0;
    channel.addListener(event, assert);

    // Act
    messages.forEach(message => {
      VIRTUAL_INPUT.PORT.sendMessage(message);
    });

    // Assert
    function assert(e) {

      expect(e.type).to.equal(event);
      expect(e.data).to.have.ordered.members(messages[index]);

      index++;
      if (index >= messages.length) done();

    }

  });

  it("should dispatch event for inbound 'noteoff' MIDI message", function (done) {

    // Arrange
    let channel = WEBMIDI_INPUT.channels[1];
    let event = "noteoff";
    let velocity = 87;
    let status = 0x80;
    let index = 0;
    channel.addListener(event, assert);

    // Act
    for (let i = 0; i <= 127; i++) {
      VIRTUAL_INPUT.PORT.sendMessage([status, i, velocity]);
    }

    // Assert
    function assert(e) {

      expect(e.type).to.equal(event);
      expect(e.note.number).to.equal(index);
      expect(e.rawRelease).to.equal(velocity);
      expect(e.target).to.equal(channel);

      index++;
      if (index >= 127) done();

    }

  });

  it("should dispatch event for inbound 'noteon' MIDI message", function (done) {

    // Arrange
    let channel = WEBMIDI_INPUT.channels[1];
    let event = "noteon";
    let velocity = 64;
    let status = 0x90;
    let index = 0;

    channel.addListener(event, assert);

    // Act
    for (let i = 0; i <= 127; i++) {
      VIRTUAL_INPUT.PORT.sendMessage([status, i, velocity]);
    }

    // Assert
    function assert(e) {

      expect(e.type).to.equal(event);
      expect(e.note.number).to.equal(index);
      expect(e.rawAttack).to.equal(velocity);
      expect(e.target).to.equal(channel);

      index++;
      if (index >= 127) done();

    }

  });

  it("should dispatch event for inbound 'keyaftertouch' MIDI message", function (done) {

    // Arrange
    let channel = WEBMIDI_INPUT.channels[1];
    let event = "keyaftertouch";
    let status = 0xA0;
    let velocity = 73;
    let index = 0;
    channel.addListener(event, assert);

    // Act
    for (let i = 0; i <= 127; i++) {
      VIRTUAL_INPUT.PORT.sendMessage([status, i, velocity]);
    }

    // Assert
    function assert(e) {

      expect(e.type).to.equal(event);
      expect(e.note.number).to.equal(index);
      expect(e.rawValue).to.equal(velocity);
      expect(e.target).to.equal(channel);

      index++;
      if (index >= 127) done();

    }

  });

  it("should dispatch event for inbound 'controlchange' MIDI message", function (done) {

    // Arrange
    let channel = WEBMIDI_INPUT.channels[1];
    let event = "controlchange";
    let status = 0xB0;
    let value = 122;
    let index = 0;
    channel.addListener(event, assert);

    // Act
    for (let i = 0; i <= 119; i++) {
      VIRTUAL_INPUT.PORT.sendMessage([status, i, value]);
    }

    // Assert
    function assert(e) {

      expect(e.type).to.equal(event);
      expect(e.controller.number).to.equal(index);
      expect(e.rawValue).to.equal(value);
      expect(e.target).to.equal(channel);

      index++;
      if (index >= 119) done();

    }

  });

  it("should dispatch event for inbound 'program change' MIDI message", function (done) {

    // Arrange
    let channel = WEBMIDI_INPUT.channels[1];
    let event = "programchange";
    let status = 0xC0;
    let value = 19;
    channel.addListener(event, assert);

    // Act
    VIRTUAL_INPUT.PORT.sendMessage([status, value]);

    // Assert
    function assert(e) {
      expect(e.type).to.equal(event);
      expect(e.value).to.equal(value + 1);
      expect(e.rawValue).to.equal(value);
      expect(e.target).to.equal(channel);
      done();
    }

  });

  it("should dispatch event for inbound 'channel aftertouch' MIDI message", function (done) {

    // Arrange
    let channel = WEBMIDI_INPUT.channels[1];
    let event = "channelaftertouch";
    let status = 0xD0;
    let value = 114;
    channel.addListener(event, assert);

    // Act
    VIRTUAL_INPUT.PORT.sendMessage([status, value]);

    // Assert
    function assert(e) {
      expect(e.type).to.equal(event);
      expect(e.rawValue).to.equal(value);
      expect(e.target).to.equal(channel);
      done();
    }

  });

  it("should dispatch event for inbound 'pitchbend' MIDI message", function (done) {

    // Arrange
    let channel = WEBMIDI_INPUT.channels[1];
    let event = "pitchbend";
    let status = 0xE0;
    let lsb = 6;
    let msb = 89;
    channel.addListener(event, assert);

    // Act
    VIRTUAL_INPUT.PORT.sendMessage([status, lsb, msb]);

    // Assert
    function assert(e) {
      expect(e.type).to.equal(event);
      expect(e.data[1]).to.equal(lsb);
      expect(e.data[2]).to.equal(msb);
      expect(e.target).to.equal(channel);
      done();
    }

  });

  it("should dispatch event for all inbound 'channelmode' MIDI message", function (done) {

    // Arrange
    let channel = WEBMIDI_INPUT.channels[1];
    let event = "channelmode";
    let status = 0xB0;
    let value = 34;
    let index = 120;
    channel.addListener(event, assert);

    // Act
    for (let i = 120; i <= 127; i++) {
      VIRTUAL_INPUT.PORT.sendMessage([status, i, value]);
    }

    // Assert
    function assert(e) {

      expect(e.type).to.equal(event);
      expect(e.controller.number).to.equal(index);
      expect(e.value).to.equal(value);
      expect(e.target).to.equal(channel);

      index++;
      if (index >= 127) done();

    }

  });

  it("should dispatch event for inbound 'all sound off' MIDI message", function (done) {

    // Arrange
    let channel = WEBMIDI_INPUT.channels[1];
    let event = "allsoundoff";
    let status = 0xB0;
    let mode = 120;
    channel.addListener(event, assert);

    // Act
    VIRTUAL_INPUT.PORT.sendMessage([status, mode, 0]);

    // Assert
    function assert(e) {
      expect(e.type).to.equal(event);
      expect(e.target).to.equal(channel);
      done();
    }

  });

  it("should dispatch event for inbound 'reset all controllers' MIDI message", function (done) {

    // Arrange
    let channel = WEBMIDI_INPUT.channels[1];
    let event = "resetallcontrollers";
    let status = 0xB0;
    let mode = 121;
    channel.addListener(event, assert);

    // Act
    VIRTUAL_INPUT.PORT.sendMessage([status, mode, 0]);

    // Assert
    function assert(e) {
      expect(e.type).to.equal(event);
      expect(e.target).to.equal(channel);
      done();
    }

  });

  it("should dispatch event for inbound 'local control' MIDI message", function (done) {

    // Arrange
    let channel = WEBMIDI_INPUT.channels[1];
    let event = "localcontrol";
    let status = 0xB0;
    let mode = 122;
    channel.addListener(event, assert);
    let index = 0;

    // Act
    VIRTUAL_INPUT.PORT.sendMessage([status, mode, 0]);
    VIRTUAL_INPUT.PORT.sendMessage([status, mode, 127]);

    // Assert
    function assert(e) {

      expect(e.type).to.equal(event);
      expect(e.target).to.equal(channel);

      if (index === 0) {
        expect(e.value).to.be.false;
      } else if (index === 1) {
        expect(e.value).to.be.true;
        done();
      }

      index++;

    }

  });

  it("should dispatch event for inbound 'all notes off' MIDI message", function (done) {

    // Arrange
    let channel = WEBMIDI_INPUT.channels[1];
    let event = "allnotesoff";
    let status = 0xB0;
    let mode = 123;
    channel.addListener(event, assert);

    // Act
    VIRTUAL_INPUT.PORT.sendMessage([status, mode, 0]);

    // Assert
    function assert(e) {
      expect(e.type).to.equal(event);
      expect(e.target).to.equal(channel);
      done();
    }

  });

  it("should dispatch event for inbound 'monomode/polymode' MIDI message", function (done) {

    // Arrange
    let channel = WEBMIDI_INPUT.channels[1];
    let event = "monomode";
    let status = 0xB0;
    channel.addListener(event, assert);
    let index = 0;

    // Act
    VIRTUAL_INPUT.PORT.sendMessage([status, 126, 0]);
    VIRTUAL_INPUT.PORT.sendMessage([status, 127, 0]);

    // Assert
    function assert(e) {

      expect(e.type).to.equal(event);
      expect(e.target).to.equal(channel);

      if (index === 0) {
        expect(e.value).to.be.true;
      } else if (index === 1) {
        expect(e.value).to.be.false;
        done();
      }

      index++;

    }

  });

  it("should dispatch event for inbound 'omni mode on/off' MIDI message", function (done) {

    // Arrange
    let channel = WEBMIDI_INPUT.channels[1];
    let event = "omnimode";
    let status = 0xB0;
    channel.addListener(event, assert);
    let index = 0;

    // Act
    VIRTUAL_INPUT.PORT.sendMessage([status, 124, 0]);
    VIRTUAL_INPUT.PORT.sendMessage([status, 125, 0]);

    // Assert
    function assert(e) {

      expect(e.type).to.equal(event);
      expect(e.target).to.equal(channel);

      if (index === 0) {
        expect(e.value).to.be.false;
      } else if (index === 1) {
        expect(e.value).to.be.true;
        done();
      }

      index++;

    }

  });

  it("should dispatch event for inbound 'RPN' MIDI sequence");

  it("should dispatch event for inbound 'NRPN' MIDI sequence");

  // it.only("should dispatch event for inbound 'NRPN' MIDI sequence", function (done) {
  //
  //   // Arrange
  //   let channel = WEBMIDI_INPUT.channels[1];
  //   let event = "nrpn";
  //   let status = 0xB0;
  //   let parameterMsb = 12;
  //   let parameterLsb = 34;
  //   let valueMsb = 56;
  //   let valueLsb = 78;
  //
  //   channel.nrpnEventsEnabled = true;
  //   channel.addListener("controlchange", assert);
  //
  //   // Act
  //   VIRTUAL_INPUT.PORT.sendMessage([status, 99, parameterMsb]);
  //   VIRTUAL_INPUT.PORT.sendMessage([status, 98, parameterLsb]);
  //   VIRTUAL_INPUT.PORT.sendMessage([status, 6, valueMsb]);
  //   VIRTUAL_INPUT.PORT.sendMessage([status, 38, valueLsb]);
  //   VIRTUAL_INPUT.PORT.sendMessage([status, 101, 127]);
  //   VIRTUAL_INPUT.PORT.sendMessage([status, 100, 127]);
  //
  //   // Assert
  //   function assert(e) {
  //     console.log(e.rawData);
  //     // expect(e.type).to.equal(event);
  //     // expect(e.data[1]).to.equal(lsb);
  //     // expect(e.data[2]).to.equal(msb);
  //     // expect(e.target).to.equal(channel);
  //     // done();
  //   }
  //
  // });

  describe("destroy()", function () {

    it("should set input and channel number to null", function () {

      // Arrange
      let channel = WEBMIDI_INPUT.channels[1];

      // Act
      channel.destroy();

      // Assert
      expect(channel.input).to.be.null;
      expect(channel.number).to.be.null;

    });

    it("should remove all listeners", function () {

      // Arrange
      let channel = WEBMIDI_INPUT.channels[1];
      channel.addListener("test", () => {});

      // Act
      channel.destroy();

      // Assert
      expect(channel.hasListener()).to.be.false;

    });

  });

  describe("getChannelModeByNumber()", function () {

    it("should return string for valid channel mode numbers", function () {

      // Arrange
      let channel = WEBMIDI_INPUT.channels[1];
      let results = [];

      // Act
      for (let cc in WebMidi.MIDI_CHANNEL_MODE_MESSAGES) {
        let number = WebMidi.MIDI_CHANNEL_MODE_MESSAGES[cc];
        results.push(channel.getChannelModeByNumber(number));
      }

      // Assert
      results.forEach(result => {
        expect(result).to.be.a("string");
      });

    });

    it("should return 'false' for numbers with no match", function () {

      // Arrange
      let channel = WEBMIDI_INPUT.channels[1];
      let values = [
        -1,
        0,
        119,
        128
      ];
      let results = [];

      // Act
      values.forEach(value => {
        results.push(channel.getChannelModeByNumber(value));
      });

      // Assert
      results.forEach(result => {
        expect(result).to.be.false;
      });

    });

  });

  describe("getCcNameByNumber()", function () {

    it("should throw error for invalid control change numbers", function () {

      // Arrange
      let channel = WEBMIDI_INPUT.channels[1];
      let values = [
        -1,
        // 120,
        // "test",
        // undefined,
        // NaN,
        // null
      ];

      // Act
      values.forEach(assert);

      // Assert
      function assert(value) {
        expect(() => {
          channel.getCcNameByNumber(value);
        }).to.throw(RangeError);
      }

    });

    it("should return string for valid control change numbers", function () {

      // Arrange
      let channel = WEBMIDI_INPUT.channels[1];
      let results = [];

      // Act
      for (let cc in WebMidi.MIDI_CONTROL_CHANGE_MESSAGES) {
        let number = WebMidi.MIDI_CONTROL_CHANGE_MESSAGES[cc];
        results.push(channel.getCcNameByNumber(number));
      }

      // Assert
      results.forEach(result => {
        expect(result).to.be.a("string");
      });

    });

    it("should return 'false' for numbers with no predefined purpose", function () {

      // Arrange
      let channel = WEBMIDI_INPUT.channels[1];
      let values = [
        3, 9,
        14, 15,
        20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
        30, 31,
        85, 86, 87, 89, 90,
        102, 103, 104, 105, 106, 107, 108, 109,
        110, 111, 112, 113, 114, 115, 116, 117, 118, 119
      ];
      let results = [];

      // Act
      values.forEach(value => {
        results.push(channel.getCcNameByNumber(value));
      });

      // Assert
      results.forEach(result => {
        expect(result).to.be.false;
      });

    });

  });

});