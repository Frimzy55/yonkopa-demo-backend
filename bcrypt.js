/*import bcrypt from "bcrypt";

const password = "";

const hashedPassword = await bcrypt.hash(password, 10);

console.log(hashedPassword);*/



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















// CREATE FUND TRANSFER
/*router.post("/api/fund-transfers", async (req, res) => {
  const {
    reference,
    transferDate,
    fromAccountCode,
    fromAccountName,
    toAccountCode,
    toAccountName,
    amount,
    currency,
    description,
    status,
    createdBy,
    tellerName,
    tellerId
  } = req.body;

  const numericAmount = parseFloat(amount);
  if (!reference || !transferDate || !numericAmount || numericAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Missing or invalid required fields (reference, transferDate, amount > 0)"
    });
  }

  // --- Map teller to account if provided and no fromAccountCode given ---
  let finalFromCode = fromAccountCode;
  let finalFromName = fromAccountName;
  let finalToCode = toAccountCode;
  let finalToName = toAccountName;

  // If from account is missing but teller is provided, use teller as from account
  if ((!finalFromCode || !finalFromName) && tellerId && tellerName) {
    finalFromCode = tellerId;
    finalFromName = tellerName;
  }

  // Default to Cash if still missing
  if (!finalFromCode) {
    finalFromCode = "CASH";
    finalFromName = "Cash Account";
  }
  if (!finalToCode) {
    finalToCode = "CASH";
    finalToName = "Cash Account";
  }

  // If both are CASH, it's a deposit/withdrawal to/from cash – allowed.

  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    // Ensure default Cash account exists in gl_accounts if used
    const defaultAccounts = [];
    if (finalFromCode === "CASH") {
      defaultAccounts.push({ code: "CASH", name: "Cash Account", normalBalance: "Debit" });
    }
    if (finalToCode === "CASH" && finalToCode !== finalFromCode) {
      defaultAccounts.push({ code: "CASH", name: "Cash Account", normalBalance: "Debit" });
    }
    for (const acc of defaultAccounts) {
      const [exists] = await connection.execute(
        `SELECT accountCode FROM gl_accounts WHERE accountCode = ?`,
        [acc.code]
      );
      if (exists.length === 0) {
        await connection.execute(
          `INSERT INTO gl_accounts (accountCode, accountName, normalBalance) VALUES (?, ?, ?)`,
          [acc.code, acc.name, acc.normalBalance]
        );
      }
    }

    // --- Also ensure teller account exists if it's being used ---
    if (finalFromCode === tellerId && finalFromName === tellerName) {
      // Check if teller already exists as account (maybe with normalBalance = Debit)
      const [exists] = await connection.execute(
        `SELECT accountCode FROM gl_accounts WHERE accountCode = ?`,
        [finalFromCode]
      );
      if (exists.length === 0) {
        // Add as an account (default Debit normal balance)
        await connection.execute(
          `INSERT INTO gl_accounts (accountCode, accountName, normalBalance) VALUES (?, ?, ?)`,
          [finalFromCode, finalFromName, "Debit"]
        );
      }
    }

    // Similar for to account if it's also a teller (unlikely but possible)
    if (finalToCode === tellerId && finalToName === tellerName && finalToCode !== finalFromCode) {
      const [exists] = await connection.execute(
        `SELECT accountCode FROM gl_accounts WHERE accountCode = ?`,
        [finalToCode]
      );
      if (exists.length === 0) {
        await connection.execute(
          `INSERT INTO gl_accounts (accountCode, accountName, normalBalance) VALUES (?, ?, ?)`,
          [finalToCode, finalToName, "Debit"]
        );
      }
    }

    // 2. Get normal balances of both accounts
    const [fromAccountRows] = await connection.execute(
      `SELECT normalBalance FROM gl_accounts WHERE accountCode = ?`,
      [finalFromCode]
    );
    const [toAccountRows] = await connection.execute(
      `SELECT normalBalance FROM gl_accounts WHERE accountCode = ?`,
      [finalToCode]
    );

    if (fromAccountRows.length === 0 || toAccountRows.length === 0) {
      throw new Error("Account not found after insertion attempt");
    }

    const fromNormalBalance = fromAccountRows[0].normalBalance;
    const toNormalBalance = toAccountRows[0].normalBalance;

    // 3. Get previous balances
    const [fromBalanceRows] = await connection.execute(
      `SELECT balance FROM to_and_from_transaction WHERE account_code = ? ORDER BY id DESC LIMIT 1`,
      [finalFromCode]
    );
    const [toBalanceRows] = await connection.execute(
      `SELECT balance FROM to_and_from_transaction WHERE account_code = ? ORDER BY id DESC LIMIT 1`,
      [finalToCode]
    );

    const fromLastBalance = fromBalanceRows.length > 0 ? Number(fromBalanceRows[0].balance) : 0;
    const toLastBalance = toBalanceRows.length > 0 ? Number(toBalanceRows[0].balance) : 0;

    // 4. Calculate new balances
    // From account: money leaves = credit entry
    let fromNewBalance;
    if (fromNormalBalance === "Debit") {
      fromNewBalance = fromLastBalance + numericAmount;
    } else {
      fromNewBalance = fromLastBalance + numericAmount;
    }

    // To account: money enters = debit entry
    let toNewBalance;
    if (toNormalBalance === "Debit") {
      toNewBalance = toLastBalance - numericAmount;
    } else {
      toNewBalance = toLastBalance - numericAmount;
    }

    // 5. Insert into fund_transfer (including teller details)
    const transferSql = `
      INSERT INTO fund_transfer
      (reference, transfer_date, from_account_code, from_account_name,
       to_account_code, to_account_name, amount, currency, description,
       status, created_by, teller_name, teller_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [transferResult] = await connection.execute(transferSql, [
      reference,
      transferDate,
      finalFromCode,
      finalFromName,
      finalToCode,
      finalToName,
      numericAmount,
      currency || "GHS",
      description || "",
      status || "Pending",
      createdBy,
      tellerName || null,
      tellerId || null
    ]);
    const transferId = transferResult.insertId;

    // 6. Insert ledger transactions
    const transactionSql = `
      INSERT INTO to_and_from_transaction
      (transfer_id, reference, transaction_date, account_name, account_code,
       narration, description, debit, credit, balance, currency, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // From account – credit entry
    await connection.execute(transactionSql, [
      transferId,
      reference,
      transferDate,
      finalFromName,
      finalFromCode,
      `Transfer to ${finalToName}`,
      description || '',
      0,
      numericAmount,
      fromNewBalance,
      currency || "GHS",
      createdBy
    ]);

    // To account – debit entry
    await connection.execute(transactionSql, [
      transferId,
      reference,
      transferDate,
      finalToName,
      finalToCode,
      `Transfer from ${finalFromName}`,
      description || '',
      numericAmount,
      0,
      toNewBalance,
      currency || "GHS",
      createdBy
    ]);

    await connection.commit();
    connection.release();

    res.status(201).json({
      success: true,
      message: "Fund transfer created successfully",
      transferId,
      fromAccountBalance: fromNewBalance,
      toAccountBalance: toNewBalance
    });

  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error("Fund Transfer Error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating fund transfer",
      error: error.message
    });
  }
});*/


