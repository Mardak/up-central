/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

this.EXPORTED_SYMBOLS = [
  "InterestsStorage",
];

const {classes: Cc, interfaces: Ci, results: Cr, utils: Cu} = Components;

Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/interests/InterestsDatabase.jsm");

const MS_PER_DAY = 86400000;

/**
 * Store the SQL statements used for this file together for easy reference
 */
const SQL = {
  addInterestHostVisit:
    "REPLACE INTO moz_interests_visits " +
    "SELECT id, " +
           "IFNULL(host, :host), " +
           "IFNULL(day, :day), " +
           "IFNULL(visits, 0) + IFNULL(:visits, 1) " +
    "FROM moz_interests " +
    "LEFT JOIN moz_interests_visits " +
    "ON interest_id = id AND " +
       "host = :host AND " +
       "day = :day " +
    "WHERE interest = :interest",

  clearRecentVisits:
    "DELETE FROM moz_interests_visits " +
    "WHERE day > :dayCutoff",

  getHostCountsForInterests:
    "SELECT interest, " +
           "COUNT(DISTINCT host) * " +
             "(NOT IFNULL(:checkSharable, 0) OR sharable) count " +
    "FROM moz_interests " +
    "LEFT JOIN moz_interests_visits " +
    "ON interest_id = id " +
    "WHERE interest IN (:interests) " +
    "GROUP BY id",

  getInterests:
    "SELECT * " +
    "FROM moz_interests " +
    "WHERE interest IN (:interests)",

  getRecentHostsForInterests:
    "SELECT interest, " +
           "host, " +
           "COUNT(day) AS days, " +
           "SUM(visits) AS visits " +
    "FROM moz_interests " +
    "JOIN moz_interests_visits " +
    "ON interest_id = id " +
    "WHERE interest IN (:interests) AND " +
          "day > :dayCutoff " +
    "GROUP BY interest, host " +
    "ORDER BY interest, days DESC, visits DESC",

  getScoresForInterests:
    "SELECT interest name, " +
           "COUNT(DISTINCT day) * " +
             "(NOT IFNULL(:checkSharable, 0) OR sharable) score " +
    "FROM moz_interests " +
    "LEFT JOIN moz_interests_visits " +
    "ON interest_id = id " +
    "WHERE interest IN (:interests) " +
    "GROUP BY id " +
    "ORDER BY score DESC",

  getScoresForNamespace:
    "SELECT interest name, " +
           "COUNT(DISTINCT day) * " +
             "(NOT IFNULL(:checkSharable, 0) OR sharable) score " +
    "FROM moz_interests " +
    "LEFT JOIN moz_interests_visits " +
    "ON interest_id = id " +
    "WHERE namespace = :namespace " +
    "GROUP BY id " +
    "ORDER BY score DESC " +
    "LIMIT IFNULL(:interestLimit, 5)",

  setInterest:
    "REPLACE INTO moz_interests " +
    "VALUES((SELECT id " +
            "FROM moz_interests " +
            "WHERE interest = :interest), " +
           ":interest, " +
           ":namespace, " +
           "IFNULL(:sharable, " +
                  "(SELECT sharable " +
                   "FROM moz_interests " +
                   "WHERE interest = :interest)))",

  setSharedInterest:
    "REPLACE INTO moz_interests_shared " +
    "VALUES((SELECT id " +
            "FROM moz_interests " +
            "WHERE interest = :interest), " +
           ":host, " +
           ":day) ",

  getHostsForSharedInterests:
    "SELECT interest, host, day " +
    "FROM moz_interests " +
    "LEFT JOIN moz_interests_shared " +
    "ON interest_id = id " +
    "WHERE interest IN (:interests) AND " +
          "host NOT NULL " +
    "ORDER BY interest, day DESC ",

  getPersonalizedHosts:
    "SELECT interest, host, day " +
    "FROM moz_interests_shared " +
    "LEFT JOIN moz_interests " +
    "ON interest_id = id " +
    "WHERE day >= :dayCutoff AND " +
          "host NOT NULL " +
    "ORDER BY day DESC, host ",

};

function InterestsStorage(connection) {
  this.dbConnection = connection;
}

