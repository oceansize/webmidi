describe('Output', function() {

  beforeEach("Enable WebMidi.js", function (done) {

    WebMidi.disable();

    WebMidi.enable(function() {

      if (WebMidi.outputs.length > 0) {
        done();
      } else {

        // Calling this.skip() throws an error. We catch it so it does not show up in the console
        try {
          this.skip();
        } catch (err) {
          // console.warn(err.message)
        }

      }

    }.bind(this));

  });

  describe('decrementRegisteredParameter()', function () {

    it("should throw error if registered parameter is invalid", function() {

      expect(function () {
        WebMidi.outputs[0].decrementRegisteredParameter(0);
      }).to.throw(TypeError);

      expect(function () {
        WebMidi.outputs[0].decrementRegisteredParameter('xxx');
      }).to.throw(TypeError);

    });

    // it("should call send the right amount of times", function() {
    //
    //   var spy = sinon.spy(WebMidi.outputs[0], "send");
    //
    //   // expect(function () {
    //     WebMidi.outputs[0].decrementRegisteredParameter('pitchbendrange', 1);
    //   // }).to.throw(RangeError);
    //
    //   expect(spy.callCount).to.equal(2);
    //   spy.restore(WebMidi, "send");
    //
    // });

    it("should return the Output object for method chaining", function() {
      expect(
        WebMidi.outputs[0].decrementRegisteredParameter("pitchbendrange")
      ).to.equal(WebMidi.outputs[0]);
    });

    // it("should throw error if options.time is invalid", function(done) {
    //
    // });

  });

  describe('incrementRegisteredParameter()', function () {

    it("should throw error if registered parameter is invalid", function() {

      expect(function () {
        WebMidi.outputs[0].incrementRegisteredParameter(0);
      }).to.throw(Error);

      expect(function () {
        WebMidi.outputs[0].incrementRegisteredParameter('xxx');
      }).to.throw(Error);

    });

    it("should return the Output object for method chaining", function() {
      expect(
        WebMidi.outputs[0].incrementRegisteredParameter("pitchbendrange")
      ).to.equal(WebMidi.outputs[0]);
    });

    // it("should throw error if options.time is invalid", function(done) {
    //
    //   WebMidi.enable(function() {
    //
    //     expect(function () {
    //       WebMidi.outputs[0].decrementRegisteredParameter('pitchbendrange', 1, {time: 'abc'});
    //     }).to.throw(TypeError);
    //
    //     expect(function () {
    //       WebMidi.outputs[0].decrementRegisteredParameter('pitchbendrange', 1, {time: '+abc'});
    //     }).to.throw(TypeError);
    //
    //     done();
    //
    //   });
    //
    // });

  });

  describe('playNote()', function () {

    it("should throw error if note is invalid", function() {

      ["Z-8", "R22", -1, 128, undefined, null, function() {}, ["x"]].forEach(function (param) {
        expect(function () {
          WebMidi.outputs[0].playNote(param);
        }).to.throw(Error);
      });

    });

    it("should return the Output object for method chaining", function() {
      expect(
        WebMidi.outputs[0].playNote(64)
      ).to.equal(WebMidi.outputs[0]);
    });

    // it("should throw error if options.time is invalid", function(done) {
    //
    // });

  });

  describe('send()', function () {

    it("should throw error if status byte is invalid", function() {

      ["xxx", [], NaN, 127, 256, undefined, null, -1, 0, {}].forEach(function (param) {
        expect(function () {
          WebMidi.outputs[0].send(param);
        }).to.throw(RangeError);
      });

    });

    it("should throw error if data bytes are invalid", function() {

      ["xxx", -1, 256, NaN, null, Infinity].forEach(function (param) {
        expect(function () {
          WebMidi.outputs[0].send(64, param);
        }).to.throw(RangeError);
      });

    });

    it("should throw error if message is incomplete", function() {

      [0x80, 0x90, 0xA0].forEach(function (param) {
        expect(function () {
          WebMidi.outputs[0].send(param, []);
        }).to.throw(TypeError);
      });

    });

    it("should return the Output object for method chaining", function() {
      expect(
        WebMidi.outputs[0].send(144, [64, 64])
      ).to.equal(WebMidi.outputs[0]);
    });

  });

  describe('sendActiveSensing()', function () {

    it("should return the Output object for method chaining", function() {
      expect(WebMidi.outputs[0].sendActiveSensing()).to.equal(WebMidi.outputs[0]);
    });

  });

  describe('sendChannelAftertouch()', function () {

    it("should return the Output object for method chaining", function() {
      expect(WebMidi.outputs[0].sendChannelAftertouch()).to.equal(WebMidi.outputs[0]);
    });

  });

  describe('sendChannelMode()', function () {

    it("should return the Output object for method chaining", function() {
      expect(WebMidi.outputs[0].sendChannelMode("allsoundoff")).to.equal(WebMidi.outputs[0]);
    });

    it("should throw an error if value is out of range", function() {

      [-1, 128].forEach(function (param) {
        expect(function () {
          WebMidi.outputs[0].sendChannelMode("localcontrol", param);
        }).to.throw(Error);
      });

    });

  });

  describe('sendClock()', function () {

    it("should return the Output object for method chaining", function() {
      expect(WebMidi.outputs[0].sendClock()).to.equal(WebMidi.outputs[0]);
    });

  });

  describe('sendContinue()', function () {

    it("should return the Output object for method chaining", function() {
      expect(WebMidi.outputs[0].sendContinue()).to.equal(WebMidi.outputs[0]);
    });

  });

  describe('sendControlChange()', function () {

    it("should return the Output object for method chaining", function() {
      expect(WebMidi.outputs[0].sendControlChange("brightness", 0)).to.equal(WebMidi.outputs[0]);
    });

    it("should throw an error if value is out of range", function() {

      [-1, 120, "xxx"].forEach(function (param) {
        expect(function () {
          WebMidi.outputs[0].sendControlChange("bankselectcoarse", param);
        }).to.throw(Error);
      });

    });

  });

  describe('sendKeyAftertouch()', function () {

    it("should return the Output object for method chaining", function() {
      expect(WebMidi.outputs[0].sendKeyAftertouch("C#3", 1)).to.equal(WebMidi.outputs[0]);
    });

  });

  describe('sendPitchBend()', function () {

    it("should return the Output object for method chaining", function() {
      expect(WebMidi.outputs[0].sendPitchBend(0.75)).to.equal(WebMidi.outputs[0]);
    });

    it("should throw an error if bend value is out of range", function() {

      [-2, 17, NaN, Infinity].forEach(function (param) {
        expect(function () {
          WebMidi.outputs[0].sendPitchBend(param);
        }).to.throw(Error);
      });

    });

  });

  describe('sendSysex()', function () {

    it("should return the Output object for method chaining");

    it("should throw an error if a data value is out of rangte");

  });

  describe('setTuningProgram()', function () {

    it("should return the Output object for method chaining", function() {
      expect(WebMidi.outputs[0].setTuningProgram(64, 1)).to.equal(WebMidi.outputs[0]);
    });

    it("should throw an error if value is out of bounds", function() {

      [-1, 128, NaN, undefined, null, Infinity, -Infinity].forEach(function (param) {
        expect(function () {
          WebMidi.outputs[0].setTuningProgram(param, 1);
        }).to.throw(RangeError);
      });

    });

  });

  describe('stopNote()', function () {

    it("should return the Output object for method chaining", function() {
      expect(WebMidi.outputs[0].stopNote(64)).to.equal(WebMidi.outputs[0]);
    });

  });

});
