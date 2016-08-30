// By Caleb Bernard
// August 2016

// Includes
var express = require('express');
var handlebars = require('express-handlebars').create({defaultLayout:'main'});
var bodyParser = require('body-parser');
var session = require('express-session');
var secrets = require('./secret/keys.js');
var AWS = require('aws-sdk');
var crypto = require('crypto');

// Boilerplate
var app = express();
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');
app.set('port', 3001);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({secret: secrets.secret}));

// Give AWS my credentials
AWS.config.update({
	region: "us-west-2",
	endpoint: "https://dynamodb.us-west-2.amazonaws.com",
	accessKeyId: secrets.access_id,
	secretAccessKey: secrets.access_key
});
var docClient = new AWS.DynamoDB.DocumentClient();
var sess;

// Modify this to change the sitename everywhere
var sitename = "Branches - Beta";


/*

General Routes

*/


// Homepage
// Note: Transition this to a more blog-feed style - Make sure we can update it without restarting the server
app.get('/', function(req,res){
  sess = req.session;
  var logged_in, name;
  if(sess.name === "" || sess.name === undefined){
    logged_in = false;
  } else {
    logged_in = true;
  }
  res.render('home', {sitename: sitename, logged_in: logged_in, name: sess.name});
  return;
});
app.post('/', function(req,res){
  sess = req.session;
  var logged_in, name;
  if(sess.name === "" || sess.name === undefined){
    logged_in = false;
  } else {
    logged_in = true;
  }
  res.render('home', {sitename: sitename, logged_in: logged_in, name: sess.name});
  return;
});

// Profile page
app.get('/dashboard', function(req,res){
  sess = req.session;
  var return_page = "/";
  var logged_in, name;
  if(sess.name === "" || sess.name === undefined){
    logged_in = false;
    res.render('error', {sitename: sitename, error_msg: "Must be logged in to view profile!", return_page: return_page});
    return;
  } else {
    logged_in = true;
  }
  res.render('dashboard', {sitename: sitename, logged_in: logged_in, name: sess.name});
  return;
});
app.post('/dashboard', function(req,res){
  var sess = req.session;
  var name = sess.name;
  var return_page = req.body.page || "/";
  if (name === "" || name === undefined) {
    res.render('error', {sitename: sitename, error_msg: "You must be logged in before you can view your profile!", return_page: return_page});
    return;
  }
  res.render('dashboard', {sitename: sitename, logged_in: true, name: name});
  return;
});


/*

Friend Management Routes

*/


// Friend Request Page
app.get('/add_friend', function(req,res){
  sess = req.session;
  var return_page = "/";
  var logged_in, name;
  if(sess.name === "" || sess.name === undefined){
    logged_in = false;
    res.render('error', {sitename: sitename, error_msg: "Must be logged in to add a friend!", return_page: return_page});
    return;
  } else {
    logged_in = true;
    res.render('add_friend', {sitename: sitename, logged_in: logged_in, name: sess.name});
    return;
  }
});

// Sending a friend request
app.post('/add_friend', function(req,res){
  var sess = req.session;
  var name = sess.name;
  var request = req.body.friend_req;
  var return_page = req.body.page || "/";
  if (name === "" || name === undefined) {
    res.render('error', {sitename: sitename, error_msg: "You must be logged in before you can add a friend!", return_page: return_page});
    return;
  }
  var checkName = {
    TableName:'users',
    KeyConditionExpression: "username = :name",
      ExpressionAttributeValues: {
        ":name":request
      }
  };
  
  var theirParams = {
    TableName:'users',
    Key: {'username': request},
    UpdateExpression : 'ADD #oldIds :newIds',
    ExpressionAttributeNames : {
      '#oldIds' : 'friend_request_inbox'
    },
    ExpressionAttributeValues : {
      ':newIds' : docClient.createSet([name])
    }
  };
  var myParams = {
    TableName:'users',
    Key: {'username': name},
    UpdateExpression : 'ADD #oldIds :newIds',
    ExpressionAttributeNames : {
      '#oldIds' : 'friend_request_outbox'
    },
    ExpressionAttributeValues : {
      ':newIds' : docClient.createSet([request])
    }
  };
  
  // First, make sure the given username exists.
  docClient.query(checkName, function(err,data) {
    if (err) {
      console.error("Database error: ", JSON.stringify(err, null, 2));
      res.render('error', {sitename: sitename, error_msg: "Something weird happened with the database.", logged_in: logged_in, name: name, return_page: return_page});
      return;
    } else {
      if (data.Count === 0) {
        res.render('error', {sitename: sitename, error_msg: "That username was not found.", logged_in: logged_in, name: name, return_page: return_page});
        return;
      } else {
        docClient.update(myParams, function (err, data){
          if (err) {
            console.error("Database error: ", JSON.stringify(err, null, 2));
            res.render('error', {sitename: sitename, error_msg: "Something weird happened with the database(1).", logged_in: logged_in, name: name, return_page: return_page});
            return;
          } else {
            docClient.update(theirParams, function (err, data){
              if (err) {
                console.error("Database error: ", JSON.stringify(err, null, 2));
                res.render('error', {sitename: sitename, error_msg: "Something weird happened with the database(2).", logged_in: logged_in, name: name, return_page: return_page});
                return;
              } else {
                res.render('success', {sitename: sitename, success_msg: "Friend request sent!", return_page: return_page, logged_in: true, name: name});
                return;
              }
            });
          }
        });
      }
    }
  });
});

