import express from 'express';
import { db } from '../config/db.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Get all users (from users1)
router.get('/getusers', (req, res) => {
  const sql = `SELECT userId, full_name, username, email, phone, role, status, created_at FROM users1 ORDER BY created_at DESC`;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to fetch users' });
    const formattedUsers = results.map(user => ({ id: user.userId, full_name: user.full_name, email: user.email, phone: user.phone, role: user.role, status: user.status, username: user.username, created_at: user.created_at }));
    res.json(formattedUsers);
  });
});

// Update user
router.put('/users/:id',  (req, res) => {
  const { id } = req.params;
  const { fullName, username, identifier, role } = req.body;
  let email = null, phone = null;
  if (identifier) {
    const cleanIdentifier = identifier.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanIdentifier);
    if (isEmail) email = cleanIdentifier.toLowerCase();
    else phone = cleanIdentifier.replace(/\D/g, '');
  }
  const sql = `UPDATE users1 SET full_name = ?, username = ?, email = ?, phone = ?, role = ? WHERE userId = ?`;
  db.query(sql, [fullName, username, email, phone, role, id], (err) => {
    if (err) return res.status(500).json({ message: 'Failed to update user' });
    res.json({ message: 'User updated successfully' });
  });
});

// Delete user (from users table)
router.delete('/users/:id',  (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE FROM users WHERE userId = ?';
  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Failed to delete user' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  });
});

// Deactivate user
router.put('/deactivate-user/:id', (req, res) => {
  const { id } = req.params;
  const sql = `UPDATE users1 SET status = 'inactive' WHERE userId = ?`;
  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Failed to deactivate user' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deactivated successfully' });
  });
});

// Activate user
router.put('/activate-user/:id', (req, res) => {
  const { id } = req.params;
  const sql = `UPDATE users1 SET status = 'active' WHERE userId = ?`;
  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Failed to activate user' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User activated successfully' });
  });
});

// Get user stats (count)
router.get("/api/users/stats", authenticateToken, authorizeRoles('admin'), (req, res) => {
  const sql = "SELECT COUNT(*) AS totalUsers FROM users";
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ message: "Error fetching stats" });
    res.json({ totalUsers: result[0].totalUsers });
  });
});

// Get all customers (customer_kyc table)
router.get("/api/customers/all", authenticateToken, authorizeRoles('admin', 'loan_officer'), (req, res) => {
  const sql = `SELECT id, kycCode, firstName, middleName, lastName, dateOfBirth, gender, mobileNumber, email, city, employmentStatus, monthlyIncome FROM customer_kyc ORDER BY createdAt DESC`;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: "Database query failed" });
    res.json(results);
  });
});

export default router;