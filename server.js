var express = require('express');
var session = require('cookie-session');
var bodyParser = require('body-parser');
var http = require('http');
var url = require('url');
var fs = require('fs');
var formidable = require('formidable');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var ObjectID = require('mongodb').ObjectID;
var mongourl = "mongodb://bunny:1234@ds139994.mlab.com:39994/s381f";
var app = express();

app.set('view engine', 'ejs');

var SECRETKEY1 = 'I want to pass COMPS381F';
var SECRETKEY2 = 'Keep this to yourself';

app.use(session({
	name: 'session',
	keys: [SECRETKEY1,SECRETKEY2]
}))
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(express.static('public'));

app.get("/", function(req,res) {
  console.log('------------------------------------');
	//Test log
	console.log(req.session);
	console.log('Incoming get request: %s', req.path);

	if (!req.session.authenticated) {
		res.redirect('/login');
	}else{
		res.status(200);

    MongoClient.connect(mongourl, function(err,db) {
        assert.equal(err,null);
        console.log('Connected to MongoDB');
        var criteria = {};
        //criteria['_id'] = ObjectID(queryAsObject._id);
        findPhoto(db,criteria,{},function(photo) {
          db.close();
          console.log('Disconnected MongoDB');
          console.log('Photo returned = ' + photo.length);
          res.render('secrets',{name:req.session.username, photos:photo});
          //res.end(image);
        });
    });
  }
});

app.get('/login',function(req,res) {
  console.log('------------------------------------');
   console.log('Incoming get request: %s', req.path);
	res.sendFile(__dirname + '/public/login.html');
});

app.post('/login',function(req,res) {
  console.log('------------------------------------');
   console.log('Incoming post request: %s', req.path);

  var name = req.body.name;
  var password = req.body.password;

  MongoClient.connect(mongourl,function(err,db) {
    var new_r = {};
    new_r['name'] = name;
    new_r['password'] = password;

    login(db,new_r,function(result) {
      db.close();
      if (result=="loginSucces") {
        console.log("Log: db close in login method");
        req.session.authenticated = true;
        req.session.username = name;
        res.redirect('/');
      }else{
        res.writeHead(200, {"Content-Type": "text/html"});
        res.end('Username or Password Wrong!<br><a href="/login">Try again</a>');
      }
    })
  });
});

app.get('/reg',function(req,res) {
  console.log('------------------------------------');
  console.log('Incoming get request: %s', req.path);
  res.sendFile(__dirname + '/public/reg.html');
});

app.post('/reg',function(req,res) {
  console.log('------------------------------------');
  console.log('Incoming post request: %s', req.path);

  var form = new formidable.IncomingForm();

  form.parse(req, function (err, fields, files) {
      console.log(JSON.stringify(files));

      var name = fields.name;
      var password = fields.password;

      MongoClient.connect(mongourl,function(err,db) {
        var new_r = {};
        new_r['name'] = name;
        new_r['password'] = password;
        regAccount(db,new_r,function(result) {
          db.close();

          if (result=="accExtist") {
            res.writeHead(200, {"Content-Type": "text/html"});
            res.end('Account already exists!<br><a href="/reg">Try again</a><br><a href="/login">Login</a>');
          }else{
            res.writeHead(200, {"Content-Type": "text/html"});
            res.end('Account registration succeed!<br><a href="/login">Login</a>');
          }
          
        })
      });
    });
});

app.get('/logout',function(req,res) {
  console.log('------------------------------------');
  console.log('Incoming get request: %s', req.path);
  req.session.authenticated = false;
  req.session.username = "";
  res.redirect('/');
});


app.get('/newRestaurant',function(req,res) {
  console.log('------------------------------------');
	console.log('Incoming get request: %s', req.path);
	res.sendFile(__dirname + '/public/newRestaurant.html');
});