// Friend Request Management Page
app.get('/check_friend_requests', function(req,res){
  sess = req.session;
  var return_page = "/dashboard";
  var logged_in;
  var name = sess.name;
  if(sess.name === "" || sess.name === undefined){
    logged_in = false;
    res.render('error', {sitename: sitename, error_msg: "Must be logged in to manage your friend requests!", return_page: return_page});
    return;
  }
  
  var params = {
    TableName:'users',
    KeyConditionExpression: "username = :name",
      ExpressionAttributeValues: {
        ":name":name
      }
  };
  
  docClient.query(params, function (err, data){
    if (err) {
      console.error("Database error: ", JSON.stringify(err, null, 2));
      res.render('error', {sitename: sitename, error_msg: "Something weird happened with the database.", return_page: return_page});
      return;
    } else {
      var inbox = data.Items[0].friend_request_inbox;
      var outbox = data.Items[0].friend_request_outbox;
      if (inbox && outbox) {
        res.render('check_friend_requests', {sitename: sitename, requests_in: inbox.values, requests_out: outbox.values, logged_in: true, name: name});
        return;
      } else if (inbox) {
        res.render('check_friend_requests', {sitename: sitename, requests_in: inbox.values, requests_out: [], logged_in: true, name: name});
        return;
      } else if (outbox) {
        res.render('check_friend_requests', {sitename: sitename, requests_in: [], requests_out: outbox.values, logged_in: true, name: name});
        return;
      } else {
        res.render('check_friend_requests', {sitename: sitename, requests_in: [], requests_out: [], logged_in: true, name: name});
        return;
      }
    }
  });
});

