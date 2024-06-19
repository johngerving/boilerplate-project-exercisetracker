const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const mongoose = require("mongoose");

mongoose.connect(process.env.MONGO_URI);

let exerciseSchema = new mongoose.Schema({
  username: String,
  description: String,
  duration: Number,
  date: String,
});

let userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  count: {
    type: Number,
    default: 0,
  },
  log: [exerciseSchema],
});

let Exercise = mongoose.model("Exercise", exerciseSchema);
let User = mongoose.model("User", userSchema);

const getUsers = (done) => {
  User.find({})
    .select({ username: 1 })
    .then((data) => {
      done(null, data);
    })
    .catch((err) => {
      done(err, null);
    });
};

const createUser = (providedUsername, done) => {
  let user = new User({
    username: providedUsername,
  });
  user.save().then((user) => {
    done(null, user);
  });
};

const addUserExercise = (id, description, duration, date, done) => {
  User.findById(id)
    .then((user) => {
      let exercise = new Exercise({
        username: user.username,
        description: description,
        duration: duration,
        date: date,
      });
      return exercise.save().then((exercise) => {
        user.log.push(exercise);
        user.count++;
        user.save();
        return exercise;
      });
    })
    .then((data) => {
      console.log(data);
      done(null, {
        _id: id,
        username: data.username,
        date: data.date,
        duration: data.duration,
        description: data.description,
      });
    });
};

const getUserWithExercises = (id, done) => {
  User.findById(id)
    .select({ _id: 1, username: 1, count: 1, log: 1 })
    .then((user) => {
      let log = user.log.map((exercise) => {
        return {
          description: exercise.description,
          duration: exercise.duration,
          date: exercise.date,
        };
      });
      done(null, {
        _id: user._id,
        username: user.username,
        count: user.count,
        log: log,
      });
    })
    .catch((err) => {
      done(err, null);
    });
};

const getUserFromToLimit = (id, from, to, limit, done) => {
  let user = User.findById(id)
    .select("_id username count log")
    .then((user) => {
      let log = user.log;

      log = log.filter((exercise) => {
        if (from) {
          if (new Date(exercise.date).getTime() < new Date(from).getTime()) {
            return false;
          }
        }
        if (to) {
          if (new Date(exercise.date).getTime() > new Date(to).getTime()) {
            return false;
          }
        }

        return true;
      });
      log = log.sort((a, b) => {
        if (new Date(a.date).getTime() < new Date(b.date).getTime()) {
          return -1;
        } else if (new Date(a.date).getTime() > new Date(b.date).getTime()) {
          return 1;
        } else {
          return 0;
        }
      });

      if (limit) {
        log = log.slice(0, limit);
      }

      log = log.map((exercise) => {
        return {
          description: exercise.description,
          duration: exercise.duration,
          date: exercise.date,
        };
      });

      let data = {
        _id: user._id,
        username: user.username,
        count: user.count,
        log: log,
      };

      done(null, data);
    });
};

app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

app.get("/api/users", function (req, res) {
  let users = getUsers(function (err, data) {
    if (err) {
      return console.error(err);
    }

    res.json(data);
  });
});

app.post("/api/users", function (req, res) {
  createUser(req.body.username, function (err, data) {
    if (err) {
      return console.error(err);
    }
    res.json({ username: data.username, _id: data._id });
  });
});

app.post("/api/users/:_id/exercises", function (req, res) {
  let id = req.params._id;
  let description = req.body.description;
  let duration = req.body.duration;
  let date = req.body.date;

  let numRegex = /^[0-9]+$/;
  let dateRegex = /^[0-9]{4}\-[0-9]{2}\-[0-9]{2}$/;

  if (numRegex.test(duration) && (dateRegex.test(date) || date == "")) {
    if (date == "") {
      date = new Date();
    } else {
      date = new Date(date + "T00:00");
    }
    date = date.toDateString();

    addUserExercise(id, description, duration, date, function (err, data) {
      console.log(data);
      res.json(data);
    });
  } else if (!numRegex.test(duration)) {
    res.json({ error: "Invalid Duration" });
  } else {
    res.json({ error: "Invalid Date" });
  }
});

app.get("/api/users/:_id/logs", function (req, res) {
  if (req.query.from || req.query.to || req.query.limit) {
    getUserFromToLimit(
      req.params._id,
      req.query.from,
      req.query.to,
      req.query.limit,
      function (err, data) {
        if (err) {
          console.error(err);
        }
        res.json(data);
      }
    );
  } else {
    getUserWithExercises(req.params._id, function (err, data) {
      if (err) {
        console.error(err);
      }
      res.json(data);
    });
  }
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
