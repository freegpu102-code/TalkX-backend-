// backend/server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

// Routes
const authRoutes = require("./routes/auth");
const postRoutes = require("./routes/post");
const userRoutes = require("./routes/user");
const chatRoutes = require("./routes/chat");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --------------------------
// MongoDB serverless-safe connection
// --------------------------
let isConnected; // global connection cache

const connectDB = async () => {
  if (isConnected) return;
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      // recommended options
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    isConnected = true;
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
};

// --------------------------
// Routes
// --------------------------

// Note: Local uploads won't work on Vercel (read-only filesystem)
// Replace with Cloudinary or S3 for production
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/post", postRoutes);
app.use("/api/friends", require("./routes/friends"));
app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);

// use port 3000 for local development
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
