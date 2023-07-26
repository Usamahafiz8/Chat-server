const express = require("express");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const io = require("socket.io")(8080, {
  cors: {
    origin: "http://localhost:3000",
  },
});

// Connect DB
require("./db/connection");

// Import Files
const Users = require("./models/Users");
const Conversations = require("./models/Conversations");
const Conversation = require("./models/Conversations");
const Message = require("./models/Messages");

// app Use
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());



// Socket.io
let users = [];
io.on("connection", (socket) => {
  console.log("User connected", socket.id);
  socket.on("addUser", (userId) => {
    const isUserExist = users.find((user) => user.userId === userId);
    if (!isUserExist) {
      const user = { userId, socketId: socket.id };
      users.push(user);
      io.emit("getUsers", users);
    }
  });
  socket.on(
    "sendMessage",
    async ({ senderId, receiverId, message, conversationId }) => {
      const receiver = users.find((user) => user.userId === receiverId);
      const sender = users.find((user) => user.userId === senderId);
      const user = await Users.findById(senderId);

      // Check if sender and receiver are defined
      if (sender && receiver) {
        io.to(receiver.socketId)
          .to(sender.socketId)
          .emit("getMessage", {
            senderId,
            message,
            conversationId,
            receiverId,
            user: { id: user._id, fullName: user.fullName, email: user.email },
          });
      } else if (sender) {
        io.to(sender.socketId).emit("getMessage", {
          senderId,
          message,
          conversationId,
          receiverId,
          user: { id: user._id, fullName: user.fullName, email: user.email },
        });
      } else {
        console.error("Sender not found!");
      }
    }
  );

  socket.on("disconnect", () => {
    users = users.filter((user) => user.socketId !== socket.id);
    io.emit("getUsers", users);
  });
});




// Users ----------------------------------
// Helper function to generate a new JWT token for users
function generateUserToken(payload) {
  const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "YOUR_SECRET_KEY_FOR_USER";
  return jwt.sign(payload, JWT_SECRET_KEY, { expiresIn: "1d" });
}

// Middleware to verify user JWT token
function verifyUserToken(req, res, next) {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized. User token is missing." });
  }

  const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "YOUR_SECRET_KEY_FOR_USER";
  jwt.verify(token, JWT_SECRET_KEY, (err, decodedToken) => {
    if (err) {
      return res.status(401).json({ error: "Unauthorized. Invalid user token." });
    }

    req.user = decodedToken;
    next();
  });
}


