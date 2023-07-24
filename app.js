const express = require('express');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const io = require('socket.io')(8080, {
  cors: {
    origin: 'http://localhost:3000',
  },
});

// Connect DB
require('./db/connection');

// Import Files
const Users = require('./models/Users');
const Conversations = require('./models/Conversations');
const Messages = require('./models/Messages');

// app Use
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

// Middleware to verify admin JWT token
const verifyAdminToken = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized. Admin token is missing.' });
  }

  const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'THIS_IS_A_JWT_SECRET_KEY';
  jwt.verify(token, JWT_SECRET_KEY, (err, decodedToken) => {
    if (err) {
      return res.status(401).json({ error: 'Unauthorized. Invalid admin token.' });
    }

    if (decodedToken.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden. Only admin users are allowed.' });
    }

    req.admin = decodedToken;
    next();
  });
};
// Middleware to verify user token
// const verifyUserToken = (req, res, next) => {
//   const token = req.headers.authorization;
//   if (!token) {
//     return res.status(401).json({ error: 'Unauthorized. User token is missing.' });
//   }

//   jwt.verify(token, 'JWT_SECRET_KEY', (err, decodedToken) => {
//     if (err) {
//       return res.status(401).json({ error: 'Unauthorized. Invalid user token.' });
//     }

//     req.user = decodedToken;
//     next();
//   });
// };


// Middleware to verify user token
const JWT_SECRET_KEY = 'YOUR_SECRET_KEY'; 
const verifyUserToken = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized. User token is missing.' });
  }

  jwt.verify(token, JWT_SECRET_KEY, (err, decodedToken) => {
    if (err) {
      return res.status(401).json({ error: 'Unauthorized. Invalid user token.' });
    }

    req.user = decodedToken;
    next();
  });
};


// Socket.io
let users = [];
io.on('connection', (socket) => {
  console.log('User connected', socket.id);
  socket.on('addUser', (userId) => {
    const isUserExist = users.find((user) => user.userId === userId);
    if (!isUserExist) {
      const user = { userId, socketId: socket.id };
      users.push(user);
      io.emit('getUsers', users);
    }
  });

  socket.on('sendMessage', async ({ senderId, receiverId, message, conversationId }) => {
    const receiver = users.find((user) => user.userId === receiverId);
    const sender = users.find((user) => user.userId === senderId);
    const user = await Users.findById(senderId);
    console.log('sender :>> ', sender, receiver);
    if (receiver) {
      io.to(receiver.socketId).to(sender.socketId).emit('getMessage', {
        senderId,
        message,
        conversationId,
        receiverId,
        user: { id: user._id, fullName: user.fullName, email: user.email },
      });
    } else {
      io.to(sender.socketId).emit('getMessage', {
        senderId,
        message,
        conversationId,
        receiverId,
        user: { id: user._id, fullName: user.fullName, email: user.email },
      });
    }
  });

  socket.on('disconnect', () => {
    users = users.filter((user) => user.socketId !== socket.id);
    io.emit('getUsers', users);
  });
});

