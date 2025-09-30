const express = require("express");
const mongoose = require("mongoose");
const userRoutes = require("./routes/user");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Database connection
mongoose
  .connect("mongodb://localhost:27017/testdb", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Routes
app.use("/api/users", userRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
