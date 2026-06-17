const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'billing_secret_key');
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const superadminOnly = (req, res, next) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'SuperAdmin access only' });
  next();
};

module.exports = { auth, superadminOnly };
