import express from 'express';
import { db } from '../config/db.js';

const router = express.Router();

// Get notifications for a user
router.get("/api/notifications/:userId", (req, res) => {
  const { userId } = req.params;
  const query = `SELECT * FROM notification WHERE userId = ? ORDER BY createdAt DESC`;
  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ message: "Failed to fetch notifications" });
    res.json(results);
  });
});

// Mark notifications as read
router.put("/api/notifications/mark-read/:userId", (req, res) => {
  const { userId } = req.params;
  const query = `UPDATE notification SET isRead = 1 WHERE userId = ? AND isRead = 0`;
  db.query(query, [userId], (err) => {
    if (err) return res.status(500).json({ message: "Failed to mark notifications as read" });
    res.json({ message: "Notifications marked as read" });
  });
});

export default router;