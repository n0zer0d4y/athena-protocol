const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const userRoutes = require("./routes/user");
const path = require("path");
const fs = require("fs");

// Environment configuration
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for accurate IP addresses in production
app.set("trust proxy", 1);

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://yourdomain.com",
      process.env.FRONTEND_URL,
    ].filter(Boolean);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));

// Body parsing middleware with size limits
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// More strict rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs for auth routes
  message: {
    error: "Too many authentication attempts, please try again later.",
  },
});

// Custom middleware for request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`
    );
  });
  next();
});

// Database connection with retry logic
const connectDB = async () => {
  const mongoURI =
    process.env.MONGODB_URI || "mongodb://localhost:27017/testdb";

  const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    bufferCommands: false,
    bufferMaxEntries: 0,
  };

  let retries = 5;
  while (retries > 0) {
    try {
      await mongoose.connect(mongoURI, options);
      console.log("Connected to MongoDB successfully");
      break;
    } catch (error) {
      console.error(
        `MongoDB connection attempt failed (${6 - retries}/5):`,
        error.message
      );
      retries--;
      if (retries > 0) {
        console.log(`Retrying in 5 seconds... (${retries} attempts remaining)`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } else {
        console.error("Failed to connect to MongoDB after 5 attempts");
        if (process.env.NODE_ENV === 'production') {
          process.exit(1);
        } else {
          console.log("Continuing without database in development mode...");
        }
      }
    }
  }
};

// Initialize database connection
connectDB();

// User schema for demonstration (in production, this would be in a separate file)
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    role: {
      type: String,
      enum: ["user", "admin", "moderator"],
      default: "user",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Add indexes for better performance
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ createdAt: -1 });

// Pre-save middleware to hash password (simplified for demo)
userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    const bcrypt = require("bcryptjs");
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

// Static method to find user by email
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Instance method to check password
userSchema.methods.comparePassword = async function (candidatePassword) {
  const bcrypt = require("bcryptjs");
  return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual for full name
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Transform output (remove password and __v)
userSchema.set("toJSON", {
  transform: function (doc, ret, options) {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

const User = mongoose.model("User", userSchema);

// Request validation middleware
const validateRequest = (req, res, next) => {
  // Basic request validation
  if (!req.headers["user-agent"]) {
    return res.status(400).json({ error: "User-Agent header is required" });
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /vbscript:/i,
    /onload/i,
    /onerror/i,
  ];

  const userAgent = req.headers["user-agent"];
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(userAgent)) {
      return res.status(400).json({ error: "Invalid User-Agent header" });
    }
  }

  next();
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error("Error occurred:", err);

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: "Validation Error", details: errors });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({ error: `${field} already exists` });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ error: "Invalid token" });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ error: "Token expired" });
  }

  // Default server error
  res.status(500).json({
    error:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal Server Error",
  });
};

// 404 handler
const notFoundHandler = (req, res) => {
  res.status(404).json({ error: "Route not found" });
};

// Routes
app.use("/api/users", userRoutes);

app.use(limiter);

// Additional API routes
app.get("/api", (req, res) => {
  res.json({
    message: "API is running",
    version: "1.0.0",
    endpoints: ["/api/users", "/api/health", "/api/status"],
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Server is running",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// System status endpoint
app.get("/api/status", async (req, res) => {
  try {
    const dbStatus =
      mongoose.connection.readyState === 1 ? "connected" : "disconnected";

    res.json({
      status: "healthy",
      database: dbStatus,
      environment: process.env.NODE_ENV || "development",
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      cpuUsage: process.cpuUsage(),
      memory: process.memoryUsage(),
      uptime: process.uptime(),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get system status" });
  }
});

// User registration endpoint
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;

    if (!username || !email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username: username.toLowerCase() },
      ],
    });

    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const user = new User({
      username,
      email,
      password,
      firstName,
      lastName,
    });

    await user.save();

    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'server-jwt-secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      token,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

// Graceful shutdown handling
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

async function gracefulShutdown(signal) {
  console.log(`Received ${signal}. Starting graceful shutdown...`);

  // Close database connection
  try {
    await mongoose.connection.close();
    console.log("Database connection closed.");
  } catch (error) {
    console.error("Error closing database connection:", error);
  }

  // Close server
  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });

  // Force close server after 10 seconds
  setTimeout(() => {
    console.error(
      "Could not close connections in time, forcefully shutting down"
    );
    process.exit(1);
  }, 10000);
}

// Create HTTP server for better control
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
});

// Export for testing
module.exports = app;
