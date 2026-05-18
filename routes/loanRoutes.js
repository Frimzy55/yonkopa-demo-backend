import express from 'express';
import { db, dbPromise } from '../config/db.js';
import { upload, attachRelativePath } from '../config/multer.js';   // ← import both
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { formatMySQLDate, safe } from '../utils/helpers.js';

const router = express.Router();

// Submit full loan application with guarantor files
router.post(
  "/api/loan/submit-full-application",
  upload.fields([
    { name: "guarantorProfilePicture" },
    { name: "guarantorPayslip" },
    { name: "guarantorBusinessPicture" },
    { name: "guarantorGhanaCardFront" },
    { name: "guarantorGhanaCardBack" },
  ]),
  attachRelativePath,   // ← ADD THIS middleware
  async (req, res) => {
    db.getConnection(async (err, connection) => {
      if (err) return res.status(500).json(err);
      try {
        await connection.promise().beginTransaction();
        const {
          userId, fullName, phone, email, kycCode, dateofbirth, gender, nationalid,
          maritalstatus, dependents, residentialAddress, residentialGPS, employmentStatus,
          loanAmount, loanPurpose, loanTerm, repaymentFrequency, ratePerAnnum, interest,
          totalInterest, numberOfPayments, monthlyPayment, loanFees,
          guarantorName, guarantorPhone, guarantorAddress, guarantorResidenceLocation,
          guarantorIdNumber, guarantorEmployeeType, guarantorRank, guarantorWorkLocation,
          guarantorNameOfEmployer, guarantorYearsInService, guarantorBusinessName,
          guarantorBusinessLocation, guarantorYearsInBusiness,
          momoProvider, momoNumber, momoAccountName
        } = req.body;

        const year = new Date().getFullYear();
        const [rows] = await connection.promise().query(`SELECT loan_id FROM loan_details WHERE loan_id LIKE 'LN${year}%' ORDER BY loan_id DESC LIMIT 1`);
        let nextNumber = 1;
        if (rows.length > 0) {
          const lastNumber = parseInt(rows[0].loan_id.slice(-5));
          nextNumber = lastNumber + 1;
        }
        const loan_id = `LN${year}${String(nextNumber).padStart(5, "0")}`;

        // Applicant details
        await connection.promise().query("INSERT INTO applicant_details SET ?", {
          userId, loan_id, fullName, phone, email, kyc_code: kycCode, dob: dateofbirth,
          gender, nationalid, maritalStatus: maritalstatus, dependents: dependents ? parseInt(dependents) : null,
          residentialAddress, residentialGPS, employmentStatus
        });

        // Loan details
        await connection.promise().query("INSERT INTO loan_details SET ?", {
          userId, loan_id, kyc_code: kycCode, loanAmount: loanAmount ? parseFloat(loanAmount) : null,
          loanPurpose, loanTerm: loanTerm ? parseInt(loanTerm) : null, repaymentFrequency,
          ratePerAnnum: ratePerAnnum ? parseFloat(ratePerAnnum) : null,
          interest: interest ? parseFloat(interest) : null,
          totalInterest: totalInterest ? parseFloat(totalInterest) : null,
          numberOfPayments: numberOfPayments ? parseInt(numberOfPayments) : null,
          monthlyPayment: monthlyPayment ? parseFloat(monthlyPayment) : null,
          loanFees: loanFees ? parseFloat(loanFees) : null
        });

        // Guarantor info – using relativePath instead of path
        const files = req.files || {};
        await connection.promise().query("INSERT INTO guarantor_info SET ?", {
          userId, loan_id, kyc_code: kycCode, guarantorName, guarantorPhone, guarantorAddress,
          guarantorResidenceLocation, guarantorIdNumber, guarantorEmployeeType, guarantorRank,
          guarantorWorkLocation, guarantorNameOfEmployer,
          guarantorYearsInService: guarantorYearsInService ? parseInt(guarantorYearsInService) : null,
          guarantorBusinessName, guarantorBusinessLocation,
          guarantorYearsInBusiness: guarantorYearsInBusiness ? parseInt(guarantorYearsInBusiness) : null,
          guarantorProfilePicture: files?.guarantorProfilePicture?.[0]?.relativePath || null,
          guarantorPayslip: files?.guarantorPayslip?.[0]?.relativePath || null,
          guarantorBusinessPicture: files?.guarantorBusinessPicture?.[0]?.relativePath || null,
          guarantorGhanaCardFront: files?.guarantorGhanaCardFront?.[0]?.relativePath || null,
          guarantorGhanaCardBack: files?.guarantorGhanaCardBack?.[0]?.relativePath || null
        });

        // Momo details
        await connection.promise().query("INSERT INTO momo_details SET ?", {
          userId, loan_id, kyc_code: kycCode, momoProvider, momoNumber, momoAccountName, loan_status: "pending"
        });

        await connection.promise().commit();
        connection.release();
        res.json({ success: true, loan_id });
      } catch (error) {
        await connection.promise().rollback();
        connection.release();
        console.error(error);
        res.status(500).json(error);
      }
    });
  }
);

// ... rest of your routes (loan-status, loan-check, etc.) remain unchanged

// Get loan status for user
router.get("/api/loan-status/:userId", (req, res) => {
  const { userId } = req.params;
  const sql = `SELECT loan_status FROM momo_details WHERE userId = ? ORDER BY created_at DESC LIMIT 1`;
  db.query(sql, [userId], (err, results) => {
    if (err || results.length === 0) return res.json({ status: "No Loan" });
    res.json({ status: results[0].loan_status });
  });
});

