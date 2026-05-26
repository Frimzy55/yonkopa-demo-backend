import express from "express";
import { db } from "../config/db.js";

const router = express.Router();

// ======================================
// CREATE ACCOUNT (V2 - FIXED)
// ======================================
router.post("/api/accounts/create", async (req, res) => {
  try {
    const {
      customer_id,
      account_name,
      account_type,
      branch,
    } = req.body;

    // ===============================
    // BASIC VALIDATION (SAFE + CLEAN)
    // ===============================
    if (!customer_id) {
      return res.status(400).json({
        success: false,
        message: "Customer ID is required",
      });
    }

    if (!account_type) {
      return res.status(400).json({
        success: false,
        message: "Account type is required",
      });
    }

    // Normalize input (🔥 IMPORTANT FIX)
    const type = account_type.trim();

    // ===============================
    // CHECK CUSTOMER EXISTS
    // ===============================
    const [customerRows] = await db.promise().query(
      `
      SELECT *
      FROM loan_master7
      WHERE customer_id = ?
      LIMIT 1
      `,
      [customer_id]
    );

    if (customerRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // ===============================
    // CHECK DUPLICATE ACCOUNT TYPE
    // ===============================
    const [existingAccount] = await db.promise().query(
      `
      SELECT COUNT(*) AS count
      FROM customer_accounts_v2
      WHERE customer_id = ?
      AND account_type = ?
      `,
      [customer_id, type]
    );

    if (existingAccount[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `Customer already has a ${type} account`,
      });
    }

    // ===============================
    // ACCOUNT TYPE MAPPING (SAFE)
    // ===============================
    const ACCOUNT_PREFIX = {
      Loan: "100",
      Lien: "200",
      "Fixed Deposit": "300",
    };

    const accountCode = ACCOUNT_PREFIX[type];

    if (!accountCode) {
      return res.status(400).json({
        success: false,
        message: `Invalid account type: ${account_type}`,
      });
    }

    // ===============================
    // GENERATE ACCOUNT NUMBER
    // FORMAT: CODE + YY + MM + CUSTOMER_NUMBER
    // ===============================
    const now = new Date();

    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, "0");

    const customerNumber = customer_id.replace(/\D/g, "");

    const account_number = `${accountCode}${year}${month}${customerNumber}`;

    // ===============================
    // DEFAULT VALUES
    // ===============================
    const account_balance = 0.0;
    const available_balance = 0.0;
    const lien_amount = 0.0;
    const account_status = "Active";
    const account_currency = "GHS";
    const minimum_balance = 0.0;
    const maximum_balance = 999999999.99;

    const created_by = req.user?.email || "system";

    // ===============================
    // INSERT INTO DATABASE
    // ===============================
    await db.promise().query(
      `
      INSERT INTO customer_accounts_v2 (
        customer_id,
        date_created,
        last_modified,
        created_by,
        authorized_by,
        account_name,
        account_number,
        account_balance,
        available_balance,
        lien_amount,
        account_type,
        account_status,
        account_currency,
        branch,
        minimum_balance,
        maximum_balance
      )
      VALUES (
        ?, NOW(), NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
      `,
      [
        customer_id,
        created_by,
        null,
        account_name,
        account_number,
        account_balance,
        available_balance,
        lien_amount,
        type,
        account_status,
        account_currency,
        branch,
        minimum_balance,
        maximum_balance,
      ]
    );

    // ===============================
    // SUCCESS RESPONSE
    // ===============================
    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      account_number,
    });

  } catch (error) {
    console.error("Account Creation Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

export default router;