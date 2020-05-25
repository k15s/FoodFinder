## Setup Example:
1. "chmod 400 new-ssh.pem"
2. "ssh -i new-ssh.pem ubuntu@ec2-11-111-11-111.us-west-2.compute.amazonaws.com"

0. if you mess up the initial heroku push (e.g. include a dollar sign at the start of the app name)
1. manually delete the bogus, generic repositories on the heroku site
2. re-create the apps from command line
3. correct the remote links in the directory's /.git/config file

+ The heroku links can be obtained directly from heroku's site
+ http://ks111777-bitstarter-mooc.herokuapp.com/

**To do a quick test...**
+ node web.js
+ Then go to localhost:8080 or ec2-11-111-11-111.us-west-2.compute.amazonaws.com:8080 depending on where the node command was run
+ npm has to have sockets, express, pg, etc. installed
+ sudo apt-get install libpq-dev before installing pg

**API Samplings**
+ https://api.foursquare.com/v2/venues/search?ll=33.716666,-118.301212&query=chipotle&&client_id=GWVQS2E14ALKFVRJL02CPTYFIJRKPMQBNZJ1G3VO0BJTOYTR&client_secret=BGGMPSR1USREGDM0LHW4CDLOLMMZIRBLW4M4LW0ISPQ5CRIO&v=20130831
+ https://api.foursquare.com/v2/venues/suggestCompletion?ll=33.716666,-118.301212&query=bur&oauth_token=AYF44BHIOU2PE0U4P0JUV1PDDN0Y2TD2TBLJ13HFPGCXWZD3&v=20130831
+ https://api.foursquare.com/v2/venues/explore?ll=33.716666,-118.301212&query=chipotle&oauth_token=AYF44BHIOU2PE0U4P0JUV1PDDN0Y2TD2TBLJ13HFPGCXWZD3&v=20130831
+ for more API details, check the Foursquare site and run sample queries

**Test Geolocations**
+ 1015 W. 34th Street, Los Angeles, CA, 90007
+ 34.0246,-118.28769899999998 
