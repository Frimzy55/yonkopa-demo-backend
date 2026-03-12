// server1.js (ES module)
import express from "express";
import mysql from "mysql2";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

// Needed to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "uploads")),
  filename: (req, file, cb) => cb(null, Date.now() + "_" + file.originalname),
});
const upload = multer({ storage });

// MySQL connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Bench123$qwert",
  database: "yonkopa1",
});

// Test connection
db.connect((err) => {
  if (err) throw err;
  console.log("Connected to MySQL!");
});

// Loan submission endpoint
app.post("/apply-loan", upload.fields([
  { name: "guarantorProfilePicture" },
  { name: "guarantorPayslip" },
  { name: "guarantorGhanaCardFront" },
  { name: "guarantorGhanaCardBack" },
  { name: "guarantorBusinessPicture" },
]), (req, res) => {
  const body = req.body;
  const files = req.files;

  const query = `
    INSERT INTO loan_applications (
      fullName, phone, email, kycCode, dob, gender, nationalId, maritalStatus, dependents,
      residentialAddress, residentialGPS, employmentStatus, loanAmount, loanPurpose, loanTerm,
      repaymentFrequency, ratePerAnnum, interest, totalInterest, numberOfPayments, monthlyPayment,
      loanFees, guarantorName, guarantorPhone, guarantorAddress, guarantorResidenceLocation,
      guarantorIdNumber, guarantorEmployeeType, guarantorRank, guarantorWorkLocation, guarantorNameOfEmployer,
      guarantorYearsInService, guarantorPayslip, guarantorGhanaCardFront, guarantorGhanaCardBack,
      guarantorBusinessName, guarantorBusinessLocation, guarantorYearsInBusiness, guarantorBusinessPicture,
      guarantorProfilePicture
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    body.fullName, body.phone, body.email, body.kycCode, body.dob, body.gender, body.nationalId, body.maritalStatus, body.dependents,
    body.residentialAddress, body.residentialGPS, body.employmentStatus, body.loanAmount, body.loanPurpose, body.loanTerm,
    body.repaymentFrequency, body.ratePerAnnum, body.interest, body.totalInterest, body.numberOfPayments, body.monthlyPayment,
    body.loanFees, body.guarantorName, body.guarantorPhone, body.guarantorAddress, body.guarantorResidenceLocation,
    body.guarantorIdNumber, body.guarantorEmployeeType, body.guarantorRank, body.guarantorWorkLocation, body.guarantorNameOfEmployer,
    body.guarantorYearsInService,
    files?.guarantorPayslip?.[0]?.filename || null,
    files?.guarantorGhanaCardFront?.[0]?.filename || null,
    files?.guarantorGhanaCardBack?.[0]?.filename || null,
    body.guarantorBusinessName, body.guarantorBusinessLocation, body.guarantorYearsInBusiness,
    files?.guarantorBusinessPicture?.[0]?.filename || null,
    files?.guarantorProfilePicture?.[0]?.filename || null,
  ];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error(err);
      return res.json({ success: false, message: err.message });
    }
    res.json({ success: true, message: "Loan submitted!" });
  });
});

app.listen(5000, () => console.log("Server running on port 5000"));