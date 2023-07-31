const mongoose = require('mongoose');

const conversationSchema = mongoose.Schema({
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    require:true

  },
  useremail: {
    type: String,
    require:true
  },
  UserRole: {
    type: String,
    require:true
  },
  messages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
  }],
});

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
