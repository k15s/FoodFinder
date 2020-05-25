//when the new note link is clicked on
$('#newnotelink').on('click', function() {
  var opacity;
  if ( $('#hiddensave').css('opacity') == 0) {
    opacity = 1;
  }
  else {
    opacity = 0;
  }
  $('#hiddensave').css('opacity', opacity);
  $('.arrow').css('opacity', opacity);
});

//when the submit button is clicked
$('#submitbutton').on('click', function() {
  var input = $('#labelinput').val();
  var div = document.createElement('div');
  document.body.appendChild(div);
  div.className = 'stickynote';
  div.contenteditable = "false";
  $(div).draggable();
  $(div).append('<h6 class="stickynoteheader" contenteditable="false">' + input + '</h6>');
  $(div).append('<p class="stickynotetext" contenteditable="true" tabindex="0"></p>');
  $('#labelinput').val('');
  var opacity;
  if ( $('#hiddensave').css('opacity') == 0) {
    opacity = 1;
  }
  else {
    opacity = 0;
  }
  $('#hiddensave').css('opacity', opacity);
  $('.arrow').css('opacity', opacity);
});

//make sticky notes draggable
$(".stickynote").each(function() {
  console.log("found stickynote");
  $(this).draggable();
});

//when a stickynote is clicked on...
$(document).on('click', '.stickynote', function() {
  if ($('html').css('cursor') !== 'crosshair') {
    $(this).find('p').attr('contenteditable', 'true');
    $(this).find('p').focus();
  }
  //crosshair cursor, so delete the sticky note that was clicked
  else {
    var notename = $(this).find('h6').text();
    $(this).remove();
    var socket = io.connect('http://localhost');
    socket.emit("deleteNote", {"notename":notename});
  }
});

$(document).on('click', '#savenoteslink', function() {
  var allnotenames = [];
  var allnotetext = [];
  //for each sticky note
  $(".stickynote").each(function() {
    var notename = $(this).find('h6').text();
    var notetext = $(this).find('p').text();
    allnotenames.push(notename);
    allnotetext.push(notetext);
  });

  //use a socket to message the node backend and commit to database
  var socket = io.connect('http://localhost');
  socket.emit("saveNotes", {"allnotenames": allnotenames, "allnotetext": allnotetext});
});

/* switch cursor to crosshair when link is clicked */
$('#deletenotelink').on('click', function() {
  $('html').css('cursor', 'crosshair');
  $('.stickynote').css('cursor', 'crosshair');
});

/* whenever something is clicked on by a crosshair cursor and it's not a link at the top, 
 * change it back to normal */
$(document).on('click', function(event) {
  if (event.target.nodeName !== 'A' && $('html').css('cursor') === 'crosshair') {
    $('html').css('cursor', 'auto');
    $('.stickynote').css('cursor', 'pointer');
  }
});

$(document).on('click', '#deletealllink', function() {
  $(".stickynote").each(function() {
    $(this).remove();
  });
  //use a socket to message the node backend and commit to database
  var socket = io.connect('http://localhost');
  socket.emit("deleteAllNotes");
});

/* on page load, ask the backend for all existing notes and then add them to the DOM */
$(document).on('ready', function() {
  var socket = io.connect('http://localhost');
  socket.emit("getAllNotes");
  socket.on("retrievedNotes", function(data) {
    var notenames = data.notenames;
    var notetext = data.notetext;
    for (var i = 0; i < notenames.length; i++) {
      var input = notenames[i];
      var text = notetext[i];
      var div = document.createElement('div');
      document.body.appendChild(div);
      div.className = 'stickynote';
      div.contenteditable = "false";
      $(div).draggable();
      $(div).append('<h6 class="stickynoteheader" contenteditable="false">' + input + '</h6>');
      $(div).append('<p class="stickynotetext" contenteditable="true" tabindex="0">' + notetext + '</p>');
    }
  });
});
