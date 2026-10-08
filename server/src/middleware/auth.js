import jwt from 'jsonwebtoken';
import User from '../models/User.js';
export const protect = async (req, res, next) => { try { const token = req.headers.authorization?.split(' ')[1]; if (!token) throw new Error(); const { id } = jwt.verify(token, process.env.JWT_SECRET); const user = await User.findById(id).select('-password'); if (!user || user.isBlocked) throw new Error(); req.user = user; next(); } catch { res.status(401).json({ message: 'Not authorized' }); } };
export const allow = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'Insufficient permissions' });
