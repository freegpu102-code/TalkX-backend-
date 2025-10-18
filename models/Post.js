const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, required: true },
}, { timestamps: true });

const PostSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true },
  image: { type: String, default: null },
  likes: { type: Number, default: 0 }, // optional frontend only
  comments: [CommentSchema], // array of comment subdocuments
}, { timestamps: true });

module.exports = mongoose.model("Post", PostSchema);