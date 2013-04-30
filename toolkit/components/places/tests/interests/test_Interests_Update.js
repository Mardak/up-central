/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/PlacesInterestsStorage.jsm");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");

let iServiceObject = Cc["@mozilla.org/places/interests;1"].getService(Ci.nsISupports).wrappedJSObject;
let iServiceApi = Cc["@mozilla.org/InterestsWebAPI;1"].createInstance(Ci.mozIInterestsWebAPI)
let obsereverService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);

function run_test() {
  startHttpServer();
  run_next_test();
}

let httpUpdateObject = {};

function setUpServerResponseForNamespace(namespace,locale) {
  let fullQualifier = locale + "/" + namespace;
  createJSONPathHandler("/api/v0/rules/" + fullQualifier,
    function(request,response) {
      try {
        httpUpdateObject[fullQualifier].ifModifiedSince = request.hasHeader("If-Modified-Since") ?
                                                          request.getHeader("If-Modified-Since") :
                                                          undefined;
        let status = httpUpdateObject[fullQualifier].status || 200;
        let ifr = httpUpdateObject[fullQualifier].ifr || {};
        let lastModified = httpUpdateObject[fullQualifier].lastModified || 0;
        let message = httpUpdateObject[fullQualifier].message || "OK";
        response.setStatusLine("1.1" , status , message);
        // no cache on the client
        response.setHeader("Cache-Control", "no-cache, must-revalidate");
        if (lastModified) {
          response.setHeader("Last-Modified",
                             iServiceObject._miliSecondsToRFC2822(lastModified));
        }
        response.write(ifr);
      } catch (ex) {
        dump( ex + " ERROR in response\n");
      }
  });
}

let enIFR1 = {
  "en/foo/cars": {
    "matches" : [{"domains": ["ford.com"]}],
    "threshold" : 1,
    "duration" : 100,
    "serverId": 1
  },
  "en/foo/pets": {
    "matches" : [{"domains": ["pets.com"]}],
    "threshold" : 20,
    "duration" : 200,
    "serverId": 2
  }
};

