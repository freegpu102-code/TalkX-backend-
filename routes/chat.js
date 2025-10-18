// backend/routes/chat.js
const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const Pusher = require("pusher");
const mongoose = require("mongoose");
// auth middleware (re-using your pattern)
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

// pusher
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});


router.post("/pusher/auth", auth, async (req, res) => {
  try {
    const socketId = req.body.socket_id;
    const channel = req.body.channel_name;
   
    const presenceData = {
      user_id: req.user._id.toString(),
      user_info: {
        name: req.user.name,
        avatar: req.user.avatar,
      },
    };
    const authResponse = pusher.authorizeChannel(socketId, channel, presenceData);
    res.send(authResponse);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Pusher auth failed" });
  }
});
// Get contacts list: following first + some random users, with last message preview
router.get("/contacts", auth, async (req, res) => {
  try {
    const me = req.user;
    // Following list (users you follow) - using friends as "following"
    const followingIds = me.friends || [];

    // Get following users with last message
    const followingUsers = await User.find({ _id: { $in: followingIds } }).select("name avatar active").lean();

    // For each user attach last message between them and me
    const attachLast = async (u) => {
      const last = await Message.findOne({
        $or: [
          { from: me._id, to: u._id },
          { from: u._id, to: me._id }
        ]
      }).sort({ createdAt: -1 }).lean();
      return { ...u, lastMessage: last ? { text: last.text, createdAt: last.createdAt, from: last.from } : null };
    };

    const followingWithLast = await Promise.all(followingUsers.map(attachLast));

    // Get some random users excluding me and following (limit to 7)
    const exclude = [...followingIds.map(String), me._id.toString()];
    const randomUsers = await User.aggregate([
      { $match: { _id: { $nin: exclude.map(id =>  new mongoose.Types.ObjectId(id)) } } },
      { $sample: { size: 7 } },
      { $project: { name: 1, avatar: 1,active:1 } }
    ]);

    const randomWithLast = await Promise.all(randomUsers.map(async (u) => {
      const last = await Message.findOne({
        $or: [
          { from: me._id, to: u._id },
          { from: u._id, to: me._id }
        ]
      }).sort({ createdAt: -1 }).lean();
      return { ...u, lastMessage: last ? { text: last.text, createdAt: last.createdAt, from: last.from } : null };
    }));

    // Build combined list: following first (sorted by last msg date desc), then random
    followingWithLast.sort((a,b) => {
      const ta = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt) : 0;
      const tb = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt) : 0;
      return tb - ta;
    });

    res.json({
      following: followingWithLast,
      suggestions: randomWithLast
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to fetch contacts" });
  }
});

// Get messages between me and :userId (paginated optional)
router.get("/messages/:userId", auth, async (req, res) => {
  try {
    const otherId = req.params.userId;
    const me = req.user._id;
    const messages = await Message.find({
      $or: [
        { from: me, to: otherId },
        { from: otherId, to: me }
      ]
    }).sort({ createdAt: 1 }).populate("from", "name avatar").populate("to", "name avatar");
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to fetch messages" });
  }
});

// Send message to userId (text-only for now; you can extend to attachment)
router.post("/:userId", auth, async (req, res) => {
  try {
    const otherId = req.params.userId;
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ msg: "Message cannot be empty" });

    const newMsg = new Message({
      from: req.user._id,
      to: otherId,
      text: text.trim()
    });
    await newMsg.save();

    // populate for response
    const populated = await Message.findById(newMsg._id).populate("from", "name avatar").populate("to", "name avatar");
    // trigger pusher events for both participants on channels: user-{id}
    // server triggers event "new-message"
    pusher.trigger(`private-user-${otherId}`, "new-message", { message: populated });
    pusher.trigger(`private-user-${req.user._id}`, "new-message", { message: populated });

    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to send message" });
  }
});

module.exports = router;
