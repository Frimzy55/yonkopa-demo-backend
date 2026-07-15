import express from "express";
import { db } from "../config/db.js";

const router = express.Router();

// Mapping: accountType -> starting number for the code
const TYPE_START_NUMBER = {
  Asset: 1001,
  Liability: 2001,
  Equity: 3001,
  Revenue: 4001,
  Expense: 5001
};

// Helper to generate the next account code for a given type
const generateAccountCode = (accountType, callback) => {
  // Check if the type is valid
  if (!TYPE_START_NUMBER[accountType]) {
    return callback(new Error("Invalid account type"), null);
  }

  // Query the maximum numeric part of the code for this type
  const sql = `
    SELECT MAX(CAST(SUBSTRING(accountCode, 4) AS UNSIGNED)) as maxNum
    FROM gl_accounts
    WHERE accountType = ?
  `;
  db.execute(sql, [accountType], (err, rows) => {
    if (err) return callback(err, null);

    let nextNumber;
    const maxNum = rows[0]?.maxNum;
    if (maxNum === null) {
      // No existing code for this type → start with the base number
      nextNumber = TYPE_START_NUMBER[accountType];
    } else {
      // Increment the highest existing number
      nextNumber = maxNum + 1;
    }
    const accountCode = `GHS${nextNumber}`;
    callback(null, accountCode);
  });
};

// CREATE GL ACCOUNT (auto‑generate accountCode)
router.post("/api/gl-accounts", (req, res) => {
  const {
    accountName,
    accountType,
    category,
    normalBalance,
    description,
    status,
    parentAccount,
    isSubAccount
  } = req.body;

  // Validate accountType
  if (!TYPE_START_NUMBER[accountType]) {
    return res.status(400).json({
      success: false,
      message: "Invalid account type"
    });
  }

  // Generate the account code
  generateAccountCode(accountType, (err, accountCode) => {
    if (err) {
      console.error("Code generation error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to generate account code"
      });
    }

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
        category || null,
        normalBalance,
        description || null,
        status || 'Active',
        parentAccount || null,
        isSubAccount ? 1 : 0
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
          message: "GL Account created successfully",
          accountCode   // optionally return the generated code
        });
      }
    );
  });
});

// GET ALL GL ACCOUNTS (unchanged)
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

// UPDATE GL ACCOUNT (do NOT allow changing accountCode)
router.put("/api/gl-accounts/:id", (req, res) => {
  const { id } = req.params;

  const {
    accountName,
    accountType,
    category,
    normalBalance,
    description,
    status,
    parentAccount,
    isSubAccount
  } = req.body;

  // account Code is NOT updated – it stays as originally generated

  const sql = `
    UPDATE gl_accounts
    SET
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
      accountName,
      accountType,
      category || null,
      normalBalance,
      description || null,
      status || 'Active',
      parentAccount || null,
      isSubAccount ? 1 : 0,
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