// Check if user already applied for loan
router.get("/loan-check/:userId", (req, res) => {
  const { userId } = req.params;
  db.query("SELECT 1 FROM full_loan_kyc_view WHERE userId = ? LIMIT 1", [userId], (err, rows) => {
    if (err) return res.status(500).json({ exists: false });
    res.json({ exists: rows.length > 0 });
  });
});

// Get customer by kyc_code (for approved loans)
router.get("/api/customer/:kyc_code", (req, res) => {
  const { kyc_code } = req.params;
  db.execute(`SELECT * FROM full_loan_kyc_view1 WHERE kyc_code = ? AND loan_status = 'approved' LIMIT 1`, [kyc_code], (err, rows) => {
    if (err || !rows.length) return res.status(404).json({ success: false, message: "KYC not approved or not found" });
    res.json({ success: true, customer: rows[0] });
  });
});

// Loan evaluation (POST) – updates multiple tables
router.post("/api/loan/evaluate", async (req, res) => {
  const connection = await dbPromise.getConnection();
  try {
    await connection.beginTransaction();
    const { loan, collateral, creditData, finalDecision } = req.body;
    const loanId = loan.loan_id || loan.id;
    if (!loan?.kyc_code) throw new Error("kyc_code is required");

    // loans_eval
    await connection.execute(
      `INSERT INTO loans_eval (loan_id, kyc_code, applicant_fullName, mobileNumber, loanAmount, loan_status, loanPurpose, applicant_created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [safe(loanId), safe(loan.kyc_code), safe(loan.applicant_fullName), safe(loan.mobileNumber), safe(loan.loanAmount), safe(loan.loan_status), safe(loan.loanPurpose), formatMySQLDate(loan.applicant_created_at)]
    );

    // collateral
    await connection.execute(
      `INSERT INTO loan_collaterals (loan_id, lending_type, collateral_type, collateral_data) VALUES (?, ?, ?, ?)`,
      [safe(loanId), collateral?.lendingType === "secured" || collateral?.lendingType === "unsecured" ? collateral.lendingType : null, safe(collateral?.collateralType), JSON.stringify(collateral?.formData || {})]
    );

    // credit assessment
    await connection.execute(
      `INSERT INTO borrower_credit_assessments (loan_id, is_creditworthy, is_able_to_pay, business_overview, business_location, business_start_date, nearest_landmark, business_description, current_stock_value, started_business_with, source_of_fund, principal, rate, loan_term, interest, loan_amount, monthly_installment, gross_margin_percentage, monthly_sales_revenue, cost_of_goods_sold, gross_profit, total_operating_expenses, net_business_profit, household_expenses, other_income, household_surplus, loan_recommendation, pay_capacity, extra_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [safe(loanId), creditData.isCreditworthy ? 1 : 0, creditData.isAbleToPay ? 1 : 0, safe(creditData.businessOverview), safe(creditData.businessLocation), formatMySQLDate(creditData.businessStartDate), safe(creditData.nearestLandmark), safe(creditData.businessDescription), safe(creditData.currentStockValue), safe(creditData.startedBusinessWith), safe(creditData.sourceOfFund), safe(creditData.principal), safe(creditData.rate), safe(creditData.loanTerm), safe(creditData.interest), safe(creditData.loanAmount), safe(creditData.monthlyInstallment), safe(creditData.grossMarginPercentage), safe(creditData.monthlySalesRevenue), safe(creditData.costOfGoodsSold), safe(creditData.grossProfit), safe(creditData.totalOperatingExpenses), safe(creditData.netBusinessProfit), safe(creditData.householdExpenses), safe(creditData.otherIncome), safe(creditData.householdSurplus), safe(creditData.loanRecommendation), safe(creditData.payCapacity), JSON.stringify(creditData.extraData || {})]
    );

    // final decision
    await connection.execute(`INSERT INTO loan_final_decisions (loan_id, comments, is_confirmed) VALUES (?, ?, ?)`, [safe(loanId), safe(finalDecision.comments), finalDecision.confirmed ? 1 : 0]);

    // soft delete momo_details
    await connection.execute(`UPDATE momo_details SET is_deleted = 1 WHERE kyc_code = ?`, [safe(loan.kyc_code)]);

    await connection.commit();
    res.json({ message: "Loan evaluation saved", loan_id: loanId });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: "Error saving loan evaluation", error: error.message });
  } finally {
    connection.release();
  }
});

// Approve loan (update momo_details)
router.put("/api/admin/approve-loan1/:loan_id", async (req, res) => {
  const { loan_id } = req.params;
  db.query(`UPDATE momo_details SET loan_status = 'approved', approved_date = NOW() WHERE loan_id = ?`, [loan_id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: "Database error" });
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Loan not found" });
    res.status(200).json({ success: true, message: "Loan approved successfully" });
  });
});

// Reject loan (soft delete)
router.post("/loan/reject", (req, res) => {
  const { loan_id } = req.body;
  if (!loan_id) return res.status(400).json({ error: "loan_id is required" });
  db.query(`UPDATE momo_details SET loan_status = 'rejected', is_deleted = 1 WHERE loan_id = ?`, [loan_id], (err, result) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (result.affectedRows === 0) return res.status(404).json({ error: "Loan not found" });
    res.json({ message: "Loan rejected and soft deleted successfully", loan_id });
  });
});




// 1. Verify customer (userId + kycCode)
router.post("/api/verify-customer", (req, res) => {
  let { userId, kycCode } = req.body;
  kycCode = kycCode?.trim();
  const query = `SELECT * FROM personal_kyc WHERE userId = ? AND kycCode = ?`;
  db.query(query, [userId, kycCode], (err, results) => {
    if (err || results.length === 0) return res.json({ verified: false });
    res.json({ verified: true, customer: results[0] });
  });
});




export default router;