// routes/officerWebLoanRoutes.js
import express from "express";
import { db } from '../config/db.js';

const router = express.Router();



// routes/clientDetailsRoutes.js (or add to existing)
router.get('/client/:clientId/references', async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      'SELECT * FROM client_kyc_step4 WHERE client_id = ?',
      [req.params.clientId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/client/:clientId/documents', async (req, res) => {
  const [rows] = await db.promise().query(
    'SELECT * FROM client_documents WHERE client_id = ?',
    [req.params.clientId]
  );
  res.json(rows);
});

router.get('/client/:clientId/guarantor-documents', async (req, res) => {
  const [rows] = await db.promise().query(
    'SELECT * FROM client_guarantor_documents WHERE client_id = ?',
    [req.params.clientId]
  );
  res.json(rows);
});

router.get('/client/:clientId/loan-history', async (req, res) => {
  const [rows] = await db.promise().query(
    'SELECT * FROM client_loan_history WHERE client_id = ?',
    [req.params.clientId]
  );
  res.json(rows);
});


router.get("/officer-web-loans", (req, res) => {
  db.promise()  // <-- Get Promise wrapper
    .query("SELECT * FROM  vw_client_full_kyc_loan")
    .then(([rows]) => {
      res.json(rows);
    })
    .catch((err) => {
      console.error("Error fetching officer web loans:", err);
      res.status(500).json({ error: "Internal server error" });
    });
});




export default router;