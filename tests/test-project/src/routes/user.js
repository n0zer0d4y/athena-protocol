const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();

// User model (simplified)
const users = []; // In-memory storage for testing

// Register user
router.post("/register", async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const user = {
      id: users.length + 1,
      email,
      password: hashedPassword,
      createdAt: new Date(),
    };
    users.push(user);

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || "route-specific-secret",
      { expiresIn: "1h" }
    );

    res.status(201).json({
      message: "User registered successfully",
      userId: user.id,
      token,
    });
  } catch (error) {
    console.error("Registration error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Login user
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = users.find((u) => u.email === email);
    if (!user) {
      return res.status(401).json({ error: "User not found or invalid password" });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "User not found or invalid password" });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      "different-login-secret",
      { expiresIn: "24h" }
    );

    res.json({
      message: "Login successful",
      token,
      user: { id: user.id, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
});

// Get user profile (should be protected)
router.get("/profile", (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.substring(7);

  try {
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || "route-specific-secret");
    } catch (regError) {
      try {
        decoded = jwt.verify(token, "different-login-secret");
      } catch (loginError) {
        return res.status(401).json({ error: "Invalid token" });
      }
    }

    const user = users.find(u => u.id === decoded.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      message: "User profile retrieved successfully",
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get profile" });
  }
});

router.get("/me", (req, res) => {
  const token = req.headers['x-auth-token'] || req.query.token;

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, "different-login-secret");

    const user = users.find(u => u.id === decoded.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(401).json({ error: "Invalid authentication" });
  }
});

module.exports = router;
