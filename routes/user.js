const express = require("express");
const router = express.Router();
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const Post = require("../models/Post");
// Middleware to authenticate token
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");

// Multer setup for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/user/");
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// authentication
const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ msg: "No token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    next();
  } catch (err) {
    return res.status(401).json({ msg: "Unauthorized" });
  }
};

// Update profile
router.put("/update", auth, upload.single("avatar"), async (req, res) => {
  try {
    const { name, email, oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) return res.status(404).json({ msg: "User not found" });

    // If oldPassword provided, validate before changing password
    if (oldPassword && newPassword) {
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) return res.status(400).json({ msg: "Incorrect old password" });
      user.password = await bcrypt.hash(newPassword, 10);
    }

    // Update basic info
    if (name) user.name = name;
    if (email) user.email = email;
    if (req.file) user.avatar = `/uploads/user/${req.file.filename}`;

    await user.save();

    res.json({
      msg: "Profile updated successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to update profile" });
  }
});



// GET a single user by ID (public info only)
router.get("/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId).select(
      "name avatar friends followers createdAt email updatedAt"
    ); // only public info
    if (!user) return res.status(404).json({ msg: "User not found" });

    const followingCount = user.friends.length;
    const followersCount = user.followers.length;
    // use aggregrate to get count posts of each user
    const totalPost = await Post.find({ user: user._id }).countDocuments();
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      followersCount,
      followingCount,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      totalPost
    });
  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch user" });
  }
});

// GET random users (excluding yourself and users you follow)
router.get("/random", auth, async (req, res) => {
  try {
    const followingIds = req.user.friends || [];
    console.log('test',followingIds)
    followingIds.push(req.user._id); // exclude yourself
    const users = await User.aggregate([
      { $match: { _id: { $nin: followingIds } } },
      { $sample: { size: 10 } }, // random 10 users
      { $project: { password: 0 } } // hide password
    ]);
    res.json(users);
  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch users" });
  }
});

// FOLLOW a user
router.post("/follow/:id", auth, async (req, res) => {
  try {
    const targetId = req.params.id;
    if (req.user._id.toString() === targetId)
      return res.status(400).json({ msg: "You cannot follow yourself" });

    const user = await User.findById(req.user._id);
    const target = await User.findById(targetId);

    if (!user.friends.includes(targetId)) {
      user.friends.push(targetId); // you follow them
      await user.save();
    }

    if (!target.followers.includes(user._id)) {
      target.followers.push(user._id); // they gain a follower
      await target.save();
    }

    res.json({ msg: `You are now following ${target.name}` });
  } catch (err) {
    res.status(500).json({ msg: "Failed to follow user" });
  }
});

// UNFOLLOW a user
router.post("/unfollow/:id", auth, async (req, res) => {
  try {
    const targetId = req.params.id;

    const user = await User.findById(req.user._id);
    const target = await User.findById(targetId);

    user.friends = user.friends.filter((id) => id.toString() !== targetId);
    await user.save();

    target.followers = target.followers.filter(
      (id) => id.toString() !== user._id.toString()
    );
    await target.save();

    res.json({ msg: `You unfollowed ${target.name}` });
  } catch (err) {
    res.status(500).json({ msg: "Failed to unfollow user" });
  }
});

// GET your following list
router.get("/following", auth, async (req, res) => {
  try {
    const following = await User.find({ _id: { $in: req.user.friends } }).select(
      "-password"
    );
    res.json(following);
  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch following" });
  }
});

// GET your followers
router.get("/followers", auth, async (req, res) => {
  try {
    const followers = await User.find({ _id: { $in: req.user.followers } }).select(
      "-password"
    );
    res.json(followers);
  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch followers" });
  }
});


router.post("/active", auth, async (req, res) => {
  try {
    const { active } = req.body;
    const user = req.user
    user.active = active
    await user.save()
    
    res.json({ success: true, active });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to update active status" });
  }
});


module.exports = router;
