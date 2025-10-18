const express = require("express");
const router = express.Router();
const User = require("../models/User");
const jwt = require("jsonwebtoken");

// Middleware to authenticate token
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

// GET random users (excluding yourself and your friends)
router.get("/random", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("friends", "_id");
    const friendsIds = user.friends.map(f => f._id.toString());

    // Fetch random 10 users except yourself
    const users = await User.aggregate([
      { $match: { _id: { $ne: req.user._id } } }, // only exclude self
      { $sample: { size: 10 } },
      { $project: { password: 0 } },
    ]);

    // Add `isFriend` field
    const finalUsers = users.map(u => ({
      ...u,
      isFriend: friendsIds.includes(u._id.toString()),
    }));

    res.json(finalUsers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to fetch users" });
  }
});


// POST add a friend

// GET your friends
router.get("/", auth, async (req, res) => {
  try {
    const friends = await User.find({ _id: { $in: req.user.friends } }).select(
      "-password"
    );
    res.json(friends);
  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch friends" });
  }
});


// GET your followers
router.get("/followers", auth, async (req, res) => {
  try {
    const followers = await User.find({ _id: { $in: req.user.followers } })
      .select("name avatar email");
    res.json(followers);
  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch followers" });
  }
});

// GET your following
router.get("/following", auth, async (req, res) => {
  try {
    
    const following = await User.find({ _id: { $in: req.user.friends } })
      .select("name avatar email");
    res.json(following);
  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch following" });
  }
});

module.exports = router;
