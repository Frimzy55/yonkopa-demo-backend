import express from 'express';
import { db, dbPromise } from '../config/db.js';
import { upload, attachRelativePath } from '../config/multer.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { formatMySQLDate, safe } from '../utils/helpers.js';

const router = express.Router();

// ===============================
// Local helpers (not imported)
// ===============================
const toDecimalOrNull = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
};

const toIntOrNull = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const num = parseInt(value);
  return isNaN(num) ? null : num;
};

// ===============================
// Submit full loan application with guarantor files
// ===============================
router.post(
  "/api/loan/submit-full-application",
  upload.fields([
    { name: "guarantorProfilePicture" },
    { name: "guarantorPayslip" },
    { name: "guarantorBusinessPicture" },
    { name: "guarantorGhanaCardFront" },
    { name: "guarantorGhanaCardBack" },
  ]),
  attachRelativePath,
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

        // Guarantor info
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

// ===============================
// Get loan status for user
// ===============================
/*router.get("/api/loan-status/:userId", (req, res) => {
  const { userId } = req.params;
  const sql = `SELECT loan_status FROM momo_details WHERE userId = ? ORDER BY created_at DESC LIMIT 1`;
  db.query(sql, [userId], (err, results) => {
    if (err || results.length === 0) return res.json({ status: "No Loan" });
    res.json({ status: results[0].loan_status });
  });
});
*/

router.get("/api/loan-status/:userId", (req, res) => {
  const { userId } = req.params;

  const sql = `
    SELECT loan_status, loan_id
    FROM momo_details
    WHERE userId = ?
    ORDER BY id DESC
    LIMIT 1
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({
        status: "error",
      });
    }

    if (results.length === 0) {
      return res.json({
        status: "No Loan",
      });
    }

    return res.json({
      status: results[0].loan_status,
      loan_id: results[0].loan_id,
    });
  });
});
// ===============================
// Check if user already applied for loan
// ===============================
router.get("/loan-check/:userId", (req, res) => {
  const { userId } = req.params;
  db.query("SELECT 1 FROM full_loan_kyc_view1 WHERE userId = ? LIMIT 1", [userId], (err, rows) => {
    if (err) return res.status(500).json({ exists: false });
    res.json({ exists: rows.length > 0 });
  });
});



router.get("/loan-rejected-check/:userId", (req, res) => {
  const { userId } = req.params;

  const sql = `
    SELECT loan_status
    FROM momo_details
    WHERE userId = ?
    ORDER BY created_at DESC
    LIMIT 1
  `;

  db.query(sql, [userId], (err, rows) => {
    if (err) return res.status(500).json({ rejected: false });

    if (rows.length === 0) {
      return res.json({ rejected: false });
    }

    return res.json({
      rejected: rows[0].loan_status === "rejected",
    });
  });
});








// ===============================
// CHECK IF LAST LOAN IS APPROVED
// ===============================
router.get("/loan-approved-check/:userId", (req, res) => {
  const { userId } = req.params;

  const sql = `
    SELECT loan_status
    FROM momo_details
    WHERE userId = ?
    ORDER BY created_at DESC
    LIMIT 1
  `;

  db.query(sql, [userId], (err, rows) => {
    if (err) {
      return res.status(500).json({
        approved: false,
      });
    }

    if (rows.length === 0) {
      return res.json({
        approved: false,
      });
    }

    return res.json({
      approved: rows[0].loan_status === "approved",
    });
  });
});
/*router.get("/loan-check/:userId", (req, res) => {
  const { userId } = req.params;

  const sql = `
    SELECT loan_status
    FROM full_loan_kyc_view
    WHERE userId = ?
    ORDER BY created_at DESC
    LIMIT 1
  `;

  db.query(sql, [userId], (err, rows) => {
    if (err) return res.status(500).json({ exists: false });

    if (rows.length === 0) {
      return res.json({ exists: false, status: null });
    }

    return res.json({
      exists: rows[0].loan_status !== "rejected",
      status: rows[0].loan_status,
    });
  });
});*/

// ===============================
// Get customer by kyc_code (for approved loans)
// ===============================
/*router.get("/api/customer/:kyc_code", (req, res) => {
  const { kyc_code } = req.params;
  db.execute(`SELECT * FROM full_loan_kyc_view1 WHERE kyc_code = ? AND loan_status = 'approved' LIMIT 1`, [kyc_code], (err, rows) => {
    if (err || !rows.length) return res.status(404).json({ success: false, message: "KYC not approved or not found" });
    res.json({ success: true, customer: rows[0] });
  });
});*/




router.get("/api/customer/:customer_id", (req, res) => {
  const { customer_id } = req.params;

  const sql = `
    SELECT * 
    FROM loan_master7
    WHERE customer_id = ?
    AND loan_status = 'approved'
    LIMIT 1
  `;

  db.execute(sql, [customer_id], (err, rows) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Database error",
        error: err.message,
      });
    }

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Customer not found or loan not approved",
      });
    }

    res.json({
      success: true,
      customer: rows[0],
    });
  });
});



// ===============================
// Loan evaluation (POST) – FIXED for numeric fields
// ===============================
router.post("/api/loan/evaluate", async (req, res) => {
  const connection = await dbPromise.getConnection();

  try {
    await connection.beginTransaction();

    const {
      loan = {},
      collateral = {},
      creditData = {},
      finalDecision = {},
    } = req.body;

    const loanId = loan.loan_id || loan.id;

    if (!loanId) throw new Error("loan_id is required");
    if (!loan?.kyc_code) throw new Error("kyc_code is required");

   // console.log("============== REQUEST DATA ==============");
   // console.log("loan:", loan);
    //console.log("collateral:", collateral);
    //console.log("creditData:", creditData);
    //console.log("finalDecision:", finalDecision);

    // Insert into loans_eval
    await connection.execute(
      `INSERT INTO loans_eval (
        loan_id, kyc_code, applicant_fullName, mobileNumber, loanAmount,
        loan_status, loanPurpose, applicant_created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        safe(loanId),
        safe(loan.kyc_code),
        safe(loan.applicant_fullName),
        safe(loan.mobileNumber),
        toDecimalOrNull(loan.loanAmount),
        safe(loan.loan_status),
        safe(loan.loanPurpose),
        formatMySQLDate(loan.applicant_created_at),
      ]
    );

    // Insert into loan_collaterals
    await connection.execute(
      `INSERT INTO loan_collaterals (loan_id, lending_type, collateral_type, collateral_data)
       VALUES (?, ?, ?, ?)`,
      [
        safe(loanId),
        (collateral?.lendingType === "secured" || collateral?.lendingType === "unsecured")
          ? collateral.lendingType : null,
        safe(collateral?.collateralType),
        JSON.stringify(collateral?.formData || {}),
      ]
    );

    // Insert into borrower_credit_assessments
    // NOTE: All numeric columns use toDecimalOrNull() to convert empty strings to NULL.
    // loan_recommendation is numeric → use toDecimalOrNull (fixed!)
    await connection.execute(
      `INSERT INTO borrower_credit_assessments (
        loan_id, is_creditworthy, is_able_to_pay,
        business_overview, business_location, business_start_date, nearest_landmark, business_description,
        current_stock_value, started_business_with, source_of_fund,
        principal, rate, loan_term, interest,
        loan_amount, monthly_installment, gross_margin_percentage,
        monthly_sales_revenue, cost_of_goods_sold, gross_profit,
        total_operating_expenses, net_business_profit,
        household_expenses, other_income, household_surplus,
        loan_recommendation, pay_capacity, extra_data
      ) VALUES (
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )`,
      [
        safe(loanId),
        creditData?.isCreditworthy ? 1 : 0,
        creditData?.isAbleToPay ? 1 : 0,
        safe(creditData?.businessOverview),
        safe(creditData?.businessLocation),
        creditData?.businessStartDate ? formatMySQLDate(creditData.businessStartDate) : null,
        safe(creditData?.nearestLandmark),
        safe(creditData?.businessDescription),
        toDecimalOrNull(creditData?.currentStockValue),
        toDecimalOrNull(creditData?.startedBusinessWith),
        safe(creditData?.sourceOfFund),
        toDecimalOrNull(creditData?.principal),
        toDecimalOrNull(creditData?.rate),
        toDecimalOrNull(creditData?.loanTerm),
        toDecimalOrNull(creditData?.interest),
        toDecimalOrNull(creditData?.loanAmount),
        toDecimalOrNull(creditData?.monthlyInstallment),
        toDecimalOrNull(creditData?.grossMarginPercentage),
        toDecimalOrNull(creditData?.monthlySalesRevenue),
        toDecimalOrNull(creditData?.costOfGoodsSold),
        toDecimalOrNull(creditData?.grossProfit),
        toDecimalOrNull(creditData?.totalOperatingExpenses),
        toDecimalOrNull(creditData?.netBusinessProfit),
        toDecimalOrNull(creditData?.householdExpenses),
        toDecimalOrNull(creditData?.otherIncome),
        toDecimalOrNull(creditData?.householdSurplus),
        toDecimalOrNull(creditData?.loanRecommendation),   // ← FIXED: convert empty string to NULL
        toDecimalOrNull(creditData?.payCapacity),
        JSON.stringify(creditData?.extraData || {}),
      ]
    );

    // Insert into loan_final_decisions
    await connection.execute(
      `INSERT INTO loan_final_decisions (loan_id, comments, is_confirmed) VALUES (?, ?, ?)`,
      [safe(loanId), safe(finalDecision?.comments), finalDecision?.confirmed ? 1 : 0]
    );

    // Soft delete momo_details
    await connection.execute(
      `UPDATE momo_details SET is_deleted = 1 WHERE kyc_code = ?`,
      [safe(loan.kyc_code)]
    );

    await connection.commit();
    res.status(200).json({
      success: true,
      message: "Loan evaluation saved successfully",
      loan_id: loanId,
    });
  } catch (error) {
    await connection.rollback();
    console.error("========== LOAN EVALUATION ERROR ==========");
    console.error("SQL Message:", error.sqlMessage);
    console.error("SQL Code:", error.code);
    console.error("Full error:", error);
    res.status(500).json({
      success: false,
      message: "Error saving loan evaluation",
      error: error.sqlMessage || error.message,
    });
  } finally {
    connection.release();
  }
});

