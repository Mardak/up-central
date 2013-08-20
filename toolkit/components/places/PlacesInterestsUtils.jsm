/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

this.EXPORTED_SYMBOLS = [
  "PlacesInterestsUtils",
];

const {classes: Cc, interfaces: Ci, results: Cr, utils: Cu} = Components;

Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "PlacesUtils", "resource://gre/modules/PlacesUtils.jsm");

const MS_PER_DAY = 86400000;

/**
 * Store the SQL statements used for this file together for easy reference
 */
const SQL = {
  getRecentHistory:
    "SELECT title, url, visitCount, visitDate " +
    "FROM moz_places " +
    "JOIN (SELECT place_id, " +
                 "COUNT(1) visitCount, " +
                 "visit_date/1000 - visit_date/1000 % :MS_PER_DAY visitDate " +
          "FROM moz_historyvisits " +
          "WHERE visit_date >= (:dayCutoff+1) * :MS_PER_DAY*1000 " +
          "GROUP BY place_id, visitDate) " +
    "ON place_id = id " +
    "WHERE hidden = 0 AND " +
          "visit_count > 0",
};

let PlacesInterestsUtils = {
  //////////////////////////////////////////////////////////////////////////////
  //// PlacesInterestsUtils

  /**
   * Fetch recent history visits to process by page and day of visit
   *
   * @param   daysAgo
   *          Number of days of recent history to fetch
   * @param   handlePageForDay
   *          Callback handling a day's visits for a page
   * @returns Promise for when all the recent pages have been processed
   */
  getRecentHistory: function PIS_getRecentHistory(daysAgo, handlePageForDay) {
    return this._execute(SQL.getRecentHistory, {
      columns: ["title", "url", "visitCount", "visitDate"],
      onRow: handlePageForDay,
      params: {
        dayCutoff: this._convertDateToDays() - daysAgo,
        MS_PER_DAY: MS_PER_DAY,
      },
    });
  },

  //////////////////////////////////////////////////////////////////////////////
  //// PlacesInterestsUtils Helpers

  /**
   * Convert a date to days since epoch
   *
   * @param   [optional] time
   *          Reference date/time defaulting to today
   * @returns Number of days since epoch to beginning of today UTC
   */
  _convertDateToDays: function PIS__convertDateToDays(time=null) {
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
   *          onRow: Function callback given the columns for each row
   *          params: Object of keys matching SQL :param to bind values
   * @returns Promise for when the statement completes with value dependant on
   *          the optional values passed in.
   */
  _execute: function PIS__execute(sql, optional={}) {
    let {columns, onRow, params} = optional;

    // Initialize the statement cache and the callback to clean it up
    if (this._cachedStatements == null) {
      this._cachedStatements = {};
      PlacesUtils.registerShutdownFunction(() => {
        Object.keys(this._cachedStatements).forEach(key => {
          this._cachedStatements[key].finalize();
        });
      });
    }

    // Use a cached version of the statement if handy; otherwise created it
    let statement = this._cachedStatements[sql];
    if (statement == null) {
      statement = this._db.createAsyncStatement(sql);
      this._cachedStatements[sql] = statement;
    }

    // Bind params if we have any
    if (params != null) {
      Object.keys(params).forEach(param => {
        statement.bindByName(param, params[param]);
      });
    }

    // Determine the type of result as nothing, a keyed object or array of columns
    let results;
    if (onRow != null) {}
    else if (columns != null) {
      results = [];
    }

    // Execute the statement and update the promise accordingly
    let deferred = Promise.defer();
    statement.executeAsync({
      handleCompletion: reason => {
        deferred.resolve(results);
      },

      handleError: error => {
        deferred.reject(new Error(error.message));
      },

      handleResult: resultSet => {
        let row;
        while (row = resultSet.getNextRow()) {
          // Read out the desired columns from the row into an object
          let result;
          if (columns != null) {
            // For just a single column, make the result that column
            if (columns.length == 1) {
              result = row.getResultByName(columns[0]);
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
          // Append the result in order
          else if (columns != null) {
            results.push(result);
          }
        }
      }
    });

    return deferred.promise;
  },
}

XPCOMUtils.defineLazyGetter(PlacesInterestsUtils, "_db", function() {
  return PlacesUtils.history.QueryInterface(Ci.nsPIPlacesDatabase).DBConnection;
});
