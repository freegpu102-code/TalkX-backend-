// backend/routes/auth.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Post = require("../models/Post");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const authMiddleware = require("../middleware/authMiddleware");
// Avatar upload config
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, "uploads/avatars"); },
  filename: function (req, file, cb) { cb(null, Date.now() + "-" + file.originalname); }
});
const upload = multer({ storage });

router.post("/signup", upload.single("avatar"), async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;
  if (password !== confirmPassword) return res.status(400).json({ msg: "Passwords do not match" });
//   find user if on email or name
  const existing = await User.findOne({ $or: [{ email }, { name }] });
  if (existing) return res.status(400).json({ msg: "User exist Try out different username or email" });
//   also check name lenght and password lenght and throw error

  if (name.length < 5) return res.status(400).json({ msg: "Name must be at least 5 characters long" });
  if (password.length < 6) return res.status(400).json({ msg: "Password must be at least 6 characters long" });

  const hashed = await bcrypt.hash(password, 10);
  const newUser = new User({
  name,
  email,
  password: hashed,
  avatar: req.file?.path || "uploads/avatars/default.png"
});
  await newUser.save();

  const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: newUser });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ msg: "Invalid credentials" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user });
});

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = req.user
    const followingCount = user.friends.length;
    const followersCount = user.followers.length;
    const postsCount = await Post.find({ user: user._id }).countDocuments();
    res.json({
      _id: user._id,
      name: user.name,
      avatar: user.avatar,
      friends: user.friends,
      postsCount,
      followersCount,
      followingCount,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,

    });
    
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
