const jwt = require("jsonwebtoken");

// Middleware to verify user token
const verifyUserToken = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res
      .status(401)
      .json({ error: "Unauthorized. User token is missing." });
  }

  const JWT_SECRET_KEY =
    process.env.JWT_SECRET_KEY || "YOUR_SECRET_KEY_FOR_USER";
  jwt.verify(token, JWT_SECRET_KEY, (err, decodedToken) => {
    if (err) {
      return res
        .status(401)
        .json({ error: "Unauthorized. Invalid user token." });
    }

    req.user = decodedToken;
    next();
  });
};

module.exports = verifyUserToken;
