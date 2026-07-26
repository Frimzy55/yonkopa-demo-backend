import express from "express";
import { db, dbPromise } from "../config/db.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

// Get all KYC records for customer approval
/*router.get("/pending-customers", (req, res) => {
  const sql = `
    SELECT *
    FROM kyc_full_view1
    WHERE UPPER(kycCode) LIKE 'CUS%'
    ORDER BY createdat DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching KYC customers:", err);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch customers",
        error: err.message,
      });
    }

    res.json({
      success: true,
      data: results,
    });
  });
});*/



router.get("/pending-customers", (req, res) => {
  const sql = `
    SELECT *
    FROM kyc_full_view11
    WHERE UPPER(kycCode) LIKE 'CUS%'
     AND personal_deleted = 0
    AND customer_status = 'pending'
    ORDER BY createdat DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching KYC customers:", err);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch customers",
        error: err.message,
      });
    }

    res.json({
      success: true,
      data: results,
    });
  });
});


router.put("/approve/:kycCode", async (req, res) => {

  const { kycCode } = req.params;

  try {

    let customerId = null;


    // =====================================
    // CHECK EXISTING CUSTOMER ID
    // =====================================

    const [existingCustomer] = await db.promise().query(
      `
      SELECT customer_id
      FROM personal_kyc
      WHERE kycCode = ?
      AND customer_id IS NOT NULL
      LIMIT 1
      `,
      [kycCode]
    );


    if (existingCustomer.length > 0) {

      customerId = existingCustomer[0].customer_id;

    } else {


      // =====================================
      // GENERATE CUSTOMER ID
      // =====================================

      const [latestCustomer] = await db.promise().query(
        `
        SELECT customer_id
        FROM personal_kyc
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


      customerId = String(nextNumber).padStart(5, "0");

    }



    // =====================================
    // UPDATE PERSONAL KYC
    // =====================================

    await db.promise().query(
      `
      UPDATE personal_kyc
      SET customer_id = ?,
       customer_status = 'approved',
    is_deleted = 1
      WHERE kycCode = ?
      `,
      [
        customerId,
        kycCode
      ]
    );


    res.json({

      success:true,

      message:"Customer approved successfully",

      customer_id:customerId

    });



  } catch(error){

    console.error("Approve Customer Error:", error);


    res.status(500).json({

      success:false,

      message:"Approval failed"

    });

  }

});






export default router;