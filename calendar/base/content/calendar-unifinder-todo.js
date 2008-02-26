/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is OEone Calendar Code, released October 31st, 2001.
 *
 * The Initial Developer of the Original Code is
 * OEone Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): Garth Smedley <garths@oeone.com>
 *                 Mike Potter <mikep@oeone.com>
 *                 Chris Charabaruk <coldacid@meldstar.com>
 *                 Colin Phillips <colinp@oeone.com>
 *                 ArentJan Banck <ajbanck@planet.nl>
 *                 Curtis Jewell <csjewell@mail.freeshell.org>
 *                 Eric Belhaire <eric.belhaire@ief.u-psud.fr>
 *                 Mark Swaffer <swaff@fudo.org>
 *                 Michael Buettner <michael.buettner@sun.com>
 *                 Philipp Kewisch <mozilla@kewis.ch>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/**
 *   Called when the calendar is loaded
 */

function prepareCalendarToDoUnifinder() {
    const kSUNBIRD_ID = "{718e30fb-e89b-41dd-9da7-e25a45638b28}";
    var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
                            .getService(Components.interfaces.nsIXULAppInfo);
    if (appInfo.ID == kSUNBIRD_ID) {
        document.getElementById("todo-label").removeAttribute("collapsed");
    }
    toDoUnifinderRefresh();
}

/**
 *   Called by event observers to update the display
 */

function toDoUnifinderRefresh() {
    // Set up hiding completed tasks for the unifinder-todo tree
    var hideCompleted = document.getElementById("hide-completed-checkbox").checked;
    var tree = document.getElementById("unifinder-todo-tree");
    tree.hideCompleted = hideCompleted;
    tree.refresh();

    var deck = getViewDeck();
    var curview = currentView();
    var currentViewHideCompleted = !curview.showCompleted;
    var selectedDay = getSelectedDay();

    // Set up show completed for each view
    for each (var view in deck.childNodes) {
        view.showCompleted = !hideCompleted;
    }

    // Only update view if hide completed has actually changed and tasks are
    // visible in the view.
    if (selectedDay &&
        currentViewHideCompleted != hideCompleted &&
        curview.tasksInView) {
        deck.selectedPanel.goToDay(selectedDay);
    }
}

function getToDoFromEvent(event) {
   return document.getElementById(
      "unifinder-todo-tree").getTaskFromEvent(event);
}