// User registration or login
app.post("/api/user/register-or-login", async (req, res) => {
  try {
    const { fullName, email } = req.body;

    if (!fullName || !email) {
      return res
        .status(400)
        .json({ error: "Please provide full name and email" });
    }

    let user = await Users.findOne({ email });

    // If user with the provided email doesn't exist, register the user with the "guest" role
    if (!user) {
      user = new Users({
        fullName,
        email,
        role: "guest", // Assuming "guest" is the default role for users
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
    const token = generateUserToken(payload);

    // Return user details and token for login
    return res
      .status(200)
      .json({ message: "User registration or login successful", user, token });
  } catch (error) {
    console.error("Error registering or logging in user:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Add the route to fetch all admins for the user
app.get("/api/user/admins", async (req, res) => {
  try {
    // Find all users with the role "admin" (excluding the password field)
    const admins = await Users.find({ role: "admin" }, { password: 0 });

    return res.status(200).json(admins);
  } catch (error) {
    console.error("Error fetching admins:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

/// API to start a conversation with an admin for the user
app.post("/api/user/start-conversation", verifyUserToken, async (req, res) => {
  try {
    const { userId } = req.body;

    // Check if userId is provided in the request body
    if (!userId) {
      return res.status(400).json({ error: "userId is required in the request body" });
    }

    // Get all admins with the role "admin" from the Users collection
    const admins = await Users.find({ role: "admin" });

    // Check if there are any admins available
    if (admins.length === 0) {
      return res.status(404).json({ error: "No admins available to start a conversation" });
    }

    // Randomly select an admin from the list of admins
    const randomIndex = Math.floor(Math.random() * admins.length);
    const randomAdmin = admins[randomIndex];

    // Check if the conversation between the user and admin already exists
    const existingConversation = await Conversation.findOne({
      members: { $all: [randomAdmin._id, userId] },
    });

    if (existingConversation) {
      // If the conversation already exists, return the existing conversation
      return res.status(200).json({ conversation: existingConversation });
    } else {
      // If the conversation doesn't exist, create a new conversation
      const newConversation = new Conversation({
        members: [randomAdmin._id, userId],
      });

      await newConversation.save();
      return res.status(200).json({ conversation: newConversation });
    }
  } catch (error) {
    console.error("Error starting conversation:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});


// API to fetch messages for a conversation
app.get("/api/user/conversation/messages/:conversationId", verifyUserToken,  async (req, res) => {
  try {
    const conversationId = req.params.conversationId;

    // Check if the conversation exists
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Find all messages for the given conversationId
    const messages = await Message.find({ conversationId });

    // Emit the messages to the users involved in the conversation using Socket.IO
    const senderId = conversation.members[0];
    const receiverId = conversation.members[1];
    const senderSocket = io.sockets.sockets.get(senderId);
    const receiverSocket = io.sockets.sockets.get(receiverId);

    if (senderSocket) {
      senderSocket.emit("getMessages", { conversationId, messages });
    }

    if (receiverSocket) {
      receiverSocket.emit("getMessages", { conversationId, messages });
    }

    return res.status(200).json({ messages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Send message for both users
app.post("/api/user/conversation/send-message/:conversationId",  async (req, res) => {
  try {
    const { userId } = req.body;
    const conversationId = req.params.conversationId;
    const { message } = req.body;

    // Check if the conversation exists
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Save the message to the database, including sender's ID and fullName
    const sender = await Users.findById(userId);
    if (!sender) {
      return res.status(404).json({ error: "Sender not found" });
    }
console.log(sender.fullName);
const senderName= sender.fullName
    const newMessage = new Message({
      conversationId: conversation._id,
      senderId: userId,
      senderName:senderName,
      message,
      time: new Date().toLocaleTimeString(),
      date: new Date().toLocaleDateString(),
    });

    // Add the newly created message to the conversation's messages array
    conversation.messages.push(newMessage._id);

    // Use Promise.all to perform both operations concurrently
    await Promise.all([newMessage.save(), conversation.save()]);

    // Emit the message to the admin using Socket.IO
    const adminId = conversation.admin;
    const adminSocket = io.sockets.sockets.get(adminId);
    if (adminSocket) {
      adminSocket.emit("getMessage", {
        senderId: userId,
        senderName: sender.fullName,
        message,
        conversationId: conversation._id,
        receiverId: adminId,
      });
    }

    return res.status(200).json({ message: "Message sent successfully" });
  } catch (error) {
    console.error("Error sending message:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});



// Admin ---------------------------------------------------------------------------------------------------------------

// Helper function to generate a new JWT token
function generateToken(payload) {
  const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "YOUR_SECRET_KEY_FOR_ADMIN";
  return jwt.sign(payload, JWT_SECRET_KEY, { expiresIn: "1d" });
}

// Middleware to verify admin JWT token
function verifyAdminToken(req, res, next) {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized. Admin token is missing." });
  }

  const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "YOUR_SECRET_KEY_FOR_ADMIN";
  jwt.verify(token, JWT_SECRET_KEY, (err, decodedToken) => {
    if (err) {
      return res.status(401).json({ error: "Unauthorized. Invalid admin token." });
    }

    if (decodedToken.role !== "admin") {
      return res.status(403).json({ error: "Forbidden. Only admin users are allowed." });
    }

    req.admin = decodedToken;
    next();
  });
}

// Admin login
app.post("/api/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Please fill all required fields" });
    }

    const adminUser = await Users.findOne({ email, role: "admin" });
    if (!adminUser) {
      return res.status(404).json({ error: "Admin user not found" });
    }

    const validateAdmin = await bcryptjs.compare(password, adminUser.password);
    if (!validateAdmin) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const payload = {
      userId: adminUser._id,
      email: adminUser.email,
      role: adminUser.role,
    };
    
    const token = generateToken(payload);

    // Return both the token and the admin ID in the response
    return res.status(200).json({ token, adminId: adminUser._id });
  } catch (error) {
    console.error("Error logging in admin:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Create a new admin
app.post("/api/newadmin", verifyAdminToken, async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: "Please fill all required fields" });
    }

    const existingAdmin = await Users.findOne({ email, role: "admin" });
    if (existingAdmin) {
      return res.status(400).json({ error: "Admin user already exists" });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);
    const newAdmin = new Users({
      fullName,
      email,
      password: hashedPassword,
      role: "admin",
    });
    await newAdmin.save();

    return res.status(200).json({ message: "Admin user created successfully" });
  } catch (error) {
    console.error("Error creating admin user:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Fetch all users info other than admin
app.get("/api/admin/users", verifyAdminToken, async (req, res) => {
  try {
    const allUsers = await Users.find({ role: { $ne: "admin" } }, { password: 0 });

    // The above query will find all users whose role is not equal to 'admin'
    // and exclude the password field from the response.

    return res.status(200).json(allUsers);
  } catch (error) {
    console.error("Error fetching all users:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});


// API to get conversations for an admin
app.get("/api/admin/conversations/:adminId",  verifyAdminToken, async (req, res) => {
  try {
    const adminIdFromUrl = req.params.adminId;

    // Find all conversations where the admin is a member
    const conversations = await Conversation.find({
      members: { $in: [adminIdFromUrl] },
    });

    // Emit the conversations to the admin using Socket.IO
    const adminSocket = io.sockets.sockets.get(adminIdFromUrl);
    if (adminSocket) {
      adminSocket.emit("getConversations", conversations);
    }

    return res.status(200).json({ conversations });
  } catch (error) {
    console.error("Error fetching conversations for admin:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});


// API to fetch messages for a conversation
app.get("/api/admin/conversation/messages/:conversationId", verifyAdminToken, async (req, res) => {
  try {
    const conversationId = req.params.conversationId;

    // Check if the conversation exists
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Find all messages for the given conversationId
    const messages = await Message.find({ conversationId });

    // Emit the messages to the users involved in the conversation using Socket.IO
    const senderId = conversation.members[0];
    const receiverId = conversation.members[1];
    const senderSocket = io.sockets.sockets.get(senderId);
    const receiverSocket = io.sockets.sockets.get(receiverId);

    if (senderSocket) {
      senderSocket.emit("getMessages", { conversationId, messages });
    }

    if (receiverSocket) {
      receiverSocket.emit("getMessages", { conversationId, messages });
    }

    return res.status(200).json({ messages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Send message for both users
app.post("/api/admin/conversation/send-message/:conversationId", verifyAdminToken, async (req, res) => {
  try {
    const { userId } = req.body;
    const conversationId = req.params.conversationId;
    const { message } = req.body;

    // Check if the conversation exists
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Save the message to the database, including sender's ID and fullName
    const sender = await Users.findById(userId);
    if (!sender) {
      return res.status(404).json({ error: "Sender not found" });
    }
console.log(sender.fullName);
const senderName= sender.fullName
    const newMessage = new Message({
      conversationId: conversation._id,
      senderId: userId,
      senderName:senderName,
      message,
      time: new Date().toLocaleTimeString(),
      date: new Date().toLocaleDateString(),
    });

    // Add the newly created message to the conversation's messages array
    conversation.messages.push(newMessage._id);

    // Use Promise.all to perform both operations concurrently
    await Promise.all([newMessage.save(), conversation.save()]);

    // Emit the message to the admin using Socket.IO
    const adminId = conversation.admin;
    const adminSocket = io.sockets.sockets.get(adminId);
    if (adminSocket) {
      adminSocket.emit("getMessage", {
        senderId: userId,
        senderName: sender.fullName,
        message,
        conversationId: conversation._id,
        receiverId: adminId,
      });
    }

    return res.status(200).json({ message: "Message sent successfully" });
  } catch (error) {
    console.error("Error sending message:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});




// Start the server
const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
