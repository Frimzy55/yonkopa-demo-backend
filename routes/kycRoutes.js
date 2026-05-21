import express from 'express';
import { db, dbPromise } from '../config/db.js';
import { upload } from '../middleware/upload.js';
import { authenticateToken } from '../middleware/auth.js';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Save full KYC (with file uploads)
router.post(
  "/api/kyc/save-all",
  authenticateToken,
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "payslip", maxCount: 1 },
    { name: "ghanaCardFront", maxCount: 1 },
    { name: "ghanaCardBack", maxCount: 1 },
    { name: "employmentId", maxCount: 1 },
    { name: "businessPicture", maxCount: 1 },
  ]),
  async (req, res) => {
    const connection = await dbPromise.getConnection();
    try {
      await connection.beginTransaction();
      const userId = req.user.userId;
      const toNull = (v) => (v === "" || v === undefined ? null : v);
      const files = req.files || {};
      const avatarPath = files?.avatar?.[0]?.filename || null;

      // Personal KYC
      await connection.query(
        `INSERT INTO personal_kyc (userId, title, firstname, middlename, lastname, dateofbirth, gender, maritalstatus, nationalid, residentiallocation, spousename, spousecontact, avatar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title=VALUES(title), firstname=VALUES(firstname), middlename=VALUES(middlename), lastname=VALUES(lastname), dateofbirth=VALUES(dateofbirth), gender=VALUES(gender), maritalstatus=VALUES(maritalstatus), nationalid=VALUES(nationalid), residentiallocation=VALUES(residentiallocation), spousename=VALUES(spousename), spousecontact=VALUES(spousecontact), avatar=VALUES(avatar)`,
        [userId, req.body.title, req.body.firstName, req.body.middleName, req.body.lastName, req.body.dateOfBirth, req.body.gender, req.body.maritalStatus, req.body.nationalId, req.body.residentialLocation, req.body.spouseName, req.body.spouseContact, avatarPath]
      );

      const [kycRow] = await connection.query(`SELECT pid FROM personal_kyc WHERE userId = ? LIMIT 1`, [userId]);
      const pid = kycRow?.[0]?.pid;
      if (!pid) throw new Error("Failed to generate KYC ID");
      //const kycCode = String(pid).padStart(5, "0");
      const kycCode = `kyc${String(pid).padStart(5, "0")}`;
      await connection.query(`UPDATE personal_kyc SET kycCode = ? WHERE pid = ?`, [kycCode, pid]);

      // Notification
      await connection.query(`INSERT INTO notification (userId, message, type, isRead) VALUES (?, ?, ?, ?)`, [userId, `Your KYC has been submitted successfully. KYC Code: ${kycCode}`, "kyc", 0]);

      // Contact KYC
      await connection.query(
        `INSERT INTO contact_kyc (userId, mobileNumber, email, residentialAddress, residentialLandmark, city, state, alternatePhone, kyc_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE residentialAddress=VALUES(residentialAddress), residentialLandmark=VALUES(residentialLandmark), city=VALUES(city), state=VALUES(state), alternatePhone=VALUES(alternatePhone), kyc_code=VALUES(kyc_code)`,
        [userId, req.body.mobileNumber, req.body.email, req.body.residentialAddress, req.body.residentialLandmark, req.body.city, req.body.state, req.body.alternatePhone, kycCode]
      );

      // Employment KYC
      await connection.query(
        `INSERT INTO employment_kyc (userId, employmentStatus, employerName, jobTitle, monthlyIncome, yearsInCurrentEmployment, workPlaceLocation, payslip, ghanaCardFront, ghanaCardBack, employmentId, businessName, businessType, monthlyBusinessIncome, businessLocation, businessGpsAddress, numberOfWorkers, yearsInBusiness, workingCapital, businessPicture, kyc_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE employmentStatus=VALUES(employmentStatus), employerName=VALUES(employerName), jobTitle=VALUES(jobTitle), monthlyIncome=VALUES(monthlyIncome), yearsInCurrentEmployment=VALUES(yearsInCurrentEmployment), workPlaceLocation=VALUES(workPlaceLocation), payslip=VALUES(payslip), ghanaCardFront=VALUES(ghanaCardFront), ghanaCardBack=VALUES(ghanaCardBack), employmentId=VALUES(employmentId), businessName=VALUES(businessName), businessType=VALUES(businessType), monthlyBusinessIncome=VALUES(monthlyBusinessIncome), businessLocation=VALUES(businessLocation), businessGpsAddress=VALUES(businessGpsAddress), numberOfWorkers=VALUES(numberOfWorkers), yearsInBusiness=VALUES(yearsInBusiness), workingCapital=VALUES(workingCapital), businessPicture=VALUES(businessPicture), kyc_code=VALUES(kyc_code)`,
        [
          userId, req.body.employmentStatus, toNull(req.body.employerName), toNull(req.body.jobTitle), toNull(req.body.monthlyIncome), toNull(req.body.yearsInCurrentEmployment), toNull(req.body.workPlaceLocation),
          files?.payslip?.[0]?.filename || null, files?.ghanaCardFront?.[0]?.filename || null, files?.ghanaCardBack?.[0]?.filename || null, files?.employmentId?.[0]?.filename || null,
          toNull(req.body.businessName), toNull(req.body.businessType), toNull(req.body.monthlyBusinessIncome), toNull(req.body.businessLocation), toNull(req.body.businessGpsAddress), toNull(req.body.numberOfWorkers), toNull(req.body.yearsInBusiness), toNull(req.body.workingCapital),
          files?.businessPicture?.[0]?.filename || null, kycCode
        ]
      );

      // Reference KYC
      await connection.query(
        `INSERT INTO reference_kyc (userId, referenceName1, referencePhone1, referenceRelationship1, referenceName2, referencePhone2, referenceRelationship2, kyc_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE referenceName1=VALUES(referenceName1), referencePhone1=VALUES(referencePhone1), referenceRelationship1=VALUES(referenceRelationship1), referenceName2=VALUES(referenceName2), referencePhone2=VALUES(referencePhone2), referenceRelationship2=VALUES(referenceRelationship2), kyc_code=VALUES(kyc_code)`,
        [userId, req.body.referenceName1, req.body.referencePhone1, req.body.referenceRelationship1, req.body.referenceName2, req.body.referencePhone2, req.body.referenceRelationship2, kycCode]
      );

      await connection.commit();
      return res.json({ success: true, kycCode });
    } catch (err) {
      await connection.rollback();
      console.error(err);
      return res.status(500).json({ success: false, message: err.message, code: err.code || "SERVER_ERROR" });
    } finally {
      connection.release();
    }
  }
);