// ===============================
// Approve loan (update momo_details)
// ===============================
/*router.put("/api/admin/approve-loan1/:loan_id", async (req, res) => {
  const { loan_id } = req.params;
  db.query(`UPDATE momo_details SET loan_status = 'approved', approved_date = NOW() WHERE loan_id = ?`, [loan_id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: "Database error" });
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Loan not found" });
    res.status(200).json({ success: true, message: "Loan approved successfully" });
  });
});*/



// ===============================
// Approve loan + Generate Customer ID
// ===============================

router.put("/api/admin/approve-loan1/:loan_id", async (req, res) => {

  const { loan_id } = req.params;

  try {

    // Get current loan
    const [loanRows] = await db.promise().query(
      `
      SELECT *
      FROM momo_details
      WHERE loan_id = ?
      LIMIT 1
      `,
      [loan_id]
    );

    // Loan not found
    if (loanRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Loan not found",
      });
    }

    const loan = loanRows[0];

    // Prevent double approval
    if (loan.loan_status === "approved") {
      return res.status(400).json({
        success: false,
        message: "Loan already approved",
      });
    }

    let customerId = null;

    // =====================================
    // CHECK IF KYC CODE ALREADY HAS CUSTOMER ID
    // =====================================

    const [existingCustomer] = await db.promise().query(
      `
      SELECT customer_id
      FROM momo_details
      WHERE kyc_code = ?
      AND customer_id IS NOT NULL
      LIMIT 1
      `,
      [loan.kyc_code]
    );

    // Reuse existing customer ID
    if (existingCustomer.length > 0) {

      customerId = existingCustomer[0].customer_id;

    } else {

      // =====================================
      // GENERATE NEW CUSTOMER ID
      // =====================================

      const [latestCustomer] = await db.promise().query(
        `
        SELECT customer_id
        FROM momo_details
        WHERE customer_id IS NOT NULL
        ORDER BY CAST(customer_id AS UNSIGNED) DESC
        LIMIT 1
        `
      );

      let nextNumber = 1;

      if (latestCustomer.length > 0) {
        nextNumber =
          parseInt(latestCustomer[0].customer_id, 10) + 1;
      }

      // Format => 00001
      customerId = String(nextNumber).padStart(5, "0");
    }

    // =====================================
    // UPDATE LOAN
    // =====================================

    await db.promise().query(
      `
      UPDATE momo_details
      SET
        loan_status = 'approved',
        approved_date = NOW(),
        customer_id = ?
      WHERE loan_id = ?
      `,
      [customerId, loan_id]
    );

    res.status(200).json({
      success: true,
      message: "Loan approved successfully",
      customer_id: customerId,
    });

  } catch (error) {

    console.error("Approve Loan Error:", error);

    res.status(500).json({
      success: false,
      message: "Database error",
    });

  }

});

