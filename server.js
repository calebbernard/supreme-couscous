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
var AWS = require("aws-sdk");

AWS.config.update({
	region: "us-west-2",
	endpoint: "https://dynamodb.us-west-2.amazonaws.com"
});

var docClient = new AWS.DynamoDB.DocumentClient();
var sess;


app.get('/', function(req,res){
	res.render('home');
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
