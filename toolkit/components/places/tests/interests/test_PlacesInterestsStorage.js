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

add_task(function test_PlacesInterestsStorage()
{
  yield promiseAddUrlInterestsVisit("http://www.cars.com/", ["cars","movies","shopping"], 2);
  yield promiseAddUrlInterestsVisit("http://www.samsung.com/", "consumer-electronics");
  yield promiseAddUrlInterestsVisit("http://www.mozilla.org/", "computers");

  // test promise returning results functionality
  yield getInterestsForHost("cars.com").then(function(results) {
    do_check_eq(results.length , 3);
    do_check_true(itemsHave(results,"cars"));
    do_check_true(itemsHave(results,"movies"));
    do_check_true(itemsHave(results,"shopping"));
  });

  yield getHostsForInterest("computers").then(function(results) {
    do_check_eq(results.length , 1);
    do_check_true(itemsHave(results,"mozilla.org"));
  });

  // make sure we are getting correct counts in the buckets
  yield PlacesInterestsStorage.getBucketsForInterests(["computers"]).then(function(results) {
    do_check_eq(results.computers.immediate , 1);
  });

  yield PlacesInterestsStorage.getBucketsForInterests(["cars"]).then(function(results) {
    do_check_eq(results.cars.immediate, 2);
  });

});

add_task(function test_PlacesInterestsStorageClearTables()
{
  // cleanup the tables
  yield PlacesInterestsStorage.clearRecentVisits(100);
  yield clearInterestsHosts();

  // check that tables are empty
  yield PlacesInterestsStorage.getBucketsForInterests(["computers"]).then(function(results) {
    do_check_eq(results.computers.immediate , 0);
    do_check_eq(results.computers.past , 0);
    do_check_eq(results.computers.recent , 0);
  });

  yield PlacesInterestsStorage.getBucketsForInterests(["cars"]).then(function(results) {
    do_check_eq(results.cars.immediate , 0);
    do_check_eq(results.cars.past , 0);
    do_check_eq(results.cars.recent , 0);
  });

  yield getInterestsForHost("cars.com").then(function(results) {
    do_check_eq(results.length, 0);
  });

  // make a bunch of insertions for a number of days
  for(let i = 0; i < 100; i++) {
    yield promiseAddUrlInterestsVisit("http://www.cars.com/", "cars", 1, i);
  }

  yield PlacesInterestsStorage.getBucketsForInterests(["cars"]).then(function(results) {
    do_check_eq(results.cars.immediate , 14);
    do_check_eq(results.cars.recent , 14);
    do_check_eq(results.cars.past , 72);
  });

  yield getHostsForInterest("cars").then(function(results) {
    do_check_eq(results.length , 1);
    do_check_eq(results[0] , "cars.com");
  });

  // test deletions
  yield PlacesInterestsStorage.clearRecentVisits(14);

  yield PlacesInterestsStorage.getBucketsForInterests(["cars"]).then(function(results) {
    do_check_eq(results.cars.immediate , 0);
    do_check_eq(results.cars.recent , 14);
    do_check_eq(results.cars.past , 72);
  });

  yield getHostsForInterest("cars").then(function(results) {
    do_check_eq(results.length , 1);
    do_check_eq(results[0] , "cars.com");
  });

  yield PlacesInterestsStorage.clearRecentVisits(28);

  yield PlacesInterestsStorage.getBucketsForInterests(["cars"]).then(function(results) {
    do_check_eq(results.cars.immediate , 0);
    do_check_eq(results.cars.recent , 0);
    do_check_eq(results.cars.past , 72);
  });

  yield PlacesInterestsStorage.clearRecentVisits(50);

  yield PlacesInterestsStorage.getBucketsForInterests(["cars"]).then(function(results) {
    do_check_eq(results.cars.immediate , 0);
    do_check_eq(results.cars.recent , 0);
    do_check_eq(results.cars.past , 50);
  });

  yield PlacesInterestsStorage.clearRecentVisits(100);

  yield PlacesInterestsStorage.getBucketsForInterests(["cars"]).then(function(results) {
    do_check_eq(results.cars.immediate , 0);
    do_check_eq(results.cars.recent , 0);
    do_check_eq(results.cars.past , 0);
  });

  yield PlacesInterestsStorage.clearRecentVisits(100);

  // test visitCounts when adding visits

  // add one today
  yield promiseAddInterestVisits("cars");
  yield PlacesInterestsStorage.getBucketsForInterests(["cars"]).then(function(results) {
    do_check_eq(results.cars.immediate , 1);
    do_check_eq(results.cars.recent , 0);
    do_check_eq(results.cars.past , 0);
  });

  // add a couple more yesterday
  yield promiseAddInterestVisits("cars", 4, 1);
  yield PlacesInterestsStorage.getBucketsForInterests(["cars"]).then(function(results) {
    do_check_eq(results.cars.immediate , 5);
    do_check_eq(results.cars.recent , 0);
    do_check_eq(results.cars.past , 0);
  });

  // add some in the recent bucket, some in the past
  // recent assumed to be 14-28 days ago, past > 28 days
  yield promiseAddInterestVisits("cars", 3, 15);
  yield promiseAddInterestVisits("cars", 10, 31);
  yield PlacesInterestsStorage.getBucketsForInterests(["cars"]).then(function(results) {
    do_check_eq(results.cars.immediate , 5);
    do_check_eq(results.cars.recent , 3);
    do_check_eq(results.cars.past , 10);
  });

  yield clearInterestsHosts();
  yield getInterestsForHost("cars.com").then(function(results) {
    do_check_eq(results.length, 0);
  });

});

