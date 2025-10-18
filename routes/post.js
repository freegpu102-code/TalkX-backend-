const express = require("express");
const router = express.Router();
const Post = require("../models/Post");
const User = require("../models/User");
const multer = require("multer");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
// Upload config
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, "uploads/posts"); },
  filename: function (req, file, cb) { cb(null, Date.now() + "-" + file.originalname); },
});
const upload = multer({ storage });

// just auth
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
// fetch all post by date
router.get("/", async (req, res) => {
  try {
    const posts = await Post.find()
      .populate("user", "name avatar") // populate user info
      .sort({ createdAt: -1 }); // newest first
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to fetch posts" });
  }
}); 

// Create post
router.post("/", auth, upload.single("image"), async (req, res) => {
  try {
    const post = new Post({
      user: req.user._id,
      content: req.body.content,
      image: req.file ? req.file.path : null,
    });
    await post.save();
    res.json(post);
  } catch (err) {
    res.status(500).json({ msg: "Error creating post" });
  }
});

// Get posts by user
router.get("/user/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const posts = await Post.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate("user", "name avatar friends")
      .populate("comments.user", "name avatar");
    res.json(posts);
  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch posts" });
  }
});

// Get single post (for eachpost page)
router.get("/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("user", "name avatar")
      .populate("comments.user", "name avatar");
    if (!post) return res.status(404).json({ msg: "Post not found" });
    res.json(post);
  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch post" });
  }
});

// Add comment
router.post("/comment/:id", auth, async (req, res) => {
  try {
    const postId = req.params.id;
    const { text } = req.body;
    if (!text) return res.status(400).json({ msg: "Comment cannot be empty" });

    const post = await Post.findById(postId);
    const comment = {
      _id: new mongoose.Types.ObjectId(),
      user: req.user._id,
      text,
    };
    post.comments.unshift(comment);
    await post.save();

    // populate comment user info before returning
    const populatedPost = await Post.findById(postId).populate("comments.user", "name avatar");
    res.json(populatedPost.comments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to add comment" });
  }
});

// Delete comment
router.delete("/comment/:postId/:commentId", auth, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const post = await Post.findById(postId);
    const comment = post.comments.id(commentId);

    if (!comment) return res.status(404).json({ msg: "Comment not found" });
    if (comment.user.toString() !== req.user._id.toString())
      return res.status(401).json({ msg: "Not authorized" });

    comment.remove();
    await post.save();

    const populatedPost = await Post.findById(postId).populate("comments.user", "name avatar");
    res.json(populatedPost.comments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to delete comment" });
  }
});

module.exports = router;
