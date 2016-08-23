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
  sess = req.session;
  if(sess.name === "" || sess.name === undefined){
		res.render('home', {sitename: sitename, logged_in_as: "Not logged in"});
		return;
	} else {
	  res.render('home', {sitename: sitename, logged_in: true, name: sess.name});
	}
});

// Create a new account
// NOTE: Later I should add an email field.
app.post('/create_account', function(req,res){
  var password_min_length = 5;
  var name = req.body.name;
  var password = req.body.password;
  var return_page = req.body.page;
  // Make sure they are not already logged in.
  if (sess.name !== "" && sess.name !== undefined) {
    res.render('error', {error_msg: "Please log out before making a new account.", return_page: return_page, logged_in: true, name: name});
    return;
  // Make sure the name and password were both entered.
  } else if (!name || !password){
    res.render('error', {error_msg: "One or more fields was left blank.", return_page: return_page});
    return;
  // Make sure the password is long enough.
  } else if (password.length < password_min_length){
    res.render('error', {error_msg: "Your password must be at least " + password_min_length + " characters long.", return_page: return_page});
    return;
  } else {
    
    // Generate a 16-byte ASCII salt.
    var salt = (crypto.randomBytes(16)).toString('hex');
    var hash = crypto.createHash('sha256');
    // Hash the password + salt
    hash.update(password + salt);
    password = hash.digest('hex');
    
    // These objects are used for database calls
    var table = "users";
    var checkName = {
      TableName:table,
      KeyConditionExpression: "username = :name",
      ExpressionAttributeValues: {
        ":name":name
      }
    };
	  var params = {
		  TableName:table,
		  Item:{
			  "username":name,
			  "password":password,
			  "salt":salt
		  }
	  };
	  
	  // Check to see if the chosen username is already taken.
    docClient.query(checkName, function(err, data) {
      if (err) {
        console.error("Database error: ", JSON.stringify(err, null, 2));
        res.render('error', {error_msg: "Something weird happened with the database.", return_page: return_page});
        return;
      } else {
        if (data.Count !== 0) {
          console.log("Username taken.");
          res.render('error', {error_msg: "This username is already taken. Please try again.", return_page: return_page});
          return;
        } else {
          
          // If everything so far is good, then we create the account.
          docClient.put(params, function(err, data) {
   	        if (err) {
              console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
		          res.render('error', {error_msg: "Account could not be created.", return_page: return_page});
		          return;
    	      } else {
              console.log("Added item:", JSON.stringify(data, null, 2));
              sess.name = name;
              res.render('success', {success_msg: "Account created successfully!", return_page: return_page, logged_in: true, name: name});
              return;
    	      }
          });
        }
      }
    });
  }
});

app.post('/profile', function(req,res){
  var sess = req.session;
  var name = req.session.name;
  var return_page = req.session.page;
  if (name === "" || name === undefined) {
    res.render('error', {error_msg: "You must be logged in before you can view your profile!", return_page: return_page});
    return;
  }
  res.render('profile', {logged_in: true, name: name})
  
});

// Login route
app.post('/login', function(req,res){
  var sess = req.session;

  // Setup for our database queries
  var name = req.body.name;
  var pass = req.body.password;
  var return_page = req.body.page;
  
  // If they're already logged in, we want them to log out before logging in again.
  if(sess.name !== "" && sess.name !== undefined){
		res.render('error', {error_msg: "Please logout of your current account first. Currently logged in as:" + sess.name, return_page: return_page});
		return;
  }
  
  if (!name || !pass) {
    res.render('error', {error_msg: "One or more required fields was left blank.", return_page: return_page});
    return;
  }
  
  var checkUsername = {
    TableName:"users",
      KeyConditionExpression: "username = :name",
      ExpressionAttributeValues: {
        ":name":name
      }
  };
  var checkPassword = {
    TableName:"users",
    Key:{
      "username":name
    }
  };
  
  // First, make sure the given username exists.
  docClient.query(checkUsername, function(err,data) {
    if (err) {
      console.error("Database error: ", JSON.stringify(err, null, 2));
      res.render('error', {error_msg: "Something weird happened with the database.", return_page: return_page});
      return;
    } else {
      if (data.Count === 0) {
        console.log("Bad username");
        res.render('error', {error_msg: "That username was not found.", return_page: return_page});
        return;
      } else {
        // If the username exists, see if the password entered matches the one stored.
        docClient.get(checkPassword, function(err,data) {
          if (err){
			      console.log("Error - could not read from database: " + JSON.stringify(err, null, 2));
			      res.render('error', {error_msg: "Database is being weird", return_page: return_page});
			      return;
		      } else {
		        // Now we want to hash the given password using the salt in the database.
		        var salt = data.Item.salt;
		        var hash = crypto.createHash('sha256');
		        hash.update(pass + salt);
		        var hashedPassword = hash.digest('hex');
			      if (hashedPassword == data.Item.password){
				      sess.name = name;
				      res.render('success', {success_msg: "Logged in successfully! logged in as: " + sess.name, return_page: return_page, logged_in: true, name: name});
				      return;
			      } else {
				      res.render('error', {error_msg: "Wrong credentials! Please try again.", return_page: return_page});
				      return;
			     }
		      }
        });
      }
    }
  });
});

// Logout route
app.post("/logout", function(req,res){
	sess = req.session;
	var return_page = req.body.page;
	if (sess.name === "" || sess.name === undefined) {
	  res.render('success', {success_msg: "You were already not logged in.", return_page: return_page, logged_in: false});
	  return;
	} else {
	  var prev_name = sess.name;
	  sess.name = "";
	  console.log("logged out of " + prev_name);
	  res.render('success', {success_msg: "Logged out of " + prev_name + " successfully!", return_page: return_page, logged_in: false});
	  return;
	}
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
