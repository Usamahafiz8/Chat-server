const express = require('express');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken'); 
const cors = require('cors');
const io = require('socket.io')(8080, {
    cors: {
        origin: 'http://localhost:3000',
    }
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

const port = process.env.PORT || 8000;

// Socket.io
let users = [];
// io.on('connection', socket => {
//     console.log('User connected', socket.id);
//     socket.on('addUser', userId => {
//         const isUserExist = users.find(user => user.userId === userId);
//         if (!isUserExist) {
//             const user = { userId, socketId: socket.id };
//             users.push(user);
//             io.emit('getUsers', users);
//         }
//     });

//     socket.on('sendMessage', async ({ senderId, receiverId, message, conversationId }) => {
//         const receiver = users.find(user => user.userId === receiverId);
//         const sender = users.find(user => user.userId === senderId);
//         const user = await Users.findById(senderId);
//         console.log('sender :>> ', sender, receiver);
//         if (receiver) {
//             io.to(receiver.socketId).to(sender.socketId).emit('getMessage', {
//                 senderId,
//                 message,
//                 conversationId,
//                 receiverId,
//                 user: { id: user._id, fullName: user.fullName, email: user.email }
//             });
//             }else {
//                 io.to(sender.socketId).emit('getMessage', {
//                     senderId,
//                     message,
//                     conversationId,
//                     receiverId,
//                     user: { id: user._id, fullName: user.fullName, email: user.email }
//                 });
//             }
//         });

//     socket.on('disconnect', () => {
//         users = users.filter(user => user.socketId !== socket.id);
//         io.emit('getUsers', users);
//     });
//     // io.emit('getUsers', socket.userId);
// });

io.on('connection', socket => {
    console.log('User connected', socket.id);
    socket.on('addUser', async ({ userId, authToken, url, name, email }) => {
      let role = 'guest'; // Default role is guest
  
      if (authToken && url) {
        try {   
          // Perform the authentication and role determination logic here based on the authToken and URL.
          // If the authToken is valid and contains the necessary information (name, email, and role), set the 'role' variable accordingly.
          // For example, you can decode the authToken and extract the required information to set the 'role'.
  
          // Here, we assume that the authToken is valid and contains the necessary information, and the role is extracted from it.
          const decodedToken = jwt.verify(authToken, 'YOUR_JWT_SECRET');
          role = decodedToken.role || 'guest'; // If 'role' is not present in the token, default to 'guest'
  
        } catch (err) {
          console.error('Authentication failed:', err.message);
          // Set role to 'guest' if authentication fails or token is invalid
        }
      }
  
      // If the user doesn't exist, create a new user with provided or default values (name, email, and role)
      if (!name || !email) {
        name = 'Guest User';
        email = 'guest@example.com';
      }
  
      const isUserExist = users.find(user => user.userId === userId);
      if (!isUserExist) {
        // Create a new user with the provided information or default values (name, email, and role)
        const newUser = new Users({ fullName: name, email, role });
        await newUser.save();
        // For simplicity, let's assume the user is successfully saved to the database and gets a unique ID (newUser._id).
  
        // Assign the new user's unique ID to 'userId'
        userId = newUser._id;
  
        // Notify the admin about the new user or guest joining the chat
        const adminUser = users.find(user => user.role === 'admin');
        if (adminUser) {
          io.to(adminUser.socketId).emit('newUserJoined', {
            userId,
            role,
          });
        }
      }
  
      // Add the user to the users array or update their role if they are already in the array
      const userIndex = users.findIndex(user => user.userId === userId);
      if (userIndex !== -1) {
        users[userIndex] = { userId, socketId: socket.id, role };
      } else {
        users.push({ userId, socketId: socket.id, role });
      }
  
      io.emit('getUsers', users);
    });
  
    socket.on('sendMessage', async ({ senderId, receiverId, message, conversationId }) => {
        const receiver = users.find(user => user.userId === receiverId);
        const sender = users.find(user => user.userId === senderId);
        const user = await Users.findById(senderId);
        console.log('sender :>> ', sender, receiver);
        if (receiver) {
            io.to(receiver.socketId).to(sender.socketId).emit('getMessage', {
                senderId,
                message,
                conversationId,
                receiverId,
                user: { id: user._id, fullName: user.fullName, email: user.email }
            });
            }else {
                io.to(sender.socketId).emit('getMessage', {
                    senderId,
                    message,
                    conversationId,
                    receiverId,
                    user: { id: user._id, fullName: user.fullName, email: user.email }
                });
            }
        });

    socket.on('disconnect', () => {
        users = users.filter(user => user.socketId !== socket.id);
        io.emit('getUsers', users);
    });
    // io.emit('getUsers', socket.userId);
    // ... (rest of the code)
  });
  
// Routes
app.get('/', (req, res) => {
    res.send('Welcome');
})

app.post('/api/admins', async (req, res) => {
    const { adminSecretKey, fullName, email, password } = req.body;
  
    // Check if the provided secret key matches the adminSecretKey
    const actualAdminSecretKey = 'YOUR_ADMIN_SECRET_KEY1';
    if (adminSecretKey !== actualAdminSecretKey) {
      return res.status(401).send('Unauthorized');
    }
  
    try {
      // Check if an admin with the same email already exists
      const existingAdmin = await Users.findOne({ email });
      if (existingAdmin) {
        return res.status(400).send('Admin with the same email already exists');
      }
  
      // Create a new admin user
      const newUser = new Users({ fullName, email, password, role: 'admin' });
      bcryptjs.hash(password, 10, async (err, hashedPassword) => {
        newUser.set('password', hashedPassword);
        await newUser.save();
        res.status(200).send('Admin user created successfully');
      });
    } catch (error) {
      console.log(error);
      res.status(500).send('Internal Server Error');
    }
  });
  
  

app.post('/api/register', async (req, res, next) => {
    try {
        const { fullName, email, password } = req.body;

        if (!fullName || !email || !password) {
            res.status(400).send('Please fill all required fields');
        } else {
            const isAlreadyExist = await Users.findOne({ email });
            if (isAlreadyExist) {
                res.status(400).send('User already exists');
            } else {
                const newUser = new Users({ fullName, email });
                bcryptjs.hash(password, 10, (err, hashedPassword) => {
                    newUser.set('password', hashedPassword);
                    newUser.save();
                    next();
                })
                return res.status(200).send('User registered successfully');
            }
        }

    } catch (error) {
        console.log(error, 'Error')
    }
})

app.post('/api/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).send('Please fill all required fields');
        } else {
            const user = await Users.findOne({ email });
            if (!user) {
                res.status(400).send('User email or password is incorrect');
            } else {
                const validateUser = await bcryptjs.compare(password, user.password);
                if (!validateUser) {
                    res.status(400).send('User email or password is incorrect');
                } else {
                    const payload = {
                        userId: user._id,
                        email: user.email
                    }
                    const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'THIS_IS_A_JWT_SECRET_KEY';

                    jwt.sign(payload, JWT_SECRET_KEY, { expiresIn: 84600 }, async (err, token) => {
                        await Users.updateOne({ _id: user._id }, {
                            $set: { token }
                        })
                        user.save();
                        return res.status(200).json({ user: { id: user._id, email: user.email, fullName: user.fullName }, token: token })
                    })
                }
            }
        }

    } catch (error) {
        console.log(error, 'Error')
    }
})