// Admin login
app.post('/api/admin/login', async (req, res) => {
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


// // Create a new admin
// app.post('/api/admins', verifyAdminToken, async (req, res) => {
//   try {
//     const { fullName, email, password } = req.body;

//     if (!fullName || !email || !password) {
//       return res.status(400).json({ error: 'Please fill all required fields' });
//     }

//     const existingAdmin = await Users.findOne({ email, role: 'admin' });
//     if (existingAdmin) {
//       return res.status(400).json({ error: 'Admin user already exists' });
//     }

//     const hashedPassword = await bcryptjs.hash(password, 10);
//     const newAdmin = new Users({ fullName, email, password: hashedPassword, role: 'admin' });
//     await newAdmin.save();

//     return res.status(200).json({ message: 'Admin user created successfully' });
//   } catch (error) {
//     console.error('Error creating admin user:', error);
//     return res.status(500).json({ error: 'Internal Server Error' });
//   }
// });

// Fetch all users info other than admin
app.get('/api/admin/users', verifyAdminToken, async (req, res) => {
  try {
    const allUsers = await Users.find({ role: { $ne: 'admin' } }, { password: 0 });
    // The above query will find all users whose role is not equal to 'admin'
    // and exclude the password field from the response.

    return res.status(200).json(allUsers);
  } catch (error) {
    console.error('Error fetching all users:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Fetch all conversations for the admin
// app.get('/api/admin/conversations', verifyAdminToken, async (req, res) => {
//   try {
//     const conversations = await Conversations.find({});
//     return res.status(200).json(conversations);
//   } catch (error) {
//     console.error('Error fetching conversations:', error);
//     return res.status(500).json({ error: 'Internal Server Error' });
//   }
// });

// Fetch all messages for a conversation
// app.get('/api/admin/messages/:conversationId', verifyAdminToken, async (req, res) => {
//   try {
//     const { conversationId } = req.params;
//     const messages = await Messages.find({ conversationId });
//     return res.status(200).json(messages);
//   } catch (error) {
//     console.error('Error fetching messages:', error);
//     return res.status(500).json({ error: 'Internal Server Error' });
//   }
// });

// Fetch all messages between admin and user
// app.get('/api/admin/messages/user/:userId', verifyAdminToken, async (req, res) => {
//   try {
//     const { userId } = req.params;
//     const conversation = await Conversations.findOne({ participants: { $all: [req.admin.userId, userId] } });

//     if (!conversation) {
//       return res.status(404).json({ error: 'Conversation not found' });
//     }

//     const messages = await Messages.find({ conversationId: conversation._id });
//     return res.status(200).json(messages);
//   } catch (error) {
//     console.error('Error fetching messages:', error);
//     return res.status(500).json({ error: 'Internal Server Error' });
//   }
// });

// Send message from admin to user
// app.post('/api/admin/send-message', verifyAdminToken, async (req, res) => {
//   try {
//     const { senderId, receiverId, message } = req.body;

//     if (!message) {
//       return res.status(400).json({ error: 'Please enter a message' });
//     }

//     const conversation = await Conversations.findOne({
//       participants: { $all: [senderId, receiverId] },
//     });

//     let conversationId;
//     if (conversation) {
//       conversationId = conversation._id;
//     } else {
//       const newConversation = new Conversations({ participants: [senderId, receiverId] });
//       const savedConversation = await newConversation.save();
//       conversationId = savedConversation._id;
//     }

//     const newMessage = new Messages({ conversationId, sender: senderId, message });
//     await newMessage.save();

//     io.emit('getMessage', {
//       senderId,
//       message,
//       conversationId,
//       receiverId,
//       user: { id: senderId, fullName: req.admin.fullName, email: req.admin.email }, // Assuming the admin's model has fullName and email properties
//     });

//     return res.status(200).json({ message: 'Message sent successfully' });
//   } catch (error) {
//     console.error('Error sending message:', error);
//     return res.status(500).json({ error: 'Internal Server Error' });
//   }
// });
// Send message from admin to user (protected route)
// app.post('/api/admin/send-message-to-user', verifyAdminToken, async (req, res) => {
//   try {
//     const { userId, message } = req.body;
//     const adminId = req.admin.id;

//     if (!userId || !message) {
//       return res.status(400).json({ error: 'Please provide user ID and message' });
//     }

//     // Check if the user exists
//     const user = await Users.findOne({ _id: userId,  });
//     if (!user) {
//       return res.status(404).json({ error: 'User not found' });
//     }

//     // Find or create a conversation between the admin and the user
//     const conversation = await Conversations.findOne({
//       participants: { $all: [userId, adminId] },
//     });

//     let conversationId;
//     if (conversation) {
//       conversationId = conversation._id;
//     } else {
//       const newConversation = new Conversations({ participants: [userId, adminId] });
//       const savedConversation = await newConversation.save();
//       conversationId = savedConversation._id;
//     }

//     // Save the message
//     const newMessage = new Messages({ conversationId, sender: adminId, message });
//     await newMessage.save();

//     // Emit the message to the user (using socket.io)
//     const userSocket = users.find((user) => user.userId === userId);
//     if (userSocket) {
//       io.to(userSocket.socketId).emit('getMessage', {
//         senderId: adminId,
//         message,
//         conversationId,
//         receiverId: userId,
//         user: { id: req.admin.id, fullName: req.admin.fullName, email: req.admin.email },
//       });
//     }

//     return res.status(200).json({ message: 'Message sent to user successfully' });
//   } catch (error) {
//     console.error('Error sending message to user:', error);
//     return res.status(500).json({ error: 'Internal Server Error' });
//   }
// });




























































// User registration or login
app.post('/api/user/register-or-login', async (req, res) => {
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

    // Generate JWT token
    const payload = {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    };
    const token = jwt.sign(payload, 'JWT_SECRET_KEY', { expiresIn: '1d' });

    // Return user details and token for login
    return res.status(200).json({ message: 'User registration or login successful', user, token });
  } catch (error) {
    console.error('Error registering or logging in user:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Select a random admin user and start a conversation
app.post('/api/start-conversation-with-admin', verifyUserToken, async (req, res) => {
  try {
    // Get the current user's ID from the decoded token (provided in the verifyUserToken middleware)
    const userId = req.user.userId;

    // Find all available admin users
    const adminUsers = await Users.find({ role: 'admin' });

    // If there are no admin users, return an error
    if (adminUsers.length === 0) {
      return res.status(404).json({ error: 'No available admin users' });
    }

    // Select a random admin user
    const randomAdminIndex = Math.floor(Math.random() * adminUsers.length);
    const selectedAdmin = adminUsers[randomAdminIndex];

    // Check if a conversation already exists between the user and the selected admin
    const existingConversation = await Conversations.findOne({
      participants: { $all: [userId, selectedAdmin._id] },
    });

    // If a conversation already exists, return the existing conversation ID
    if (existingConversation) {
      return res.status(200).json({
        message: 'Conversation with admin already exists',
        conversationId: existingConversation._id,
        adminId: selectedAdmin._id,
      });
    }

    // Create a new conversation between the user and the selected admin
    const newConversation = new Conversations({
      participants: [userId, selectedAdmin._id],
    });
    const savedConversation = await newConversation.save();

    return res.status(200).json({
      message: 'Conversation started with admin successfully',
      conversationId: savedConversation._id,
      adminId: selectedAdmin._id,
    });
  } catch (error) {
    console.error('Error starting conversation with admin:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});



























// // Start conversation with admin
// app.post('/api/user/start-conversation',verifyUserToken, async (req, res) => {
//   try {
//     const { userId } = req.body;

//     if (!userId) {
//       return res.status(400).json({ error: 'Please provide user ID' });
//     }

//     const adminId = 'admin'; // Assuming the admin's user ID is "admin"
//     const user = await Users.findById(userId);

//     if (!user) {
//       return res.status(404).json({ error: 'User not found' });
//     }

//     // Start a conversation with the admin
//     const conversation = await Conversations.findOne({
//       participants: { $all: [user._id, adminId] },
//     });

//     let conversationId;
//     if (conversation) {
//       conversationId = conversation._id;
//     } else {
//       const newConversation = new Conversations({ participants: [user._id, adminId] });
//       const savedConversation = await newConversation.save();
//       conversationId = savedConversation._id;
//     }

//     // Send a message to the admin
//     const message = 'Hello Admin! I have started a conversation.';
//     const newMessage = new Messages({ conversationId, sender: user._id, message });
//     await newMessage.save();

//     const adminSocket = users.find((user) => user.userId === adminId);
//     if (adminSocket) {
//       io.to(adminSocket.socketId).emit('getMessage', {
//         senderId: user._id,
//         message,
//         conversationId,
//         receiverId: adminId,
//         user: { id: user._id, fullName: user.fullName, email: user.email },
//       });
//     }

//     return res.status(200).json({ message: 'Conversation with admin started successfully' });
//   } catch (error) {
//     console.error('Error starting conversation:', error);
//     return res.status(500).json({ error: 'Internal Server Error' });
//   }
// });

// // Fetch user details after login
// app.get('/api/user/details',verifyUserToken, async (req, res) => {
//   try {
//     // Assuming the user ID is stored in the request object after login
//     const userId = req.user.id; // Replace 'id' with the actual property name for user ID

//     const user = await Users.findById(userId);
//     if (!user) {
//       return res.status(404).json({ error: 'User not found' });
//     }

//     // Return user details
//     return res.status(200).json({ user });
//   } catch (error) {
//     console.error('Error fetching user details:', error);
//     return res.status(500).json({ error: 'Internal Server Error' });
//   }
// });

// // Fetch the list of available admins
// app.get('/api/user/available-admins',verifyUserToken, async (req, res) => {
//   try {
//     // Assuming 'admin' is the role assigned to admin users
//     const availableAdmins = await Users.find({ role: 'admin' });

//     // Return the list of available admins
//     return res.status(200).json({ availableAdmins });
//   } catch (error) {
//     console.error('Error fetching available admins:', error);
//     return res.status(500).json({ error: 'Internal Server Error' });
//   }
// });

// // Fetch conversations between the user and an admin
// app.get('/api/user/conversations/:adminId',verifyUserToken, async (req, res) => {
//   try {
//     const { adminId } = req.params;
//     const userId = req.user.id; // Replace 'id' with the actual property name for user ID

//     // Find the conversation between the user and the specified admin
//     const conversation = await Conversations.findOne({
//       participants: { $all: [userId, adminId] },
//     });

//     if (!conversation) {
//       return res.status(404).json({ error: 'Conversation not found' });
//     }

//     // Fetch messages for the conversation
//     const messages = await Messages.find({ conversationId: conversation._id });

//     // Return the conversation and messages
//     return res.status(200).json({ conversation, messages });
//   } catch (error) {
//     console.error('Error fetching conversations:', error);
//     return res.status(500).json({ error: 'Internal Server Error' });
//   }
// });
// // Send message from user to admin (protected route)
// app.post('/api/user/send-message-to-admin', verifyUserToken, async (req, res) => {
//   try {
//     const { adminId, message } = req.body;
//     const userId = req.user.id;

//     if (!adminId || !message) {
//       return res.status(400).json({ error: 'Please provide admin ID and message' });
//     }

//     // Check if the admin exists
//     const admin = await Users.findOne({ _id: adminId, role: 'admin' });
//     if (!admin) {
//       return res.status(404).json({ error: 'Admin not found' });
//     }

//     // Find or create a conversation between the user and the admin
//     const conversation = await Conversations.findOne({
//       participants: { $all: [userId, adminId] },
//     });

//     let conversationId;
//     if (conversation) {
//       conversationId = conversation._id;
//     } else {
//       const newConversation = new Conversations({ participants: [userId, adminId] });
//       const savedConversation = await newConversation.save();
//       conversationId = savedConversation._id;
//     }

//     // Save the message
//     const newMessage = new Messages({ conversationId, sender: userId, message });
//     await newMessage.save();

//     // Emit the message to the admin (using socket.io)
//     const adminSocket = users.find((user) => user.userId === adminId);
//     if (adminSocket) {
//       io.to(adminSocket.socketId).emit('getMessage', {
//         senderId: userId,
//         message,
//         conversationId,
//         receiverId: adminId,
//         user: { id: req.user.id, fullName: req.user.fullName, email: req.user.email },
//       });
//     }

//     return res.status(200).json({ message: 'Message sent to admin successfully' });
//   } catch (error) {
//     console.error('Error sending message to admin:', error);
//     return res.status(500).json({ error: 'Internal Server Error' });
//   }
// });


// Start the server
const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
