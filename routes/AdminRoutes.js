// const express = require("express");
// const router = express.Router();
// const bcryptjs = require("bcryptjs");
// const jwt = require("jsonwebtoken");
// const Users = require("./models/Users");

// // Middleware to verify admin JWT token
// const verifyAdminToken = (req, res, next) => {
//   const token = req.headers.authorization;
//   if (!token) {
//     return res
//       .status(401)
//       .json({ error: "Unauthorized. Admin token is missing." });
//   }

//   const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "YOUR_SECRET_KEY_FOR_ADMIN";
//   jwt.verify(token, JWT_SECRET_KEY, (err, decodedToken) => {
//     if (err) {
//       return res
//         .status(401)
//         .json({ error: "Unauthorized. Invalid admin token." });
//     }

//     if (decodedToken.role !== "admin") {
//       return res
//         .status(403)
//         .json({ error: "Forbidden. Only admin users are allowed." });
//     }

//     req.admin = decodedToken;
//     next();
//   });
// };

// // Admin login
// const adminLogin = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     if (!email || !password) {
//       return res.status(400).json({ error: "Please fill all required fields" });
//     }

//     const adminUser = await Users.findOne({ email, role: "admin" });
//     if (!adminUser) {
//       return res.status(404).json({ error: "Admin user not found" });
//     }

//     const validateAdmin = await bcryptjs.compare(password, adminUser.password);
//     if (!validateAdmin) {
//       return res.status(400).json({ error: "Invalid credentials" });
//     }

//     const payload = {
//       userId: adminUser._id,
//       email: adminUser.email,
//       role: adminUser.role,
//     };
//     const JWT_SECRET_KEY =
//       process.env.JWT_SECRET_KEY || "THIS_IS_A_JWT_SECRET_KEY";

//     jwt.sign(payload, JWT_SECRET_KEY, { expiresIn: "1d" }, (err, token) => {
//       if (err) {
//         console.error("Error signing JWT token:", err);
//         return res.status(500).json({ error: "Internal Server Error" });
//       }

//       // Return both the token and the admin ID in the response
//       return res.status(200).json({ token, adminId: adminUser._id });
//     });
//   } catch (error) {
//     console.error("Error logging in admin:", error);
//     return res.status(500).json({ error: "Internal Server Error" });
//   }
// };

// // Create a new admin
// const createAdmin = async (req, res) => {
//   try {
//     const { fullName, email, password } = req.body;

//     if (!fullName || !email || !password) {
//       return res.status(400).json({ error: "Please fill all required fields" });
//     }

//     const existingAdmin = await Users.findOne({ email, role: "admin" });
//     if (existingAdmin) {
//       return res.status(400).json({ error: "Admin user already exists" });
//     }

//     const hashedPassword = await bcryptjs.hash(password, 10);
//     const newAdmin = new Users({
//       fullName,
//       email,
//       password: hashedPassword,
//       role: "admin",
//     });
//     await newAdmin.save();

//     return res.status(200).json({ message: "Admin user created successfully" });
//   } catch (error) {
//     console.error("Error creating admin user:", error);
//     return res.status(500).json({ error: "Internal Server Error" });
//   }
// };

// // Fetch all users info other than admin
// const getAllUsers = async (req, res) => {
//   try {
//     const allUsers = await Users.find(
//       { role: { $ne: "admin" } },
//       { password: 0 }
//     );
//     // The above query will find all users whose role is not equal to 'admin'
//     // and exclude the password field from the response.

//     return res.status(200).json(allUsers);
//   } catch (error) {
//     console.error("Error fetching all users:", error);
//     return res.status(500).json({ error: "Internal Server Error" });
//   }
// };


// router.post("/login", adminLogin);
// router.post("/admins", verifyAdminToken, createAdmin);
// router.get("/users", verifyAdminToken, getAllUsers);

// module.exports = router;
