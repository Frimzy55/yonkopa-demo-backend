import express from 'express';
import { db } from '../config/db.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Admin dashboard protected route
router.get('/admin/dashboard', authenticateToken, authorizeRoles('admin'), (req, res) => {
  res.json({ message: 'Welcome Admin, this is your dashboard.' });
});

// Loan management route (accessible by loan_officer, supervisor, manager, admin)
router.get('/loan/management', authenticateToken, authorizeRoles('loan_officer', 'supervisor', 'manager', 'admin'), (req, res) => {
  res.json({ message: 'Loan management area accessed successfully.' });
});

// Get all loan applications
router.get("/api/admin/loan-progress", (req, res) => {
  const sql = `SELECT * FROM loan_applications ORDER BY createdAt DESC`;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: "Database error" });
    res.json(results);
  });
});

// Full loan KYC view (admin)
router.get("/api/admin/full-loan-kyc",  (req, res) => {
  const sql = "SELECT * FROM full_loan_kyc_view2 ORDER BY applicant_created_at DESC";
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false, error: err });
    res.json(results);
  });
});

// Get single loan details by userId
router.get("/api/admin/loan/:userId", (req, res) => {
  const userId = req.params.userId;
  const sql = "SELECT * FROM full_loan_kyc_view2 WHERE userId = ?";
  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: "Server error" });
    if (results.length === 0) return res.status(404).json({ error: "Loan not found" });
    res.json(results[0]);
  });
});

// Get approved loans list
router.get("/api/admin/approved-loans",  (req, res) => {
  db.query(`SELECT * FROM full_loan_kyc_view2 WHERE loan_status = 'approved' ORDER BY applicant_created_at DESC`, (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

// Loan master view (evaluated loans)
router.get("/api/admin/loan-full-view-evaluation", (req, res) => {
  const query = `SELECT * FROM loan_master4 WHERE loan_eval_id IS NOT NULL AND loan_eval_id != ''`;
  db.query(query, (err, rows) => {
    if (err) return res.status(500).json({ message: "Database error", error: err.message });
    res.json(rows);
  });
});

// Get loan by loan_id from master view
router.get("/api/admin/loan1/:loan_id",  (req, res) => {
  const { loan_id } = req.params;
  db.query("SELECT * FROM loan_master1 WHERE loan_id = ?", [loan_id], (err, rows) => {
    if (err) return res.status(500).json({ message: "Database error", error: err.message });
    if (rows.length === 0) return res.status(404).json({ message: "Loan not found" });
    res.json(rows[0]);
  });
});

// Approved loans summary (for admin)
router.get("/api/admin/approved-loan",  (req, res) => {
  const query = `SELECT applicant_fullName, mobileNumber, applicant_phone, kyc_loan_amount, approved_date FROM loan_master4 WHERE loan_status = 'approved' ORDER BY approved_date DESC`;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "Database error" });
    res.status(200).json(results);
  });
});

export default router;