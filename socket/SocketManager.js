const io = require("socket.io");

// Function to manage Socket.IO connections and events
const initializeSocket = (server) => {
  const socketServer = io(server);

  // Array to store connected users
  let users = [];

  // Function to handle new user connection
  const handleConnection = (socket) => {
    console.log("User connected", socket.id);

    // Event: addUser
    socket.on("addUser", (userId) => {
      const isUserExist = users.find((user) => user.userId === userId);
      if (!isUserExist) {
        const user = { userId, socketId: socket.id };
        users.push(user);
        socketServer.emit("getUsers", users);
      }
    });

    // Event: sendMessage
    socket.on("sendMessage", async ({ senderId, receiverId, message, conversationId }) => {
      const receiver = users.find((user) => user.userId === receiverId);
      const sender = users.find((user) => user.userId === senderId);
      // ... Remaining message sending logic ...
    });

    // Event: disconnect
    socket.on("disconnect", () => {
      users = users.filter((user) => user.socketId !== socket.id);
      socketServer.emit("getUsers", users);
    });
  };

  // Event: connection
  socketServer.on("connection", handleConnection);
};

module.exports = initializeSocket;
