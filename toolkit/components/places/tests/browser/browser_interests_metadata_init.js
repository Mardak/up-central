/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const kInterestMetaInit = "interest-metadata-initialized";
const kInterests = ["arts", "banking", "blogging", "business", "career",
"cars", "clothes", "computers", "consumer-electronics", "cuisine", "dance",
"discounts", "drinks", "education", "email", "entertainment", "family",
"fashion", "finance", "food", "games", "government", "health", "history",
"hobby", "home", "image-sharing", "law", "maps", "marketing", "men",
"motorcycles", "movies", "music", "news", "outdoors", "pets", "photography",
"politics", "radio", "reading", "real-estate", "reference", "relationship",
"religion", "reviews", "science", "shoes", "shopping", "society", "sports",
"technology", "travel", "tv", "video-games", "weather", "women", "writing"];

function test() {

  waitForExplicitFinish();

  // tests if data is initialized upon init
  PlacesInterestsStorage.getInterests(kInterests).then(results => {
    ok(kInterests.length == Object.keys(results).length, "obtained correct number of interest metadata");
  }).then(finish);

} // end of test
