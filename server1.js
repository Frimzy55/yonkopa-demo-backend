// server.js
import express from "express";
import mysql from "mysql2";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Enable CORS
app.use(cors());

// Parse JSON bodies (for non-file fields)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ---------- MySQL Connection ----------
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.getConnection((err, conn) => {
  if (err) {
    console.error("Database connection failed:", err);
  } else {
    console.log("✅ Connected to MySQL database");
    conn.release();
  }
});

// ---------- Multer Setup for File Uploads ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads"); // folder where files are stored
  },
  filename: (req, file, cb) => {
    const uniqueName = `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// ---------- KYC Submit Route ----------
app.post(
  "/api/kyc/submit",
  upload.fields([
    { name: "avatar", maxCount: 1 },
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
  kycCode, avatar, title, firstName, middleName, lastName, dateOfBirth, gender, maritalStatus,
  nationalId, taxId, residentialLocation, residentialLandmark, spouseName, spouseContact,
  mobileNumber, email, residentialAddress, city, state, zipCode,
  employmentStatus, employerName, jobTitle, monthlyIncome, yearsInCurrentEmployment,
  workPlaceLocation, businessName, businessType, monthlyBusinessIncome,
  businessLocation, businessGpsAddress, numberOfWorkers, yearsInBusiness,
  workingCapital, payslip, ghanaCardFront, ghanaCardBack, employmentId, businessPicture,
  createdAt
) VALUES (
  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
)
`;

      const values = [
        data.kycCode || null,
        files.avatar?.[0]?.filename || null,
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
        new Date(),
      ];

      db.query(query, values, (err, result) => {
        if (err) {
          console.error("Insert error:", err);
          return res.status(500).json({ message: "Failed to submit KYC", error: err.message });
        }
        res.status(200).json({ message: "KYC submitted successfully", id: result.insertId });
      });
    } catch (error) {
      console.error("Server error:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// ---------- Start Server ----------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));