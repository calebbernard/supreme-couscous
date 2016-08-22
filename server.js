var express = require('express');
var app = express();
var handlebars = require('express-handlebars').create({defaultLayout:'main'});
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');
app.set('port', 3000);
var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
var session = require('express-session');
app.use(session({secret: process.env.NODESECRET}));
var AWS = require('aws-sdk');
var crypto = require('crypto');

AWS.config.update({
	region: "us-west-2",
	endpoint: "https://dynamodb.us-west-2.amazonaws.com",
	accessKeyId: process.env.ACCESS_KEY_ID,
	secretAccessKey: process.env.ACCESS_KEY
});

var docClient = new AWS.DynamoDB.DocumentClient();
var sess;

var sitename = "Branches";


app.get('/', function(req,res){
	res.render('home', {sitename: sitename});
});

app.post('/create_account', function(req,res){
  var password_min_length = 5;
  var name = req.body.name;
  var password = req.body.password;
  if (!name || !password){
    res.render('error', {error_msg: "One or more fields was left blank.", return_page: "/"});
  } else if (password.length < password_min_length){
    res.render('error', {error_msg: "Your password must be at least " + password_min_length + " characters long.", return_page: "/"});
  } else {
    var salt = crypto.randomBytes(16);
    console.log(salt);
    var hash = crypto.createHash('sha256');
    hash.update(password + salt);
    password = hash.digest('hex');
    var table = "users";
	  var params = {
		  TableName:table,
		  Item:{
			  "username":name,
			  "password":password,
			  "salt":salt
		  }
	  }

	  docClient.put(params, function(err, data) {
   	  if (err) {
        console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
		    res.render('error', {error_msg: "Account could not be created.", return_page: "/"});
		    return;
    	} else {
        console.log("Added item:", JSON.stringify(data, null, 2));
        res.send("Cool!");
    	}
});
  }
});

app.post('/test', function(req,res){
  var pass = req.body.text;
  var salt = req.body.salt;
  var hash = crypto.createHash('sha256');
  hash.update(pass + salt);
  var hashedText = hash.digest('hex');
  res.render('test', {hash: hashedText, pass: pass, salt: salt});
});

app.use(function(req,res){
	res.render('404');
});

app.use(function(err,req,res,next){
	res.render('500');
});

app.listen(app.get('port'), function(){
	console.log("Server started on port " + app.get('port') + ".");
});
