import express from "express";
import { db } from "../config/db.js";

const router = express.Router();

router.get("/transactions", (req, res) => {

  const { customerId } = req.query;

  console.log("Received customerId:", customerId);


  const sql = `
    SELECT *
    FROM customer_accounts_v2
    WHERE customer_id = ?
  `;


  db.query(sql, [customerId], (err, rows) => {

    if (err) {
      console.log("Database error:", err);
      return res.status(500).json({
        message: "Database error"
      });
    }


    console.log("Rows returned:", rows);


    res.json(rows);

  });

});

export default router;