// Get avatar
router.get("/api/kyc/avatar/:userId", (req, res) => {
  const { userId } = req.params;
  const sql = `SELECT avatar FROM personal_kyc WHERE userId = ? LIMIT 1`;
  db.query(sql, [userId], (err, result) => {
    if (err || !result[0]?.avatar) return res.json({ success: true, avatar: null });
    const avatarPath = result[0].avatar.replace(/\\/g, "/");
    res.json({ success: true, avatar: avatarPath });
  });
});

// Check if user has KYC
router.get("/api/kyc/check/:userId", (req, res) => {
  const { userId } = req.params;
  const sql = `SELECT kycCode FROM personal_kyc WHERE userId = ? LIMIT 1`;
  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ success: false });
    if (results.length > 0 && results[0].kycCode) return res.json({ success: true, hasKyc: true, kycCode: results[0].kycCode });
    res.json({ success: true, hasKyc: false });
  });
});

// Check if national ID already exists
router.get("/api/kyc/check-national-id/:nationalId", (req, res) => {
  const nationalId = req.params.nationalId?.trim().toUpperCase();
  if (!nationalId) return res.status(400).json({ success: false, message: "National ID is required" });
  const sql = `SELECT pid FROM personal_kyc WHERE TRIM(UPPER(nationalid)) = TRIM(UPPER(?)) LIMIT 1`;
  db.query(sql, [nationalId], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: "Server error" });
    res.json({ success: true, exists: result.length > 0 });
  });
});

// Get full KYC view by userId
router.get("/api/kyc-view/:userId", (req, res) => {
  const userId = req.params.userId;
  const sql = `
    SELECT p.*, c.mobileNumber, c.email, c.residentialAddress, c.city, c.state,
           e.employmentStatus, e.employerName, e.jobTitle, e.monthlyIncome,
           e.businessName, e.businessType,
           r.referenceName1, r.referencePhone1, r.referenceRelationship1,
           r.referenceName2, r.referencePhone2, r.referenceRelationship2, r.kyc_code
    FROM personal_kyc p
    LEFT JOIN contact_kyc c ON p.userId = c.userId
    LEFT JOIN employment_kyc e ON p.userId = e.userId
    LEFT JOIN reference_kyc r ON p.userId = r.userId
    WHERE p.userId = ?
  `;
  db.query(sql, [userId], (err, result) => {
    if (err) return res.status(500).json({ success: false, error: err });
    if (result.length === 0) return res.status(404).json({ success: false, message: "No KYC found" });
    res.json({ success: true, data: result[0] });
  });
});

export default router;