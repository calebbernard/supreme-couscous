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
	endpoint: "https://dynamodb.us-west-2.amazonaws.com"
});

var docClient = new AWS.DynamoDB.DocumentClient();
var sess;

var sitename = "Branches";


app.get('/', function(req,res){
	res.render('home', {sitename: sitename});
});

app.post('/create_account', function(req,res){
  var name = req.body.name;
  var password = req.body.password;
  if (!name || !password){
    res.render(error, {error_msg: "One or more fields was left blank.", return_page: "/"})
  }
  else {
    res.send("Cool!");
  }
});

app.post('/test', function(req,res){
  var text = req.body.text;
  var hash = crypto.createHash('sha256');
  hash.update(text);
  var hashedText = hash.digest('hex');
  res.render('test', {hash: hashedText, text: text});
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