router.post("/api/fund-transfers", async (req, res) => {
  const {
    reference,
    transferDate,
    fromAccountCode,
    fromAccountName,
    toAccountCode,
    toAccountName,
    amount,
    currency,
    description,
    status,
    createdBy,
    tellerName,
    tellerId
  } = req.body;

  const numericAmount = parseFloat(amount);
  if (!reference || !transferDate || !numericAmount || numericAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Missing or invalid required fields (reference, transferDate, amount > 0)"
    });
  }

  // Validate both accounts are present
  if (!fromAccountCode || !fromAccountName || !toAccountCode || !toAccountName) {
    return res.status(400).json({
      success: false,
      message: "Both From and To accounts are required."
    });
  }

  const finalFromCode = fromAccountCode;
  const finalFromName = fromAccountName;
  const finalToCode = toAccountCode;
  const finalToName = toAccountName;

  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    // Helper: get normal balance, default to "Debit" if account not found
    const getNormalBalance = async (accountCode) => {
      const [rows] = await connection.execute(
        `SELECT normalBalance FROM gl_accounts WHERE accountCode = ?`,
        [accountCode]
      );
      return rows.length > 0 ? rows[0].normalBalance : "Debit";
    };

    const fromNormalBalance = await getNormalBalance(finalFromCode);
    const toNormalBalance = await getNormalBalance(finalToCode);

    // Get previous balances
    const [fromBalanceRows] = await connection.execute(
      `SELECT balance FROM to_and_from_transaction WHERE account_code = ? ORDER BY id DESC LIMIT 1`,
      [finalFromCode]
    );
    const [toBalanceRows] = await connection.execute(
      `SELECT balance FROM to_and_from_transaction WHERE account_code = ? ORDER BY id DESC LIMIT 1`,
      [finalToCode]
    );

    const fromLastBalance = fromBalanceRows.length > 0 ? Number(fromBalanceRows[0].balance) : 0;
    const toLastBalance = toBalanceRows.length > 0 ? Number(toBalanceRows[0].balance) : 0;

    // Calculate new balances
    // From: credit entry
    let fromNewBalance;
    if (fromNormalBalance === "Debit") {
      fromNewBalance = fromLastBalance + numericAmount;  // debit-normal: credit decreases
    } else {
      fromNewBalance = fromLastBalance + numericAmount;  // credit-normal: credit increases
    }

    // To: debit entry
    let toNewBalance;
    if (toNormalBalance === "Debit") {
      toNewBalance = toLastBalance - numericAmount;     // debit-normal: debit increases
    } else {
      toNewBalance = toLastBalance - numericAmount;     // credit-normal: debit decreases
    }

    // Insert into fund_transfer
    const transferSql = `
      INSERT INTO fund_transfer
      (reference, transfer_date, from_account_code, from_account_name,
       to_account_code, to_account_name, amount, currency, description,
       status, created_by, teller_name, teller_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [transferResult] = await connection.execute(transferSql, [
      reference,
      transferDate,
      finalFromCode,
      finalFromName,
      finalToCode,
      finalToName,
      numericAmount,
      currency || "GHS",
      description || "",
      status || "Pending",
      createdBy,
      tellerName || null,
      tellerId || null
    ]);
    const transferId = transferResult.insertId;

    // Insert ledger transactions
    const transactionSql = `
      INSERT INTO to_and_from_transaction
      (transfer_id, reference, transaction_date, account_name, account_code,
       narration, description, debit, credit, balance, currency, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // From account – credit
    await connection.execute(transactionSql, [
      transferId,
      reference,
      transferDate,
      finalFromName,
      finalFromCode,
      `Transfer to ${finalToName}`,
      description || '',
      0,
      numericAmount,
      fromNewBalance,
      currency || "GHS",
      createdBy
    ]);

    // To account – debit
    await connection.execute(transactionSql, [
      transferId,
      reference,
      transferDate,
      finalToName,
      finalToCode,
      `Transfer from ${finalFromName}`,
      description || '',
      numericAmount,
      0,
      toNewBalance,
      currency || "GHS",
      createdBy
    ]);

    await connection.commit();
    connection.release();

    res.status(201).json({
      success: true,
      message: "Fund transfer created successfully",
      transferId,
      fromAccountBalance: fromNewBalance,
      toAccountBalance: toNewBalance
    });

  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error("Fund Transfer Error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating fund transfer",
      error: error.message
    });
  }
});