InterestsStorage.prototype = {
  //////////////////////////////////////////////////////////////////////////////
  //// InterestsStorage

  /**
   * Increment or initialize the number of visits for an interest on a day
   *
   * @param   interest
   *          The full interest string with namespace
   * @param   host
   *          The host string to associate with the interest
   * @param   [optional] visitData {see below}
   *          visitCount: Number of visits to add defaulting to 1
   *          visitTime: Date/time to associate with the visit defaulting to now
   * @returns Promise for when the row is added/updated
   */
  addInterestHostVisit: function IS_addInterestHostVisit(interest, host, visitData={}) {
    let {visitCount, visitTime} = visitData;
    return this._execute(SQL.addInterestHostVisit, {
      params: {
        day: this._convertDateToDays(visitTime),
        host: host,
        interest: interest,
        visits: visitCount,
      },
    });
  },

  /**
   * Clear recent visits for all interests
   *
   * @param   daysAgo
   *          Number of recent days to be cleared
   * @returns Promise for when the visits are deleted
   */
  clearRecentVisits: function IS_clearRecentVisits(daysAgo) {
    return this._execute(SQL.clearRecentVisits, {
      params: {
        dayCutoff: this._convertDateToDays() - daysAgo,
      },
    });
  },

  /**
   * Count the number of hosts interests
   *
   * @param   interests
   *          Array of interest strings
   * @param   [optional] options {see below}
   *          checkSharable: Boolean for 0-count for unshared defaulting false
   * @returns Promise with each interest as keys on an object with host counts
   */
  getHostCountsForInterests: function IS_getHostCountsForInterests(interests, options={}) {
    let {checkSharable} = options;
    return this._execute(SQL.getHostCountsForInterests, {
      columns: "count",
      key: "interest",
      listParams: {
        interests: interests,
      },
      params: {
        checkSharable: checkSharable,
      },
    });
  },

  /**
   * Obtains interest metadata for a list of interests
   * @param   interests
              An array of interest names
   * @returns A promise with the interest metadata for each interest
   */
  getInterests: function IS_getInterests(interests) {
    return this._execute(SQL.getInterests, {
      columns: ["sharable"],
      key: "interest",
      listParams: {
        interests: interests,
      },
    });
  },

  /**
   * Fetch recently visited hosts for interests, ranked by frecency
   *
   * @param   interests
   *          Array of interest strings to select
   * @param   daysAgo
   *          Number of days of recent history to fetch
   * @returns Promise with hostname/last day visited as results
   */
  getRecentHostsForInterests: function IS_getRecentHostsForInterests(interests, daysAgo) {
    return this._execute(SQL.getRecentHostsForInterests, {
      columns: ["interest", "host", "days", "visits"],
      listParams: {
        interests: interests,
      },
      params: {
        dayCutoff: this._convertDateToDays() - daysAgo,
      },
    });
  },

  /**
   * Get a sorted array of interests by score
   *
   * @param   interests
   *          Array of interest strings to select
   * @param   [optional] options {see below}
   *          checkSharable: Boolean for 0-score for unshared defaulting false
   * @returns Promise with the array of interest names and scores
   */
  getScoresForInterests: function IS_getScoresForInterests(interests, options={}) {
    let {checkSharable} = options;
    return this._execute(SQL.getScoresForInterests, {
      columns: ["name", "score"],
      listParams: {
        interests: interests,
      },
      params: {
        checkSharable: checkSharable,
      },
    });
  },

  /**
   * Get a sorted array of top interests for a namespace by score
   *
   * @param   namespace
   *          Namespace string of interests in the namespace to select
   * @param   [optional] options {see below}
   *          checkSharable: Boolean for 0-score for unshared defaulting false
   *          interestLimit: Number of top interests to select defaulting to 5
   * @returns Promise with the array of interest names and scores
   */
  getScoresForNamespace: function IS_getScoresForNamespace(namespace, options={}) {
    let {checkSharable, interestLimit} = options;
    return this._execute(SQL.getScoresForNamespace, {
      columns: ["name", "score"],
      params: {
        checkSharable: checkSharable,
        interestLimit: interestLimit,
        namespace: namespace,
      },
    });
  },

  /**
   * Set (insert or update) metadata for an interest
   *
   * @param   interest
   *          Full interest name with namespace to set
   * @param   [optional] metadata {see below}
   *          sharable: Boolean user preference if the interest can be shared
   * @returns Promise for when the interest data is set
   */
  setInterest: function IS_setInterest(interest, metadata={}) {
    let {sharable} = metadata;
    return this._execute(SQL.setInterest, {
      params: {
        interest: interest,
        namespace: this._splitInterestName(interest)[0],
        sharable: sharable,
      },
    });
  },

  /**
   * Set (insert or update) an interest being shared with a domain
   *
   * @param   interest
   *          Full interest name with namespace to set
   * @param   host
   *          host of the site an interest was shared with
   * @param   [optional] visitTime
   *          time when an interest was shared with the site
   * @returns Promise for when the interest,domain pair is set
   */
  setSharedInterest: function IS_setSharedInterest(interest, host, visitTime) {
    return this._execute(SQL.setSharedInterest, {
      params: {
        interest: interest,
        host: host,
        day: this._convertDateToDays(visitTime),
      },
    });
  },

  /**
   * Get a sorted array of 'shared-with' domains by day of the visit for each interest
   *
   * @param   interests
   *          interests that were shared
   * @returns Promise with an array of {intrest,domains,day} objects
   */
  getHostsForSharedInterests: function IS_getHostsForSharedInterests(interests) {
    return this._execute(SQL.getHostsForSharedInterests, {
      columns: ["interest","host", "day"],
      listParams: {
        interests: interests,
      },
    });
  },

  /**
   * Get a sorted array of 'shared-with' domains,interests by day of the visit
   *
   * @param   daysAgo
   *          Number of days of history to fetch
   * @returns Promise with an array of {intrest,domains,day} objects
   */
  getPersonalizedHosts: function IS_getPersonalizedDomains(daysAgo) {
    return this._execute(SQL.getPersonalizedHosts, {
      columns: ["interest","host", "day"],
      params: {
        dayCutoff: this._convertDateToDays() - (daysAgo || 180),
      },
    });
  },

  //////////////////////////////////////////////////////////////////////////////
  //// InterestsStorage Helpers

  /**
   * Convert a date to days since epoch
   *
   * @param   [optional] time
   *          Reference date/time defaulting to today
   * @returns Number of days since epoch to beginning of today UTC
   */
  _convertDateToDays: function IS__convertDateToDays(time=null) {
    // Default to today and truncate to an integer number of days
    return Math.floor((time || Date.now()) / MS_PER_DAY);
  },

  /**
   * Execute a SQL statement with various options
   *
   * @param   sql
   *          The SQL statement to execute
   * @param   [optional] optional {see below}
   *          columns: Array of column strings to read for array format result
   *          key: Additional column string to trigger object format result
   *          listParams: Object to expand the key to a SQL list
   *          onRow: Function callback given the columns for each row
   *          params: Object of keys matching SQL :param to bind values
   * @returns Promise for when the statement completes with value dependant on
   *          the optional values passed in.
   */
  _execute: function IS__execute(sql, optional={}) {
    let {columns, key, listParams, onRow, params} = optional;

    // Convert listParams into params and the desired number of identifiers
    if (listParams != null) {
      params = params || {};
      Object.keys(listParams).forEach(listName => {
        let listIdentifiers = [];
        for (let i = 0; i < listParams[listName].length; i++) {
          let paramName = listName + i;
          params[paramName] = listParams[listName][i];
          listIdentifiers.push(":" + paramName);
        }

        // Replace the list placeholders with comma-separated identifiers
        sql = sql.replace(":" + listName, listIdentifiers, "g");
      });
    }
    // Determine the type of result as nothing, a keyed object or array of columns
    let results;
    if (onRow != null) {}
    else if (key != null) {
      results = {};
    }
    else if (columns != null) {
      results = [];
    }
    // execute cached sql statement
    return this.dbConnection.executeCached(sql, params, function (row) {
      // Read out the desired columns from the row into an object
      let result;
      if (columns != null) {
        // For just a single column, make the result that column
        if (typeof columns == "string") {
          result = row.getResultByName(columns);
        }
        // For multiple columns, put as valyes on an object
        else {
          result = {};
          columns.forEach(column => {
            result[column] = row.getResultByName(column);
          });
        }
      }

      // Give the packaged result to the handler
      if (onRow != null) {
        onRow(result);
      }
      // Store the result keyed on the result key
      else if (key != null) {
        results[row.getResultByName(key)] = result;
      }
      // Append the result in order
      else if (columns != null) {
        results.push(result);
      }
    }).then(() => {
      return results;
    });
  },

  /**
   * Extract the namespace from a fully-qualified interest name
   *
   * @param   interest
   *          Interest string in the namespace/name format
   * @returns [Namespace or empty string, interest name]
   */
  _splitInterestName: function IS__splitInterestName(interest) {
    let tokens = interest.split(":", 2);

    // Add an empty namespace if there was no ":"
    if (tokens.length < 2) {
      tokens.unshift("");
    }

    return tokens;
  },
}

