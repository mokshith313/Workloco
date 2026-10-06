import express from 'express';
import { store } from '../services/store.js';

export const notificationsRouter = express.Router();

// Fetch Notifications by Target Role ('SEEKER', 'PROVIDER', 'ALL')
notificationsRouter.get('/', (req, res) => {
  const { role = 'ALL' } = req.query;
  const list = store.getNotifications(role);
  const unreadCount = list.filter(n => !n.is_read).length;

  res.json({
    success: true,
    count: list.length,
    unread_count: unreadCount,
    notifications: list
  });
});

// Mark Single Notification as Read
notificationsRouter.patch('/:id/read', (req, res) => {
  const { id } = req.params;
  const updated = store.markNotificationRead(id);

  if (!updated) {
    return res.status(404).json({ error: 'Notification not found.' });
  }

  res.json({ success: true, notification: updated });
});

// Mark All Notifications as Read
notificationsRouter.post('/read-all', (req, res) => {
  const { role = 'ALL' } = req.body;
  store.markAllNotificationsRead(role);
  res.json({ success: true, message: 'All notifications marked as read.' });
});
