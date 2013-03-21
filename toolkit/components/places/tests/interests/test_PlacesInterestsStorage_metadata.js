/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/PlacesInterestsStorage.jsm");

function run_test() {
  run_next_test();
}

add_task(function test_PlacesInterestsStorage_getMetaForInterests()
{
  yield PlacesInterestsStorage.addInterest("cars");
  yield PlacesInterestsStorage.addInterest("movies");

  // code lifted from: https://github.com/prettycode/Object.identical.js
  function isIdentical(expected, actual, sortArrays) {
    function sort(object) {
      if (sortArrays == true && Array.isArray(object)) {
        return object.sort();
      }
      else if (typeof object != "object" || object == null) {
        return object;
      }
      return Object.keys(object).sort().map(function(key) {
        return {
          key: key,
          value: sort(object[key])
        };
      });
    }
    do_check_eq(JSON.stringify(sort(expected)), JSON.stringify(sort(actual)));
  }

  let results;

  // empty array
  results = yield PlacesInterestsStorage.getMetaForInterests([]);
  isIdentical([], results);

  // non-existent interest cases
  results = yield PlacesInterestsStorage.getMetaForInterests(["eccentricity"])
  isIdentical([], results);

  results = yield PlacesInterestsStorage.getMetaForInterests(["eccentricity", "quixotic"])
  isIdentical([], results);

  // INSERT works. create meta table entry, with no data given
  // for custom rules, this is what we will use to signal the need to download them
  let todayTime = PlacesInterestsStorage._getRoundedTime();
  results = yield PlacesInterestsStorage.getMetaForInterests(["cars"])
  isIdentical([], results);
  yield PlacesInterestsStorage.setMetaForInterest("cars");
  results = yield PlacesInterestsStorage.getMetaForInterests(["cars"])
  isIdentical([{threshold: null, duration: null, ignored: false, dateUpdated: todayTime}], results);

  // updates work as expected
  yield PlacesInterestsStorage.setMetaForInterest("cars", {threshold: 5, duration: 15, ignored: true, dateUpdated: 0});
  results = yield PlacesInterestsStorage.getMetaForInterests(["cars"])
  isIdentical([{threshold: 5, duration: 15, ignored: true, dateUpdated: 0}], results);

  // null for option does not change anything
  yield PlacesInterestsStorage.setMetaForInterest("cars", {threshold: null, duration: null, ignored: null, dateUpdated: null});
  results = yield PlacesInterestsStorage.getMetaForInterests(["cars"])
  isIdentical([{threshold: 5, duration: 15, ignored: true, dateUpdated: 0}], results);

  // not specifying dateUpdate sets today's update time
  yield PlacesInterestsStorage.setMetaForInterest("cars", {duration: 7});
  results = yield PlacesInterestsStorage.getMetaForInterests(["cars"])
  isIdentical([{threshold: 5, duration: 7, ignored: true, dateUpdated: todayTime}], results);

  // not giving any options set today's update time
  yield PlacesInterestsStorage.setMetaForInterest("cars", {threshold: 0, duration: 0, ignored: false, dateUpdated: 0});
  results = yield PlacesInterestsStorage.getMetaForInterests(["cars"])
  isIdentical([{threshold: 0, duration: 0, ignored: false, dateUpdated: 0}], results);
  yield PlacesInterestsStorage.setMetaForInterest("cars");
  results = yield PlacesInterestsStorage.getMetaForInterests(["cars"])
  isIdentical([{threshold: 0, duration: 0, ignored: false, dateUpdated: todayTime}], results);


  // INSERT cases

  // calling with an interest that doesn't exist
  yield PlacesInterestsStorage.setMetaForInterest("idontexist", {});
  results = yield PlacesInterestsStorage.getMetaForInterests(["idontexist"]);
  isIdentical([], results);

  // inserting with parameters works
  let todayTime = PlacesInterestsStorage._getRoundedTime();
  results = yield PlacesInterestsStorage.getMetaForInterests(["movies"]);
  isIdentical([], results);
  yield PlacesInterestsStorage.setMetaForInterest("movies", {threshold:14, duration: 5});
  results = yield PlacesInterestsStorage.getMetaForInterests(["movies"])
  isIdentical([{threshold: 14, duration: 5, ignored: false, dateUpdated: todayTime}], results);
});