// GET INTERNAL ACCOUNT STATEMENT
// GET INTERNAL ACCOUNT STATEMENT
router.get("/api/internal-account-statement", async (req, res) => {
  const { accountCode, fromDate, toDate } = req.query;

  if (!accountCode || !fromDate || !toDate) {
    return res.status(400).json({
      success: false,
      message: "Account code and date range are required"
    });
  }

  const connection = await db.promise().getConnection();

  try {
    // Get account name & currency from latest transaction
    const [accountInfoRows] = await connection.execute(
      `SELECT account_name, currency FROM to_and_from_transaction
       WHERE account_code = ?
       ORDER BY transaction_date DESC, id DESC LIMIT 1`,
      [accountCode]
    );
    let accountName = accountCode;
    let currency = "GHS";
    if (accountInfoRows.length > 0) {
      accountName = accountInfoRows[0].account_name;
      currency = accountInfoRows[0].currency || "GHS";
    }

    // Get opening balance
    const [openingRows] = await connection.execute(
      `SELECT balance FROM to_and_from_transaction
       WHERE account_code = ? AND transaction_date < ?
       ORDER BY transaction_date DESC, id DESC LIMIT 1`,
      [accountCode, fromDate]
    );
    const openingBalance = openingRows.length > 0 ? parseFloat(openingRows[0].balance) : 0;

    // Get transactions – include created_at as transactionDateTime
    const [transactions] = await connection.execute(
      `SELECT
        id,
        reference,
        transaction_date AS transactionDate,
        created_at AS transactionDateTime,   -- ✅ includes time
        narration,
           description,   
        debit,
        credit,
        balance,
        currency
       FROM to_and_from_transaction
       WHERE account_code = ? AND transaction_date BETWEEN ? AND ?
       ORDER BY transaction_date ASC, id ASC`,
      [accountCode, fromDate, toDate]
    );

    const closingBalance = transactions.length > 0
      ? parseFloat(transactions[transactions.length - 1].balance)
      : openingBalance;

    connection.release();

    res.json({
      success: true,
      data: {
        accountName,
        currency,
        openingBalance,
        closingBalance,
        transactions: transactions.map(t => ({
          ...t,
          debit: parseFloat(t.debit) || 0,
          credit: parseFloat(t.credit) || 0,
          balance: parseFloat(t.balance) || 0,
        }))
      }
    });

  } catch (error) {
    connection.release();
    console.error("Statement Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate statement",
      error: error.message
    });
  }
});




