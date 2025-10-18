const mongoose = require("mongoose");
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String, default: "" },
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // mutual friends
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  active: {
  type: Boolean,
  default: false,
} // one-way followers
}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);