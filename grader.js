#!/usr/bin/env node
/*
Automatically grade files for the presence of specified HTML tags/attributes.
Uses commander.js and cheerio. Teaches command line application development
and basic DOM parsing.

References:

 + cheerio
   - https://github.com/MatthewMueller/cheerio
   - http://encosia.com/cheerio-faster-windows-friendly-alternative-jsdom/
   - http://maxogden.com/scraping-with-node.html

 + commander.js
   - https://github.com/visionmedia/commander.js
   - http://tjholowaychuk.com/post/9103188408/commander-js-nodejs-command-line-interfaces-made-easy

 + JSON
   - http://en.wikipedia.org/wiki/JSON
   - https://developer.mozilla.org/en-US/docs/JSON
   - https://developer.mozilla.org/en-US/docs/JSON#JSON_in_Firefox_2
*/

var fs = require('fs');
var program = require('commander');
var cheerio = require('cheerio');
var HTMLFILE_DEFAULT = "index.html";
var CHECKSFILE_DEFAULT = "checks.json";
var rest = require('restler'); //restler library to download the URL

var assertFileExists = function(infile) {
    var instr = infile.toString();
    if(!fs.existsSync(instr)) {
        console.log("%s does not exist. Exiting.", instr);
        process.exit(1); // http://nodejs.org/api/process.html#process_process_exit_code
    }
    return instr;
};

var cheerioHtmlFile = function(htmlfile) {
    return cheerio.load(fs.readFileSync(htmlfile));
};

var loadChecks = function(checksfile) {
    return JSON.parse(fs.readFileSync(checksfile));
};

var checkHtmlFile = function(htmlfile, checksfile) {
    $ = cheerioHtmlFile(htmlfile);
    var checks = loadChecks(checksfile).sort();
    var out = {};
    for(var ii in checks) {
        var present = $(checks[ii]).length > 0;
        out[checks[ii]] = present;
    }
    return out;
};

var clone = function(fn) {
    // Workaround for commander.js issue.
    // http://stackoverflow.com/a/6772648
    return fn.bind({});
};

if(require.main == module) {
    /* commander to parse command line input. */
    program
        .option('-c, --checks <check_file>', 'Path to checks.json', clone(assertFileExists), CHECKSFILE_DEFAULT)
        .option('-f, --file <html_file>', 'Path to index.html', clone(assertFileExists), HTMLFILE_DEFAULT)
        .option('-u, --url [URL]', 'Url to html file')
        .parse(process.argv);

    /* if the URL is provided: ./grader.js --checks checks.json --url http://calm-stream-4677.herokuapp.com */
    if (program.url) {
      /* once restler is finished "getting" file from url, it will call function(result), executing the
      * code defined within that function. result @param will contain the html string returned
      * by get. */
      rest.get(program.url).on('complete', function(result){
        console.log("url provided");
        /* callback function passed into restler function as parameter. Because getting may take some time,
         * use callback function through param to delay it's execution until the get is finished. Then, 
         * use fs package to synchronously write html text stored in "result" to 'download.html' file. 
         * 
         * We can then use the .html file written to to check */
        var file = fs.writeFileSync('download.html', result);
        var checkJson = checkHtmlFile('download.html', program.checks);
        var outJson = JSON.stringify(checkJson, null, 4);
        return console.log(outJson);
      });
    }
    else {
      console.log("no url provided");
      var checkJson = checkHtmlFile(program.file, program.checks);
      var outJson = JSON.stringify(checkJson, null, 4);
      console.log(outJson);
    }
} 
else {
    exports.checkHtmlFile = checkHtmlFile;
}
