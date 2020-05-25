var markersArray = []; //global array to track all markers on current map 
var idhashmap = {}; //empty object to serve as "hashmap"
var restaurantchainsfound = {};
var socket = io.connect('http://localhost');
var numparses = 0;

var delay = (function() {
  var timer = 0;
  return function(callback, ms){
    clearTimeout (timer);
    timer = setTimeout(callback, ms);
  };
})();

//delay execution of API calls 
$('#custominput').keyup(function() {
  delay(main, 500);
});

function main() {
  var address = $('#locationinput').val();
  //use google maps to calculate longitude and latitude
  var geocoder = new google.maps.Geocoder();
  //geocoder.geocode({'address': location}, function(results, status) {
  geocoder.geocode( { 'address': address}, function(results, status) {
    map.setCenter(results[0].geometry.location);
    try {
      var location = results[0].geometry.location;
      //location.lat() and location.lng() contains lat and long.
      var input = $('#custominput').val();
      //clear all markers from map
      for (var i = 0; i < markersArray.length; i++ ) {
        markersArray[i].setMap(null);
      }
      markersArray = [];
      //clear all addresses stored in hashmap
      for (var member in idhashmap) {
        delete idhashmap[member];
      }
      //clear all restaurant chains found
      for (var member in restaurantchainsfound) {
        delete restaurantchainsfound[member];
      }
      $('#selectrestaurantchain').find('option').remove();
      //place custom marker to designate your current latitude/longitude as inputted
      var image = {url: 'marker-icon.png'};
      var marker = new google.maps.Marker({position: new google.maps.LatLng(location.lat(), location.lng()), map: map, icon: image, title:'You Are Here'});
      markersArray.push(marker);
      parseInput(input, location.lat(), location.lng());
      numparses++;
    }
    catch (err) {
      console.log("Invalid location: " + err);
    }
  });
}

function parseInput(input, latitude, longitude) {
  var startindex = 0;
  var wordsfound = [];
  var foundnewstart = false;
  //console.log("input length: " + input.length);
  //iterate through all keywords the user entered
  for (var i = 0; i <= input.length; i++) {
    //console.log("at: " + input[i] +" at index: " + i + ", foundnewstart: " + foundnewstart +", startindex: " + input[startindex]);
    //char found and looking for a new start index
    if (i === input.length) {
      //if a starting char was found for the word, push, otherwise only trailing whitespace
      if (foundnewstart === true) {
        wordsfound.push(input.substring(startindex, input.length));
        //console.log("pushed " + input.substring(startindex, input.length));
      }
    }
    else if (input[i] !== ' ' && input[i] !== '\t' && foundnewstart === false) {
      startindex = i;
      foundnewstart = true;
    }
    //if a space is found and you have a start index
    else if ((input[i] === ' ' || input[i] === '\t') && foundnewstart === true) {
      wordsfound.push(input.substring(startindex, i));
      //console.log("pushed " + input.substring(startindex, i));
      foundnewstart = false;
    }
  }
  $('.venueinfo').fadeOut("fast", function() {
    $(this).remove();
  });
  $(".venuedirections").fadeOut("fast", function() {
    $(this).remove();
  });
  $(".querydiv").fadeOut("fast", function() {
    $(this).remove();
  });
  $('.querylinkdiv').fadeOut("fast", function() {
    $(this).remove();
  });
  console.log(latitude, longitude);
  if (wordsfound.length > 1) {
    searchFullString(wordsfound, latitude, longitude);
  }
  /* loop through all keywords and execute JSON requests to foursquare server - requests stack up in callback functions so 
   * that they all occur in sequence. Requests allocated in separate function so that the JSON requests can
   * complete at their own pace and i doesn't increment too fast for them */
  var i = 0;
  for (var i = 0; i < wordsfound.length; i++) {
    $('#querycontainer').append('<div class="querydiv"> <p class="querydivtitle"> Query </p> <p class="querydivcontents">' + wordsfound[i] + '</p></div>');
    executeJSONChain(latitude, longitude, i, wordsfound);
  }
  checkForKeywordLinks(latitude, longitude, wordsfound);
}

/* This function checks user input for matches with tagged keywords linked to specific queries. 
 * Only call socket.on ONCE - the first time input is ever parsed. checkForKeywordLinks() is
 * repeatedly called to emit() every iteration, but calling socket.on() each iteration is bad, 
 * as this results in multiple functions executing simultaneously, each created every time 
 * socket.on() was executed. The emit() function sends the copy of wordsfound to the backend so that 
 * the backend can send an updated copy in response each time. This is necessary since the socket.on() 
 * method is only called once, so it's important to keep the words being passed around updated */
