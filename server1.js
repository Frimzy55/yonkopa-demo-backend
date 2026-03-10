import express from "express";
import mysql from "mysql2";
import multer from "multer";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// File upload setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Normal MySQL connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Bench123$qwert", // your password
  database: "yonkopa1",
});

db.connect((err) => {
  if (err) throw err;
  console.log("✅ Connected to MySQL database");
});

// POST /api/kyc/submit
app.post(
  "/api/kyc/submit",
  upload.fields([
    { name: "payslip", maxCount: 1 },
    { name: "ghanaCardFront", maxCount: 1 },
    { name: "ghanaCardBack", maxCount: 1 },
    { name: "employmentId", maxCount: 1 },
    { name: "businessPicture", maxCount: 1 },
  ]),
  (req, res) => {
    try {
      const data = req.body;
      const files = req.files;

      const query = `
        INSERT INTO customer_kyc (
          title, firstName, middleName, lastName, dateOfBirth, gender, maritalStatus,
          nationalId, taxId, residentialLocation, residentialLandmark, spouseName,
          spouseContact, mobileNumber, email, residentialAddress, city, state, zipCode,
          employmentStatus, employerName, jobTitle, monthlyIncome, yearsInCurrentEmployment,
          workPlaceLocation, businessName, businessType, monthlyBusinessIncome,
          businessLocation, businessGpsAddress, numberOfWorkers, yearsInBusiness,
          workingCapital, payslip, ghanaCardFront, ghanaCardBack, employmentId, businessPicture
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        data.title || null,
        data.firstName || null,
        data.middleName || null,
        data.lastName || null,
        data.dateOfBirth || null,
        data.gender || null,
        data.maritalStatus || null,
        data.nationalId || null,
        data.taxId || null,
        data.residentialLocation || null,
        data.residentialLandmark || null,
        data.spouseName || null,
        data.spouseContact || null,
        data.mobileNumber || null,
        data.email || null,
        data.residentialAddress || null,
        data.city || null,
        data.state || null,
        data.zipCode || null,
        data.employmentStatus || null,
        data.employerName || null,
        data.jobTitle || null,
        data.monthlyIncome || null,
        data.yearsInCurrentEmployment || null,
        data.workPlaceLocation || null,
        data.businessName || null,
        data.businessType || null,
        data.monthlyBusinessIncome || null,
        data.businessLocation || null,
        data.businessGpsAddress || null,
        data.numberOfWorkers || null,
        data.yearsInBusiness || null,
        data.workingCapital || null,
        files.payslip?.[0]?.filename || null,
        files.ghanaCardFront?.[0]?.filename || null,
        files.ghanaCardBack?.[0]?.filename || null,
        files.employmentId?.[0]?.filename || null,
        files.businessPicture?.[0]?.filename || null,
      ];

      db.query(query, values, (err, result) => {
        if (err) {
          console.error("Insert error:", err);
          return res.status(500).json({ message: "Failed to submit KYC", error: err.message });
        }
        res.status(200).json({ message: "KYC submitted successfully" });
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

app.listen(5000, () => console.log("🚀 Server running on port 5000"));