// GET /api/teller-statement
/*router.get('/api/teller-statement', async (req, res) => {
  const { tellerId, fromDate, toDate } = req.query;

  if (!tellerId || !fromDate || !toDate) {
    return res.status(400).json({
      success: false,
      message: "Teller ID and date range are required"
    });
  }

  const connection = await db.promise().getConnection();

  try {
    // Get teller name from users1 (fallback to tellerId if not found)
    const [tellerRows] = await connection.execute(
      `SELECT full_name FROM users1 WHERE teller_id = ? OR userId = ?`,
      [tellerId, tellerId]
    );
    const tellerName = tellerRows.length > 0 ? tellerRows[0].full_name : tellerId;

    // Opening balance (transactions before fromDate)
    const [openingRows] = await connection.execute(
      `SELECT balance FROM deposit_to_and_from_transaction
       WHERE teller_id = ? AND transaction_date < ?
       ORDER BY transaction_date DESC, id DESC LIMIT 1`,
      [tellerId, fromDate]
    );
    const openingBalance = openingRows.length > 0 ? parseFloat(openingRows[0].balance) : 0;

    // Transactions within the date range
    const [transactions] = await connection.execute(
      `SELECT
        id,
        reference,
        transaction_date AS transactionDate,
        created_at AS transactionDateTime,
        account_name,
        account_number,
        narration,
        description,
        debit,
        credit,
        balance,
        currency
       FROM deposit_to_and_from_transaction
       WHERE teller_id = ? AND transaction_date BETWEEN ? AND ?
       ORDER BY transaction_date ASC, id ASC`,
      [tellerId, fromDate, toDate]
    );

    const closingBalance = transactions.length > 0
      ? parseFloat(transactions[transactions.length - 1].balance)
      : openingBalance;

    connection.release();

    res.json({
      success: true,
      data: {
        tellerId,
        tellerName,
        currency: transactions.length > 0 ? transactions[0].currency : 'GHS',
        openingBalance,
        closingBalance,
        transactions: transactions.map(t => ({
          ...t,
          debit: parseFloat(t.debit) || 0,
          credit: parseFloat(t.credit) || 0,
          balance: parseFloat(t.balance) || 0,
        }))
      }
    });

  } catch (error) {
    connection.release();
    console.error("Teller Statement Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate teller statement",
      error: error.message
    });
  }
});
*/







