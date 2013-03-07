/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

try{
  importScripts("interestsTextClassifier.js");
}catch(ex){dump("ERROR file:" + ex.fileName + " line:" + ex.lineNumber + " message:" + ex.message);}

function InterestsWorkerError(message) {
    this.name = "InterestsWorkerError";
    this.message = message || "InterestsWorker has errored";
}
InterestsWorkerError.prototype = new Error();
InterestsWorkerError.prototype.constructor = InterestsWorkerError;

let gTokenizer = null;
let gClassifier = null;
let gInterestsData = null;
const kSplitter = /[^-\w\xco-\u017f\u0380-\u03ff\u0400-\u04ff]+/;

// bootstrap the worker with data and models
function bootstrap(aMessageData) {
  //expects : {interestsData, interestsDataType, interestsClassifierModel, interestsUrlStopwords}
  gTokenizer = new PlaceTokenizer(aMessageData.interestsUrlStopwords);
  gClassifier = new NaiveBayesClassifier(aMessageData.interestsClassifierModel);

  swapRules(aMessageData, true);

  self.postMessage({
    message: "bootstrapComplete"
  });
}

// swap out rules
function swapRules({interestsData, interestsDataType}, noPostMessage) {
  if (interestsDataType == "dfr") {
    gInterestsData = interestsData;
  }

  if(!noPostMessage) {
    // only post message if value is true, i.e. it was intentionally passed
    self.postMessage({
      message: "swapRulesComplete"
    });
  }
}

// classify a page using rules
function ruleClassify({host, language, tld, metaData, path, title, url}) {
  if (gInterestsData == null) {
    throw new InterestsWorkerError("interestData not loaded");
  }
  let interests = [];
  let hostKeys = (gInterestsData[host]) ? Object.keys(gInterestsData[host]).length : 0;
  let tldKeys = (host != tld && gInterestsData[tld]) ? Object.keys(gInterestsData[tld]).length : 0;

  if (hostKeys || tldKeys) {
    // process __HOST first
    if (hostKeys && gInterestsData[host]["__HOST"]) {
      interests = interests.concat(gInterestsData[host]["__HOST"]);
      hostKeys--;
    }
    if (tldKeys && gInterestsData[tld]) {
      interests = interests.concat(gInterestsData[tld]["__HOST"]);
      tldKeys--;
    }

    // process keywords
    if (hostKeys || tldKeys) {
      // Split on non-dash, alphanumeric, latin-small, greek, cyrillic
      let words = (url + " " + title).toLowerCase().split(kSplitter);

      let matchedAllTokens = function(tokens) {
        return tokens.every(function(word) {
          return words.indexOf(word) != -1;
        });
      }

      let processDFRKeys = function(hostObject) {
        Object.keys(hostObject).forEach(function(key) {
          if (key != "__HOST" && matchedAllTokens(key.split(kSplitter))) {
            interests = interests.concat(hostObject[key]);
          }
        });
      }

      if (hostKeys) processDFRKeys(gInterestsData[host]);
      if (tldKeys) processDFRKeys(gInterestsData[tld]);
    }
  }
  return interests;
}

// classify a page using text
function textClassify({url, title}) {
  if (gTokenizer == null || gClassifier == null) {
    throw new InterestsWorkerError("interest classifier not loaded");
  }

  let tokens = gTokenizer.tokenize(url, title);
  let interest = gClassifier.classify(tokens);

  if (interest != null) {
    return [interest];
  }
  return [];
}

// Figure out which interests are associated to the document
function getInterestsForDocument(aMessageData) {
  let interests = ruleClassify(aMessageData);
  if (interests.length == 0) {
    // fallback to text classification
    interests = textClassify(aMessageData);
  }

  // remove duplicates
  if(interests.length > 1) {
    // insert interests into hash and reget the keys
    let theHash = {};
    interests.forEach(function(aInterest) {
      if(!theHash[aInterest]) {
        theHash[aInterest]=1;
      }
    });
    interests = Object.keys(theHash);
  }

  // Respond with the interests for the document
  self.postMessage({
    host: aMessageData.host,
    interests: interests,
    message: "InterestsForDocument",
    url: aMessageData.url
  });
}

// Classify document via text only
function getInterestsForDocumentText(aMessageData) {
  let interests = textClassify(aMessageData);

  // Respond with the interests for the document
  self.postMessage({
    host: aMessageData.host,
    interests: interests,
    message: "InterestsForDocumentText",
    url: aMessageData.url
  });
}

// Classify document via rules only
function getInterestsForDocumentRules(aMessageData) {
  let interests = ruleClassify(aMessageData);

  // Respond with the interests for the document
  self.postMessage({
    host: aMessageData.host,
    interests: interests,
    message: "InterestsForDocumentRules",
    url: aMessageData.url
  });
}

// Dispatch the message to the appropriate function
self.onmessage = function({data}) {
  self[data.message](data);
};
