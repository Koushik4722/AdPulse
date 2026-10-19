import 'dotenv/config'; import express from 'express'; import cors from 'cors'; import mongoose from 'mongoose'; import {createServer} from 'node:http'; import {Server} from 'socket.io';
import { clerkMiddleware, verifyToken } from '@clerk/express';
import User from './models/User.js';
import auth from './routes/auth.js'; import campaigns from './routes/campaigns.js'; import publishers from './routes/publishers.js'; import admin from './routes/admin.js'; import insights from './routes/insights.js'; import uploads from './routes/uploads.js'; import ads from './routes/ads.js';
const allowedOrigins=[process.env.CLIENT_URL,'https://adpulse-xi.vercel.app','http://localhost:5173'].filter(Boolean);
const corsOptions={origin:(origin,callback)=>callback(null,!origin||allowedOrigins.includes(origin)),credentials:true};
const app = express();
app.set('trust proxy', 1);
if (process.env.CLERK_SECRET_KEY && process.env.CLERK_PUBLISHABLE_KEY) app.use(clerkMiddleware());
else console.warn('Clerk keys are missing; protected API routes will not authenticate.');
const server = createServer(app);
const io = new Server(server, { cors: corsOptions });

app.set('io', io);
app.use(cors(corsOptions));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'AdPulse API' }));

app.use('/api/auth', auth);
app.use('/api/campaigns', campaigns);
app.use('/api/publisher', publishers);
app.use('/api/admin', admin);
app.use('/api/insights', insights);
app.use('/api/uploads', uploads);
app.use('/api/ads', ads);

// Global error handler MUST be after all route definitions
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'Images must be 5 MB or smaller.' });
  if (err.message === 'Upload a PNG, JPG, WEBP, or GIF image.') return res.status(400).json({ message: err.message });
  console.error(err);
  res.status(err.statusCode || 500).json({ message: err.statusCode && err.statusCode < 500 ? err.message : 'Something went wrong. Please try again.' });
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token || !process.env.CLERK_SECRET_KEY) throw new Error('Missing session token');
    const claims = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      authorizedParties: allowedOrigins
    });
    const profile = await User.findOne({ clerkId: claims.sub, isBlocked: false });
    if (!profile) throw new Error('No active AdPulse profile');
    socket.data.profile = profile;
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  const profile = socket.data.profile;
  socket.join(String(profile._id));
  if (profile.role === 'admin') socket.join('admin_channel');
});

const normaliseMongoUri = (source) => {
  if (!source) return '';
  return source.replace(/\/\?Ad Pulse=[^&]+$/i, '/adpulse');
};

const port = process.env.PORT || 5000;
mongoose
  .connect(normaliseMongoUri(process.env.MONGODB_URI))
  .then(() => server.listen(port, () => console.log(`AdPulse API running on port ${port}`)))
  .catch((e) => {
    console.error('MongoDB connection failed:', e.message);
    console.error('Set MONGODB_URI in server/.env then restart.');
  });