add_task(function test_NamespaceUpdate() {

  let lastModifiedMiliSeconds = iServiceObject._RFC2822ToMilliSeconds("Tue, 15 Nov 1994 12:45:26 GMT");
  do_check_eq(lastModifiedMiliSeconds,784903526000);
  do_check_eq(iServiceObject._miliSecondsToRFC2822(784903526000),"Tue, 15 Nov 1994 12:45:26 GMT");
  yield PlacesInterestsStorage.addNamespace("foo","en",0);
  setUpServerResponseForNamespace("foo","en");

  httpUpdateObject["en/foo"] = {};
  httpUpdateObject["en/foo"].status = 200;
  httpUpdateObject["en/foo"].ifr = JSON.stringify(enIFR1);
  httpUpdateObject["en/foo"].lastModified = lastModifiedMiliSeconds;

  // make sure that we throw because Server URI has not been set yet
  yield iServiceObject._updateNamespaces().then(results => {
    do_check_true(results == null);
  },
  error => {
    do_check_eq(error,"Empty URI for Interest Update Server");
  });

  dump("HERE \n");
  Services.prefs.setCharPref("interests.updateServerURI","http://localhost:4444")

  yield iServiceObject._updateNamespaces();
  dump("HERE \n");

  // make sure If-Modified-Since arrived as expected
  do_check_eq(httpUpdateObject["en/foo"].ifModifiedSince,undefined);

  yield PlacesInterestsStorage.getInterests(["pets", "cars"]).then(results => {
    do_check_eq(results.cars.threshold,1);
    do_check_eq(results.cars.duration,100);
    do_check_eq(results.pets.threshold,20);
    do_check_eq(results.pets.duration,200);
  });

  yield PlacesInterestsStorage.getAllIFRs().then(results => {
    isIdentical(results,[ {
                           "namespace":"foo",
                           "locale":"en",
                           "interest":"cars",
                           "dateUpdated":784903526000,
                           "ifr":[{"domains":["ford.com"]}],
                           "serverId":1
                          },
                          {
                            "namespace":"foo",
                            "locale":"en",
                            "interest":"pets",
                            "dateUpdated":784903526000,
                            "ifr":[{"domains":["pets.com"]}],
                            "serverId":2
                           }]);
  });

  delete enIFR1["en/foo/pets"];
  enIFR1["en/foo/cars"].matches = {"a":1};
  enIFR1["en/foo/cars"].threshold = 11;
  enIFR1["en/foo/cars"].duration = 110;

  lastModifiedMiliSeconds = iServiceObject._RFC2822ToMilliSeconds("Wed, 16 Nov 1994 12:45:27 GMT");
  do_check_eq(lastModifiedMiliSeconds,784989927000);
  do_check_eq(iServiceObject._miliSecondsToRFC2822(784989927000),"Wed, 16 Nov 1994 12:45:27 GMT");

  httpUpdateObject["en/foo"].status = 206;
  httpUpdateObject["en/foo"].ifr = JSON.stringify(enIFR1);
  httpUpdateObject["en/foo"].lastModified = lastModifiedMiliSeconds;

  yield iServiceObject._updateNamespaces();

  // make sure the namespace update date is 5000
  yield PlacesInterestsStorage.getNamespaces().then(results => {
    do_check_eq(results[0].namespace,"foo");
    do_check_eq(results[0].locale,"en");
    do_check_eq(results[0].lastModified,784989927000);
  });

  yield PlacesInterestsStorage.
    getInterests(["pets","cars"]).then(results => {
    do_check_eq(results.cars.threshold,11);
    do_check_eq(results.cars.duration,110);
    do_check_eq(results.pets.threshold,20);
    do_check_eq(results.pets.duration,200);
  });

  yield PlacesInterestsStorage.
    getAllIFRs().then(results => {
    isIdentical(results.sort((a,b) => a.interest.localeCompare(b.interest))
                         ,[ {
                           "namespace":"foo",
                           "locale":"en",
                           "interest":"cars",
                           "dateUpdated":784989927000,
                           "ifr":{"a":1},
                           "serverId":1
                          },
                          {
                            "namespace":"foo",
                            "locale":"en",
                            "interest":"pets",
                            "dateUpdated":784989927000,
                            "ifr":[{"domains":["pets.com"]}],
                            "serverId":2
                           }],true);
  });

  // test 200 that should cause deletion of non-existent rules
  lastModifiedMiliSeconds = iServiceObject._RFC2822ToMilliSeconds("Wed, 16 Nov 1994 13:45:28 GMT");
  do_check_eq(lastModifiedMiliSeconds,784993528000);
  do_check_eq(iServiceObject._miliSecondsToRFC2822(784993528000),"Wed, 16 Nov 1994 13:45:28 GMT");

  httpUpdateObject["en/foo"].status = 200;
  httpUpdateObject["en/foo"].ifr = JSON.stringify(enIFR1);
  httpUpdateObject["en/foo"].lastModified = lastModifiedMiliSeconds;

  yield iServiceObject._updateNamespaces();

  // try out the deletion of IFRs, this last flag will force deletion of rules
  // no mentioned in IFR, whose timestamp is less 7000
  yield PlacesInterestsStorage.getAllIFRs().then(results => {
    isIdentical(results ,[ {
                           "namespace":"foo",
                           "locale":"en",
                           "interest":"cars",
                           "dateUpdated":784993528000,
                           "ifr":{"a":1},
                           "serverId":1
                          }]);
  });

  // test 304,400, and 404 codes - they all should be ignored
  [304,400,404].forEach(function(code) {
    httpUpdateObject["en/foo"].status = code;
    yield iServiceObject._updateNamespaces();
    yield PlacesInterestsStorage.getAllIFRs().then(results => {
      isIdentical(results ,[ {
                             "namespace":"foo",
                             "locale":"en",
                             "interest":"cars",
                             "dateUpdated":784993528000,
                             "ifr":{"a":1},
                             "serverId":1
                            }]);
    });
  });

  // test namespace deletion
  httpUpdateObject["en/foo"].status = 410;
  yield iServiceObject._updateNamespaces();
  // now results should just empty
  yield PlacesInterestsStorage.getAllIFRs().then(results => {
    isIdentical(results ,[]);
  });


});

add_task(function test_common_terminate() {
  // Stop the HTTP server.  this should be the last task registered
  yield stopHttpServer();
});
