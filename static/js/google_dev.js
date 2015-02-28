var RAW_EVENTS_LIST = [];
var PROGRESS_TOTAL = 0;
var PROGRESS_CURRENT = 0;
var USER = {};

var helper = (function() {
var BASE_API_PATH = 'calendar/v3/';
return {
  /**
   * Hides the sign in button and starts the post-authorization operations.
   *
   * @param {Object} authResult An Object which contains the access token and
   *   other authentication information.
   */
  onSignInCallback: function(authResult) {

    //LOAD CALENDAR API
    gapi.client.load('calendar','v3').then(function() {

      if (authResult['access_token']) {

        //if not already in, redirect to charts page
        if (window.location.pathname == '/'){
            window.location = '/in';
        }

        //show logged-in part of page
        $("html, body").animate({ scrollTop: 0 }, 200);
        $('#progress').show('slow'); 
        //hide login part
        $('#gConnect').hide();
        //reset progress
        PROGRESS_CURRENT = 0;
        //process calendar data
        helper.handleCalendar();

      } else if (authResult['error']) {
        //go to login page if not there already
        if (window.location.pathname != '/'){
            window.location = '/';
        }

        $('#authOps').hide('slow');
        $('#gConnect').show();
        $("html, body").animate({ scrollTop: 0 }, 200);
      }

    });

    //LOAD GOOGLE PLUS API
    gapi.client.load('plus','v1').then(function() {
      
      if (authResult['access_token']) {
        helper.people();

      } else if (authResult['error']) {
        // There was an error, which means the user is not signed in.
        // As an example, you can handle by writing to the console:
        console.log('There was an error: ' + authResult['error']);
        $('#authResult').append('Logged out');
        $('#authOps').hide('slow');
        $('#gConnect').show();
        $("html, body").animate({ scrollTop: 0 }, 200);

      }
      
    });

  },

  /**
   * Calls the OAuth2 endpoint to disconnect the app for the user.
   */
  disconnect: function() {
    // Revoke the access token.
    $.ajax({
      type: 'GET',
      url: 'https://accounts.google.com/o/oauth2/revoke?token=' +
          gapi.auth.getToken().access_token,
      async: false,
      contentType: 'application/json',
      dataType: 'jsonp',
      success: function(result) {
        console.log('revoke response: ' + result);
        window.location.replace("/");
        $('#authOps').hide();
        $('#dashboard_div').css('visibility', 'hidden');
        $('#gConnect').show();
      },
      error: function(e) {
        console.log(e);
      }
    });
  },

  /**
   * Gets profile info
   */
  people: function() {
    gapi.client.plus.people.get( {'userId' : 'me'} ).then(function(res) {
      $('#greeting h2').html('Hello ' + res.result.name.givenName+"!   ")
        .append('<button id="disconnect" class="btn btn-default" type="button" style="position: absolute; right: 13px;">Log Off</button>');
      $('#disconnect').click(helper.disconnect);
      USER['givenName'] = res.result.name.givenName;
      USER['fullName'] = res.result.displayName;
      USER['email'] = res.result.emails[0].value;

      //Log and email user
      $.post('/database',{
        'givenname':USER.givenName, 
        'email': USER.email, 
        'fullname': USER.fullName
        }, function( data ) {console.log( data );});

    });

  },

  getEvents: function(calid, nextPageToken){
    gapi.client.calendar.events.list({'calendarId': calid, 'pageToken': nextPageToken, 'maxResults': 2500}).then(function(res) {
      
      //loop through events and add calendar names and ids
      event_sublist = res.result.items;
      for (var j = 0; j < event_sublist.length; j++) {
        event_sublist[j].calendarname = res.result.summary;
      }

      //add events to long list //long life
      RAW_EVENTS_LIST = RAW_EVENTS_LIST.concat(event_sublist);

      //recursive for long calendar event lists
      if (res.result.nextPageToken != null){
        helper.getEvents(calid, res.result.nextPageToken);
        console.log('next page: '+res.result.nextPageToken);
      }else{
        //report progress
        PROGRESS_CURRENT += 1;
        $(".progress-bar").attr('style','width:'+(100*PROGRESS_CURRENT/PROGRESS_TOTAL)+"%");

        if (PROGRESS_CURRENT >= PROGRESS_TOTAL){
          $("#progress").hide();
          $("html, body").animate({ scrollTop: 0 }, 200);
          $('#authOps').show('slow');
          CalendarSelect();

        }
      }//END recursive check

    }, function(err) {
          var error = err.result;
          //TODO error message
        });
  },

  /**
   * Gets Calendar data
   */
  handleCalendar: function(){

    //get calendar ids
    gapi.client.calendar.calendarList.list().then(function(res) {

      //loop through calendar ids
      var ids = res.result.items;

      PROGRESS_TOTAL = ids.length;

      for (var i = 0; i < ids.length; i++) {
        helper.getEvents(ids[i].id, null);
      }//END looping through ids

    }, function(err) {
      var error = err.result;
      //TODO Error Message
    });

  }//END profile function
};
})();





/**
* jQuery initialization
*/
$(document).ready(function() {
  //nothing
});

/**
* Calls the helper method that handles the authentication flow.
*
* @param {Object} authResult An Object which contains the access token and
*   other authentication information.
*/
function onSignInCallback(authResult) {
  helper.onSignInCallback(authResult);
}
