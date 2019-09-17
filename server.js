const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const cors = require('cors');

const mongoose = require('mongoose');
mongoose.connect(process.env.MLAB_URI, {
  useNewUrlParser : true,
  dbName : "Exercise",
  useUnifiedTopology : true
});
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function(){
  console.log('They\'re connected!');
});



app.use(cors());

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());


app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});;



const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})


const activitySchema = new mongoose.Schema({
  description : {
    type: String,
    required: true
  },
  duration : {
    type: Number,
    required: true
  },
  date : {
    type: String,
    required: true
  }
})


const userSchema = new mongoose.Schema({
  username : {
    type: String,
    required: true
  },
  log : {
    type: [activitySchema]
  }
});

const User = mongoose.model("user", userSchema);




app.post('/api/exercise/new-user', function (req, res) {

  let username = req.body.username;
  
  User.find({username: username}, (err, data) => {
    if (err) console.log(err);
    else if (data.length > 0) {
      res.send('username already taken');
    } else {
      console.log('Creating new user');
      let new_user = new User({
        username: username
      });
      new_user.save(function() {
        User.find({username: username}, (err, data) => {
          let id;
          if (err) console.error(err);
          else {
            id = data[0]._id;
          }
          res.json({
            "username" : username,
            "_id" : id
          });  
        });
      });
    }
  });  
});



app.post('/api/exercise/add', function (req, res) {
  console.log("Incoming message from the big giant head");
  
  let userId = req.body.userId;
  let description = req.body.description;
  let duration = req.body.duration;
  let date = req.body.date;
  
  // Check Duration format
  duration = Number(duration);
  if (isNaN(duration)) {
    res.send('Duration must be a number in minutes');
  }
  
  // Check Date format
  date = new Date(date);
  if (isNaN(date.getTime())) {
    res.send("Invalid Date");
  } 
  
  if (description.length === 0) {
    res.send("Missing activity description")
  }
  
  
  // Check userId for validity
  User.find({_id: userId}, function(err, data) {
    if (err) console.error(err);
    else {
      if (data.length === 0) {
        console.log("invalid user");
        res.send("Unknown _id");
      } else {
        let user = data[0];
        user.log.push({
          description: description,
          duration: duration,
          date: date
        })
        user.save((err, data) => {
          if (err) console.error(err);
          else {
            res.json({
              username: user.username,
              description: description,
              duration: duration,
              _id: user._id,
              date: new Date(date).toDateString()
            })
          }
        })
      }
    }
  })
  
  

  
  // return json of username, description, duration, id, date
  
});


app.get('/api/exercise/log?', function(req, res) {
  
  // GET /api/exercise/log?{userId}[&from][&to][&limit]
  // Send back {id: String, username: String, count: Number (log.length), log: [{description: String, duration: Number, date: String}...]}
  
  let searchObj = {};
  
  if (req.query.userId === undefined) {
    res.send("Please specify a userId");
  } 
  
  let addlKeys = ['from', 'to', 'limit']
  
  for (let key of addlKeys) {
    if (req.query[key]) {
      if (key==='limit') searchObj[key] = req.query[key];
      else searchObj[key] = new Date(req.query[key]);
      // searchObj[key] = (key==='limit') ? req.query[key] : new Date(req.query[key]);
    }
  }
  
  User.find({_id: req.query.userId}, (err, data) => {
    if (!data) {
      res.send("Invalid userId");
    }
    else if (err) console.error(err);
    else {
      if (data.length === 0) {
        res.send("Invalid userId");
      } else {
        let user = data[0].toObject();
        let log = user.log.filter((elem) => {
          var realDate = new Date(elem.date);
          if (searchObj.from != undefined && realDate < searchObj.from) {
            return false;
          }
          if (searchObj.to != undefined && realDate > searchObj.to) {
            return false;
          }
          return true;
        });
        for (let elem of log) {
          delete(elem._id);
          elem.date = new Date(elem.date).toDateString();
        };
        if (log.length && log.length > searchObj.limit) {
          log = log.slice(0, searchObj.limit);
        }
        var retObj = ({
          id: user._id,
          username: user.username,
          count: log.length,
        });
        if (searchObj.from) retObj.from = searchObj.from.toDateString();
        if (searchObj.to) retObj.to = searchObj.to.toDateString();
        retObj.log = log;
        res.json(retObj);
      }
    }
  })
  
  
});



// Not found middleware
// app.use((req, res, next) => {
//   return next({status: 404, message: 'not found'})
// });

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})
