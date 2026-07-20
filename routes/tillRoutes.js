// routes/tillRoutes.js
import express from 'express';
import { db } from '../config/db.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();


// POST /api/tills/create
router.post(
  '/',
  [
    body('branch').notEmpty().withMessage('Branch is required'),
    body('currency').notEmpty().withMessage('Currency is required'),
    body('tillType').notEmpty().withMessage('Till type is required'),
    body('assignedTeller').notEmpty().withMessage('Assigned teller is required'),
    body('supervisor').notEmpty().withMessage('Supervisor is required'),
    body('effectiveDate').isISO8601().withMessage('Valid date required'),
    body('cashLimitPerTransaction').optional().isNumeric(),
    body('dailyCashLimit').optional().isNumeric(),
    body('overLimitAction').optional().isIn(['block', 'approval', 'alert']),
  ],

  (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        errors: errors.array()
      });
    }

    const {
      branch,
      currency,
      tillType,
      cashLimitPerTransaction = 0,
      dailyCashLimit = 0,
      overLimitAction = 'block',
      assignedTeller,
      supervisor,
      effectiveDate
    } = req.body;

    db.getConnection((err, connection) => {
      if (err) {
        console.error(err);
        return res.status(500).json({
          error: 'Database connection failed'
        });
      }

      // Generate next Till number
      connection.query(
        `SELECT till_number 
         FROM tills 
         ORDER BY id DESC 
         LIMIT 1`,
        (err, rows) => {
          if (err) {
            connection.release();
            return res.status(500).json({
              error: 'Failed to generate till number'
            });
          }

          let nextNumber = 10001;
          if (rows.length > 0) {
            const match = rows[0].till_number.match(/Till-(\d+)/);
            if (match) {
              const num = parseInt(match[1], 10);
              if (!isNaN(num)) {
                nextNumber = num + 1;
              }
            }
          }

          const tillNumber = `Till-${nextNumber}`;

          const insertSql = `
            INSERT INTO tills (
              till_number,
              branch,
              currency,
              till_type,
              cash_limit_per_transaction,
              daily_cash_limit,
              over_limit_action,
              assigned_teller,
              supervisor,
              effective_date,
              status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          connection.query(
            insertSql,
            [
              tillNumber,
              branch,
              currency,
              tillType,
              cashLimitPerTransaction,
              dailyCashLimit,
              overLimitAction,
              assignedTeller,
              supervisor,
              effectiveDate,
              'active'
            ],
            (err, result) => {
              if (err) {
                connection.release();
                if (err.code === 'ER_DUP_ENTRY') {
                  return res.status(409).json({
                    error: 'Till number already exists'
                  });
                }
                return res.status(500).json({
                  error: 'Failed to create till'
                });
              }

              // Get created till
              connection.query(
                `SELECT * FROM tills WHERE id = ?`,
                [result.insertId],
                (err, newTill) => {
                  connection.release();
                  if (err) {
                    return res.status(500).json({
                      error: 'Failed to fetch created till'
                    });
                  }

                  res.status(201).json({
                    message: 'Till created successfully',
                    till: newTill[0]
                  });
                }
              );
            }
          );
        }
      );
    });
  }
);



router.get("/tellers", (req, res) => {

  db.getConnection((err, connection) => {

    if (err) {
      console.error("Database connection error:", err);
      return res.status(500).json({
        error: "Database connection failed"
      });
    }

    const sql = `
      SELECT 
        userId,
        full_name,
        username,
        role,
        teller_id,
        status
      FROM users1
      WHERE LOWER(role) = 'teller'
      AND LOWER(status) = 'active'
      ORDER BY full_name ASC
    `;

    connection.query(sql, (err, rows) => {

      connection.release();

      if (err) {
        console.error("Teller fetch error:", err);
        return res.status(500).json({
          error: "Failed to fetch tellers"
        });
      }

      console.log("Active tellers:", rows);

      res.json(rows);

    });

  });

});





// ------------------------------
router.get('/', (req, res) => {
  db.getConnection((err, connection) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database connection failed' });
    }

    connection.query(
      `SELECT * FROM tills ORDER BY id DESC`,
      (err, rows) => {
        connection.release();
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Failed to fetch tills' });
        }
        res.json(rows);
      }
    );
  });
});












router.get('/loan-account', (req, res) => {
  const { customerId } = req.query;

  if (!customerId) {
    return res.status(400).json({ error: 'customerId query parameter is required' });
  }

  db.getConnection((err, connection) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database connection failed' });
    }

    const sql = `
      SELECT
        customer_id,
        account_number,
        applicant_fullName,
        account_name,
        account_type,
        account_balance,
        account_currency,
        account_status,
        avatar                    -- added avatar column
      FROM loan_master_account
      WHERE customer_id = ?
      LIMIT 1
    `;

    connection.query(sql, [customerId], (err, rows) => {
      connection.release();
      if (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
      }

      if (rows.length === 0) {
        return res.status(404).json({ error: 'No loan account found for this customer' });
      }

      // The response now includes avatar
      res.json(rows[0]);
    });
  });
});






/*router.post('/deposits', async (req, res) => {
  const {
    customerId,
    accountNumber,
    accountName,
    depositType,
    amount,
    currency,
    depositedBy,
    tellerId,
    transactionReference,
    description,
    cashAccountNumber,
    cashAccountName
  } = req.body;

  // ---- Manual validation ----
  const numericAmount = parseFloat(amount);
  const errors = [];

  if (!customerId) errors.push('customerId is required');
  if (!accountNumber) errors.push('accountNumber is required');
  if (!numericAmount || numericAmount <= 0) errors.push('amount must be a positive number');
  if (!tellerId) errors.push('tellerId is required');
  if (!transactionReference) errors.push('transactionReference is required');
  if (depositType && !['cash', 'cheque', 'transfer'].includes(depositType)) {
    errors.push('depositType must be one of: cash, cheque, transfer');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      details: errors
    });
  }

  // Defaults
  const finalCurrency = currency || 'GHS';
  const finalDescription = description || '';
  const finalDepositedBy = depositedBy || tellerId;
  const cashAccNum = cashAccountNumber || 'CASH001';
  const cashAccName = cashAccountName || 'Teller';

  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    // 1. Get cash account normal balance from GL accounts
    const [cashAccountRows] = await connection.execute(
      `
      SELECT normalBalance 
      FROM gl_accounts 
      WHERE accountCode = ?
      `,
      [cashAccNum]
    );

    const cashNormalBalance = cashAccountRows.length > 0
      ? cashAccountRows[0].normalBalance
      : 'Credit';

    // 2. Lock and verify the customer account – NOWAIT (fails immediately if locked)
    const [accountRows] = await connection.execute(
      `
      SELECT account_number, account_name, account_balance
      FROM customer_accounts_v2
      WHERE account_number = ? AND customer_id = ?
      FOR UPDATE NOWAIT
      `,
      [accountNumber, customerId]
    );

    if (accountRows.length === 0) {
      throw new Error('ACCOUNT_NOT_FOUND');
    }

    // 3. Get previous ledger balances
    const [cashBalanceRows] = await connection.execute(
      `
      SELECT balance
      FROM deposit_to_and_from_transaction
      WHERE account_number = ?
      ORDER BY id DESC
      LIMIT 1
      `,
      [cashAccNum]
    );

    const [customerBalanceRows] = await connection.execute(
      `
      SELECT balance
      FROM deposit_to_and_from_transaction
      WHERE account_number = ?
      ORDER BY id DESC
      LIMIT 1
      `,
      [accountNumber]
    );

    const cashPreviousBalance = cashBalanceRows.length > 0
      ? Number(cashBalanceRows[0].balance)
      : 0;

    const customerPreviousBalance = customerBalanceRows.length > 0
      ? Number(customerBalanceRows[0].balance)
      : 0;

    // 4. Compute new balances
    let cashNewBalance;
    let customerNewBalance;

    customerNewBalance = customerPreviousBalance + numericAmount;

    if (cashNormalBalance === 'Credit') {
      cashNewBalance = cashPreviousBalance - numericAmount;
    } else {
      cashNewBalance = cashPreviousBalance + numericAmount;
    }

    // Update customer_accounts_v2 balance
    await connection.execute(
      `
      UPDATE customer_accounts_v2
      SET account_balance = ?,
          available_balance = ?,
          last_modified = NOW()
      WHERE account_number = ?
      `,
      [customerNewBalance, customerNewBalance, accountNumber]
    );

    // 5. Insert deposit master record
    const [depositResult] = await connection.execute(
      `
      INSERT INTO deposits
        (customer_id, account_number, account_name, deposit_type, amount, currency,
         deposited_by, teller_id, transaction_reference, description, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        customerId,
        accountNumber,
        accountName || accountRows[0].account_name,
        depositType || 'cash',
        numericAmount,
        finalCurrency,
        finalDepositedBy,
        tellerId,
        transactionReference,
        finalDescription,
        'completed'
      ]
    );
    const depositId = depositResult.insertId;

    // 6. Insert ledger entries – Customer first, then Teller
    const ledgerSql = `
      INSERT INTO deposit_to_and_from_transaction
        (deposit_id, customer_id, teller_id, reference, transaction_date,
         account_name, account_number, narration, description,
         debit, credit, balance, currency, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const now = new Date();

    // Entry 1: Customer account CREDIT (first)
    await connection.execute(ledgerSql, [
      depositId,
      customerId,
      tellerId,
      transactionReference,
      now,
      accountName || accountRows[0].account_name,
      accountNumber,
      'Deposit to Account',
      finalDescription,
      0,
      numericAmount,
      customerNewBalance,
      finalCurrency,
      finalDepositedBy
    ]);

    // Entry 2: Teller account DEBIT (second)
    await connection.execute(ledgerSql, [
      depositId,
      customerId,
      tellerId,
      transactionReference,
      now,
      cashAccName,
      cashAccNum,
      'Cash Deposit Received',
      finalDescription,
      numericAmount,
      0,
      cashNewBalance,
      finalCurrency,
      finalDepositedBy
    ]);

    await connection.commit();
    connection.release();

    return res.status(201).json({
      success: true,
      message: 'Deposit completed successfully',
      depositId,
      reference: transactionReference,
      customerId,
      tellerId,
      accountNumber,
      accountBalance: customerNewBalance
    });

  } catch (err) {
    if (connection) {
      try { await connection.rollback(); } catch (rollbackErr) 
      connection.release();
    }

    // Simplified error handling – no retries
    let statusCode = 500;
    let userMessage = 'Error processing deposit';

    switch (err.message) {
      case 'ACCOUNT_NOT_FOUND':
        statusCode = 404;
        userMessage = 'Customer account not found or does not belong to the specified customer';
        break;
      default:
        // Duplicate transaction reference
        if (err.code === 'ER_DUP_ENTRY' && err.sqlMessage?.includes('transaction_reference')) {
          statusCode = 409;
          userMessage = 'Duplicate transaction reference – deposit may have already been processed';
        } else {
          // For lock errors (NOWAIT) or any other, we return a generic error.
          // You can check err.code === 'ER_LOCK_NOWAIT' to give a specific message if desired.
          console.error('Deposit Error:', err);
        }
    }

    return res.status(statusCode).json({
      success: false,
      message: userMessage
    });
  }
});*/

router.post('/deposits', async (req, res) => {
  const {
    customerId,
    accountNumber,
    accountName,
    depositType,
    amount,
    currency,
    depositedBy,
    tellerId,
    transactionReference,
    description,
    cashAccountNumber,
    cashAccountName
  } = req.body;

  // ---- Manual validation ----
  const numericAmount = parseFloat(amount);
  const errors = [];

  if (!customerId) errors.push('customerId is required');
  if (!accountNumber) errors.push('accountNumber is required');
  if (!numericAmount || numericAmount <= 0) errors.push('amount must be a positive number');
  if (!tellerId) errors.push('tellerId is required');
  if (!transactionReference) errors.push('transactionReference is required');
  if (depositType && !['cash', 'cheque', 'transfer'].includes(depositType)) {
    errors.push('depositType must be one of: cash, cheque, transfer');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      details: errors
    });
  }

  // Defaults
  const finalCurrency = currency || 'GHS';
  const finalDescription = description || '';
  const finalDepositedBy = depositedBy || tellerId; // Keep frontend-provided depositor name
  const cashAccNum = cashAccountNumber || 'CASH001';
  // We will override cashAccountName with the teller's full name if found
  // let cashAccountNameFromTeller = cashAccountName || 'Teller';

  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    // 0. Fetch teller's full name from users1 table using teller_id
    let tellerFullName = null;
    const [tellerRows] = await connection.execute(
      `SELECT full_name FROM users1 WHERE teller_id = ? AND role = 'teller' AND status = 'active'`,
      [tellerId]
    );
    if (tellerRows.length > 0) {
      tellerFullName = tellerRows[0].full_name;
    } else {
      // Fallback: maybe the tellerId is actually a userId? Try that.
      const [userRows] = await connection.execute(
        `SELECT full_name FROM users1 WHERE userId = ? AND role = 'teller' AND status = 'active'`,
        [tellerId]
      );
      if (userRows.length > 0) {
        tellerFullName = userRows[0].full_name;
      }
    }

    // Use the teller's full name for the teller account name, otherwise fallback to provided or default
    const tellerAccountName = tellerFullName || cashAccountName || 'Teller';

    // 1. Get cash account normal balance from GL accounts
    const [cashAccountRows] = await connection.execute(
      `
      SELECT normalBalance 
      FROM gl_accounts 
      WHERE accountCode = ?
      `,
      [cashAccNum]
    );

    const cashNormalBalance = cashAccountRows.length > 0
      ? cashAccountRows[0].normalBalance
      : 'Credit';

    // 2. Lock and verify the customer account – NOWAIT (fails immediately if locked)
    const [accountRows] = await connection.execute(
      `
      SELECT account_number, account_name, account_balance
      FROM customer_accounts_v2
      WHERE account_number = ? AND customer_id = ?
      FOR UPDATE NOWAIT
      `,
      [accountNumber, customerId]
    );

    if (accountRows.length === 0) {
      throw new Error('ACCOUNT_NOT_FOUND');
    }

    // 3. Get previous ledger balances
    const [cashBalanceRows] = await connection.execute(
      `
      SELECT balance
      FROM deposit_to_and_from_transaction
      WHERE account_number = ?
      ORDER BY id DESC
      LIMIT 1
      `,
      [cashAccNum]
    );

    const [customerBalanceRows] = await connection.execute(
      `
      SELECT balance
      FROM deposit_to_and_from_transaction
      WHERE account_number = ?
      ORDER BY id DESC
      LIMIT 1
      `,
      [accountNumber]
    );

    const cashPreviousBalance = cashBalanceRows.length > 0
      ? Number(cashBalanceRows[0].balance)
      : 0;

    const customerPreviousBalance = customerBalanceRows.length > 0
      ? Number(customerBalanceRows[0].balance)
      : 0;

    // 4. Compute new balances
    let cashNewBalance;
    let customerNewBalance;

    customerNewBalance = customerPreviousBalance + numericAmount;

    if (cashNormalBalance === 'Credit') {
      cashNewBalance = cashPreviousBalance - numericAmount;
    } else {
      cashNewBalance = cashPreviousBalance + numericAmount;
    }

    // Update customer_accounts_v2 balance
    await connection.execute(
      `
      UPDATE customer_accounts_v2
      SET account_balance = ?,
          available_balance = ?,
          last_modified = NOW()
      WHERE account_number = ?
      `,
      [customerNewBalance, customerNewBalance, accountNumber]
    );

    // 5. Insert deposit master record
    const [depositResult] = await connection.execute(
      `
      INSERT INTO deposits
        (customer_id, account_number, account_name, deposit_type, amount, currency,
         deposited_by, teller_id, transaction_reference, description, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        customerId,
        accountNumber,
        accountName || accountRows[0].account_name,
        depositType || 'cash',
        numericAmount,
        finalCurrency,
        finalDepositedBy,  // This remains as the depositor's name (from frontend)
        tellerId,
        transactionReference,
        finalDescription,
        'completed'
      ]
    );
    const depositId = depositResult.insertId;

    // 6. Insert ledger entries – Customer first, then Teller
    const ledgerSql = `
      INSERT INTO deposit_to_and_from_transaction
        (deposit_id, customer_id, teller_id, reference, transaction_date,
         account_name, account_number, narration, description,
         debit, credit, balance, currency, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const now = new Date();

    // Entry 1: Customer account CREDIT (first)
    await connection.execute(ledgerSql, [
      depositId,
      customerId,
      tellerId,
      transactionReference,
      now,
      accountName || accountRows[0].account_name,
      accountNumber,
      'Deposit to Account',
      finalDescription,
      0,
      numericAmount,
      customerNewBalance,
      finalCurrency,
      finalDepositedBy
    ]);

    // Entry 2: Teller account DEBIT (second) – using teller's full name as account_name
    await connection.execute(ledgerSql, [
      depositId,
      customerId,
      tellerId,
      transactionReference,
      now,
      tellerAccountName,   // ← Now the teller's full name (from users1)
      cashAccNum,
      'Cash Deposit Received',
      finalDescription,
      numericAmount,
      0,
      cashNewBalance,
      finalCurrency,
      finalDepositedBy
    ]);

    await connection.commit();
    connection.release();

    return res.status(201).json({
      success: true,
      message: 'Deposit completed successfully',
      depositId,
      reference: transactionReference,
      customerId,
      tellerId,
      accountNumber,
      accountBalance: customerNewBalance
    });

  } catch (err) {
    if (connection) {
      try { await connection.rollback(); } catch (rollbackErr) { /* ignore */ }
      connection.release();
    }

    let statusCode = 500;
    let userMessage = 'Error processing deposit';

    switch (err.message) {
      case 'ACCOUNT_NOT_FOUND':
        statusCode = 404;
        userMessage = 'Customer account not found or does not belong to the specified customer';
        break;
      default:
        if (err.code === 'ER_DUP_ENTRY' && err.sqlMessage?.includes('transaction_reference')) {
          statusCode = 409;
          userMessage = 'Duplicate transaction reference – deposit may have already been processed';
        } else {
          console.error('Deposit Error:', err);
        }
    }

    return res.status(statusCode).json({
      success: false,
      message: userMessage
    });
  }
});








/*router.post('/withdrawals', async (req, res) => {
  const {
    customerId,
    accountNumber,
    accountName,
    withdrawalType,      // 'cash', 'cheque', 'transfer'
    amount,
    currency,
    withdrawnBy,
    tellerId,
    transactionReference,
    description,
    cashAccountNumber,
    cashAccountName
  } = req.body;

  // ---- Manual validation ----
  const numericAmount = parseFloat(amount);
  const errors = [];

  if (!customerId) errors.push('customerId is required');
  if (!accountNumber) errors.push('accountNumber is required');
  if (!numericAmount || numericAmount <= 0) errors.push('amount must be a positive number');
  if (!tellerId) errors.push('tellerId is required');
  if (!transactionReference) errors.push('transactionReference is required');
  if (withdrawalType && !['cash', 'cheque', 'transfer'].includes(withdrawalType)) {
    errors.push('withdrawalType must be one of: cash, cheque, transfer');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      details: errors
    });
  }

  // Defaults
  const finalCurrency = currency || 'GHS';
  const finalDescription = description || '';
  const finalWithdrawnBy = withdrawnBy || tellerId;
  const cashAccNum = cashAccountNumber || 'CASH001';
  const cashAccName = cashAccountName || 'Teller';

  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    // 1. Get cash account normal balance from GL accounts
    const [cashAccountRows] = await connection.execute(
      `
      SELECT normalBalance 
      FROM gl_accounts 
      WHERE accountCode = ?
      `,
      [cashAccNum]
    );

    const cashNormalBalance = cashAccountRows.length > 0
      ? cashAccountRows[0].normalBalance
      : 'Debit';   // Cash is usually Debit-normal

    // 2. Lock and verify the customer account
    const [accountRows] = await connection.execute(
      `
      SELECT account_number, account_name, account_balance
      FROM customer_accounts_v2
      WHERE account_number = ? AND customer_id = ?
      FOR UPDATE NOWAIT
      `,
      [accountNumber, customerId]
    );

    if (accountRows.length === 0) {
      throw new Error('ACCOUNT_NOT_FOUND');
    }

    // 3. Get previous ledger balances for both accounts
    const [cashBalanceRows] = await connection.execute(
      `
      SELECT balance
      FROM deposit_to_and_from_transaction
      WHERE account_number = ?
      ORDER BY id DESC
      LIMIT 1
      `,
      [cashAccNum]
    );

    const [customerBalanceRows] = await connection.execute(
      `
      SELECT balance
      FROM deposit_to_and_from_transaction
      WHERE account_number = ?
      ORDER BY id DESC
      LIMIT 1
      `,
      [accountNumber]
    );

    const cashPreviousBalance = cashBalanceRows.length > 0
      ? Number(cashBalanceRows[0].balance)
      : 0;

    const customerPreviousBalance = customerBalanceRows.length > 0
      ? Number(customerBalanceRows[0].balance)
      : 0;

    // 4. Compute new balances (opposite of deposit)
    let cashNewBalance;
    let customerNewBalance;

    // Customer liability: debit decreases balance (withdrawal)
    customerNewBalance = customerPreviousBalance - numericAmount;

    // Cash account: withdrawal is a CREDIT entry
    //   - If Debit-normal (asset), credit decreases balance -> subtract
    //   - If Credit-normal (liability), credit increases balance -> add
    if (cashNormalBalance === 'Debit') {
      cashNewBalance = cashPreviousBalance + numericAmount;
    } else {
      cashNewBalance = cashPreviousBalance + numericAmount;
    }

    // Update customer_accounts_v2 balance (atomic)
    await connection.execute(
      `
      UPDATE customer_accounts_v2
      SET account_balance = ?,
          available_balance = ?,
          last_modified = NOW()
      WHERE account_number = ?
      `,
      [customerNewBalance, customerNewBalance, accountNumber]
    );

    // 5. Insert withdrawal master record
    const [withdrawalResult] = await connection.execute(
      `
      INSERT INTO withdrawals
        (customer_id, account_number, account_name, withdrawal_type, amount, currency,
         withdrawn_by, teller_id, transaction_reference, description, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        customerId,
        accountNumber,
        accountName || accountRows[0].account_name,
        withdrawalType || 'cash',
        numericAmount,
        finalCurrency,
        finalWithdrawnBy,
        tellerId,
        transactionReference,
        finalDescription,
        'completed'
      ]
    );
    const withdrawalId = withdrawalResult.insertId;

    // 6. Insert ledger entries – Customer first (debit), then Teller (credit)
    const ledgerSql = `
      INSERT INTO deposit_to_and_from_transaction
        (deposit_id, customer_id, teller_id, reference, transaction_date,
         account_name, account_number, narration, description,
         debit, credit, balance, currency, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const now = new Date();

    // Entry 1: Customer account DEBIT (liability decrease)
    await connection.execute(ledgerSql, [
      withdrawalId,        // we use deposit_id column but can rename later
      customerId,
      tellerId,
      transactionReference,
      now,
      accountName || accountRows[0].account_name,
      accountNumber,
      'Withdrawal from Account',
      finalDescription,
      numericAmount,       // debit
      0,                   // credit
      customerNewBalance,
      finalCurrency,
      finalWithdrawnBy
    ]);

    // Entry 2: Teller account CREDIT (asset decrease)
    await connection.execute(ledgerSql, [
      withdrawalId,
      customerId,
      tellerId,
      transactionReference,
      now,
      cashAccName,
      cashAccNum,
      'Cash Withdrawal Paid',
      finalDescription,
      0,                   // debit
      numericAmount,       // credit
      cashNewBalance,
      finalCurrency,
      finalWithdrawnBy
    ]);

    await connection.commit();
    connection.release();

    return res.status(201).json({
      success: true,
      message: 'Withdrawal completed successfully',
      withdrawalId,
      reference: transactionReference,
      customerId,
      tellerId,
      accountNumber,
      accountBalance: customerNewBalance
    });

  } catch (err) {
    if (connection) {
      try { await connection.rollback(); } catch (rollbackErr) 
      connection.release();
    }

    let statusCode = 500;
    let userMessage = 'Error processing withdrawal';

    switch (err.message) {
      case 'ACCOUNT_NOT_FOUND':
        statusCode = 404;
        userMessage = 'Customer account not found or does not belong to the specified customer';
        break;
      default:
        if (err.code === 'ER_DUP_ENTRY' && err.sqlMessage?.includes('transaction_reference')) {
          statusCode = 409;
          userMessage = 'Duplicate transaction reference – withdrawal may have already been processed';
        } else if (err.code === 'ER_LOCK_NOWAIT') {
          statusCode = 409;
          userMessage = 'Account is currently being updated, please try again in a moment.';
        } else {
          console.error('Withdrawal Error:', err);
        }
    }

    return res.status(statusCode).json({
      success: false,
      message: userMessage
    });
  }
});*/






router.post('/withdrawals', async (req, res) => {
  const {
    customerId,
    accountNumber,
    accountName,
    withdrawalType,      // 'cash', 'cheque', 'transfer'
    amount,
    currency,
    withdrawnBy,
    tellerId,
    transactionReference,
    description,
    cashAccountNumber,
    cashAccountName
  } = req.body;

  // ---- Manual validation ----
  const numericAmount = parseFloat(amount);
  const errors = [];

  if (!customerId) errors.push('customerId is required');
  if (!accountNumber) errors.push('accountNumber is required');
  if (!numericAmount || numericAmount <= 0) errors.push('amount must be a positive number');
  if (!tellerId) errors.push('tellerId is required');
  if (!transactionReference) errors.push('transactionReference is required');
  if (withdrawalType && !['cash', 'cheque', 'transfer'].includes(withdrawalType)) {
    errors.push('withdrawalType must be one of: cash, cheque, transfer');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      details: errors
    });
  }

  // Defaults
  const finalCurrency = currency || 'GHS';
  const finalDescription = description || '';
  const cashAccNum = cashAccountNumber || 'CASH001';

  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    // 0. Fetch teller's full name from users1
    let tellerFullName = null;
    const [tellerRows] = await connection.execute(
      `SELECT full_name FROM users1 WHERE teller_id = ? AND role = 'teller' AND status = 'active'`,
      [tellerId]
    );
    if (tellerRows.length > 0) {
      tellerFullName = tellerRows[0].full_name;
    } else {
      // Fallback: try using userId (in case frontend sends numeric userId)
      const [userRows] = await connection.execute(
        `SELECT full_name FROM users1 WHERE userId = ? AND role = 'teller' AND status = 'active'`,
        [tellerId]
      );
      if (userRows.length > 0) {
        tellerFullName = userRows[0].full_name;
      }
    }

    // Use teller's full name for both the ledger account name and the "withdrawn by" field
    const tellerAccountName = tellerFullName || cashAccountName || 'Teller';
    const finalWithdrawnBy = tellerFullName || withdrawnBy || tellerId;

    // 1. Get cash account normal balance from GL accounts
    const [cashAccountRows] = await connection.execute(
      `
      SELECT normalBalance 
      FROM gl_accounts 
      WHERE accountCode = ?
      `,
      [cashAccNum]
    );

    const cashNormalBalance = cashAccountRows.length > 0
      ? cashAccountRows[0].normalBalance
      : 'Debit';   // Cash is usually Debit-normal

    // 2. Lock and verify the customer account
    const [accountRows] = await connection.execute(
      `
      SELECT account_number, account_name, account_balance
      FROM customer_accounts_v2
      WHERE account_number = ? AND customer_id = ?
      FOR UPDATE NOWAIT
      `,
      [accountNumber, customerId]
    );

    if (accountRows.length === 0) {
      throw new Error('ACCOUNT_NOT_FOUND');
    }

    // 3. Get previous ledger balances for both accounts
    const [cashBalanceRows] = await connection.execute(
      `
      SELECT balance
      FROM deposit_to_and_from_transaction
      WHERE account_number = ?
      ORDER BY id DESC
      LIMIT 1
      `,
      [cashAccNum]
    );

    const [customerBalanceRows] = await connection.execute(
      `
      SELECT balance
      FROM deposit_to_and_from_transaction
      WHERE account_number = ?
      ORDER BY id DESC
      LIMIT 1
      `,
      [accountNumber]
    );

    const cashPreviousBalance = cashBalanceRows.length > 0
      ? Number(cashBalanceRows[0].balance)
      : 0;

    const customerPreviousBalance = customerBalanceRows.length > 0
      ? Number(customerBalanceRows[0].balance)
      : 0;

    // 4. Compute new balances (opposite of deposit)
    let cashNewBalance;
    let customerNewBalance;

    // Customer liability: debit decreases balance (withdrawal)
    customerNewBalance = customerPreviousBalance - numericAmount;

    // Cash account: withdrawal is a CREDIT entry
    //   - If Debit-normal (asset), credit decreases balance -> subtract
    //   - If Credit-normal (liability), credit increases balance -> add
    if (cashNormalBalance === 'Debit') {
      cashNewBalance = cashPreviousBalance + numericAmount;
    } else {
      cashNewBalance = cashPreviousBalance + numericAmount;
    }

    // Update customer_accounts_v2 balance (atomic)
    await connection.execute(
      `
      UPDATE customer_accounts_v2
      SET account_balance = ?,
          available_balance = ?,
          last_modified = NOW()
      WHERE account_number = ?
      `,
      [customerNewBalance, customerNewBalance, accountNumber]
    );

    // 5. Insert withdrawal master record
    const [withdrawalResult] = await connection.execute(
      `
      INSERT INTO withdrawals
        (customer_id, account_number, account_name, withdrawal_type, amount, currency,
         withdrawn_by, teller_id, transaction_reference, description, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        customerId,
        accountNumber,
        accountName || accountRows[0].account_name,
        withdrawalType || 'cash',
        numericAmount,
        finalCurrency,
        finalWithdrawnBy,          // now uses teller's full name (or fallback)
        tellerId,
        transactionReference,
        finalDescription,
        'completed'
      ]
    );
    const withdrawalId = withdrawalResult.insertId;

    // 6. Insert ledger entries – Customer first (debit), then Teller (credit)
    const ledgerSql = `
      INSERT INTO deposit_to_and_from_transaction
        (deposit_id, customer_id, teller_id, reference, transaction_date,
         account_name, account_number, narration, description,
         debit, credit, balance, currency, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const now = new Date();

    // Entry 1: Customer account DEBIT (liability decrease)
    await connection.execute(ledgerSql, [
      withdrawalId,
      customerId,
      tellerId,
      transactionReference,
      now,
      accountName || accountRows[0].account_name,
      accountNumber,
      'Withdrawal from Account',
      finalDescription,
      numericAmount,       // debit
      0,                   // credit
      customerNewBalance,
      finalCurrency,
      finalWithdrawnBy
    ]);

    // Entry 2: Teller account CREDIT (asset decrease) – using teller's full name as account_name
    await connection.execute(ledgerSql, [
      withdrawalId,
      customerId,
      tellerId,
      transactionReference,
      now,
      tellerAccountName,    // <--- now uses teller's full name
      cashAccNum,
      'Cash Withdrawal Paid',
      finalDescription,
      0,                   // debit
      numericAmount,       // credit
      cashNewBalance,
      finalCurrency,
      finalWithdrawnBy
    ]);

    await connection.commit();
    connection.release();

    return res.status(201).json({
      success: true,
      message: 'Withdrawal completed successfully',
      withdrawalId,
      reference: transactionReference,
      customerId,
      tellerId,
      accountNumber,
      accountBalance: customerNewBalance
    });

  } catch (err) {
    if (connection) {
      try { await connection.rollback(); } catch (rollbackErr) { /* ignore */ }
      connection.release();
    }

    let statusCode = 500;
    let userMessage = 'Error processing withdrawal';

    switch (err.message) {
      case 'ACCOUNT_NOT_FOUND':
        statusCode = 404;
        userMessage = 'Customer account not found or does not belong to the specified customer';
        break;
      default:
        if (err.code === 'ER_DUP_ENTRY' && err.sqlMessage?.includes('transaction_reference')) {
          statusCode = 409;
          userMessage = 'Duplicate transaction reference – withdrawal may have already been processed';
        } else if (err.code === 'ER_LOCK_NOWAIT') {
          statusCode = 409;
          userMessage = 'Account is currently being updated, please try again in a moment.';
        } else {
          console.error('Withdrawal Error:', err);
        }
    }

    return res.status(statusCode).json({
      success: false,
      message: userMessage
    });
  }
});




router.get('/tellers', (req, res) => {

const query = `
SELECT
 userId AS id,
 full_name AS fullName,
 username,
 teller_id AS tellerId
FROM users1
WHERE role='teller'
AND status='active'
`;

db.query(query,(error, rows)=>{

if(error){
 console.error(error);
 return res.status(500).json({
   message:"Server error"
 });
}

res.json(rows);

});

});
// GET /api/tills/:id  - Fetch a single till by ID
// ------------------------------
router.get('/:id', (req, res) => {
  const tillId = req.params.id;

  // Validate that id is a number
  if (isNaN(tillId)) {
    return res.status(400).json({ error: 'Invalid till ID' });
  }

  db.getConnection((err, connection) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database connection failed' });
    }

    connection.query(
      `SELECT * FROM tills WHERE id = ?`,
      [tillId],
      (err, rows) => {
        connection.release();
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Failed to fetch till' });
        }
        if (rows.length === 0) {
          return res.status(404).json({ error: 'Till not found' });
        }
        res.json(rows[0]);
      }
    );
  });
});





export default router;