// ===============================
// Reject loan (soft delete)
// ===============================
router.post("/loan/reject", (req, res) => {
  const { loan_id } = req.body;
  if (!loan_id) return res.status(400).json({ error: "loan_id is required" });
  db.query(`UPDATE momo_details SET loan_status = 'rejected', is_deleted = 1 WHERE loan_id = ?`, [loan_id], (err, result) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (result.affectedRows === 0) return res.status(404).json({ error: "Loan not found" });
    res.json({ message: "Loan rejected and soft deleted successfully", loan_id });
  });
});






router.post("/loan/reject1", (req, res) => {
  console.log("Reject request:", req.body);

  const { loan_id } = req.body;

  if (!loan_id) {
    return res.status(400).json({
      error: "loan_id is required",
    });
  }

  db.query(
    `UPDATE momo_details
     SET loan_status = 'rejected',
         is_deleted = 1
     WHERE loan_id = ?`,
    [loan_id],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({
          error: "Database error",
        });
      }

      console.log(result);

      if (result.affectedRows === 0) {
        return res.status(404).json({
          error: "Loan not found",
        });
      }

      res.json({
        message: "Loan rejected successfully",
        loan_id,
      });
    }
  );
});

// ===============================
// Verify customer (userId + kycCode)
// ===============================
router.post("/api/verify-customer", (req, res) => {
  let { userId, kycCode } = req.body;
  kycCode = kycCode?.trim();
  const query = `SELECT * FROM personal_kyc WHERE userId = ? AND kycCode = ?`;
  db.query(query, [userId, kycCode], (err, results) => {
    if (err || results.length === 0) return res.json({ verified: false });
    res.json({ verified: true, customer: results[0] });
  });
});






/*router.post("/api/verify-manual-customer", (req, res) => {
  let { kycCode } = req.body;
  kycCode = kycCode?.trim();
  if (!kycCode) return res.json({ verified: false });

  const query = `SELECT * FROM personal_kyc WHERE kycCode = ?`;
  db.query(query, [kycCode], (err, results) => {
    if (err || results.length === 0) return res.json({ verified: false });
    res.json({ verified: true, customer: results[0] });
  });
});*/


router.post("/api/verify-manual-customer", (req, res) => {
  let { kycCode } = req.body;
  kycCode = kycCode?.trim();
  if (!kycCode) return res.json({ verified: false });

  // Normalize: if it doesn't start with 'kyc', prepend it
  const normalized = kycCode.toLowerCase();
  const searchCode = normalized.startsWith('kyc') ? normalized : 'kyc' + normalized;

  const query = `SELECT * FROM personal_kyc WHERE LOWER(kycCode) = ?`;
  db.query(query, [searchCode], (err, results) => {
    if (err || results.length === 0) return res.json({ verified: false });
    res.json({ verified: true, customer: results[0] });
  });
});



export default router;