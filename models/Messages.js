const mongoose = require("mongoose");

const messageSchema = mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  senderName: {
    type: String,
    ref: "User",
  },
  message: {
    type: String,
  },
  time: {
    type: String, // You can store time as a string or use Date type, depending on your preference
  },
  date: {
    type: String, // You can store date as a string or use Date type, depending on your preference
  },
});

const Message = mongoose.model("Message", messageSchema);

module.exports = Message;