// Cancel an outstanding friend request
app.post('/cancel_friend_request', function(req,res) {
  var sess = req.session;
  var request = req.body.who_to_cancel;
  var name = sess.name;
  var return_page = req.body.return_page || "/";
  var logged_in;
  if(sess.name === "" || sess.name === undefined){
    logged_in = false;
    res.render('error', {sitename: sitename, error_msg: "Must be logged in to manage your friend requests!", return_page: return_page});
    return;
  }
  var params = {
    TableName: "users",
    KeyConditionExpression: "username = :user",
    ExpressionAttributeValues: {
      ":user":name
    }
  }
  docClient.query(params, function(err,data) {
    if (err){
      console.error("Database error: ", JSON.stringify(err, null, 2));
      res.render('error', {sitename: sitename, error_msg: "Something weird happened with the database.", logged_in: logged_in, name: name, return_page: return_page});
      return;
    } else {
      if (!data.Items[0].friend_request_outbox.values) {
        res.render('error', {sitename: sitename, error_msg: "You have no requests to cancel.", logged_in: logged_in, name: name, return_page: return_page});
        return;
      } else {
        for (x = 0; x < data.Items[0].friend_request_outbox.values.length; x++) {
          if (data.Items[0].friend_request_outbox.values[x] == request) {
            // Remove the user from the friend request outbox AND remove this user from their inbox.
            var myParams = {
              TableName:'users',
              Key: {'username': name},
              UpdateExpression: 'delete #attribute :values',
              ExpressionAttributeNames : {
                '#attribute': 'friend_request_outbox'
              },
              ExpressionAttributeValues: {
                ':values': docClient.createSet([request])
              }
            };
            var theirParams = {
              TableName:'users',
              Key: {'username': request},
              UpdateExpression: 'delete #attribute :values',
              ExpressionAttributeNames : {
                '#attribute': 'friend_request_inbox'
              },
              ExpressionAttributeValues : {
                ':values': docClient.createSet([name])
              }
            };
            docClient.update(myParams, function(err,data){
              if (err){
                console.error("Database error: ", JSON.stringify(err, null, 2));
                res.render('error', {sitename: sitename, error_msg: "Something weird happened with the database.", logged_in: logged_in, name: name, return_page: return_page});
                return;
              } else {
                docClient.update(theirParams, function(err,data){
                  if (err){
                    console.error("Database error: ", JSON.stringify(err, null, 2));
                    res.render('error', {sitename: sitename, error_msg: "Something weird happened with the database.", logged_in: logged_in, name: name, return_page: return_page});
                    return;
                  } else {
                    res.render('success', {sitename: sitename, success_msg: "Friend request canceled successfully.", logged_in: logged_in, name: name, return_page: return_page});
                    return;
                  }
                });
              }
            });
          } else {
            if (x == data.Items[0].friend_request_outbox.values.length) {
              res.render('error', {sitename: sitename, error_msg: "No friend request to that user could be found.", logged_in: logged_in, name: name, return_page: return_page});
              return;
            }
          }
        }
      }
    }
  });
});

// Reject an incoming friend request (flipped cancel)
app.post('/reject_friend_request', function(req,res) {
  var sess = req.session;
  var request = req.body.who_to_reject;
  var name = sess.name;
  var return_page = req.body.page || "/";
  var logged_in;
  if(sess.name === "" || sess.name === undefined){
    logged_in = false;
    res.render('error', {sitename: sitename, error_msg: "Must be logged in to manage your friend requests!", return_page: return_page});
    return;
  }
  var params = {
    TableName: "users",
    KeyConditionExpression: "username = :user",
    ExpressionAttributeValues: {
      ":user":name
    }
  }
  docClient.query(params, function(err,data) {
    if (err){
      console.error("Database error: ", JSON.stringify(err, null, 2));
      res.render('error', {sitename: sitename, error_msg: "Something weird happened with the database.", return_page: return_page});
      return;
    } else {
      if (!data.Items[0].friend_request_inbox.values) {
        res.render('error', {sitename: sitename, error_msg: "You have no requests to reject.", return_page: return_page});
        return;
      } else {
        for (x = 0; x < data.Items[0].friend_request_inbox.values.length; x++) {
          if (data.Items[0].friend_request_inbox.values[x] == request) {
            // Remove the user from the friend request inbox AND remove this user from their outbox.
            var myParams = {
              TableName:'users',
              Key: {'username': name},
              UpdateExpression: 'delete #attribute :values',
              ExpressionAttributeNames : {
                '#attribute': 'friend_request_inbox'
              },
              ExpressionAttributeValues: {
                ':values': docClient.createSet([request])
              }
            };
            var theirParams = {
              TableName:'users',
              Key: {'username': request},
              UpdateExpression: 'delete #attribute :values',
              ExpressionAttributeNames : {
                '#attribute': 'friend_request_outbox'
              },
              ExpressionAttributeValues : {
                ':values': docClient.createSet([name])
              }
            };
            docClient.update(myParams, function(err,data){
              if (err){
                console.error("Database error: ", JSON.stringify(err, null, 2));
                res.render('error', {sitename: sitename, error_msg: "Something weird happened with the database.", return_page: return_page});
                return;
              } else {
                docClient.update(theirParams, function(err,data){
                  if (err){
                    console.error("Database error: ", JSON.stringify(err, null, 2));
                    res.render('error', {sitename: sitename, error_msg: "Something weird happened with the database.", return_page: return_page});
                    return;
                  } else {
                    res.render('success', {sitename: sitename, success_msg: "Friend request rejected successfully.", return_page: return_page});
                    return;
                  }
                });
              }
            });
          } else {
            if (x == data.Items[0].friend_request_inbox.values.length) {
              res.render('error', {sitename: sitename, error_msg: "No friend request from that user could be found.", return_page: return_page});
              return;
            }
          }
        }
      }
    }
  });
});

