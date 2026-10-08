import express from 'express'; import multer from 'multer'; import {v2 as cloudinary} from 'cloudinary'; import {protect} from '../middleware/auth.js';
const router=express.Router(), upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024}});
cloudinary.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,api_secret:process.env.CLOUDINARY_API_SECRET});
router.post('/',protect,upload.single('image'),async(req,res)=>{if(!req.file)return res.status(400).json({message:'Image file is required'});if(!process.env.CLOUDINARY_CLOUD_NAME)return res.status(503).json({message:'Cloudinary is not configured'});try{const data=`data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;const result=await cloudinary.uploader.upload(data,{folder:'adpulse',resource_type:'image'});res.status(201).json({url:result.secure_url,publicId:result.public_id})}catch(e){res.status(400).json({message:e.message})}});
export default router;