app.post('/api/conversation', async (req, res) => {
    try {
        const { senderId, receiverId } = req.body;
        const newCoversation = new Conversations({ members: [senderId, receiverId] });
        await newCoversation.save();
        res.status(200).send('Conversation created successfully');
    } catch (error) {
        console.log(error, 'Error')
    }
})

app.post('/api/guest', async (req, res) => {
    const { name, email } = req.body;
  
    // If name or email is not provided, return a bad request response
    if (!name || !email) {
      return res.status(400).send('Please provide both name and email');
    }
  
    // Check if a user with the given email already exists
    let user = await Users.findOne({ email });
  
    if (user) {
      // If the user already exists, check if the provided name matches the stored name
      if (user.fullName !== name) {
        return res.status(400).send('Email and name do not match');
      }
    } else {
      // If the user doesn't exist, create a new guest user with the provided name and email
      user = new Users({ fullName: name, email, role: 'guest' });
      await user.save();
      // For simplicity, let's assume the user is successfully saved to the database and gets a unique ID (user._id).
  
      // Notify the admin about the new guest user joining the chat
      const adminUser = users.find(user => user.role === 'admin');
      if (adminUser) {
        io.to(adminUser.socketId).emit('newUserJoined', {
          userId: user._id,
          role: 'guest',
        });
      }
  
      // Add the guest user to the users array
      users.push({ userId: user._id, socketId: null, role: 'guest' });
  
      io.emit('getUsers', users);
    }
  
    // Return the user's information, including the user ID and role
    return res.status(200).json({ userId: user._id, role: 'guest', fullName: user.fullName, email: user.email });
  });
  