// Accept an incoming friend request (like reject but also add to each user's friends list)
app.post('/accept_friend_request', function(req,res) {
  var sess = req.session;
  var request = req.body.who_to_accept;
  var name = sess.name;
  var return_page = req.body.page || "/";
  var logged_in;
  if(name === "" || name === undefined){
    logged_in = false;
    res.render('error', {sitename: sitename, error_msg: "Must be logged in to view profile!", logged_in: logged_in, return_page: return_page});
    return;
  } else {
    logged_in = true;
  }
  var params = {
    TableName: "users",
    KeyConditionExpression: "username = :user",
    ExpressionAttributeValues: {
      ":user":name
    }
  }
  docClient.query(params, function(err,data) {
    if (err){
      console.error("Database error: ", JSON.stringify(err, null, 2));
      res.render('error', {sitename: sitename, error_msg: "Something weird happened with the database.", logged_in: logged_in, return_page: return_page});
      return;
    } else {
      if (!data.Items[0].friend_request_inbox.values) {
        res.render('error', {sitename: sitename, error_msg: "You have no requests to accept.", logged_in: logged_in, return_page: return_page});
        return;
      } else {
        for (x = 0; x < data.Items[0].friend_request_inbox.values.length; x++) {
          if (data.Items[0].friend_request_inbox.values[x] == request) {
            // Remove the user from the friend request inbox AND remove this user from their outbox.
            var myParams = {
              TableName:'users',
              Key: {'username': name},
              UpdateExpression: 'delete #attribute :values',
              ExpressionAttributeNames : {
                '#attribute': 'friend_request_inbox'
              },
              ExpressionAttributeValues: {
                ':values': docClient.createSet([request])
              }
            };
            var theirParams = {
              TableName:'users',
              Key: {'username': request},
              UpdateExpression: 'delete #attribute :values',
              ExpressionAttributeNames : {
                '#attribute': 'friend_request_outbox'
              },
              ExpressionAttributeValues : {
                ':values': docClient.createSet([name])
              }
            };
            
            var theirAddParams = {
              TableName:'users',
              Key: {'username': request},
              UpdateExpression : 'ADD #oldIds :newIds',
              ExpressionAttributeNames : {
                '#oldIds' : 'friend_list'
              },
              ExpressionAttributeValues : {
                ':newIds' : docClient.createSet([name])
              }
            };
            var myAddParams = {
              TableName:'users',
              Key: {'username': name},
              UpdateExpression : 'ADD #oldIds :newIds',
              ExpressionAttributeNames : {
                '#oldIds' : 'friend_list'
              },
              ExpressionAttributeValues : {
                ':newIds' : docClient.createSet([request])
              }
            };
            docClient.update(myParams, function(err,data){
              if (err){
                console.error("Database error: ", JSON.stringify(err, null, 2));
                res.render('error', {sitename: sitename, error_msg: "Something weird happened with the database.", logged_in: logged_in, return_page: return_page});
                return;
              } else {
                docClient.update(theirParams, function(err,data){
                  if (err){
                    console.error("Database error: ", JSON.stringify(err, null, 2));
                    res.render('error', {sitename: sitename, error_msg: "Something weird happened with the database.", logged_in: logged_in, return_page: return_page});
                    return;
                  } else {
                    docClient.update(theirAddParams, function(err,data){
                      if (err) {
                        console.error("Database error: ", JSON.stringify(err,null,2));
                        res.render('error', {sitename: sitename, error_msg: "Something weird happened with the database.", logged_in: logged_in, return_page: return_page});
                        return;
                      } else {
                        docClient.update(myAddParams, function(err,data){
                          if (err) {
                            console.error("Database error: ", JSON.stringify(err,null,2));
                            res.render('error', {sitename: sitename, error_msg: "Something weird happened with the database.", logged_in: logged_in, return_page: return_page});
                            return;
                          } else {
                            res.render('success', {sitename: sitename, success_msg: "Friend added successfully!", logged_in: logged_in, return_page: return_page});
                            return;
                          }
                        });
                      }
                    });
                  }
                });
              }
            });
          } else {
            if (x == data.Items[0].friend_request_inbox.values.length) {
              res.render('error', {sitename: sitename, error_msg: "No friend request from that user could be found.", logged_in: logged_in, return_page: return_page});
              return;
            }
          }
        }
      }
    }
  });
});

