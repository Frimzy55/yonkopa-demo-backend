import express from "express";
import { dbPromise } from "../config/db.js";

const router = express.Router();

// ======================================
// GET APPROVED CUSTOMER ENQUIRIES
// REMOVE DUPLICATE CUSTOMERS
router.get("/api/customer-enquiries", async (req, res) => {
  try {
    /*const [rows] = await dbPromise.query(`
      SELECT *
      FROM loan_master7 lm1
      WHERE loan_status = 'approved'
      AND loan_created_at = (
        SELECT MAX(lm2.loan_created_at)
        FROM loan_master7 lm2
        WHERE lm2.customer_id = lm1.customer_id
      )
      ORDER BY loan_created_at DESC
    `);*/


    const [rows] = await dbPromise.query(`
  SELECT *
  FROM loan_master7 lm1
  WHERE loan_status = 'approved'
  AND loan_created_at = (
    SELECT MAX(lm2.loan_created_at)
    FROM loan_master7 lm2
    WHERE lm2.customer_id = lm1.customer_id
  )
  ORDER BY CAST(customer_id AS UNSIGNED) DESC
`);

    const data = rows.map((row) => ({
      id: row.loan_id,
      enquiryId: row.loan_id,
      customerId: row.customer_id || "",

      customerName:
        row.applicant_fullName ||
        `${row.firstname || ""} ${row.lastname || ""}`.trim(),

      // ✅ FIXED AVATAR HANDLING
    avatar: row.avatar,
 
       

      contactNumber:
        row.applicant_phone ||
        row.mobileNumber ||
        row.alternatePhone ||
        row.momoNumber ||
        "",

      email: row.applicant_email || row.contact_email || "",

      dob: row.applicant_dob || row.dateofbirth || "",
      gender: row.applicant_gender || row.personal_gender || "",

      amountApproved:
        row.evaluated_loan_amount ||
        row.kyc_loan_amount ||
        row.principal ||
        0,

      approvalDate: row.approved_date
        ? new Date(row.approved_date).toISOString().split("T")[0]
        : "",

      enquiryType: "Loan Application",
      status: row.loan_status || "pending",

      dateSubmitted: row.loan_created_at
        ? new Date(row.loan_created_at).toISOString().split("T")[0]
        : "",

      assignedTo: "Not Assigned",

      response:
        row.comments ||
        row.eval_loan_purpose ||
        ""
    }));

    return res.json({
      success: true,
      count: data.length,
      data,
    });

  } catch (error) {
    console.error("GET customer enquiries error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// ======================================
// UPDATE LOAN STATUS + COMMENTS
// ======================================
router.put("/api/customer-enquiries/:loan_id", async (req, res) => {
  const { loan_id } = req.params;

  const { status, comments } = req.body;

  if (!status) {
    return res.status(400).json({
      success: false,
      message: "Status is required",
    });
  }

  try {
    const [result] = await dbPromise.query(
      `
      UPDATE loan_master7
      SET
        loan_status = ?,
        comments = ?
      WHERE loan_id = ?
      `,
      [status, comments || null, loan_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Loan not found",
      });
    }

    return res.json({
      success: true,
      message: "Loan updated successfully",
    });

  } catch (error) {
    console.error("UPDATE error:", error);

    return res.status(500).json({
      success: false,
      message: "Update failed",
    });
  }
});

export default router;