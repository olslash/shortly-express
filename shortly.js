var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bcrypt = require('bcrypt-nodejs');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var cookieParser = require('cookie-parser');
var expressSession = require('express-session');

var app = express();

app.use(cookieParser());
app.use(expressSession({secret: 'Mitch'}));

app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(partials());
  app.use(express.bodyParser())
  app.use(express.static(__dirname + '/public'));
});

app.get('/', function(req, res) {
  // console.log(req.session);
  // if checkuser says theyre not logged in, redirect login
  if(!req.session.username) { res.redirect('login'); }
  res.render('index');
});

app.get('/create', function(req, res) {
  // if checkuser says theyre not logged in, redirect login
  if(!req.session.username) { res.redirect('login'); }
  res.render('index');
});

app.get('/links', function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links', function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }
        console.log(req.session)
        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin,
          user_id: req.session.userid
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/
app.get('/logout', function(req, res) {
   if(req.session.username) {
    req.session.destroy(function(err) {
      if(err) { }
      res.redirect('login');
    });
  }
   else {res.redirect('login');}
});

app.get('/signup', function(req, res) {
  if(req.session.username) { res.redirect('index'); }
  res.render('signup');
});

app.post('/signup', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;
  var password = bcrypt.hashSync(password, null);
  var user = new User({
    username: username,
    password: password
  });

  user.save().then(function(newUser) {
    console.log(newUser);
    Users.add(newUser);
    req.session.username = username;
    req.session.userid = newUser.id;
    console.log(req.session);
    res.redirect('index');
  }).catch(function(error){
    res.send(500, error);
  });
});

app.get('/login', function(req, res) {
  if(req.session.username) { res.redirect('index'); }
  res.render('login');
});

app.post('/login', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  var user = new User({
    username: username
  });

  user.fetch({require: true}).then(function(user){
    console.log(user);
    if(bcrypt.compareSync(password, user.attributes.password)){
      req.session.username = username;
      req.session.userid = user.id;
      res.redirect('index');
    }else{
      res.redirect('login');
    }
  })
  .catch(function(error){
    res.redirect('signup');
    console.log(error);
  });
});


/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