// Friend List Page
app.get('/check_friends', function(req,res){
  sess = req.session;
  var return_page = "/dashboard";
  var logged_in;
  var name = sess.name;
  if(sess.name === "" || sess.name === undefined){
    logged_in = false;
    res.render('error', {sitename: sitename, error_msg: "Must be logged in to manage your friends!", return_page: return_page});
    return;
  }
  
  var params = {
    TableName:'users',
    KeyConditionExpression: "username = :name",
      ExpressionAttributeValues: {
        ":name":name
      }
  };
  
  docClient.query(params, function (err, data){
    if (err) {
      console.error("Database error: ", JSON.stringify(err, null, 2));
      res.render('error', {sitename: sitename, error_msg: "Something weird happened with the database.", return_page: return_page});
      return;
    } else {
      var friends = data.Items[0].friend_list;
      if (friends) {
        res.render('check_friends', {sitename: sitename, friends: friends.values, logged_in: true, name: name});
        return;
      } else {
        res.render('check_friends', {sitename: sitename, requests_in: [], requests_out: [], logged_in: true, name: name});
        return;
      }
    }
  });
});

// Delete a Friend Code
app.post('/delete_friend', function(req,res){
  var sess = req.session;
  var request = req.body.who_to_delete;
  var name = sess.name;
  var pass = req.body.password;
  var return_page = req.body.page || "/";
  var logged_in;
  if(name === "" || name === undefined){
    logged_in = false;
    res.render('error', {sitename: sitename, error_msg: "Must be logged in to view profile!", logged_in: logged_in, name: name, return_page: return_page});
    return;
  } else {
    logged_in = true;
  }
  var params = {
    TableName: "users",
    KeyConditionExpression: "username = :user",
    ExpressionAttributeValues: {
      ":user":name
    }
  }
  docClient.query(params, function(err,data) {
    if (err){
      console.error("Database error: ", JSON.stringify(err, null, 2));
      res.render('error', {sitename: sitename, error_msg: "Something weird happened with the database.", logged_in: logged_in, name: name, return_page: return_page});
      return;
    } else {
      // Now we want to hash the given password using the salt in the database.
      console.log(data);
		  var salt = data.Items.salt;
		  console.log(data.Items[0].salt);
		  var hash = crypto.createHash('sha256');
		  hash.update(pass + salt);
		  var hashedPassword = hash.digest('hex');
		  console.log(hashedPassword);
			if (hashedPassword == data.Items.password){
			// Delete the account here. Update this as mentioned above.
				docClient.delete(params, function(err, data) {
				  if (err){
				    res.render('error', {sitename: sitename, error_msg: "Database error - could not delete friend.", return_page: return_page, logged_in: true, name: name});
				  } else {
            if (!data.Items[0].friend_list.values) {
              res.render('error', {sitename: sitename, error_msg: "You have no friends to delete.", logged_in: logged_in, name: name, return_page: return_page});
              return;
            } else {
              for (x = 0; x < data.Items[0].friend_list.length; x++) {
                if (data.Items[0].friend_list.values[x] == request) {
                  // Remove the user from the friend request inbox AND remove this user from their outbox.
                  var myParams = {
                    TableName:'users',
                    Key: {'username': name},
                    UpdateExpression: 'delete #attribute :values',
                    ExpressionAttributeNames : {
                      '#attribute': 'friend_list'
                    },
                    ExpressionAttributeValues: {
                      ':values': docClient.createSet([request])
                    }
                  };
                  var theirParams = {
                    TableName:'users',
                    Key: {'username': request},
                    UpdateExpression: 'delete #attribute :values',
                    ExpressionAttributeNames : {
                      '#attribute': 'friend_list'
                    },
                    ExpressionAttributeValues : {
                      ':values': docClient.createSet([name])
                    }
                  };
                  docClient.update(myParams, function(err,data){
                    if (err){
                      console.error("Database error: ", JSON.stringify(err, null, 2));
                      res.render('error', {sitename: sitename, error_msg: "Something weird happened with the database.", logged_in: logged_in, name: name, return_page: return_page});
                      return;
                    } else {
                      docClient.update(theirParams, function(err,data){
                        if (err){
                          console.error("Database error: ", JSON.stringify(err, null, 2));
                          res.render('error', {sitename: sitename, error_msg: "Something weird happened with the database.", logged_in: logged_in, name: name, return_page: return_page});
                          return;
                        } else {
                          res.render('success', {sitename: sitename, logged_in: logged_in, name: name, return_page: return_page, success_msg: request + " has been removed from your friends list"});
                          return;
                        }
                      });
                    }
                  });
                } else {
                  if (x == data.Items[0].friend_request_inbox.values.length) {
                    res.render('error', {sitename: sitename, error_msg: "That user could not be found in your friends list.", name: name, logged_in: logged_in, return_page: return_page});
                    return;
                  }
                }
              }
            }
				  }
				});
      } else {
        res.render('error', {sitename: sitename, name: name, logged_in: logged_in, return_page: return_page, error_msg: "Wrong password, try again!"});
        return;
      }
    }
  });
});


