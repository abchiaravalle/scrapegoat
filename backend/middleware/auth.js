const { getUserByUsername } = require('../models/database');
const bcrypt = require('bcrypt');

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ error: 'Authentication required' });
}

// Middleware to verify password
async function verifyPassword(username, password) {
  try {
    const user = await getUserByUsername(username);
    if (!user) {
      return false;
    }
    return await bcrypt.compare(password, user.password_hash);
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
}

module.exports = {
  requireAuth,
  verifyPassword
};

