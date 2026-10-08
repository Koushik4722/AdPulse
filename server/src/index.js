import 'dotenv/config'; import express from 'express'; import cors from 'cors'; import mongoose from 'mongoose'; import {createServer} from 'node:http'; import {Server} from 'socket.io';
import auth from './routes/auth.js'; import campaigns from './routes/campaigns.js'; import publishers from './routes/publishers.js'; import admin from './routes/admin.js'; import insights from './routes/insights.js'; import uploads from './routes/uploads.js'; import ads from './routes/ads.js';
const app=express(), server=createServer(app), io=new Server(server,{cors:{origin:process.env.CLIENT_URL||'http://localhost:5173',credentials:true}}); app.set('io',io); app.use(cors({origin:process.env.CLIENT_URL||'http://localhost:5173'}));app.use(express.json()); app.get('/api/health',(req,res)=>res.json({status:'ok'}));app.use('/api/auth',auth);app.use('/api/campaigns',campaigns);app.use('/api/publisher',publishers);app.use('/api/admin',admin);app.use('/api/insights',insights);app.use((err,req,res,next)=>{console.error(err);res.status(500).json({message:'Something went wrong'})});io.on('connection',socket=>socket.on('join',id=>socket.join(id)));
app.use('/api/uploads',uploads);app.use('/api/ads',ads);
const normaliseMongoUri = (source) => {
  // Atlas UI labels such as `?Ad Pulse=Cluster0` are not MongoDB options.
  return source.replace(/\/\?Ad Pulse=[^&]+$/i, '/adpulse');
};
const port=process.env.PORT||5000; mongoose.connect(normaliseMongoUri(process.env.MONGODB_URI)).then(()=>server.listen(port,()=>console.log(`API on ${port}`))).catch(e=>{console.error('MongoDB connection failed:',e.message);console.error('Set MONGODB_URI in server/.env then restart.');});
