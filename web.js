/* load the express module to create an express app */
var express = require('express');
var fs = require('fs');
var path = require('path');
//enable postgres interaction
var pg = require('pg');

/* create an express server with a logger that prints out any requests it receives */
var app = express.createServer(express.logger());

//var buffer = new Buffer(fs.readFileSync("index.html").toString());

/* Use the given middleware function, with optional mount path, defaulting to "/" to serve static files 
 * It's usually a good idea to dump static assets like HTML/CSS 
 * files, client side JavaScript libraries (like jQuery), and images that you need for your web sites but 
 * that don't change very often into this folder */
app.use(express.static(__dirname + '/static'));

var io = require('socket.io').listen(app);

/*app.get('/', function(request, response) {
  //display either "Hello World 2!" or the string located in index.html via a buffer
  //response.send('Hello World 2!');
  //response.send(buffer.toString());
  var html = fs.readFileSync("static/index.html").toString();
  response.send(html);
});*/

/* fire up app to listen to 8080 port for requests: e.g. http://localhost:8080 */
var port = process.env.PORT || 8080;
app.listen(port, function() {
  console.log("Listening on " + port);
});

/* connection url assumes a postgresql user has been created. The url lists postgres as the overall superuser of
 * postgresql, bitstarter as the specific user with password 'password' and permissions to operate on db stickynotes */
var conString = "postgres://bitstarter:password@localhost/stickynotes";

io.sockets.on('connection', function (socket) {
  socket.on("saveNotes", function(data) {
    var allnotenames = data.allnotenames;
    var allnotetext = data.allnotetext;
    var client = new pg.Client(conString);
    client.connect(function(err) {
      if(err) {
        return console.error('could not connect to postgres', err);
      }
      else {
        client.query('CREATE TABLE IF NOT EXISTS notes(notename TEXT, notetext TEXT)');
        for (var i = 0; i < allnotenames.length; i++) {
          client.query("DELETE FROM notes WHERE notename = ($1);", [allnotenames[i]]);
          client.query("INSERT INTO notes(notename, notetext) VALUES ($1, $2);", [allnotenames[i], allnotetext[i]]);
        }
        client.query('SELECT * FROM notes;', function(err, result) {
          for (var j = 0; j < result.rows.length; j++) {
            console.log("name: " + result.rows[j].notename + ", text: " + result.rows[j].notetext);
          }
        });
      }
    });
  });

  socket.on("deleteAllNotes", function(data) {
    var client = new pg.Client(conString);
    client.connect(function(err) {
      if(err) {
        return console.error('could not connect to postgres', err);
      }
      else {
        client.query("DELETE FROM notes;");
      }
    });
  });

  socket.on("deleteNote", function(data) {
    var client = new pg.Client(conString);
    client.connect(function(err) {
      if(err) {
        return console.error('could not connect to postgres', err);
      }
      else {
        var notetodelete = data.notename;
        client.query("DELETE FROM notes WHERE notename = ($1);", [notetodelete]);
      }
    });
  });

  socket.on("getAllNotes", function(data) {
    var client = new pg.Client(conString);
    client.connect(function(err) {
      if(err) {
        return console.error('could not connect to postgres', err);
      }
      else {
        client.query("SELECT * FROM notes;", function(err, result) {
          if (err) {
            console.log("notes table doesn't exist yet");
          }
          else {          
            var notenames = [];
            var notetext = [];
            for (var i = 0; i < result.rows.length; i++) {
              notenames.push(result.rows[i].notename);
              notetext.push(result.rows[i].notetext);
            }
            socket.emit("retrievedNotes", {"notenames":notenames, "notetext":notetext});
          }
        });
      }
    });
  });

  socket.on("getQueryLink", function(data) {
    var client = new pg.Client(conString);
    client.connect(function(err) {
      if(err) {
        return console.error('could not connect to postgres', err);
      }
      else {
        client.query('CREATE TABLE IF NOT EXISTS searchlinks(keyword TEXT, restaurantchains TEXT);', function(err, result) {
          if (err) {
            return console.err('could not create table');
          }
        });
        client.query("SELECT * FROM searchlinks;", function(err, result) {
          if (err) {
            return console.err('could not select from table');
          }
          else {
            var keywords = [];
            var chains = [];
            for (var i = 0; i < result.rows.length; i++) {
              keywords.push(result.rows[i].keyword);
              chains.push(result.rows[i].restaurantchains);
            }
            if (data.type === "query") {
              socket.emit("retrievedQueryLink", {"keywords":keywords, "chains":chains, "wordsfound":data.wordsfound});
            }
            else if (data.type === "display") {
              socket.emit("retrievedQueryLinkForDisplay", {"keywords":keywords, "chains":chains, "wordsfound":data.wordsfound});
            }
          }
        });
      }
    });
  });

  socket.on("wordQueryLink", function(data) {
    var keyword = data.keyword;
    var restaurant = data.restaurant;
    var client = new pg.Client(conString);
    client.connect(function(err) {
      if (err) {
        return console.error('could not connect to postgres', err);
      }
      else {
        console.log("Heard " + data);
        client.query('CREATE TABLE IF NOT EXISTS searchlinks(keyword TEXT, restaurantchains TEXT);', function(err, result) {
          if (err) {
            return console.err('could not create table');
          }
          else {
            console.log("Created table");
          }
        }); 
        client.query('SELECT * FROM searchlinks WHERE keyword = ($1);', [keyword], function(err, result) {
          if (err) {
            return console.error('could not select', err);
          }
          else {
            if (result.rows.length > 0) {
              var chains = result.rows[0].restaurantchains;
              var chainsarray = chains.split("~");
              var existingrestaurant = false;
              var fullchainsstring = "";
              for (var i = 0; i < chainsarray.length; i++) {
                console.log("found chain " + (i + 1) + ": " + chainsarray[i]);
                if (i === 0) {
                  fullchainsstring = chainsarray[i];
                }
                else {
                  fullchainsstring = fullchainsstring + "~" + chainsarray[i];
                }
                if (chainsarray[i] === restaurant) {
                  existingrestaurant = true;
                }
              }
              if (existingrestaurant === false) {
                fullchainsstring = fullchainsstring + "~" + restaurant;
                client.query("DELETE FROM searchlinks WHERE keyword=($1)", [keyword]);
                client.query("INSERT INTO searchlinks(keyword, restaurantchains) VALUES ($1, $2);", [keyword, fullchainsstring]);
                console.log("Insertion performed");
                client.query("SELECT * FROM searchlinks;", function(err, result) {
                  if (err) {
                    return console.error('could not select', err);
                  }
                  else {
                    for (var i = 0; i < result.rows.length; i++) {
                      console.log("keyword: " + result.rows[i].keyword + ", chains: " + result.rows[i].restaurantchains + ".");
                    }
                  }
                });
              }
            }
            else {
              client.query("INSERT INTO searchlinks(keyword, restaurantchains) VALUES ($1, $2);", [keyword, restaurant]);
              console.log("insertion performed");
              client.query("SELECT * FROM searchlinks;", function(err, result) {
                if (err) {
                  return console.error('could not select', err);
                }
                else {
                  for (var i = 0; i < result.rows.length; i++) {
                    console.log("keyword: " + result.rows[i].keyword + ", chains: " + result.rows[i].restaurantchains + ".");
                  }
                }
              });
            }
          }
        });
      }
    });
  });

  socket.on('clearQueryLinks', function() {
    var client = new pg.Client(conString);
    client.connect(function(err) {
      if(err) {
        return console.error('could not connect to postgres', err);
      }
      else {
        client.query('DELETE FROM searchlinks;', function(err, result) {
          if (err) {
            return console.error("couldn't delete all entries from table");
          }
        });
      }
    });
  });

});

