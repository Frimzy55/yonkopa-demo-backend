import express from "express";
import { db } from "../config/db.js";

const router = express.Router();

// ======================================
// CREATE ACCOUNT
// ======================================
router.post(
  "/api/accounts/create",
  
  async (req, res) => {
    try {
      const {
        customer_id,
        account_name,
        account_type,
        branch,
      } = req.body;

      // ===============================
      // VALIDATION
      // ===============================
      if (!customer_id) {
        return res.status(400).json({
          success: false,
          message: "Customer ID is required",
        });
      }

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
        SELECT *
        FROM customer_accounts
        WHERE customer_id = ?
        AND account_type = ?
        `,
        [customer_id, account_type]
      );

      if (existingAccount.length > 0) {
        return res.status(400).json({
          success: false,
          message:
            "Customer already has this account type",
        });
      }

      // ===============================
      // GENERATE ACCOUNT NUMBER
      // ===============================
// GENERATE ACCOUNT NUMBER
// FORMAT:
// 100 + YY + MM + CUSTOMER_NUMBER
// Example:
// 100260500001
// ===============================

// CURRENT DATE
const now = new Date();

// LAST 2 DIGITS OF YEAR
const year = now.getFullYear().toString().slice(-2);

// CURRENT MONTH (2 DIGITS)
const month = String(now.getMonth() + 1).padStart(2, "0");

// REMOVE NON-NUMBERS FROM CUSTOMER ID
const customerNumber = customer_id.replace(/\D/g, "");

// ACCOUNT PREFIX
const accountCode = "100";

// FINAL ACCOUNT NUMBER
const account_number =
  accountCode +
  year +
  month +
  customerNumber;

      // ===============================
      // DEFAULT VALUES
      // ===============================
      const account_balance = 0.00;
      const available_balance = 0.00;
      const account_status = "Active";
      const account_currency = "GHS";
      const lien_amount = 0.00;
      const minimum_balance = 0.00;
      const maximum_balance = 999999999.99;

      // USER FROM TOKEN
      const created_by = req.user?.email || "system";

      // ===============================
      // INSERT ACCOUNT
      // ===============================
      await db.promise().query(
        `
        INSERT INTO customer_accounts (
          customer_id,
          created_by,
          account_name,
          account_number,
          account_balance,
          available_balance,
          account_type,
          account_status,
          account_currency,
          authorized_by,
          lien_amount,
          branch,
          minimum_balance,
          maximum_balance
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          customer_id,
          created_by,
          account_name,
          account_number,
          account_balance,
          available_balance,
          account_type,
          account_status,
          account_currency,
          null,
          lien_amount,
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
      console.error(
        "Account Creation Error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

export default router;