function checkForKeywordLinks(latitude, longitude, wordsfound) {
  socket.emit("getQueryLink", {"wordsfound":wordsfound, "type":"query"});
  if (numparses === 0) {
    socket.on("retrievedQueryLink", function(data) {
      var keywords = data.keywords;
      var chains = data.chains; //one entry in chains contains all restaurants linked to a single keyword as a string 
      /* Iterate through user inputted queries, checking if any of them match keywords in database */
      for (var i = 0; i < data.wordsfound.length; i++) {
        console.log("checking for keyword matching: " + data.wordsfound[i]);
        var index = $.inArray(data.wordsfound[i], keywords);
        //user query matches keyword, so execute queries for all chains corresponding to that keyword
        if (index !== -1) {
          console.log(data.wordsfound[i] + " is a keyword");
          //get all restaurant chains linking to keyword in single string, then parse single string so you can
          //iterate through each chain
          var chainstring = chains[index];
          var chainsarray = chainstring.split("~");
          for (var j = 0; j < chainsarray.length; j++) {
            $('#querycontainer').append('<div class="querydiv"> <p class="querydivtitle">Linked Query </p> <p class="querydivcontents">' + chainsarray[j] + '</p></div>');
            executeJSONChain(latitude, longitude, j, chainsarray);
          }
        }
      }
    });
  }
}

//this function executes chain of JSON queries based off certain parameters
function executeJSONChain(latitude, longitude, i, wordsfound) {
  //immediately store word for query then use it in all requests below
  var word = wordsfound[i];
  console.log("execute of i: " + i + ", so: " + word + " and length: " + wordsfound.length);
  $.getJSON('https://api.foursquare.com/v2/venues/search?ll=' + latitude + ',' + longitude + '&query=' + word + '&&radius=100000&&intent=browse&&client_id=GWVQS2E14ALKFVRJL02CPTYFIJRKPMQBNZJ1G3VO0BJTOYTR&client_secret=BGGMPSR1USREGDM0LHW4CDLOLMMZIRBLW4M4LW0ISPQ5CRIO&v=20130831', function(data) {
      console.log("search: " + word);
      parseJSON(data, 'venuesearch', latitude, longitude, wordsfound);
      $.getJSON('https://api.foursquare.com/v2/venues/explore?ll=' + latitude + ',' + longitude + '&query=' + word + '&&client_id=GWVQS2E14ALKFVRJL02CPTYFIJRKPMQBNZJ1G3VO0BJTOYTR&client_secret=BGGMPSR1USREGDM0LHW4CDLOLMMZIRBLW4M4LW0ISPQ5CRIO&v=20130831', function(data) {
        console.log("explore: " + word);
        parseJSON(data, 'venueexplore', latitude, longitude, wordsfound);
        $.getJSON('https://api.foursquare.com/v2/venues/suggestCompletion?ll=' + latitude + ',' + longitude + '&query=' + word + '&&client_id=GWVQS2E14ALKFVRJL02CPTYFIJRKPMQBNZJ1G3VO0BJTOYTR&client_secret=BGGMPSR1USREGDM0LHW4CDLOLMMZIRBLW4M4LW0ISPQ5CRIO&v=20130831', function(data) {
          console.log("suggest completion: " + word + " and i = " + i + " and length: " + wordsfound.length);
          console.log(data);
          //the restaurant chain select bar is only filled once all requests for all keywords have
          //finished
          if (i === (wordsfound.length - 1)) {
            console.log("filling chain");
            fillChainSelect();
          }
          });
        });
      });
}

/* place restaurant branch options into box */
function fillChainSelect() {
  $('#selectrestaurantchain').find('option').remove();
  $('#selectrestaurantchain').append('<option class="restaurantchainoption" value="Show All">Show All</option>');
  var tempmemberstorage = [];
  for (var member in restaurantchainsfound) {
    tempmemberstorage.push(member);
  }
  tempmemberstorage.sort();
  for (var i = 0; i < tempmemberstorage.length; i++) {
    $('#selectrestaurantchain').append('<option class="restaurantchainoption" value="' + tempmemberstorage[i] + '">' + tempmemberstorage[i] + '</option>');
  }
}

