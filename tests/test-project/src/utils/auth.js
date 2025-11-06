// Authentication utilities
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// JWT helpers
const jwtHelpers = {
  generateToken: (payload, expiresIn = '7d') => {
    return jwt.sign(payload, process.env.JWT_SECRET || 'server-jwt-secret', { expiresIn });
  },

  generateRegistrationToken: (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET || 'route-specific-secret', { expiresIn: '1h' });
  },

  generateLoginToken: (payload) => {
    return jwt.sign(payload, 'different-login-secret', { expiresIn: '24h' });
  },

  verifyToken: (token, secret) => {
    try {
      return jwt.verify(token, secret);
    } catch (error) {
      throw error;
    }
  },

  verifyTokenWithFallback: (token) => {
    try {
      return jwt.verify(token, process.env.JWT_SECRET || 'middleware-secret');
    } catch (error) {
      throw error;
    }
  }
};

// Password helpers
const passwordHelpers = {
  hashPassword: async (password) => {
    const salt = await bcrypt.genSalt(12);
    return await bcrypt.hash(password, salt);
  },

  hashPasswordRoutes: async (password) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
  },

  comparePassword: async (candidatePassword, hashedPassword) => {
    return await bcrypt.compare(candidatePassword, hashedPassword);
  }
};

// Validation helpers
const validationHelpers = {
  validateEmail: (email) => {
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    return emailRegex.test(email);
  },

  validateEmailSimple: (email) => {
    return email && email.includes('@');
  },

  validatePassword: (password, minLength = 8) => {
    return password && password.length >= minLength;
  },

  validatePasswordMiddleware: (password) => {
    return password && password.length >= 6;
  }
};

// Error handling helpers
const errorHelpers = {
  createValidationError: (message) => ({
    error: message
  }),

  createServerError: (message, details = null) => ({
    error: message,
    ...(details && { details })
  }),

  createAuthError: (message) => ({
    error: message
  })
};

module.exports = {
  jwtHelpers,
  passwordHelpers,
  validationHelpers,
  errorHelpers
};