app.post('/newRestaurant',function(req, res){
  console.log('------------------------------------');
	console.log('Incoming post request: %s', req.path);

	var form = new formidable.IncomingForm();

    form.parse(req, function (err, fields, files) {
      console.log(JSON.stringify(files));

      var filename = files.filetoupload.path;
      var name = (fields.title.length > 0) ? fields.title : "untitled";
      var mimetype = files.filetoupload.type;
      var borough = (fields.borough.length > 0) ? fields.borough : "untitled";
      var cuisine = (fields.cuisine.length > 0) ? fields.cuisine : "untitled";

      //address
      var street = (fields.street.length > 0) ? fields.street : "";
      var building = (fields.building.length > 0) ? fields.building : "";
      var zipcode = (fields.zipcode.length > 0) ? fields.zipcode : "";

      var gpsLon = (fields.gpsLon.length > 0) ? fields.gpsLon : "";
      var gpsLat = (fields.gpsLat.length > 0) ? fields.gpsLat : "";
      var coord = [gpsLon,gpsLat];

      console.log("name = " + name);
      console.log("filename = " + filename);
      console.log("coord = "+coord);

      
      fs.readFile(filename, function(err,data) {
        MongoClient.connect(mongourl,function(err,db) {
          var new_r = {};
          new_r['name'] = name;
          new_r['mimetype'] = mimetype;
          new_r['image'] = new Buffer(data).toString('base64');
		      new_r['borough'] = borough;	
          new_r['cuisine'] = cuisine;
          new_r['owner'] = req.session.username;

          var address = {};
          address['street'] = street;
          address['building'] = building;
          address['zipcode'] = zipcode;
          address['coord'] = coord;

          new_r['address'] = address;
          new_r['grades'] = [];
          insertPhoto(db,new_r,function(result) {
            db.close();
            res.writeHead(200, {"Content-Type": "text/html"});
            res.write('A new document was created successfully!');
            res.end('<p><a href="/">Back Home</a>\n');
          })
        });
      });
    });
});

app.get("/display", function(req,res) {
  console.log('------------------------------------');
  var parsedURL = url.parse(req.url,true);
  var queryAsObject = parsedURL.query;
  //Test log
  console.log(req.session);
  console.log('Incoming get request: %s', req.path);

  if (!req.session.authenticated) {
    res.redirect('/login');
  }else{
    res.status(200);

    MongoClient.connect(mongourl, function(err,db) {
        assert.equal(err,null);
        console.log('Connected to MongoDB');
        var criteria = {};
        criteria['_id'] = ObjectID(queryAsObject._id);
        findPhoto(db,criteria,{},function(photo) {
          db.close();
          console.log('Disconnected MongoDB');
          console.log('Photo returned = ' + photo.length);

          res.render('display',{photos:photo});
          //res.end(image);
        });
    });
  }
});

app.get("/delete", function(req,res) {
  console.log('------------------------------------');
	var parsedURL = url.parse(req.url,true);
	var queryAsObject = parsedURL.query;
	//Test log
	console.log(req.session);
	console.log('Incoming get request: %s', req.path);

	if (!req.session.authenticated) {
		res.redirect('/login');
	}else{
		res.status(200);

		var parsedURL = url.parse(req.url,true);
		var queryAsObject = parsedURL.query;

		var owner = queryAsObject.owner;

		console.log("photo owner:"+owner);

		if (owner == req.session.username) {
			MongoClient.connect(mongourl, function(err,db) {
			    assert.equal(err,null);
			    console.log('Connected to MongoDB');
			    var criteria = {};
			    criteria['_id'] = ObjectID(queryAsObject._id);

			   	findPhoto(db,criteria,{},function(result) {
			   		//Testing Log
			   		console.log("user:"+req.session.username+" owner:"+result[0].owner);

			    	if (result[0].owner == req.session.username) {
			    		deletePhoto(db,criteria,function(result){
			    			res.writeHead(200, {"Content-Type": "text/html"});
			    			res.write('Delete was successful!<p>');
	              res.end('<p><a href="/">Back Home</a>\n');
			    		});
			    	}else{
			    		res.writeHead(200, {"Content-Type": "text/html"});
	            res.write('You are not the owner! Failed to delete!');
			        res.end('<p><a href="/">Back Home</a>\n');
			    	}
			    	db.close();
			    });
			});
		}else{
			res.writeHead(200, {"Content-Type": "text/html"});
			res.write('you are not the Owner! Failed to delete!');
      res.end('<p><a href="/">Back Home</a>\n');
		}
	}
});

app.get("/rate", function(req,res) {
  console.log('------------------------------------');
  //Test log
  console.log(req.session);
  console.log('Incoming get request: %s', req.path);

  var parsedURL = url.parse(req.url,true);
  var queryAsObject = parsedURL.query;

  if (!req.session.authenticated) {
    res.redirect('/login');
  }else{
    res.status(200);
    res.render('rate',{id:queryAsObject._id});
  }
});

