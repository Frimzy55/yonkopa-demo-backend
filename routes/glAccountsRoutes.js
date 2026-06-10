import express from "express";
import { db } from "../config/db.js";

const router = express.Router();

// CREATE GL ACCOUNT
router.post("/api/gl-accounts", (req, res) => {
  const {
    accountCode,
    accountName,
    accountType,
    category,
    normalBalance,
    description,
    status,
    parentAccount,
    isSubAccount
  } = req.body;

  const sql = `
    INSERT INTO gl_accounts (
      accountCode,
      accountName,
      accountType,
      category,
      normalBalance,
      description,
      status,
      parentAccount,
      isSubAccount
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.execute(
    sql,
    [
      accountCode,
      accountName,
      accountType,
      category,
      normalBalance,
      description,
      status,
      parentAccount,
      isSubAccount
    ],
    (err, result) => {
      if (err) {
        console.error("GL Account Create Error:", err);
        return res.status(500).json({
          success: false,
          message: "Error creating GL Account"
        });
      }

      res.status(201).json({
        success: true,
        message: "GL Account created successfully"
      });
    }
  );
});

// GET ALL GL ACCOUNTS
router.get("/api/gl-accounts", (req, res) => {
  const sql = `
    SELECT *
    FROM gl_accounts
    ORDER BY accountCode
  `;

  db.execute(sql, (err, rows) => {
    if (err) {
      console.error("GL Account Fetch Error:", err);
      return res.status(500).json({
        success: false,
        message: "Error fetching GL Accounts"
      });
    }

    res.json(rows);
  });
});

// UPDATE GL ACCOUNT
router.put("/api/gl-accounts/:id", (req, res) => {
  const { id } = req.params;

  const {
    accountCode,
    accountName,
    accountType,
    category,
    normalBalance,
    description,
    status,
    parentAccount,
    isSubAccount
  } = req.body;

  const sql = `
    UPDATE gl_accounts
    SET
      accountCode = ?,
      accountName = ?,
      accountType = ?,
      category = ?,
      normalBalance = ?,
      description = ?,
      status = ?,
      parentAccount = ?,
      isSubAccount = ?
    WHERE id = ?
  `;

  db.execute(
    sql,
    [
      accountCode,
      accountName,
      accountType,
      category,
      normalBalance,
      description,
      status,
      parentAccount,
      isSubAccount,
      id
    ],
    (err, result) => {
      if (err) {
        console.error("GL Account Update Error:", err);
        return res.status(500).json({
          success: false,
          message: "Error updating GL Account"
        });
      }

      res.json({
        success: true,
        message: "GL Account updated successfully"
      });
    }
  );
});

export default router;