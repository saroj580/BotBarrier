import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Token } from '../models/Token.js';
import { initConfig } from '../config/index.js';
import { recordSuspicious } from '../services/realtime.js';
import { 
  ValidationError, 
  AuthenticationError, 
  asyncHandler 
} from '../middleware/errorHandler.js';

const config = initConfig();

function signAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    config.jwtAccessSecret,
    { expiresIn: config.accessTokenTtlSec || 900 } // default 15m
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { sub: user._id.toString() },
    config.jwtRefreshSecret,
    { expiresIn: config.refreshTokenTtlSec || 60 * 60 * 24 * 7 } // default 7d
  );
}

export const signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  
  
  const existing = await User.findOne({ email });
  if (existing) {
    throw new ValidationError('Email already registered');
  }
  
 
  const passwordHash = await bcrypt.hash(password, 12); // Increased rounds for security
  
  
  const role = (email && email === config.adminBootstrapEmail) ? 'admin' : 'user';
  
  
  const user = await User.create({ name, email, passwordHash, role });
  
  res.status(201).json({ 
    id: user._id, 
    name: user.name,
    email: user.email, 
    role: user.role 
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  
  const user = await User.findOne({ email });
  if (!user) {
    await recordSuspicious(req, { type: 'login_failed', email });
    throw new AuthenticationError('Invalid credentials');
  }
  
  
  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    await recordSuspicious(req, { type: 'login_failed', email });
    throw new AuthenticationError('Invalid credentials');
  }
  
  
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  
  
  await Token.create({ user: user._id, token: refreshToken, type: 'refresh' });
  
  res.json({
    accessToken,
    refreshToken,
    user: { id: user._id, name: user.name, email: user.email, role: user.role }
  });
});

export async function refreshToken(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Missing refreshToken' });
    }
    const stored = await Token.findOne({ token: refreshToken, type: 'refresh' });
    if (!stored) {
      await recordSuspicious(req, { type: 'refresh_invalid', reason: 'not found' });
      return res.status(401).json({ message: 'Invalid refresh token' });
    }
    const payload = jwt.verify(refreshToken, config.jwtRefreshSecret);
    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    const accessToken = signAccessToken(user);
    return res.json({ accessToken });
  } catch (err) {
    console.error('❌ Refresh token error:', err);
    await recordSuspicious(req, { type: 'refresh_invalid', reason: err.message });
    return res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
}

export async function logout(req, res) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await Token.deleteOne({ token: refreshToken, type: 'refresh' });
    }
    return res.json({ message: 'Logged out' });
  } catch (err) {
    console.error('❌ Logout error:', err);
    return res.status(500).json({ message: 'Server error during logout' });
  }
}
