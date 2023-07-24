// userRoutes.js
const express = require('express');
const router = express.Router();
const Users = require('./models/Users');
const Conversations = require('./models/Conversations');
const Messages = require('./models/Messages');


// User registration or login
router.post('/register-or-login', async (req, res) => {
    try {
      const { fullName, email } = req.body;
  
      if (!fullName || !email) {
        return res.status(400).json({ error: 'Please provide full name and email' });
      }
  
      let user = await Users.findOne({ email });
  
      // If user with the provided email doesn't exist, register the user with the "guest" role
      if (!user) {
        user = new Users({
          fullName,
          email,
          role: 'guest', // Assuming "guest" is the default role for users
        });
  
        await user.save();
      }
  
      // Return user details and token for login (if you have a login system with tokens)
      return res.status(200).json({ message: 'User registration or login successful', user });
    } catch (error) {
      console.error('Error registering or logging in user:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
  // Start conversation with admin
  router.post('/start-conversation', async (req, res) => {
    try {
      const { userId } = req.body;
  
      if (!userId) {
        return res.status(400).json({ error: 'Please provide user ID' });
      }
  
      const user = await Users.findById(userId);
  
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      // Find all admins based on their role
      const admins = await Users.find({ role: 'admin' });
  
      if (admins.length === 0) {
        return res.status(404).json({ error: 'No admin found' });
      }
  
      // Assuming for simplicity that we'll just select the first admin in the list
      const adminId = admins[0]._id;
  
      // Start a conversation with the selected admin
      const conversation = await Conversations.findOne({
        participants: { $all: [user._id, adminId] },
      });
  
      let conversationId;
      if (conversation) {
        conversationId = conversation._id;
      } else {
        const newConversation = new Conversations({ participants: [user._id, adminId] });
        const savedConversation = await newConversation.save();
        conversationId = savedConversation._id;
      }
  
      // Send a message to the admin
      const message = 'Hello Admin! I have started a conversation.';
      const newMessage = new Messages({ conversationId, sender: user._id, message });
      await newMessage.save();
  
      const adminSocket = users.find((user) => user.userId === adminId);
      if (adminSocket) {
        io.to(adminSocket.socketId).emit('getMessage', {
          senderId: user._id,
          message,
          conversationId,
          receiverId: adminId,
          user: { id: user._id, fullName: user.fullName, email: user.email },
        });
      }
  
      return res.status(200).json({ message: 'Conversation with admin started successfully' });
    } catch (error) {
      console.error('Error starting conversation:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
// ... (Other user-related routes)

module.exports = router;
