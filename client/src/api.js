import axios from 'axios';
const apiBaseUrl=import.meta.env.VITE_API_URL||(import.meta.env.PROD?'https://adpulse-ae5a.onrender.com/api':'http://localhost:5000/api');
export const socketUrl=(import.meta.env.VITE_SOCKET_URL||apiBaseUrl).replace(/\/api\/?$/,'');
let getClerkToken = async () => null;
export const setClerkTokenGetter = (getter) => { getClerkToken = getter || (async () => null); };
export const api=axios.create({baseURL:apiBaseUrl});
api.interceptors.request.use(async (config) => {
  const token = await getClerkToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
