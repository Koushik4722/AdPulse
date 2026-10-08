import axios from 'axios';
const apiBaseUrl=import.meta.env.VITE_API_URL||(import.meta.env.PROD?'https://adpulse-ae5a.onrender.com/api':'http://localhost:5000/api');
export const api=axios.create({baseURL:apiBaseUrl}); api.interceptors.request.use(c=>{const t=localStorage.getItem('token');if(t)c.headers.Authorization=`Bearer ${t}`;return c});