/* search entire user inputted query */
function searchFullString(wordsfound, latitude, longitude) {
  var fullstring = "";
  for (var l = 0; l < wordsfound.length; l++) {
    fullstring = fullstring + wordsfound[l];
  }
  $('#querycontainer').append('<div id="querydiv' + 0 + '" class="querydiv"> <p class="querydivtitle"> Query </p> <p class="querydivcontents">' + fullstring + '</p></div>');
  $.getJSON('https://api.foursquare.com/v2/venues/search?ll=' + latitude + ',' + longitude + '&query=' + fullstring + '&&radius=100000&&intent=browse&&client_id=GWVQS2E14ALKFVRJL02CPTYFIJRKPMQBNZJ1G3VO0BJTOYTR&client_secret=BGGMPSR1USREGDM0LHW4CDLOLMMZIRBLW4M4LW0ISPQ5CRIO&v=20130831', function(data) {
    parseJSON(data, 'venuesearch', latitude, longitude, wordsfound);
    $.getJSON('https://api.foursquare.com/v2/venues/explore?ll=' + latitude + ',' + longitude + '&query=' + fullstring + '&&client_id=GWVQS2E14ALKFVRJL02CPTYFIJRKPMQBNZJ1G3VO0BJTOYTR&client_secret=BGGMPSR1USREGDM0LHW4CDLOLMMZIRBLW4M4LW0ISPQ5CRIO&v=20130831', function(data) {
      parseJSON(data, 'venueexplore', latitude, longitude, wordsfound);
      $.getJSON('https://api.foursquare.com/v2/venues/suggestCompletion?ll=' + latitude + ',' + longitude + '&query=' + fullstring + '&&client_id=GWVQS2E14ALKFVRJL02CPTYFIJRKPMQBNZJ1G3VO0BJTOYTR&client_secret=BGGMPSR1USREGDM0LHW4CDLOLMMZIRBLW4M4LW0ISPQ5CRIO&v=20130831', function(data) {
        console.log(data);
      });
    });
  });
}

