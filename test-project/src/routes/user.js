const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();

// User model (simplified)
const users = []; // In-memory storage for testing

// Register user
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save user (simplified)
    const user = {
      id: users.length + 1,
      email,
      password: hashedPassword,
    };
    users.push(user);

    res.status(201).json({
      message: "User registered successfully",
      userId: user.id,
    });
  } catch (error) {
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login user
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = users.find((u) => u.email === email);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      "your-secret-key",
      { expiresIn: "24h" }
    );

    res.json({
      message: "Login successful",
      token,
    });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
});

// Get user profile (should be protected)
router.get("/profile", (req, res) => {
  // This route should require authentication
  res.json({
    message: "User profile - this should be protected!",
    user: {
      id: 1,
      email: "user@example.com",
      name: "Test User",
    },
  });
});

module.exports = router;