app.get('/api/conversations/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const conversations = await Conversations.find({ members: { $in: [userId] } });
        const conversationUserData = Promise.all(conversations.map(async (conversation) => {
            const receiverId = conversation.members.find((member) => member !== userId);
            const user = await Users.findById(receiverId);
            return { user: { receiverId: user._id, email: user.email, fullName: user.fullName }, conversationId: conversation._id }
        }))
        res.status(200).json(await conversationUserData);
    } catch (error) {
        console.log(error, 'Error')
    }
})

app.post('/api/message', async (req, res) => {
    try {
        const { conversationId, senderId, message, receiverId = '' } = req.body;
        if (!senderId || !message) return res.status(400).send('Please fill all required fields')
        if (conversationId === 'new' && receiverId) {
            const newCoversation = new Conversations({ members: [senderId, receiverId] });
            await newCoversation.save();
            const newMessage = new Messages({ conversationId: newCoversation._id, senderId, message });
            await newMessage.save();
            return res.status(200).send('Message sent successfully');
        } else if (!conversationId && !receiverId) {
            return res.status(400).send('Please fill all required fields')
        }
        const newMessage = new Messages({ conversationId, senderId, message });
        await newMessage.save();
        res.status(200).send('Message sent successfully');
    } catch (error) {
        console.log(error, 'Error')
    }
})

app.get('/api/message/:conversationId', async (req, res) => {
    try {
        const checkMessages = async (conversationId) => {
            console.log(conversationId, 'conversationId')
            const messages = await Messages.find({ conversationId });
            const messageUserData = Promise.all(messages.map(async (message) => {
                const user = await Users.findById(message.senderId);
                return { user: { id: user._id, email: user.email, fullName: user.fullName }, message: message.message }
            }));
            res.status(200).json(await messageUserData);
        }
        const conversationId = req.params.conversationId;
        if (conversationId === 'new') {
            const checkConversation = await Conversations.find({ members: { $all: [req.query.senderId, req.query.receiverId] } });
            if (checkConversation.length > 0) {
                checkMessages(checkConversation[0]._id);
            } else {
                return res.status(200).json([])
            }
        } else {
            checkMessages(conversationId);
        }
    } catch (error) {
        console.log('Error', error)
    }
})

app.get('/api/users/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const users = await Users.find({ _id: { $ne: userId } });
        const usersData = Promise.all(users.map(async (user) => {
            return { user: { email: user.email, fullName: user.fullName, receiverId: user._id } }
        }))
        res.status(200).json(await usersData);
    } catch (error) {
        console.log('Error', error)
    }
})

app.listen(port, () => {
    console.log('listening on port ' + port);
})