function parseJSON(data, apicall, latitude, longitude, wordsfound) {
  console.log(data);
  //arrays work around closure within for loop to allow for unique markers and content strings
  var markers = [];
  var contentStrings = [];
  var names = [];
  var placelatitudes = [];
  var placelongitudes = [];
  var venueids = [];
  if (apicall === 'venuesearch') {
    for (var k = 0; k < data.response.venues.length; k++) {
      var sitelat = data.response.venues[k].location.lat;
      var sitelng = data.response.venues[k].location.lng;
      placelatitudes.push(sitelat);
      placelongitudes.push(sitelng);
      var restaurantname = data.response.venues[k].name;
      var address = data.response.venues[k].location.address;
      var id = data.response.venues[k].id;
      //console.log(k + " search: " + address);
      //if the id hasn't yet been found, then go for it
      if ((id in idhashmap) === false) {
        idhashmap[id] = id;
        venueids.push(id);
        var city = data.response.venues[k].location.city;
        var state = data.response.venues[k].location.state;
        var country = data.response.venues[k].location.country;
        var distance = data.response.venues[k].location.distance;
        var url = data.response.venues[k].url;
        var phonenumber = data.response.venues[k].contact.formattedPhone;
        var checkins = data.response.venues[k].stats.checkinsCount;
        var usercount = data.response.venues[k].stats.usersCount;

        var marker = new google.maps.Marker({
          position: new google.maps.LatLng(sitelat, sitelng), map: map, title:restaurantname
        });
        markers.push(marker);
        markersArray.push(marker);
        names.push(restaurantname);
        //new restaurant branch found
        if ((restaurantname in restaurantchainsfound) === false) {
          restaurantchainsfound[restaurantname] = restaurantname;
        }

        var contentString = '<div id="content">' + '<div id="bodyContent"> <p class="venuetextinfo"><br>Location: ';

        if (address !== undefined) {
          contentString = contentString + address + ', ';
        }
        
        contentString = contentString + city + ', ' + state + ', ' + country + '<br> distance from current location: ' + distance + ' meters or ' + (distance * 0.000621371) + ' miles<br>';

        if (url !== undefined) {
          contentString = contentString + 'url: ' + url + '<br>';
        }

        if (phonenumber !== undefined) {
          contentString = contentString + 'phone number: ' + phonenumber + '<br>';
        }

        contentString = contentString + 'check-ins: ' + checkins + ', user count: ' + usercount + '<br> categories: ';

        //finally append the categories to the string and we're finished
        for (var m = 0; m < data.response.venues[k].categories.length; m++) {
          contentString = contentString + data.response.venues[k].categories[m].name + ", " + data.response.venues[k].categories[m].pluralName + ", " + data.response.venues[k].categories[m].shortName + "<br>";
        }
        contentString = contentString + '</p>' + '</div>' + '</div>';
        contentStrings.push(contentString);
      }
    }
  }
  else if (apicall === 'venueexplore') {
    for (var k = 0; k < data.response.groups.length; k++) {
      for (var l = 0; l < data.response.groups[k].items.length; l++) {
        var restaurantname = data.response.groups[k].items[l].venue.name;
        var address = data.response.groups[k].items[l].venue.location.address;
        var id = data.response.groups[k].items[l].venue.id;
        //console.log(l + " explore: " + address);
        //brand new restaurant found
        if ((id in idhashmap) === false) {
          idhashmap[id] = id;
          venueids.push(id);
          //if it's a brand new chain
          if ((restaurantname in restaurantchainsfound) === false) {
            restaurantchainsfound[restaurantname] = restaurantname;
          }
          var city = data.response.groups[k].items[l].venue.location.city;
          var state = data.response.groups[k].items[l].venue.location.state;
          var country = data.response.groups[k].items[l].venue.location.country;
          var zip = data.response.groups[k].items[l].venue.location.postalCode;
          var distance = data.response.groups[k].items[l].venue.location.distance;
          var phonenumber = data.response.groups[k].items[l].venue.contact.formattedPhone;
          var checkins = data.response.groups[k].items[l].venue.stats.checkinsCount;
          var usercount = data.response.groups[k].items[l].venue.stats.usersCount;
          var url = data.response.groups[k].items[l].venue.url;
          var rating = data.response.groups[k].items[l].venue.rating;
          if (data.response.groups[k].items[l].venue.hours !== undefined) {
            var open = data.response.groups[k].items[l].venue.hours.isOpen;
          }
          var sitelat = data.response.groups[k].items[l].venue.location.lat;
          var sitelng = data.response.groups[k].items[l].venue.location.lng;
          placelatitudes.push(sitelat);
          placelongitudes.push(sitelng);

          var marker = new google.maps.Marker({
            position: new google.maps.LatLng(sitelat, sitelng), map: map, title:restaurantname
          });
          markers.push(marker);
          markersArray.push(marker);
          names.push(restaurantname);
          var contentString = '<div id="content">' + '<div id="siteNotice">' + '</div>'+ '<div id="bodyContent">' + '<p class="venuetextinfo"><br>Address: ' + address + ', ' + city + ', ' + state + ', ' + country + ', ' + zip + '<br>' + 'distance from current location: ' + distance + ' meters <br>';
          if (url !== undefined) {
            contentString = contentString + 'url: ' + url + '<br>';
          }

          if (phonenumber !== undefined) {
            contentString = contentString + 'phone number: ' + phonenumber + '<br>';
          }
          
          contentString = contentString + 'open?: ' + open + '<br>';
          contentString = contentString + 'rating: ' + rating + '/10 <br>';
          contentString = contentString + 'check-ins: ' + checkins + ', user count: ' + usercount + '<br> categories: ';

          //finally append the categories to the string and we're finished
          for (var m = 0; m < data.response.groups[k].items[l].venue.categories.length; m++) {
            contentString = contentString + data.response.groups[k].items[l].venue.categories[m].name + ", " + data.response.groups[k].items[l].venue.categories[m].pluralName + ", " + data.response.groups[k].items[l].venue.categories[m].shortName + "<br>";
          }
          contentString = contentString + '</p>' + '</div>' + '</div>';
          contentStrings.push(contentString);
        }
      }
    }
  }
  //console.log("array lengths: " + markers.length + ", " + contentStrings.length + ", " + names.length + ", " + placelatitudes.length + ", " + placelongitudes.length);
  /* now loop back through arrays and add corresponding info boxes */
  for (var n = 0; n < markers.length; n++) {
    addInfoDiv(venueids[n], markers[n], contentStrings[n], names[n], latitude, longitude, placelatitudes[n], placelongitudes[n], wordsfound);
  }
  //center on current location and zoom in
  map.setCenter(new google.maps.LatLng(latitude, longitude));
  map.setZoom(8);
}

