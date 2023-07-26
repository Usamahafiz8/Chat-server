const jwt = require("jsonwebtoken");

const verifyAdminToken = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res
      .status(401)
      .json({ error: "Unauthorized. Admin token is missing." });
  }

  const JWT_SECRET_KEY =
    process.env.JWT_SECRET_KEY || "YOUR_SECRET_KEY_FOR_ADMIN";
  jwt.verify(token, JWT_SECRET_KEY, (err, decodedToken) => {
    if (err) {
      return res
        .status(401)
        .json({ error: "Unauthorized. Invalid admin token." });
    }

    if (decodedToken.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Forbidden. Only admin users are allowed." });
    }

    req.admin = decodedToken;
    next();
  });
};

module.exports = verifyAdminToken;
