    require('dotenv').config(); // Load environment variables from .env file
    
    // --- ADD THIS LINE FOR DEBUGGING ---
    console.log('DEBUG: MONGO_URI from .env:', process.env.MONGO_URI);
    // -----------------------------------

    const express = require('express');
    const app = express();
    const cors = require('cors');
    const mongoose = require('mongoose'); // Import Mongoose

    // Basic Configuration
    const port = process.env.PORT || 3000;

    // Connect to MongoDB
    mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    })
    .then(() => console.log('MongoDB Connected!'))
    .catch(err => console.error('MongoDB connection error:', err));

    // Middleware
    app.use(cors());
    app.use(express.static('public')); // Serve static files from 'public' directory

    // Body parsing middleware for POST requests
    // Express now has built-in body parsers, replacing the need for 'body-parser' package
    app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded
    app.use(express.json()); // For parsing application/json

    // Serve the HTML file for the root route
    app.get('/', (req, res) => {
      res.sendFile(__dirname + '/views/index.html');
    });

    // --- Mongoose Schemas and Models ---

    // User Schema
    const userSchema = new mongoose.Schema({
      username: { type: String, required: true, unique: true }
    });
    const User = mongoose.model('User', userSchema);

    // Exercise Schema
    const exerciseSchema = new mongoose.Schema({
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      description: { type: String, required: true },
      duration: { type: Number, required: true },
      date: { type: Date, default: Date.now } // Store as Date object
    });
    const Exercise = mongoose.model('Exercise', exerciseSchema);

    // --- API Endpoints ---

    // 1. POST /api/users - Create a new user
    app.post("/api/users", async (req, res) => {
      const username = req.body.username;

      if (!username) {
        return res.json({ error: "Username is required" });
      }

      try {
        // Check if user already exists
        let user = await User.findOne({ username });
        if (user) {
          return res.json({ username: user.username, _id: user._id });
        }

        // Create new user
        user = new User({ username });
        await user.save();
        res.json({ username: user.username, _id: user._id });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error creating user" });
      }
    });

    // 2. GET /api/users - Get a list of all users
    app.get("/api/users", async (req, res) => {
      try {
        const users = await User.find({}).select('username _id'); // Select only username and _id
        res.json(users);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error fetching users" });
      }
    });

    // 3. POST /api/users/:_id/exercises - Add an exercise for a user
    app.post("/api/users/:_id/exercises", async (req, res) => {
      const userId = req.params._id;
      const { description, duration, date } = req.body;

      // Validate required fields
      if (!description || !duration) {
        return res.json({ error: "Description and duration are required" });
      }
      if (isNaN(Number(duration))) {
        return res.json({ error: "Duration must be a number" });
      }

      try {
        const user = await User.findById(userId);
        if (!user) {
          return res.json({ error: "User not found" });
        }

        // Parse date or use current date
        let exerciseDate;
        if (date) {
          exerciseDate = new Date(date);
          if (isNaN(exerciseDate.getTime())) { // Check if date is valid
            return res.json({ error: "Invalid date format" });
          }
        } else {
          exerciseDate = new Date();
        }

        // Create new exercise
        const newExercise = new Exercise({
          userId: user._id,
          description,
          duration: Number(duration),
          date: exerciseDate
        });

        await newExercise.save();

        // Return the user object with the exercise fields added
        res.json({
          _id: user._id,
          username: user.username,
          date: newExercise.date.toDateString(), // Format date as required
          duration: newExercise.duration,
          description: newExercise.description
        });

      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error adding exercise" });
      }
    });

    // 4. GET /api/users/:_id/logs - Retrieve a full exercise log of any user
    app.get("/api/users/:_id/logs", async (req, res) => {
      const userId = req.params._id;
      const { from, to, limit } = req.query;

      try {
        const user = await User.findById(userId);
        if (!user) {
          return res.json({ error: "User not found" });
        }

        let query = { userId: userId };

        // Date filtering
        if (from || to) {
          query.date = {};
          if (from) {
            query.date.$gte = new Date(from);
          }
          if (to) {
            query.date.$lte = new Date(to);
          }
          // Validate dates
          if (from && isNaN(new Date(from).getTime())) {
            return res.json({ error: "Invalid 'from' date format" });
          }
          if (to && isNaN(new Date(to).getTime())) {
            return res.json({ error: "Invalid 'to' date format" });
          }
        }

        let exercises = await Exercise.find(query).limit(Number(limit) || 0); // Apply limit, 0 means no limit

        // Format dates for the log array as strings using toDateString()
        const log = exercises.map(ex => ({
          description: ex.description,
          duration: ex.duration,
          date: ex.date.toDateString()
        }));

        res.json({
          _id: user._id,
          username: user.username,
          count: log.length,
          log: log
        });

      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error fetching exercise log" });
      }
    });


    // Start the server
    const listener = app.listen(port, () => {
      console.log(`Your app is listening on port ${port}`);
    });
    