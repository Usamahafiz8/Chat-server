const express = require("express");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const io = require("socket.io")(8080, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174"],
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

  // Add the user to the users array when they connect
  socket.on("addUser", (userId) => {
    // Check if the user is not already in the users array
    const isUserExist = users.find((user) => user.userId === userId);
    if (!isUserExist) {
      const user = { userId, socketId: socket.id };
      users.push(user);
      io.emit("getUsers", users);
    }
  });

  // Listen for incoming messages
socket.on("sendMessage", async ({ senderEmail, receiverId, message, conversationId }) => {
  // Find the receiver's socket using their ID
  const receiver = users.find((user) => user.userId === receiverId);
  const sender = users.find((user) => user.userId === senderEmail);

  // Check if the sender and receiver are defined
  if (!sender || !receiver) {
    // Handle the case where the sender or receiver is not found
    // Try to find the conversation based on the provided conversationId and check the members or useremail
    const conversation = await Conversation.findById(conversationId).populate("members admin");
    
    if (!conversation) {
      return io.to(sender?.socketId).emit("userNotFound", "Invalid conversationId");
    }

    // Check if the user exists in the conversation's members or admin
    const userExistsInMembers = conversation.members.some(member => member._id.toString() === senderEmail);
    const userExistsInAdmin = conversation.admin._id.toString() === senderEmail;
    
    // Check if the senderEmail matches the conversation's useremail
    const userEmailMatches = conversation.useremail === senderEmail;

    if (!userExistsInMembers && !userExistsInAdmin && !userEmailMatches) {
      return io.to(sender?.socketId).emit("userNotFound", "User not found in conversation");
    }

    // Continue with sending the message to the receiver (if found) or the sender (if receiver not found)
    const receiverSocketId = receiver ? receiver.socketId : sender?.socketId;
    io.to(receiverSocketId).emit("getMessage", {
      senderEmail,
      message,
      conversationId,
      receiverId,
    });
  } else {
    // Send the message to both sender and receiver
    io.to(receiver.socketId).to(sender.socketId).emit("getMessage", {
      senderEmail,
      message,
      conversationId,
      receiverId,
    });
  }
});


  // Listen for user disconnection and remove them from the users array
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


// API to start a conversation with an admin for the user
// app.post("/api/user/start-conversation", async (req, res) => {
//   try {
//     const { fullName, email, role } = req.body;

//     // Check if fullName, email, and role are provided in the request body
//     if (!fullName || !email || !role) {
//       return res.status(400).json({ error: "Please provide full name, email, and role" });
//     }

//     // Find the admin to start a conversation with
//     const admin = await Users.findOne({ role: "admin" });

//     // Check if an admin is available
//     if (!admin) {
//       return res.status(404).json({ error: "No admins available to start a conversation" });
//     }

//     // Create a new conversation with the admin and user
//     const newConversation = new Conversation({
//       members: [admin._id, /* Add the ObjectId of the user here */ ],
//       admin: admin._id,
//       useremail: email, // Save the user's email in the useremail field
//     });

//     await newConversation.save();
//     return res.status(200).json({ conversation: newConversation });
//   } catch (error) {
//     console.error("Error starting conversation:", error);
//     return res.status(500).json({ error: "Internal Server Error" });
//   }
// });

// API to start a conversation with an admin for the user
app.post("/api/user/start-conversation", async (req, res) => {
  try {
    const { fullName, email, role } = req.body;

    // Check if fullName, email, and role are provided in the request body
    if (!fullName || !email || !role) {
      return res.status(400).json({ error: "Please provide full name, email, and role" });
    }

    // Find the admin to start a conversation with
    const admin = await Users.findOne({ role: "admin" });

    // Check if an admin is available
    if (!admin) {
      return res.status(404).json({ error: "No admins available to start a conversation" });
    }

    // Check if a conversation with the user's email already exists
    const existingConversation = await Conversation.findOne({ useremail: email });

    if (existingConversation) {
      // Update the existing conversation with the new full name and role
      existingConversation.userfullname = fullName;
      existingConversation.role = role;
      await existingConversation.save();
      return res.status(200).json({ conversation: existingConversation });
    } else {
      // Create a new conversation with the admin and user
      const newConversation = new Conversation({
        members: [admin._id, /* Add the ObjectId of the user here */ ],
        admin: admin._id,
        useremail: email,
        userfullname: fullName,
        UserRole: role,
      });

      await newConversation.save();
      return res.status(200).json({ conversation: newConversation });
    }
  } catch (error) {
    console.error("Error starting conversation:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});
app.post("/api/user/auth/start-conversation", async (req, res) => {
  try {
    const { fullName, email, role, url, auth_token } = req.body;

    // // Check if fullName, email, and role are provided in the request body
    // if (!fullName || !email || !role) {
    //   return res.status(400).json({ error: "Please provide full name, email, and role" });
    // }

    // let useremail = email;
    // let userfullname = fullName;
    // let UserRole = role;
    
    // Check if url and auth_token are provided
    if (!isEmpty(url) && !isEmpty(auth_token)) {
      // Make a request to the external API with the provided Auth_Token
      const response = await axios.get(url, {
        headers: {
          Authorization: `${auth_token}`,
        },
      });
      console.log(response, url, auth_token);
      // Extract the required data from the response (Modify this based on the response data from the external API)
      useremail = response.data.email;
      userfullname = response.data.name;
      UserRole = response.data.role;
    } else {
      // Prompt the user to provide name, email, and role manually
      
      return res.status(200).json({ prompt: true, message: "Please provide name, email, and role manually" });
      
    }
    // const { fullName, email, role, url, auth_token } = req.body;
    // let useremail = email;
    // let userfullname = fullName;
    // let UserRole = role;
    // // Check if fullName, email, and role are provided in the request body
    // if (!fullName || !email || !role) {
    //   return res.status(400).json({ error: "Please provide full name, email, and role" });
    // }

    // let useremail = email;
    // let userfullname = fullName;
    // let UserRole = role;

    // Find the admin to start a conversation with
    const admin = await Users.findOne({ role: "admin" });
    
    // Check if an admin is available
    if (!admin) {
      return res.status(404).json({ error: "No admins available to start a conversation" });
    }
    
    // Check if a conversation with the user's email already exists
    const existingConversation = await Conversation.findOne({ useremail });

    if (existingConversation) {
      // Update the existing conversation with the new full name and role
      existingConversation.userfullname = userfullname;
      existingConversation.UserRole = UserRole;
      await existingConversation.save();
      return res.status(200).json({ conversation: existingConversation });
    } else {
      // Create a new conversation with the admin and user
      const newConversation = new Conversation({
        members: [admin._id], // Add the ObjectId of the admin here
        admin: admin._id,
        useremail,
        userfullname,
        UserRole,
      });

      await newConversation.save();
      return res.status(200).json({ conversation: newConversation });
    }
  } catch (error) {
    console.error("Error starting conversation:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

//API to send a message in a conversation
app.post("/api/user/send-message/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params; // Extract the conversationId from the URL

    const { senderemail, message } = req.body;

    // Check if senderemail and message are provided in the request body
    if (!senderemail || !message) {
      return res.status(400).json({ error: "Please provide senderemail and message" });
    }

    // Find the conversation with the provided conversationId and senderemail
    const conversation = await Conversation.findOne({ _id: conversationId, useremail: senderemail });

    // Check if the conversation exists and the senderemail matches
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found or invalid senderemail" });
    }

    // Create a new message instance with the current time and date
    const currentTime = new Date();
    const newMessage = new Message({
      conversationId: conversationId,
      senderemail: senderemail, // Use the senderemail as the reference to the User model
      message: message,
      time: currentTime.toLocaleTimeString(), // Convert current time to a string
      date: currentTime.toLocaleDateString(), // Convert current date to a string
    });

    // Save the new message to the database
    await newMessage.save();

    // Update the conversation's messages array with the new message's ObjectId
    conversation.messages.push(newMessage._id);
    await conversation.save();

    return res.status(200).json({ message: "Message sent successfully" });
  } catch (error) {
    console.error("Error sending message:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});


// API to get all messages in a conversation
app.get("/api/conversations/messages/:conversationId", async (req, res) => {
  try {
    const conversationId = req.params.conversationId;

    // Find the conversation by its ID and populate the 'messages' field with message documents
    const conversation = await Conversation.findById(conversationId).populate("messages");

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Extract and send the messages
    const messages = conversation.messages;
    return res.status(200).json({ messages });
  } catch (error) {
    console.error("Error fetching messages:", error);
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
app.post("/api/admin/conversation/send-message/:conversationId",  async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId, message } = req.body;

    // Check if the conversation exists
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Save the message to the database, including sender's ID and fullName
    const admin = await Users.findById(userId);
    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    const newMessage = new Message({
      conversationId: conversation._id,
      senderId: userId,
      senderName: admin.fullName, // Use the admin's fullName as the senderName
      message,
      time: new Date().toLocaleTimeString(),
      date: new Date().toLocaleDateString(),
    });

    // Add the newly created message to the conversation's messages array
    conversation.messages.push(newMessage._id);

    // Use Promise.all to perform both operations concurrently
    await Promise.all([newMessage.save(), conversation.save()]);

    // Emit the message to the user using Socket.IO
    const userSocket = io.sockets.sockets.get(conversation.user); // 'conversation.user' contains the user's ID
    if (userSocket) {
      userSocket.emit("getMessage", {
        senderId: userId,
        senderName: admin.fullName,
        message,
        conversationId: conversation._id,
        receiverId: conversation.user,
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