function addInfoDiv(venueid, marker, message, name, userlatitude, userlongitude, endlatitude, endlongitude, wordsfound) {
  var info = message;

  google.maps.event.addListener(marker, 'click', function () {
    var divcount = 0;
    $('.venueinfo').each(function() {
      divcount++;  
    });
    if (divcount > 0) {
      $(".venuedirections").fadeOut("fast", function() {
        $(this).remove();
      });
      //remove existing div and create a new one if there is an existing one
      $('.venueinfo').fadeOut("fast", function() {
        $(this).remove();
        createInfoDiv(venueid, marker, message, name, userlatitude, userlongitude, endlatitude, endlongitude, wordsfound);
      });
    }
    else {
      createInfoDiv(venueid, marker, message, name, userlatitude, userlongitude, endlatitude, endlongitude, wordsfound);
    }
  });
}

/* create Info div for each marker */
function createInfoDiv(venueid, marker, message, name, userlatitude, userlongitude, endlatitude, endlongitude, wordsfound) {
  var div = document.createElement('div');
  document.body.appendChild(div);
  div.className = 'venueinfo';
  $(div).append('<div class="venueinfotop"></div>');
  $(div).find('.venueinfotop').append('<span class="close">&times;</span>');
  $(div).find('.venueinfotop').append('<h3 class="venueheader">' + name + '</h3>');
  $(div).find('.venueinfotop').append("<a id='getdirections' class='headerlink link getdirectionslink'>Get Directions</a>");
  $(div).find('.venueheader').css('font-color', '#FFFFFF');
  $(div).append(message);

  $(div).find('.venueinfotop').append('<a id="createlink" class="headerlink link createlink">Create Link</span>');

  $('#getdirections').on('click', function() {
    var directiondivcount = 0;
    $('.venuedirections').each(function() {
      directiondivcount++;
    });
    if (directiondivcount > 0) {
      $('.venuedirections').each(function() {
        $(this).remove();
      });
    }
    //append div that shall contain directions to venue and designate it to hold directions from google maps
    var directionsdiv = document.createElement('div');
    document.body.appendChild(directionsdiv);
    directionsdiv.className = 'venuedirections';
    $(directionsdiv).append('<span class="closedirections">&times;</span>');
    $(directionsdiv).attr('id', 'venuedirections');
    directionsDisplay.setPanel(document.getElementById('venuedirections'));

    function calcRoute() {
      var request = {
        origin: new google.maps.LatLng(userlatitude, userlongitude),
    destination: new google.maps.LatLng(endlatitude, endlongitude),
    travelMode: google.maps.DirectionsTravelMode.DRIVING
      };
      directionsService.route(request, function(response, status) {
        if (status == google.maps.DirectionsStatus.OK) {
          directionsDisplay.setDirections(response);
        }
      });
    }
    calcRoute();
  });

  $('#createlink').on('click', function() {
    var querylinkdiv = document.createElement('div');
    document.body.appendChild(querylinkdiv);
    querylinkdiv.className = 'querylinkdiv';
    $(querylinkdiv).append('<span class="closelinkdiv">&times;</span>');
    $(querylinkdiv).append('<h4 id="querylinkheader">Link ' + name + ' To Keyword</span>');
    $(querylinkdiv).attr('id', 'querylinkdiv');
    $(querylinkdiv).append('<select id="choosewordlink" class="choosewordlink">');
    for (var i = 0; i < wordsfound.length; i++) {
      $(querylinkdiv).find('select').append('<option class="choosewordlinkoption" value="' + wordsfound[i] + '">' + wordsfound[i] + '</option>');
    }
    $(querylinkdiv).append('<button id="choosewordbutton" class="btn btn-primary">Link</button>');

    $('.closelinkdiv').on('click', function() {
      $('.querylinkdiv').fadeOut("fast", function() {
        $(this).remove();
      });
    });

    //when link to keyword is submitted, send it to backend via socket
    $('#choosewordbutton').on('click', function() {
      var selection = document.getElementById("choosewordlink").value;
      $('.querylinkdiv').fadeOut("fast", function() {
        $(this).remove();
      });
      socket.emit("wordQueryLink", {"keyword":selection, "restaurant":name});
    });
  });
}

/* when X at top of info div is clicked, close it and its directions div (if open) */
$(document).on("click", '.close', function(event) {
  event.stopPropagation();
  $(".venueinfo").fadeOut("fast", function() {
    $(this).remove();
  });
  $(".venuedirections").fadeOut("fast", function() {
    $(this).remove();
  });
  $('.querylinkdiv').fadeOut("fast", function() {
    $(this).remove();
  });
});