add_task(function test_PlacesInterestsStorageResubmitHistory()
{
  const MICROS_PER_DAY = 86400000000;
  let now = Date.now();
  let microNow = now * 1000;
  yield promiseClearHistory();
  yield promiseAddVisits({uri: NetUtil.newURI("http://www.cars.com/"), visitDate: microNow});
  yield promiseAddVisits({uri: NetUtil.newURI("http://www.cars.com/"), visitDate: microNow - MICROS_PER_DAY});
  yield promiseAddVisits({uri: NetUtil.newURI("http://www.cars.com/"), visitDate: microNow - MICROS_PER_DAY});
  yield promiseAddVisits({uri: NetUtil.newURI("http://www.cars.com/"), visitDate: microNow - 2*MICROS_PER_DAY});
  yield promiseAddVisits({uri: NetUtil.newURI("http://www.cars.com/"), visitDate: microNow - 2*MICROS_PER_DAY});
  yield promiseAddVisits({uri: NetUtil.newURI("http://www.cars.com/"), visitDate: microNow - 2*MICROS_PER_DAY});

  let results = {};

  yield PlacesInterestsStorage.getRecentHistory(3, function(oneRecord) {
    // make sure oneRecord looks kosher
    do_check_eq(oneRecord.url, "http://www.cars.com/");
    do_check_eq(oneRecord.title, "test visit for http://www.cars.com/");
    do_check_true(oneRecord.visitDate != null);
    do_check_true(oneRecord.visitCount != null);
    results[oneRecord.visitDate] = oneRecord.visitCount;
  }).then(function() {
    // make sure we have:
    // 3 visits for 2 days ago
    // 2 visits for 1 day ago
    // 1 visit for today
    do_check_eq(Object.keys(results).length, 3);
    do_check_eq(results["" + PlacesInterestsStorage._getRoundedTime(now)], 1);
    do_check_eq(results["" + PlacesInterestsStorage._getRoundedTime(now-MICROS_PER_DAY/1000)], 2);
    do_check_eq(results["" + PlacesInterestsStorage._getRoundedTime(now-2*MICROS_PER_DAY/1000)], 3);
  });

});
