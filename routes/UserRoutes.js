const express = require("express");
const router = express.Router();
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");

// User registration or login
const userRegisterOrLogin = async (req, res) => {
  // User registration/login route logic...
};

// Add the route to fetch all admins for the user
const getAdmins = async (req, res) => {
  // Fetch all admins route logic...
};

// API to start a conversation with an admin for the user
const startConversation = async (req, res) => {
  // Start conversation route logic...
};

// API to send a message for both users
const sendMessage = async (req, res) => {
  // Send message route logic...
};

// API to fetch messages for a conversation
const getMessages = async (req, res) => {
  // Fetch messages route logic...
};

router.post("/register-or-login", userRegisterOrLogin);
router.get("/admins", verifyUserToken, getAdmins);
router.post("/start-conversation", verifyUserToken, startConversation);
router.post("/send-message/:conversationId", verifyUserToken, sendMessage);
router.get("/messages/:conversationId", verifyUserToken, getMessages);

module.exports = router;
