import Notification from '../models/Notification.js';
export const notify = async (io, user, title, message, type = 'info') => { const note = await Notification.create({ user, title, message, type }); io.to(String(user)).emit('notification', note); return note; };