function filterMarkers(targettag) {
  var target = targettag.options[targettag.selectedIndex].value;  
  for (var i = 0; i < markersArray.length; i++) {
    markersArray[i].setVisible(true);
  }
  if (target !== 'Show All') {
    for (var i = 0; i < markersArray.length; i++) {
      if (markersArray[i].title !== 'You Are Here' && markersArray[i].title !== target) {
        markersArray[i].setVisible(false);
      }
    }
  }
}

/*when X at top of directions div is clicked, close it alone */
$(document).on('click', '.closedirections', function(event) {
  event.stopPropagation();
  $(".venuedirections").fadeOut("fast", function() {
    $(this).remove();
  });
});

var numviewlinksclicks = 0;
$(document).on('click', '#viewlinkslink', function(event) {
  numviewlinksclicks++;
  var divcount = 0;
  $('.viewlinksdiv').each(function() {
    divcount++;
  });
  if (divcount > 0) {
    $('.viewlinksdiv').remove();
  }
  else {
    var viewlinksdiv = document.createElement('div');
    document.body.appendChild(viewlinksdiv);
    viewlinksdiv.className = 'viewlinksdiv';
    $(viewlinksdiv).append('<span id="closedisplaylinkdiv" class="closedisplaylinkdiv">&times;</span>');
    socket.emit("getQueryLink", {"type":"display"});

    if (numviewlinksclicks === 1) {
      socket.on("retrievedQueryLinkForDisplay", function(data) {
        for (var i = 0; i < data.keywords.length; i++) {
          $('.viewlinksdiv').append('<div id="keyword' + i + '" class="viewlinkscontainer">');
          $('.viewlinksdiv').find('#keyword' + i).append('<h5 class="viewlinksheader" id=keyword' + i + '>' + data.keywords[i] + '</h5><p id="chainparagraph' + i + '" class="chainparagraph">: ');
          var chainsarray = data.chains[i].split('~');
          for (var j = 0; j < chainsarray.length; j++) {
            if (j === 0) {
              $('.viewlinksdiv').find('#chainparagraph' + i).append(chainsarray[j]);
            }
            else {
              $('.viewlinksdiv').find('#chainparagraph' + i).append(', ' + chainsarray[j]);
            }
          }
        }
      });
    }

    $('#closedisplaylinkdiv').on('click', function() {
      $('.viewlinksdiv').fadeOut("fast", function() {
        $(this).remove();
      });
    })
  }
});

$(document).on('click', '#clearlinkslink', function(event) {
  socket.emit("clearQueryLinks");
});

$(document).on('click', '#submitlinkslink', function(event) {
  var userlinkdiv = document.createElement('div');
  document.body.appendChild(userlinkdiv);
  userlinkdiv.className = 'userlinkdiv';
  $(userlinkdiv).append('<span id="closeuserlinkdiv" class="closelinkdiv">&times;</span>');
  $(userlinkdiv).append('<h4 id="userlinkheader">Link Query To Keyword</span>');
  $(userlinkdiv).attr('id', 'userlinkdiv');
  $(userlinkdiv).append('<div class="input-prepend form"><span class="add-on">Keyword</span><input class="span2" id="prependedKeywordInput" type="text" placeholder="Enter Keyword"></div>');
  $(userlinkdiv).append('<div class="input-prepend form"><span class="add-on">Restaurant</span><input class="span2" id="prependedRestaurantInput" type="text" placeholder="Enter Restaurant"></div>');
  $(userlinkdiv).append('<button id="submituserlink" class="btn btn-primary" type="button">Submit</button>');

  $('.viewlinksdiv').fadeOut("fast", function() {
    $(this).remove();
  });

  $('#closeuserlinkdiv').on('click', function() {
    $('.userlinkdiv').fadeOut("fast", function() {
      $(this).remove();
    })
  });

  $('#submituserlink').on('click', function() {
    var keyword = $('#prependedKeywordInput').val();
    var restaurant = $('#prependedRestaurantInput').val();
    $('.userlinkdiv').fadeOut("fast", function() {
      $(this).remove();
    })
    socket.emit("wordQueryLink", {"keyword":keyword, "restaurant":restaurant});
  });
});

var config = {
  apiKey: 'GWVQS2E14ALKFVRJL02CPTYFIJRKPMQBNZJ1G3VO0BJTOYTR',
  authUrl: 'https://foursquare.com/',
  apiUrl: 'https://api.foursquare.com/'
};