/*

Account Management Routes

*/


// Create Account Page
app.get('/create_account', function(req,res){
  sess = req.session;
  var logged_in, name;
  if(sess.name === "" || sess.name === undefined){
    logged_in = false;
  } else {
    logged_in = true;
  }
  res.render('create_account', {sitename: sitename, logged_in: logged_in, name: sess.name});
  return;
});

// Create a new account
// NOTE: Later I should add an email field.
app.post('/create_account', function(req,res){
  var sess = req.session;
  var password_min_length = 5;
  var username_max_length = 20;
  var name = req.body.name.toLowerCase();
  var password = req.body.password;
  var pattern = /^[a-z0-9]+$/i;
  var return_page = req.body.page || "/";
  // Make sure they are not already logged in.
  if (sess.name !== "" && sess.name !== undefined) {
    res.render('error', {sitename: sitename, error_msg: "Please log out before making a new account.", return_page: return_page, logged_in: true, name: sess.name});
    return;
  // Make sure the name and password were both entered.
  } else if (!name || !password){
    res.render('error', {sitename: sitename, error_msg: "One or more fields was left blank.", return_page: return_page});
    return;
  // Make sure the password is long enough.
  } else if (password.length < password_min_length){
    res.render('error', {sitename: sitename, error_msg: "Your password must be at least " + password_min_length + " characters long.", return_page: return_page});
    return;
  // Make sure the username is not too long or short.
  } else if (name < 1 || name > username_max_length) {
    res.render('error', {sitename: sitename, error_msg: "Username cannot be shorter than 1 or longer than " + username_max_length + " characters.", return_page: return_page});
    return;
  } else if (!pattern.test(name)) {
    res.render('error', {sitename: sitename, error_msg: "Username must only use alphanumeric characters.", return_page: return_page});
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
        res.render('error', {sitename: sitename, error_msg: "Something weird happened with the database.", return_page: return_page});
        return;
      } else {
        if (data.Count !== 0) {
          res.render('error', {sitename: sitename, error_msg: "This username is already taken. Please try again.", return_page: return_page});
          return;
        } else {
          
          // If everything so far is good, then we create the account.
          docClient.put(params, function(err, data) {
   	        if (err) {
              console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
		          res.render('error', {sitename: sitename, error_msg: "Account could not be created.", return_page: return_page});
		          return;
    	      } else {
              sess.name = name;
              res.render('success', {sitename: sitename, success_msg: "Account created successfully!", return_page: "/dashboard", logged_in: true, name: sess.name});
              return;
    	      }
          });
        }
      }
    });
  }
});

