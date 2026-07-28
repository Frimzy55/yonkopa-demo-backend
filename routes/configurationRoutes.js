import express from 'express';
import { db } from '../config/db.js';

const router = express.Router();

// ================================
// GET ALL LOAN FEES
// ================================
router.get("/loan-fees", (req, res) => {
  db.query(`
    SELECT
      lfc.*,
      ga.accountName AS ledger_name
    FROM loan_fee_configuration lfc
    LEFT JOIN gl_accounts ga
    ON lfc.general_ledger_id = ga.id
    ORDER BY lfc.created_at DESC
  `, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Failed to fetch loan fees." });
    }
    res.json(rows);
  });
});

// ================================
// GET ALL GL ACCOUNTS (for dropdown)
// ================================
router.get("/gl-accounts", (req, res) => {
  db.query(`
    SELECT id, accountName AS name
    FROM gl_accounts
    ORDER BY accountName
  `, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Failed to fetch GL accounts." });
    }
    res.json(rows);
  });
});

// ================================
// CREATE LOAN FEE
// ================================
router.post("/loan-fees", (req, res) => {
  const {
    feeName,
    feeType,
    feeTrend,
    paymentMode,
    status,
    feeValueType,
    feeAmount,
    allowEditAtDisbursement,
    alertManagementOnEdit,
    generalLedgerId,
  } = req.body;

  const ledgerId =
    generalLedgerId === "" || generalLedgerId == null
      ? null
      : generalLedgerId;

  const query = `
    INSERT INTO loan_fee_configuration (
      fee_name,
      fee_type,
      fee_trend,
      payment_mode,
      status,
      fee_value_type,
      fee_amount,
      allow_edit_at_disbursement,
      alert_management_on_edit,
      general_ledger_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    query,
    [
      feeName,
      feeType,
      feeTrend,
      paymentMode,
      status,
      feeValueType,
      feeAmount,
      allowEditAtDisbursement,
      alertManagementOnEdit,
      ledgerId,
    ],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Failed to create loan fee." });
      }
      res.status(201).json({
        success: true,
        message: "Loan fee created successfully.",
        id: result.insertId,
      });
    }
  );
});

// ================================
// UPDATE LOAN FEE
// ================================
router.put("/loan-fees/:id", (req, res) => {
  const { id } = req.params;

  const {
    feeName,
    feeType,
    feeTrend,
    paymentMode,
    status,
    feeValueType,
    feeAmount,
    allowEditAtDisbursement,
    alertManagementOnEdit,
    generalLedgerId,
  } = req.body;

  const ledgerId =
    generalLedgerId === "" || generalLedgerId == null
      ? null
      : generalLedgerId;

  const query = `
    UPDATE loan_fee_configuration
    SET
      fee_name=?,
      fee_type=?,
      fee_trend=?,
      payment_mode=?,
      status=?,
      fee_value_type=?,
      fee_amount=?,
      allow_edit_at_disbursement=?,
      alert_management_on_edit=?,
      general_ledger_id=?
    WHERE id=?
  `;

  db.query(
    query,
    [
      feeName,
      feeType,
      feeTrend,
      paymentMode,
      status,
      feeValueType,
      feeAmount,
      allowEditAtDisbursement,
      alertManagementOnEdit,
      ledgerId,
      id,
    ],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Failed to update loan fee." });
      }
      res.json({
        success: true,
        message: "Loan fee updated successfully.",
      });
    }
  );
});

// ================================
// DELETE LOAN FEE
// ================================
router.delete("/loan-fees/:id", (req, res) => {
  const { id } = req.params;

  db.query(
    "DELETE FROM loan_fee_configuration WHERE id = ?",
    [id],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Failed to delete loan fee." });
      }
      res.json({
        success: true,
        message: "Loan fee deleted successfully.",
      });
    }
  );
});





// Create Loan Product
router.post("/loan-products", (req, res) => {

  const {
    productName,
    loanType,
    assignToLoanTypes,
    creditReportCategory,
    loanRangeRequired,
    minAmount,
    maxAmount,
    allowMultipleAccounts,
    savingsBeforeEligibility,
    loanEligibilityAmountRequired,
    allowableDisposableIncome,
    interestType,
    minRate,
    defaultRate,
    maxRate,
    allowMoratorium,
    moratoriumDays,
    includeMoratoriumPeriod,
    loanTermDefault,
    durationMonths,
    repaymentCycleDefault,
    scheduleComputationDefault,
    applyTrunchDisbursement,
    selectedFees,
    chargePenaltyOverdue,
    overduePenaltyRate,
    overduePenaltyComputeOn,
    overduePenaltyMoratorium,
    chargePenaltyExpired,
    expiredPenaltyRate,
    expiredPenaltyComputeOn,
    expiredPenaltyMoratorium
  } = req.body;


  const sql = `
    INSERT INTO loan_products_configuration
    (
      product_name,
      loan_type,
      assign_to_loan_types,
      credit_report_category,
      loan_range_required,
      min_amount,
      max_amount,
      allow_multiple_accounts,
      savings_before_eligibility,
      loan_eligibility_amount_required,
      allowable_disposable_income,
      interest_type,
      min_rate,
      default_rate,
      max_rate,
      allow_moratorium,
      moratorium_days,
      include_moratorium_period,
      loan_term_default,
      duration_months,
      repayment_cycle_default,
      schedule_computation_default,
      apply_trunch_disbursement,
      selected_fees,
      charge_penalty_overdue,
      overdue_penalty_rate,
      overdue_penalty_compute_on,
      overdue_penalty_moratorium,
      charge_penalty_expired,
      expired_penalty_rate,
      expired_penalty_compute_on,
      expired_penalty_moratorium
    )
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `;


  const values = [
    productName,
    loanType,
    assignToLoanTypes,
    creditReportCategory,
    loanRangeRequired,
    minAmount,
    maxAmount,
    allowMultipleAccounts,
    savingsBeforeEligibility,
    loanEligibilityAmountRequired,
    allowableDisposableIncome,
    interestType,
    minRate,
    defaultRate,
    maxRate,
    allowMoratorium,
    moratoriumDays,
    includeMoratoriumPeriod,
    loanTermDefault,
    durationMonths,
    repaymentCycleDefault,
    scheduleComputationDefault,
    applyTrunchDisbursement,
    JSON.stringify(selectedFees || []),
    chargePenaltyOverdue,
    overduePenaltyRate,
    overduePenaltyComputeOn,
    overduePenaltyMoratorium,
    chargePenaltyExpired,
    expiredPenaltyRate,
    expiredPenaltyComputeOn,
    expiredPenaltyMoratorium
  ];


  db.query(sql, values, (err, result) => {

    if (err) {
      console.error("Loan Product Insert Error:", err);

      return res.status(500).json({
        success: false,
        message: "Failed to create loan product",
        error: err.message
      });
    }


    res.status(201).json({
      success: true,
      message: "Loan product created successfully",
      id: result.insertId
    });

  });

});


// Get Loan Products
router.get("/loan-product1", (req, res) => {

  const sql = `
    SELECT 
      id,
      product_name AS productName,
      loan_type AS loanType,
      assign_to_loan_types AS assignToLoanTypes,
      credit_report_category AS creditReportCategory,
      min_amount AS minAmount,
      max_amount AS maxAmount,
      interest_type AS interestType,
      default_rate AS defaultRate,
      duration_months AS durationMonths,
      repayment_cycle_default AS repaymentCycleDefault,
      created_at AS createdAt
    FROM loan_products_configuration
    ORDER BY id DESC
  `;


  db.query(sql, (err, results) => {

    if (err) {
      return res.status(500).json({
        success:false,
        error:err.message
      });
    }


    res.json({
      success:true,
      data:results
    });

  });

});







// Get all active fees from loan_fee_configurations
router.get("/fees", (req, res) => {
  const sql = `
    SELECT 
      id, 
      fee_name, 
      fee_type, 
      fee_trend, 
      payment_mode, 
      status, 
      fee_value_type, 
      fee_amount,
      allow_edit_at_disbursement,
      alert_management_on_edit,
      general_ledger_id
    FROM loan_fee_configuration
    WHERE status = 'Active'
    ORDER BY fee_name
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("GET /fees error:", err);
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }
    res.json({
      success: true,
      data: results,
    });
  });
});






export default router;