app.post("/rate", function(req,res) {
  console.log('------------------------------------');
  //Test log
  console.log(req.session);
  console.log('Incoming post request: %s', req.path);

  // var parsedURL = url.parse(req.url,true);
  // var queryAsObject = parsedURL.query;

  if (!req.session.authenticated) {
    res.redirect('/login');
  }else{
    res.status(200);

    var parsedURL = url.parse(req.url,true);
    var queryAsObject = parsedURL.query;

    var form1 = new formidable.IncomingForm();

    form1.parse(req, function (err, fields, files) {
      var score = (fields.rating.length > 0) ? fields.rating : "";
      console.log('rate mark = '+ score);

      MongoClient.connect(mongourl, function(err,db) {
        assert.equal(err,null);
        console.log('Connected to MongoDB');

        var criteria = {};
        criteria['_id'] = ObjectID(queryAsObject._id);

        findPhoto(db,criteria,{},function(photo) {
          var new_r = {};
          new_r['grades'] = photo[0].grades;
          //Testing Log
          console.log('rate returned length = ' + new_r['grades'].length);
          var mkAvailable = true;

          new_r['grades'].forEach(function(rate){
            if (rate.name == req.session.username) {
              mkAvailable = false;
            }
          });

          if (mkAvailable) {
            var newRate = {};
            newRate['name'] = req.session.username;
            newRate['mark'] = score;

            new_r['grades'].push(newRate);

            updatePhoto(db,criteria,new_r,function(result) {
              db.close();
              console.log('Disconnected MongoDB');

              res.writeHead(200, {"Content-Type": "text/html"});
              res.write('Rating was successfully!');
              res.end('<p><a href="/">Back Home</a>\n');
            })

          }else{
            db.close();
            console.log('Disconnected MongoDB');

            res.writeHead(200, {"Content-Type": "text/html"});
            res.write('You cannot do this again!!!');
            res.end('<p><a href="/">Back Home</a>\n');
          }
        });
      });
    });
  }
});


app.get("/edit", function(req,res) {
  console.log('------------------------------------');
  var parsedURL = url.parse(req.url,true);
  var queryAsObject = parsedURL.query;
  //Test log
  console.log(req.session);
  console.log('Incoming get request: %s', req.path);

  if (!req.session.authenticated) {
    res.redirect('/login');
  }else{
    res.status(200);

    var parsedURL = url.parse(req.url,true);
	var queryAsObject = parsedURL.query;

	var owner = queryAsObject.owner;

	console.log("photo owner:"+owner);

	if (owner == req.session.username) {
		MongoClient.connect(mongourl, function(err,db) {
        assert.equal(err,null);
        console.log('Connected to MongoDB');
        var criteria = {};
        criteria['_id'] = ObjectID(queryAsObject._id);
        findPhoto(db,criteria,{},function(photo) {
          db.close();
          console.log('Disconnected MongoDB');
          console.log('Photo returned = ' + photo.length);

          res.render('edit',{photos:photo});
          //res.end(image);
        });
    });
	}else{
		res.writeHead(200, {"Content-Type": "text/html"});
		res.write('you are not the Owner!');
    res.end('<p><a href="/">Back Home</a>\n');
	}
  }
});


app.post('/edit',function(req, res){
  console.log('------------------------------------');
	console.log('Incoming post request: %s', req.path);

	if (!req.session.authenticated) {
		res.redirect('/login');
	}else{
		res.status(200);

		var parsedURL = url.parse(req.url,true);
		var queryAsObject = parsedURL.query;

		var form2 = new formidable.IncomingForm();

		form2.parse(req, function (err, fields, files) {
      var file = files.filesToUpload;
      console.log("file:"+ JSON.stringify(file));

      var size = files.filesToUpload.size;

      console.log("file size:"+ size);

      if (size > 0) {
        console.log("do new file & mimetype");
        var filename = file.path;
        var mimetype = file.type;
      }

      var name = (fields.title.length > 0) ? fields.title : "untitled";
      var borough = (fields.borough.length > 0) ? fields.borough : "untitled";
      var cuisine = (fields.cuisine.length > 0) ? fields.cuisine : "untitled";

      //address
      var street = (fields.street.length > 0) ? fields.street : "";
      var building = (fields.building.length > 0) ? fields.building : "";
      var zipcode = (fields.zipcode.length > 0) ? fields.zipcode : "";
      var gpsLon = (fields.gpsLon.length > 0) ? fields.gpsLon : "";
      var gpsLat = (fields.gpsLat.length > 0) ? fields.gpsLat : "";
      var coord = [gpsLon,gpsLat];
      var id = fields.id;

      console.log("name=" + name+" fileSize="+size+" mimetype:"+mimetype);

      var criteria = {};
      criteria['_id'] = ObjectID(queryAsObject._id);

      var new_r = {};

      if (size > 0) {
        fs.readFile(filename, function(err,data) {
          console.log("do new_r file & mimetype");
          new_r['mimetype'] = mimetype;
          new_r['image'] = new Buffer(data).toString('base64');
        });
      }
          
      new_r['name'] = name;
      new_r['cuisine'] = cuisine;
      new_r['borough'] = borough;

      var address = {};
      address['street'] = street;
      address['building'] = building;
      address['zipcode'] = zipcode;
      address['coord'] = coord;
      new_r['address'] = address;

        MongoClient.connect(mongourl, function(err,db) {
          assert.equal(err,null);
          console.log('Connected to MongoDB');

          console.log(JSON.stringify(new_r));
          updatePhoto(db,criteria,new_r,function(result) {
            db.close();
            console.log('Disconnected MongoDB');

            res.writeHead(200, {"Content-Type": "text/html"});
            res.write('updatePhoto was successfully!');
            res.end('<p><a href="/">Back Home</a>\n');
          });
        });
      });
	}
});