// Login code
app.post('/login', function(req,res){
  var sess = req.session;

  // Setup for our database queries
  var name = req.body.name.toLowerCase();
  var pass = req.body.password;
  var return_page = "/dashboard";
  
  // If they're already logged in, we want them to log out before logging in again.
  if(sess.name !== "" && sess.name !== undefined){
		res.render('error', {sitename: sitename, error_msg: "Please logout of your current account first. Currently logged in as:" + sess.name, return_page: return_page});
		return;
  }
  
  if (!name || !pass) {
    res.render('error', {sitename: sitename, error_msg: "One or more required fields was left blank.", return_page: return_page});
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
      res.render('error', {sitename: sitename, error_msg: "Something weird happened with the database.", return_page: return_page});
      return;
    } else {
      if (data.Count === 0) {
        res.render('error', {sitename: sitename, error_msg: "That username was not found.", return_page: return_page});
        return;
      } else {
        // If the username exists, see if the password entered matches the one stored.
        docClient.get(checkPassword, function(err,data) {
          if (err){
			      console.log("Error - could not read from database: " + JSON.stringify(err, null, 2));
			      res.render('error', {sitename: sitename, error_msg: "Database is being weird", return_page: return_page});
			      return;
		      } else {
		        // Now we want to hash the given password using the salt in the database.
		        var salt = data.Item.salt;
		        var hash = crypto.createHash('sha256');
		        hash.update(pass + salt);
		        var hashedPassword = hash.digest('hex');
			      if (hashedPassword == data.Item.password){
				      sess.name = name;
				      res.render('success', {sitename: sitename, success_msg: "Logged in successfully! logged in as: " + sess.name, return_page: return_page, logged_in: true, name: name});
				      return;
			      } else {
				      res.render('error', {sitename: sitename, error_msg: "Wrong credentials! Please try again.", return_page: return_page});
				      return;
			     }
		      }
        });
      }
    }
  });
});

// Logout code
app.post("/logout", function(req,res){
	sess = req.session;
	var return_page = req.body.page || "/";
	if (sess.name === "" || sess.name === undefined) {
	  res.render('success', {sitename: sitename, success_msg: "You were already not logged in.", return_page: return_page, logged_in: false});
	  return;
	} else {
	  var prev_name = sess.name;
	  sess.name = "";
	  res.render('success', {sitename: sitename, success_msg: "Logged out of " + prev_name + " successfully!", return_page: return_page, logged_in: false});
	  return;
	}
});

// Delete Account Page
app.get("/delete_account", function(req,res){
  sess = req.session;
  var return_page = "/";
  var logged_in, name;
  if(sess.name === "" || sess.name === undefined){
    logged_in = false;
    res.render('error', {sitename: sitename, error_msg: "Must be logged in to delete account!", return_page: return_page});
    return;
  } else {
    logged_in = true;
  }
  res.render('delete_account', {sitename: sitename, logged_in: logged_in, name: sess.name});
  return;
});

// Delete Account code
  // Monitor this whenever I modify the database -- I need to remove all references to this account!
  // Also to consider: What to do about this user's shared content?
app.post("/delete_account", function(req,res){
  sess = req.session;
  var return_page = req.body.page || "/";
  var logged_in;
  var name = sess.name;
  var pass = req.body.password;
  if(sess.name === "" || sess.name === undefined){
    logged_in = false;
    res.render('error', {sitename: sitename, error_msg: "Must be logged in to delete account!", return_page: return_page});
    return;
  } else {
    var params = {
      TableName:"users",
      Key:{
        "username":name
      }
    }
    // See if the password entered matches the one stored.
        docClient.get(params, function(err,data) {
          if (err){
			      console.log("Error - could not read from database: " + JSON.stringify(err, null, 2));
			      res.render('error', {sitename: sitename, error_msg: "Database is being weird", return_page: return_page});
			      return;
		      } else {
		        // Now we want to hash the given password using the salt in the database.
		        var salt = data.Item.salt;
		        var hash = crypto.createHash('sha256');
		        hash.update(pass + salt);
		        var hashedPassword = hash.digest('hex');
			      if (hashedPassword == data.Item.password){
			        // Delete the account here. Update this as mentioned above.
				      docClient.delete(params, function(err, data) {
				        if (err){
				          res.render('error', {sitename: sitename, error_msg: "Database error - could not delete account.", return_page: return_page, logged_in: true, name: sess.name});
				        } else {
				          sess.name="";
				          res.render('success', {sitename: sitename, success_msg: "Account deleted.", return_page: "/", logged_in: false});
				          return;
				        }
				      });
				      
			      } else {
				      res.render('error', {sitename: sitename, error_msg: "Wrong credentials! Please try again.", return_page: return_page});
				      return;
			     }
		      }
        });
  }
});


/*

Boilerplate Routes

*/


// Error 404 boilerplate
app.use(function(req,res){
	res.render('404', {sitename: sitename});
	return;
});

// Error 500 boilerplate
app.use(function(err,req,res,next){
	res.render('500', {sitename: sitename});
	return;
});

// Start the server boilerplate
app.listen(app.get('port'), function(){
	console.log("Server started on port " + app.get('port') + ".");
});