// adminRoutes.js
const express = require('express');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const Users = require('./models/Users');
const Conversations = require('./models/Conversations');
const Messages = require('./models/Messages');

// Middleware to verify admin JWT token
// ... (Copy the verifyAdminToken middleware from your original code)



// Create a new admin
router.post('/', verifyAdminToken, async (req, res) => {
  // ... (Copy the /s route handler from your original code)
});

// Fetch all users info
router.get('/users', verifyAdminToken, async (req, res) => {
  // ... (Copy the //users route handler from your original code)
});

// Fetch all conversations for the admin
router.get('/conversations', verifyAdminToken, async (req, res) => {
  // ... (Copy the //conversations route handler from your original code)
});


// Admin login
router.post('/login', async (req, res) => {
    // ... (Copy the //login route handler from your original code)
  });
// Admin login
router.post('//login', async (req, res) => {
    try {
      const { email, password } = req.body;
  
      if (!email || !password) {
        return res.status(400).json({ error: 'Please fill all required fields' });
      }
  
      const adminUser = await Users.findOne({ email, role: 'admin' });
      if (!adminUser) {
        return res.status(404).json({ error: 'Admin user not found' });
      }
  
      const validateAdmin = await bcryptjs.compare(password, adminUser.password);
      if (!validateAdmin) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }
  
      const payload = {
        userId: adminUser._id,
        email: adminUser.email,
        role: adminUser.role,
      };
      const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'THIS_IS_A_JWT_SECRET_KEY';
  
      jwt.sign(payload, JWT_SECRET_KEY, { expiresIn: '1d' }, (err, token) => {
        return res.status(200).json({ token });
      });
    } catch (error) {
      console.error('Error logging in admin:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
  // Create a new admin
  router.post('/', verifyAdminToken, async (req, res) => {
    try {
      const { fullName, email, password } = req.body;
  
      if (!fullName || !email || !password) {
        return res.status(400).json({ error: 'Please fill all required fields' });
      }
  
      const existingAdmin = await Users.findOne({ email, role: 'admin' });
      if (existingAdmin) {
        return res.status(400).json({ error: 'Admin user already exists' });
      }
  
      const hashedPassword = await bcryptjs.hash(password, 10);
      const newAdmin = new Users({ fullName, email, password: hashedPassword, role: 'admin' });
      await newAdmin.save();
  
      return res.status(200).json({ message: 'Admin user created successfully' });
    } catch (error) {
      console.error('Error creating admin user:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
  // Fetch all users info
  router.get('//users', verifyAdminToken, async (req, res) => {
    try {
      const allUsers = await Users.find({}, { password: 0 }); // Exclude the password field from the response
      return res.status(200).json(allUsers);
    } catch (error) {
      console.error('Error fetching all users:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
  // Fetch all conversations for the admin
  router.get('//conversations', verifyAdminToken, async (req, res) => {
    try {
      const conversations = await Conversations.find({});
      return res.status(200).json(conversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
  // Fetch all messages for a conversation
  router.get('//messages/:conversationId', verifyAdminToken, async (req, res) => {
    try {
      const { conversationId } = req.params;
      const messages = await Messages.find({ conversationId });
      return res.status(200).json(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
  // Fetch all messages between admin and user
  router.get('//messages/user/:userId', verifyAdminToken, async (req, res) => {
    try {
      const { userId } = req.params;
      const conversation = await Conversations.findOne({ participants: { $all: [req.admin.userId, userId] } });
  
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
  
      const messages = await Messages.find({ conversationId: conversation._id });
      return res.status(200).json(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
  // Send message from admin to user
  router.post('//send-message', verifyAdminToken, async (req, res) => {
    try {
      const { senderId, receiverId, message } = req.body;
  
      if (!message) {
        return res.status(400).json({ error: 'Please enter a message' });
      }
  
      const conversation = await Conversations.findOne({
        participants: { $all: [senderId, receiverId] },
      });
  
      let conversationId;
      if (conversation) {
        conversationId = conversation._id;
      } else {
        const newConversation = new Conversations({ participants: [senderId, receiverId] });
        const savedConversation = await newConversation.save();
        conversationId = savedConversation._id;
      }
  
      const newMessage = new Messages({ conversationId, sender: senderId, message });
      await newMessage.save();
  
      io.emit('getMessage', {
        senderId,
        message,
        conversationId,
        receiverId,
        user: { id: senderId, fullName: req.admin.fullName, email: req.admin.email }, // Assuming the admin's model has fullName and email properties
      });
  
      return res.status(200).json({ message: 'Message sent successfully' });
    } catch (error) {
      console.error('Error sending message:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  

module.exports = router;