// GET /api/teller-statement
router.get('/api/teller-statement', async (req, res) => {
  const { accountName, fromDate, toDate } = req.query; // changed from tellerId to accountName

  if (!accountName || !fromDate || !toDate) {
    return res.status(400).json({
      success: false,
      message: "Account name and date range are required"
    });
  }

  const connection = await db.promise().getConnection();

  try {
    // Get account name from the parameter (just use it as is)
    const accountNameUsed = accountName;

    // Opening balance (transactions before fromDate) for this account
    const [openingRows] = await connection.execute(
      `SELECT balance FROM deposit_to_and_from_transaction
       WHERE account_name = ? AND transaction_date < ?
       ORDER BY transaction_date DESC, id DESC LIMIT 1`,
      [accountNameUsed, fromDate]
    );
    const openingBalance = openingRows.length > 0 ? parseFloat(openingRows[0].balance) : 0;

    // Transactions within the date range for this account
    const [transactions] = await connection.execute(
      `SELECT
        id,
        reference,
        transaction_date AS transactionDate,
        created_at AS transactionDateTime,
        account_name,
        account_number,
        narration,
        description,
        debit,
        credit,
        balance,
        currency
       FROM deposit_to_and_from_transaction
       WHERE account_name = ? AND transaction_date BETWEEN ? AND ?
       ORDER BY transaction_date ASC, id ASC`,
      [accountNameUsed, fromDate, toDate]
    );

    const closingBalance = transactions.length > 0
      ? parseFloat(transactions[transactions.length - 1].balance)
      : openingBalance;

    connection.release();

    res.json({
      success: true,
      data: {
        accountName: accountNameUsed,
        currency: transactions.length > 0 ? transactions[0].currency : 'GHS',
        openingBalance,
        closingBalance,
        transactions: transactions.map(t => ({
          ...t,
          debit: parseFloat(t.debit) || 0,
          credit: parseFloat(t.credit) || 0,
          balance: parseFloat(t.balance) || 0,
        }))
      }
    });

  } catch (error) {
    connection.release();
    console.error("Account Statement Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate account statement",
      error: error.message
    });
  }
});











router.get('/api/teller-callover', async (req, res) => {
  const { accountName, fromDate, toDate, type } = req.query; // added 'type'

  if (!accountName || !fromDate || !toDate) {
    return res.status(400).json({
      success: false,
      message: "Account name and date range are required"
    });
  }

  const connection = await db.promise().getConnection();

  try {
    const accountNameUsed = accountName;

    // Opening balance (unchanged)
    const [openingRows] = await connection.execute(
      `SELECT balance FROM deposit_to_and_from_transaction
       WHERE account_name = ? AND transaction_date < ?
       ORDER BY transaction_date DESC, id DESC LIMIT 1`,
      [accountNameUsed, fromDate]
    );
    const openingBalance = openingRows.length > 0 ? parseFloat(openingRows[0].balance) : 0;

    // Build WHERE clause with optional type filter
    let typeCondition = '';
    if (type === 'deposit') {
      typeCondition = 'AND credit > 0 AND debit = 0';
    } else if (type === 'withdrawal') {
      typeCondition = 'AND debit > 0 AND credit = 0';
    }
    // If type not provided, return all transactions (no extra condition)

    const [transactions] = await connection.execute(
      `SELECT
        id,
        reference,
        transaction_date AS transactionDate,
        created_at AS transactionDateTime,
        account_name,
        account_number,
        narration,
        description,
        debit,
        credit,
        balance,
        currency
       FROM deposit_to_and_from_transaction
       WHERE account_name = ? AND transaction_date BETWEEN ? AND ?
       ${typeCondition}
       ORDER BY transaction_date ASC, id ASC`,
      [accountNameUsed, fromDate, toDate]
    );

    const closingBalance = transactions.length > 0
      ? parseFloat(transactions[transactions.length - 1].balance)
      : openingBalance;

    connection.release();

    res.json({
      success: true,
      data: {
        accountName: accountNameUsed,
        currency: transactions.length > 0 ? transactions[0].currency : 'GHS',
        openingBalance,
        closingBalance,
        transactions: transactions.map(t => ({
          ...t,
          debit: parseFloat(t.debit) || 0,
          credit: parseFloat(t.credit) || 0,
          balance: parseFloat(t.balance) || 0,
        }))
      }
    });

  } catch (error) {
    connection.release();
    console.error("Account Statement Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate account statement",
      error: error.message
    });
  }
});

export default router;