//ORIGINAL TEST CODE BELOW
/*
 *var conString = "postgres://bitstarter:password@localhost/stickynotes";
var client = new pg.Client(conString);
client.connect(function(err) {
  if(err) {
    return console.error('could not connect to postgres', err);
  }
  client.query('SELECT NOW() AS "theTime"', function(err, result) {
    if(err) {
      return console.error('error running query', err);
    }
    console.log(result.rows[0].theTime);
    //output should be like Tue Jan 15 2013 19:12:47 GMT-600 (CST)
    //client.end();
  });
  //create a temporary table that exists just when needed
  client.query("CREATE TEMP TABLE reviews(id SERIAL, author VARCHAR(50), content TEXT)");
  client.query("INSERT INTO reviews(author, content) VALUES($1, $2)", ["mad_reviewer", "I'd buy this any day of the week!"]);
  client.query("INSERT INTO reviews(author, content) VALUES($1, $2)", ["calm_reviewer", "Yes, that was a pretty good product."]);
  client.query("SELECT * FROM reviews", function(err, result) {
    console.log("Row count: %d",result.rows.length);  // 1
    for (var i = 0; i < result.rows.length; i++) {
      var row = result.rows[i];
      console.log("id: " + row.id);
      console.log("author: " + row.author);
      console.log("content: " + row.content);
    }
  });
});
 * */

//ALL CODE BELOW HAS "IDENTICAL" POSTGRESQL EFFECT
/*
var dbUrl = "tcp://nodetest:Yvaine730@localhost/nodetest";
function testDate(onDone) {
  pg.connect(dbUrl, function(err, client) {
    client.query("SELECT NOW() as when", function(err, result) {
      console.log("Row count: %d",result.rows.length);  // 1
      console.log("Current year: %d", result.rows[0].when.getFullYear());
      onDone();
    });
  });
}

function disconnectAll() {
  console.log("disconnecting");
  //pg.end();
}

console.log("first testDate()");
testDate(disconnectAll);
*/
/*
function testTable(onDone) {
  pg.connect(dbUrl, function(err, client) {
    client.query("CREATE TEMP TABLE reviews(id SERIAL, author VARCHAR(50), content TEXT)");
    client.query("INSERT INTO reviews(author, content) VALUES($1, $2)", ["mad_reviewer", "I'd buy this any day of the week!"]);
    client.query("INSERT INTO reviews(author, content) VALUES($1, $2)", ["calm_reviewer", "Yes, that was a pretty good product."]);
    client.query("SELECT * FROM reviews", function(err, result) {
      console.log("Row count: %d",result.rows.length);  // 1
      for (var i = 0; i < result.rows.length; i++) {
        var row = result.rows[i];
        console.log("id: " + row.id);
        console.log("author: " + row.author);
        console.log("content: " + row.content);
      }
      onDone();
    });
  });
}

console.log("second, testDate and testTable");
testDate((function() {
  testTable(disconnectAll)
}));
*/
