const { jwtHelpers, validationHelpers, errorHelpers } = require('../utils/auth');

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json(errorHelpers.createAuthError('Access token required'));
  }

  try {
    const decoded = jwtHelpers.verifyTokenWithFallback(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json(errorHelpers.createAuthError('Invalid or expired token'));
  }
};

// Rate limiting middleware
const rateLimitAuth = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  if (!global.rateLimitStore) {
    global.rateLimitStore = new Map();
  }

  const clientData = global.rateLimitStore.get(clientIP) || { count: 0, resetTime: now + 60000 };

  if (now > clientData.resetTime) {
    clientData.count = 1;
    clientData.resetTime = now + 60000;
  } else {
    clientData.count++;
  }

  global.rateLimitStore.set(clientIP, clientData);

  if (clientData.count > 5) {
    return res.status(429).json({
      error: 'Too many auth attempts',
      retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
    });
  }

  next();
};

// Validation middleware
const validateUserInput = (req, res, next) => {
  const { email, password } = req.body;

  if (!validationHelpers.validateEmailSimple(email)) {
    return res.status(400).json(errorHelpers.createValidationError('Valid email required'));
  }

  if (!validationHelpers.validatePasswordMiddleware(password)) {
    return res.status(400).json(errorHelpers.createValidationError('Password must be at least 6 characters'));
  }

  next();
};

// Logging middleware
const logRequests = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });

  next();
};

module.exports = {
  authenticateToken,
  rateLimitAuth,
  validateUserInput,
  logRequests
};
