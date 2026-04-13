// server/server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5001;

// ─── Trust proxy (required for secure cookies behind Render's load balancer) ───
app.set("trust proxy", 1);

// ─── Body parser ────────────────────────────────────────────────────────────────
app.use(express.json());

// ─── MongoDB connection ─────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// ─── Mongoose models ────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, default: "user" },
});
const User = mongoose.model("User", userSchema);

const todoSchema = new mongoose.Schema({
  username: { type: String, required: true },
  text: { type: String, required: true },
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});
const Todo = mongoose.model("Todo", todoSchema);

// ─── TODO 1: Session middleware ─────────────────────────────────────────────────
// Configure express-session with the required options.
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 2,          // 2 hours
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
    },
  })
);

// ─── Serve built React files in production ──────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client/dist")));
}

// ─── Auth middleware ─────────────────────────────────────────────────────────────
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not authenticated." });
  }
  next();
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── TODO 2: Public cache header ────────────────────────────────────────────────
// This route is safe to cache because it contains no user-specific data.
app.get("/api/public/tips", (req, res) => {
  res.set("Cache-Control", "public, max-age=30");
  res.json({
    tips: [
      "Drink plenty of water.",
      "Take short breaks every hour.",
      "Keep your workspace tidy.",
    ],
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Register ───────────────────────────────────────────────────────────────────
app.post("/api/auth/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }
  try {
    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashed });
    await user.save();
    res.status(201).json({ message: "User registered." });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Username already exists." });
    }
    res.status(500).json({ error: "Registration failed." });
  }
});

// ─── TODO 3: Login — save user session ──────────────────────────────────────────
// After a successful login, store a minimal user object (no password) in
// req.session.user so the server can identify the caller on later requests.
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials." });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    // Store only what the rest of the app needs — never store the password.
    req.session.user = { username: user.username, role: user.role };

    res.json({ message: "Logged in.", user: req.session.user });
  } catch (err) {
    res.status(500).json({ error: "Login failed." });
  }
});

// ─── TODO 4: Logout — destroy the session ───────────────────────────────────────
// Use express-session's destroy() to remove the session from the store, then
// return the appropriate JSON response.
app.post("/api/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed." });
    }
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out." });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SESSION ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── TODO 5: Disable caching for private session data ───────────────────────────
// Private data must never be stored in a shared cache. Set the headers that
// instruct browsers and proxies to always revalidate this response.
app.get("/api/session/me", requireLogin, (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.json({ user: req.session.user });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TODO ROUTES (protected)
// ═══════════════════════════════════════════════════════════════════════════════

// Get all todos for the logged-in user
app.get("/api/todos", requireLogin, async (req, res) => {
  try {
    const todos = await Todo.find({ username: req.session.user.username }).sort({
      createdAt: -1,
    });
    res.json({ todos });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch todos." });
  }
});

// Create a todo
app.post("/api/todos", requireLogin, async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Text is required." });
  }
  try {
    const todo = new Todo({ username: req.session.user.username, text });
    await todo.save();
    res.status(201).json({ todo });
  } catch (err) {
    res.status(500).json({ error: "Failed to create todo." });
  }
});

// Toggle a todo
app.patch("/api/todos/:id", requireLogin, async (req, res) => {
  try {
    const todo = await Todo.findOne({
      _id: req.params.id,
      username: req.session.user.username,
    });
    if (!todo) return res.status(404).json({ error: "Todo not found." });
    todo.completed = !todo.completed;
    await todo.save();
    res.json({ todo });
  } catch (err) {
    res.status(500).json({ error: "Failed to update todo." });
  }
});

// Delete a todo
app.delete("/api/todos/:id", requireLogin, async (req, res) => {
  try {
    const result = await Todo.deleteOne({
      _id: req.params.id,
      username: req.session.user.username,
    });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Todo not found." });
    }
    res.json({ message: "Deleted." });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete todo." });
  }
});

// ─── Catch-all: serve React index.html for non-API routes in production ─────────
if (process.env.NODE_ENV === "production") {
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../client/dist/index.html"));
  });
}

// ─── Start server ────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (${process.env.NODE_ENV || "development"})`);
});
