/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

subscriptLoader.loadSubScript("resource://gre/modules/ril_consts.js", this);

function run_test() {
  run_next_test();
}

const PIN = "0000";
const NEW_PIN = "1234";

/**
 * Helper function.
 */
function newUint8Worker() {
  let worker = newWorker();
  let index = 0; // index for read
  let buf = [];

  worker.Buf.writeUint8 = function (value) {
    buf.push(value);
  };

  worker.Buf.readUint8 = function () {
    return buf[index++];
  };

  worker.Buf.seekIncoming = function (offset) {
    index += offset;
  };

  worker.debug = do_print;

  return worker;
}

add_test(function test_change_call_barring_password() {
  let worker = newUint8Worker();
  let buf = worker.Buf;

  function do_test(facility, pin, newPin) {
    buf.sendParcel = function fakeSendParcel () {
      // Request Type.
      do_check_eq(this.readUint32(), REQUEST_CHANGE_BARRING_PASSWORD);

      // Token : we don't care.
      this.readUint32();

      let parcel = this.readStringList();
      do_check_eq(parcel.length, 3);
      do_check_eq(parcel[0], facility);
      do_check_eq(parcel[1], pin);
      do_check_eq(parcel[2], newPin);
    };

    let options = {facility: facility, pin: pin, newPin: newPin};
    worker.RIL.changeCallBarringPassword(options);
  }

  do_test(ICC_CB_FACILITY_BA_ALL, PIN, NEW_PIN);

  run_next_test();
});

add_test(function test_check_change_call_barring_password_result() {
  let barringPasswordOptions;
  let worker = newWorker({
    postMessage: function fakePostMessage(message) {
      do_check_eq(barringPasswordOptions.pin, PIN);
      do_check_eq(barringPasswordOptions.newPin, NEW_PIN);
      do_check_eq(message.errorMsg, GECKO_ERROR_SUCCESS);
    }
  });

  worker.RIL.changeCallBarringPassword =
    function fakeChangeCallBarringPassword(options) {
      barringPasswordOptions = options;
      worker.RIL[REQUEST_CHANGE_BARRING_PASSWORD](0, {
        rilRequestError: ERROR_SUCCESS
      });
    }

  worker.RIL.changeCallBarringPassword({pin: PIN, newPin: NEW_PIN});

  run_next_test();
});