app.post("/search", function(req,res) {
  console.log('------------------------------------');
  //Test log
  console.log(req.session);
  console.log('Incoming post request: %s', req.path);

  if (!req.session.authenticated) {
    res.redirect('/login');
  }else{
    res.status(200);
    var form2 = new formidable.IncomingForm();

    form2.parse(req, function (err, fields, files) {
      var criteria = (fields.criteria.length > 0) ? fields.criteria : "";
      var type = fields.searchType;

      console.log("search:"+type+" c:"+criteria);

        MongoClient.connect(mongourl, function(err,db) {
          assert.equal(err,null);
          console.log('Connected to MongoDB');
            var new_r = {};
            new_r[type] = criteria;

            console.log(JSON.stringify(new_r));

          findPhoto(db,new_r,{},function(photo) {
            db.close();
            console.log('Disconnected MongoDB');
            console.log('Photo returned = ' + photo.length);
            res.render('secrets',{name:req.session.username, photos:photo});
            //res.end(image);
          });
        });
      });
  }
});

app.get("/gps", function(req,res) {
  console.log('------------------------------------');
  console.log('Incoming get request: %s', req.path);

  if (!req.session.authenticated) {
    res.redirect('/login');
  }else{
    res.status(200);

    res.render("gmap.ejs", {
      lat:req.query.lat,
      lon:req.query.lon,
      zoom:18,
      title:req.query.title
    });
    res.end();
  }
});


function insertPhoto(db,r,callback) {
  db.collection('photos').insertOne(r,function(err,result) {
    assert.equal(err,null);
    console.log("insert was successful!");
    console.log(JSON.stringify(result));
    callback(result);
  });
}


function findPhoto(db,criteria,fields,callback) {
  console.log("findPhoto function:"+JSON.stringify(criteria));
  var cursor = db.collection("photos").find(criteria,fields);
  var photos = [];
  cursor.each(function(err,doc) {
    assert.equal(err,null);
    if (doc != null) {
      photos.push(doc);
    } else {
      callback(photos);
    }
  });
}

function regAccount(db,r,callback) {
  db.collection('users').count({name: r['name']},function(err,result){
    assert.equal(err,null);
    console.log("result count: "+result);
    if (result>0) {
      console.log("Account already exists!");
      result = "accExtist";
      callback(result);
    }else{
      db.collection('users').insertOne(r,function(err,result) {
      assert.equal(err,null);
      console.log("insert was successful!");
      console.log(JSON.stringify(result));
      callback(result);
  });
    }
  });
}

function login(db,r,callback) {
  db.collection('users').count(r,function(err,result){
    assert.equal(err,null);
    console.log("result count: "+result);
    if (result<=0) {
      console.log("Login error!");
      result = "err";
    }else{
      console.log("Login successful!");
      result = "loginSucces";
    }
    console.log(JSON.stringify(result));
    callback(result);
  });
}

function deletePhoto(db,criteria,callback) {
  db.collection('photos').remove(criteria,function(err,result) {
    assert.equal(err,null);
    console.log("delete was successful!");
    console.log(JSON.stringify(result));
    callback(result);
  });
}

function updatePhoto(db,criteria,r,callback) {
  console.log("updatePhoto function c:"+JSON.stringify(criteria));
  console.log("updatePhoto function r:"+JSON.stringify(r));
  db.collection('photos').updateOne(criteria,{$set: r},function(err,result) {
    console.log(JSON.stringify(result));
    assert.equal(err,null);
    console.log("update was successful!");
    callback(result);
  });
}

function gpsDecimal(direction,degrees,minutes,seconds) {
  var d = degrees + minutes / 60 + seconds / (60 * 60);
  return (direction === 'S' || direction === 'W') ? d *= -1 : d;
}


app.listen(process.env.PORT || 8099);
