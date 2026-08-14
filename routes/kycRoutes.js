import express from 'express';
import { db, dbPromise } from '../config/db.js';
import { upload } from '../middleware/upload.js';
import { authenticateToken } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
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







// Save full KYC (with file uploads)
/*router.post(
  "/api/kyc/save-all-manual",
  
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
      //const userId = req.user?.userId || null;
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
      const kycCode = `Man${String(pid).padStart(5, "0")}`;
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
);*/

// Save full KYC (with file uploads)







router.post(
  "/api/kyc/save-all-manual",

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


      const toNull = (v) =>
        v === "" || v === undefined ? null : v;


      const files = req.files || {};

      const avatarPath =
        files?.avatar?.[0]?.filename || null;



      // ===============================
      // CREATE USER
      // ===============================

      const defaultPassword = await bcrypt.hash(
        "123456",
        10
      );


      const [userResult] = await connection.query(

        `
        INSERT INTO users
        (
          full_name,
          email,
          phone,
          password,
          role,
          user_uuid
        )
        VALUES (?, ?, ?, ?, ?, UUID())
        `,

        [
          `${req.body.firstName} ${req.body.lastName}`,
          req.body.email || null,
          req.body.mobileNumber,
          defaultPassword,
          "customer"
        ]

      );


      const userId = userResult.insertId;



      // Display customer number
      const customerCode =
        String(userId * 10).padStart(3, "0");



      // ===============================
      // PERSONAL KYC
      // ===============================


      const [personalResult] = await connection.query(

        `
        INSERT INTO personal_kyc
        (
          userId,
          title,
          firstname,
          middlename,
          lastname,
          dateofbirth,
          gender,
          maritalstatus,
          nationalid,
          residentiallocation,
          spousename,
          spousecontact,
          avatar
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,

        [

          userId,
          req.body.title,
          req.body.firstName,
          req.body.middleName,
          req.body.lastName,
          req.body.dateOfBirth,
          req.body.gender,
          req.body.maritalStatus,
          req.body.nationalId,
          req.body.residentialLocation,
          req.body.spouseName,
          req.body.spouseContact,
          avatarPath

        ]

      );


      const pid = personalResult.insertId;


      const kycCode =
        `cus${String(pid).padStart(5, "0")}`;



      await connection.query(

        `
        UPDATE personal_kyc
        SET kycCode = ?
        WHERE pid = ?
        `,

        [
          kycCode,
          pid
        ]

      );



      // ===============================
      // NOTIFICATION
      // ===============================


      await connection.query(

        `
        INSERT INTO notification
        (
          userId,
          message,
          type,
          isRead
        )
        VALUES (?, ?, ?, ?)
        `,

        [
          userId,
          `Your KYC has been submitted successfully. KYC Code: ${kycCode}`,
          "kyc",
          0
        ]

      );



      // ===============================
      // CONTACT KYC
      // ===============================


      await connection.query(

        `
        INSERT INTO contact_kyc
        (
          userId,
          mobileNumber,
          email,
          residentialAddress,
          residentialLandmark,
          city,
          state,
          alternatePhone,
          kyc_code
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,

        [
          userId,
          req.body.mobileNumber,
          req.body.email,
          req.body.residentialAddress,
          req.body.residentialLandmark,
          req.body.city,
          req.body.state,
          req.body.alternatePhone,
          kycCode
        ]

      );


      // ===============================
      // EMPLOYMENT KYC
      // ===============================


      await connection.query(

        `
        INSERT INTO employment_kyc
        (
          userId,
          employmentStatus,
          employerName,
          jobTitle,
          monthlyIncome,
          yearsInCurrentEmployment,
          workPlaceLocation,
          payslip,
          ghanaCardFront,
          ghanaCardBack,
          employmentId,
          businessName,
          businessType,
          monthlyBusinessIncome,
          businessLocation,
          businessGpsAddress,
          numberOfWorkers,
          yearsInBusiness,
          workingCapital,
          businessPicture,
          kyc_code
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `,

        [

          userId,
          req.body.employmentStatus,

          toNull(req.body.employerName),
          toNull(req.body.jobTitle),
          toNull(req.body.monthlyIncome),
          toNull(req.body.yearsInCurrentEmployment),
          toNull(req.body.workPlaceLocation),

          files?.payslip?.[0]?.filename || null,
          files?.ghanaCardFront?.[0]?.filename || null,
          files?.ghanaCardBack?.[0]?.filename || null,
          files?.employmentId?.[0]?.filename || null,

          toNull(req.body.businessName),
          toNull(req.body.businessType),
          toNull(req.body.monthlyBusinessIncome),
          toNull(req.body.businessLocation),
          toNull(req.body.businessGpsAddress),
          toNull(req.body.numberOfWorkers),
          toNull(req.body.yearsInBusiness),
          toNull(req.body.workingCapital),

          files?.businessPicture?.[0]?.filename || null,

          kycCode

        ]

      );



      // ===============================
      // REFERENCE KYC
      // ===============================


      await connection.query(

        `
        INSERT INTO reference_kyc
        (
          userId,
          referenceName1,
          referencePhone1,
          referenceRelationship1,
          referenceName2,
          referencePhone2,
          referenceRelationship2,
          kyc_code
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,

        [

          userId,
          req.body.referenceName1,
          req.body.referencePhone1,
          req.body.referenceRelationship1,
          req.body.referenceName2,
          req.body.referencePhone2,
          req.body.referenceRelationship2,
          kycCode

        ]

      );



      await connection.commit();


      return res.json({

        success:true,

        userId,

        customerCode,

        kycCode

      });



    } catch(err) {


      await connection.rollback();

      console.error(err);


      return res.status(500).json({

        success:false,

        message:err.message,

        code:err.code || "SERVER_ERROR"

      });


    } finally {

      connection.release();

    }

  }
);






// ============================================================
// SAVE FULL KYC WITH FILE UPLOADS
// ============================================================

/*router.post(
  "/api/kyc/save-all-manual",

  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "payslip", maxCount: 1 },
    { name: "ghanaCardFront", maxCount: 1 },
    { name: "ghanaCardBack", maxCount: 1 },
    { name: "employmentId", maxCount: 1 },
    { name: "businessPicture", maxCount: 1 },
  ]),

  async (req, res) => {

    const connection =
      await dbPromise.getConnection();

    try {

      await connection.beginTransaction();


      // ======================================================
      // HELPERS
      // ======================================================

      const toNull = (v) =>
        v === "" || v === undefined
          ? null
          : v;


      const files =
        req.files || {};


      // ======================================================
      // FILE PATHS
      // ======================================================

      const avatarPath =
        files?.avatar?.[0]?.filename ||
        null;


      const payslipPath =
        files?.payslip?.[0]?.filename ||
        null;


      const ghanaCardFrontPath =
        files?.ghanaCardFront?.[0]?.filename ||
        null;


      const ghanaCardBackPath =
        files?.ghanaCardBack?.[0]?.filename ||
        null;


      const employmentIdPath =
        files?.employmentId?.[0]?.filename ||
        null;


      const businessPicturePath =
        files?.businessPicture?.[0]?.filename ||
        null;


      // ======================================================
      // USER ID
      // ======================================================
      //
      // The frontend should send the existing logged-in
      // user's userId.
      //
      // Your users table is:
      //
      // users.userId INT AI PK
      //
      // ======================================================

      const userId =
        Number(req.body.userId);


      if (!userId) {

        await connection.rollback();

        return res.status(400).json({
          success: false,
          message:
            "User ID is required for KYC submission",
        });
      }


      // ======================================================
      // VERIFY USER EXISTS
      // ======================================================

      const [users] =
        await connection.query(
          `
          SELECT
            userId,
            full_name,
            email,
            phone,
            role,
            user_uuid,
            customerCode
          FROM users
          WHERE userId = ?
          LIMIT 1
          `,
          [userId]
        );


      if (users.length === 0) {

        await connection.rollback();

        return res.status(404).json({
          success: false,
          message:
            "User account not found",
        });
      }


      const existingUser =
        users[0];


      // ======================================================
      // CHECK IF KYC ALREADY EXISTS
      // ======================================================

      const [existingKyc] =
        await connection.query(
          `
          SELECT
            pid,
            kycCode
          FROM personal_kyc
          WHERE userId = ?
          LIMIT 1
          `,
          [userId]
        );


      if (existingKyc.length > 0) {

        await connection.rollback();

        return res.status(409).json({
          success: false,
          message:
            "KYC has already been submitted for this user",
          kycCode:
            existingKyc[0].kycCode,
        });
      }


      // ======================================================
      // CUSTOMER CODE
      // ======================================================
      //
      // If your users table already has customerCode,
      // preserve it.
      //
      // Otherwise generate it.
      //
      // ======================================================

      let customerCode =
        existingUser.customerCode;


      if (!customerCode) {

        customerCode =
          String(
            userId * 10
          ).padStart(
            3,
            "0"
          );


        await connection.query(
          `
          UPDATE users
          SET customerCode = ?
          WHERE userId = ?
          `,
          [
            customerCode,
            userId,
          ]
        );
      }


      // ======================================================
      // PERSONAL KYC
      // ======================================================

      const [
        personalResult,
      ] =
        await connection.query(

          `
          INSERT INTO personal_kyc
          (
            userId,
            title,
            firstname,
            middlename,
            lastname,
            dateofbirth,
            gender,
            maritalstatus,
            nationalid,
            residentiallocation,
            spousename,
            spousecontact,
            avatar
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,

          [

            userId,

            req.body.title ||
              null,

            req.body.firstName ||
              null,

            req.body.middleName ||
              null,

            req.body.lastName ||
              null,

            req.body.dateOfBirth ||
              null,

            req.body.gender ||
              null,

            req.body.maritalStatus ||
              null,

            req.body.nationalId ||
              null,

            req.body.residentialLocation ||
              null,

            req.body.spouseName ||
              null,

            req.body.spouseContact ||
              null,

            avatarPath,

          ]
        );


      // ======================================================
      // PERSONAL KYC ID
      // ======================================================

      const pid =
        personalResult.insertId;


      // ======================================================
      // KYC CODE
      // ======================================================

      const kycCode =
        `Cus${String(
          pid
        ).padStart(
          5,
          "0"
        )}`;


      // ======================================================
      // UPDATE KYC CODE
      // ======================================================

      await connection.query(

        `
        UPDATE personal_kyc
        SET kycCode = ?
        WHERE pid = ?
        `,

        [
          kycCode,
          pid,
        ]
      );


      // ======================================================
      // NOTIFICATION
      // ======================================================

      await connection.query(

        `
        INSERT INTO notification
        (
          userId,
          message,
          type,
          isRead
        )
        VALUES (?, ?, ?, ?)
        `,

        [

          userId,

          `Your KYC has been submitted successfully. KYC Code: ${kycCode}`,

          "kyc",

          0,

        ]
      );


      // ======================================================
      // CONTACT KYC
      // ======================================================

      await connection.query(

        `
        INSERT INTO contact_kyc
        (
          userId,
          mobileNumber,
          email,
          residentialAddress,
          residentialLandmark,
          city,
          state,
          alternatePhone,
          kyc_code
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,

        [

          userId,

          req.body.mobileNumber ||
            null,

          req.body.email ||
            null,

          req.body.residentialAddress ||
            null,

          req.body.residentialLandmark ||
            null,

          req.body.city ||
            null,

          req.body.state ||
            null,

          req.body.alternatePhone ||
            null,

          kycCode,

        ]
      );


      // ======================================================
      // EMPLOYMENT KYC
      // ======================================================

      await connection.query(

        `
        INSERT INTO employment_kyc
        (
          userId,
          employmentStatus,
          employerName,
          jobTitle,
          monthlyIncome,
          yearsInCurrentEmployment,
          workPlaceLocation,
          payslip,
          ghanaCardFront,
          ghanaCardBack,
          employmentId,
          businessName,
          businessType,
          monthlyBusinessIncome,
          businessLocation,
          businessGpsAddress,
          numberOfWorkers,
          yearsInBusiness,
          workingCapital,
          businessPicture,
          kyc_code
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
        `,

        [

          userId,

          req.body.employmentStatus ||
            null,

          toNull(
            req.body.employerName
          ),

          toNull(
            req.body.jobTitle
          ),

          toNull(
            req.body.monthlyIncome
          ),

          toNull(
            req.body.yearsInCurrentEmployment
          ),

          toNull(
            req.body.workPlaceLocation
          ),

          payslipPath,

          ghanaCardFrontPath,

          ghanaCardBackPath,

          employmentIdPath,

          toNull(
            req.body.businessName
          ),

          toNull(
            req.body.businessType
          ),

          toNull(
            req.body.monthlyBusinessIncome
          ),

          toNull(
            req.body.businessLocation
          ),

          toNull(
            req.body.businessGpsAddress
          ),

          toNull(
            req.body.numberOfWorkers
          ),

          toNull(
            req.body.yearsInBusiness
          ),

          toNull(
            req.body.workingCapital
          ),

          businessPicturePath,

          kycCode,

        ]
      );


      // ======================================================
      // REFERENCE KYC
      // ======================================================

      await connection.query(

        `
        INSERT INTO reference_kyc
        (
          userId,
          referenceName1,
          referencePhone1,
          referenceRelationship1,
          referenceName2,
          referencePhone2,
          referenceRelationship2,
          kyc_code
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,

        [

          userId,

          req.body.referenceName1 ||
            null,

          req.body.referencePhone1 ||
            null,

          req.body.referenceRelationship1 ||
            null,

          req.body.referenceName2 ||
            null,

          req.body.referencePhone2 ||
            null,

          req.body.referenceRelationship2 ||
            null,

          kycCode,

        ]
      );


      // ======================================================
      // MARK DRAFT AS SUBMITTED
      // ======================================================
      //
      // The frontend sends:
      //
      // draftUuid
      //
      // Example:
      //
      // draftUuid = "kyc-8e8b8f7a-..."
      //
      // ======================================================

      const draftUuid =
        req.body.draftUuid ||
        null;


      if (draftUuid) {

        await connection.query(

          `
          UPDATE kyc_drafts
          SET
            status = 'submitted',
            updated_at = CURRENT_TIMESTAMP
          WHERE draft_uuid = ?
          AND userId = ?
          AND status = 'draft'
          `,

          [
            draftUuid,
            userId,
          ]
        );
      }


      // ======================================================
      // COMMIT
      // ======================================================

      await connection.commit();


      // ======================================================
      // SUCCESS
      // ======================================================

      return res.json({

        success: true,

        message:
          "KYC submitted successfully",

        userId,

        customerCode,

        kycCode,

        draftUuid,

      });


    } catch (err) {


      // ======================================================
      // ROLLBACK
      // ======================================================

      try {

        await connection.rollback();

      } catch (
        rollbackError
      ) {

        console.error(
          "Rollback error:",
          rollbackError
        );
      }


      // ======================================================
      // LOG
      // ======================================================

      console.error(
        "KYC SUBMISSION ERROR:",
        err
      );


      // ======================================================
      // RESPONSE
      // ======================================================

      return res.status(500).json({

        success: false,

        message:
          err.message ||
          "Failed to submit KYC",

        code:
          err.code ||
          "SERVER_ERROR",

      });


    } finally {

      connection.release();

    }

  }
);
*/











// ============================================================
// SAVE FULL KYC WITH FILE UPLOADS – NO USER CREATION
// ============================================================

router.post(
  "/api/kyc/save-all-online",

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

      // ======================================================
      // HELPERS
      // ======================================================

      const toNull = (v) =>
        v === "" || v === undefined ? null : v;

      const files = req.files || {};

      // ======================================================
      // FILE PATHS
      // ======================================================

      const avatarPath = files?.avatar?.[0]?.filename || null;
      const payslipPath = files?.payslip?.[0]?.filename || null;
      const ghanaCardFrontPath = files?.ghanaCardFront?.[0]?.filename || null;
      const ghanaCardBackPath = files?.ghanaCardBack?.[0]?.filename || null;
      const employmentIdPath = files?.employmentId?.[0]?.filename || null;
      const businessPicturePath = files?.businessPicture?.[0]?.filename || null;

      // ======================================================
      // USER ID
      // ======================================================

      const userId = Number(req.body.userId);

      if (!userId) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "User ID is required for KYC submission",
        });
      }

      // ======================================================
      // VERIFY USER EXISTS (NO INSERT)
      // ======================================================

      const [users] = await connection.query(
        `
        SELECT userId, full_name, email, phone, role, user_uuid, customerCode
        FROM users
        WHERE userId = ?
        LIMIT 1
        `,
        [userId]
      );

      if (users.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: "User account not found",
        });
      }

      const existingUser = users[0];

      // ======================================================
      // CHECK IF KYC ALREADY EXISTS
      // ======================================================

      const [existingKyc] = await connection.query(
        `
        SELECT pid, kycCode
        FROM personal_kyc
        WHERE userId = ?
        LIMIT 1
        `,
        [userId]
      );

      if (existingKyc.length > 0) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: "KYC has already been submitted for this user",
          kycCode: existingKyc[0].kycCode,
        });
      }

      // ======================================================
      // CUSTOMER CODE
      // ======================================================

      let customerCode = existingUser.customerCode;

      if (!customerCode) {
        customerCode = String(userId * 10).padStart(3, "0");

        await connection.query(
          `
          UPDATE users
          SET customerCode = ?
          WHERE userId = ?
          `,
          [customerCode, userId]
        );
      }

      // ======================================================
      // PERSONAL KYC
      // ======================================================

      const [personalResult] = await connection.query(
        `
        INSERT INTO personal_kyc
        (
          userId,
          title,
          firstname,
          middlename,
          lastname,
          dateofbirth,
          gender,
          maritalstatus,
          nationalid,
          residentiallocation,
          spousename,
          spousecontact,
          avatar
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          userId,
          req.body.title || null,
          req.body.firstName || null,
          req.body.middleName || null,
          req.body.lastName || null,
          req.body.dateOfBirth || null,
          req.body.gender || null,
          req.body.maritalStatus || null,
          req.body.nationalId || null,
          req.body.residentialLocation || null,
          req.body.spouseName || null,
          req.body.spouseContact || null,
          avatarPath,
        ]
      );

      const pid = personalResult.insertId;

      // ======================================================
      // KYC CODE
      // ======================================================

      const kycCode = `kyc${String(pid).padStart(5, "0")}`;

      await connection.query(
        `
        UPDATE personal_kyc
        SET kycCode = ?
        WHERE pid = ?
        `,
        [kycCode, pid]
      );

      // ======================================================
      // NOTIFICATION
      // ======================================================

      await connection.query(
        `
        INSERT INTO notification
        (
          userId,
          message,
          type,
          isRead
        )
        VALUES (?, ?, ?, ?)
        `,
        [
          userId,
          `Your KYC has been submitted successfully. KYC Code: ${kycCode}`,
          "kyc",
          0,
        ]
      );

      // ======================================================
      // CONTACT KYC
      // ======================================================

      await connection.query(
        `
        INSERT INTO contact_kyc
        (
          userId,
          mobileNumber,
          email,
          residentialAddress,
          residentialLandmark,
          city,
          state,
          alternatePhone,
          kyc_code
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          userId,
          req.body.mobileNumber || null,
          req.body.email || null,
          req.body.residentialAddress || null,
          req.body.residentialLandmark || null,
          req.body.city || null,
          req.body.state || null,
          req.body.alternatePhone || null,
          kycCode,
        ]
      );

      // ======================================================
      // EMPLOYMENT KYC
      // ======================================================

      await connection.query(
        `
        INSERT INTO employment_kyc
        (
          userId,
          employmentStatus,
          employerName,
          jobTitle,
          monthlyIncome,
          yearsInCurrentEmployment,
          workPlaceLocation,
          payslip,
          ghanaCardFront,
          ghanaCardBack,
          employmentId,
          businessName,
          businessType,
          monthlyBusinessIncome,
          businessLocation,
          businessGpsAddress,
          numberOfWorkers,
          yearsInBusiness,
          workingCapital,
          businessPicture,
          kyc_code
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
        `,
        [
          userId,
          req.body.employmentStatus || null,
          toNull(req.body.employerName),
          toNull(req.body.jobTitle),
          toNull(req.body.monthlyIncome),
          toNull(req.body.yearsInCurrentEmployment),
          toNull(req.body.workPlaceLocation),
          payslipPath,
          ghanaCardFrontPath,
          ghanaCardBackPath,
          employmentIdPath,
          toNull(req.body.businessName),
          toNull(req.body.businessType),
          toNull(req.body.monthlyBusinessIncome),
          toNull(req.body.businessLocation),
          toNull(req.body.businessGpsAddress),
          toNull(req.body.numberOfWorkers),
          toNull(req.body.yearsInBusiness),
          toNull(req.body.workingCapital),
          businessPicturePath,
          kycCode,
        ]
      );

      // ======================================================
      // REFERENCE KYC
      // ======================================================

      await connection.query(
        `
        INSERT INTO reference_kyc
        (
          userId,
          referenceName1,
          referencePhone1,
          referenceRelationship1,
          referenceName2,
          referencePhone2,
          referenceRelationship2,
          kyc_code
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          userId,
          req.body.referenceName1 || null,
          req.body.referencePhone1 || null,
          req.body.referenceRelationship1 || null,
          req.body.referenceName2 || null,
          req.body.referencePhone2 || null,
          req.body.referenceRelationship2 || null,
          kycCode,
        ]
      );

      // ======================================================
      // MARK DRAFT AS SUBMITTED
      // ======================================================

      const draftUuid = req.body.draftUuid || null;

      if (draftUuid) {
        await connection.query(
          `
          UPDATE kyc_drafts
          SET status = 'submitted', updated_at = CURRENT_TIMESTAMP
          WHERE draft_uuid = ?
          AND userId = ?
          AND status = 'draft'
          `,
          [draftUuid, userId]
        );
      }

      // ======================================================
      // COMMIT
      // ======================================================

      await connection.commit();

      return res.json({
        success: true,
        message: "KYC submitted successfully",
        userId,
        customerCode,
        kycCode,
        draftUuid,
      });
    } catch (err) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Rollback error:", rollbackError);
      }

      console.error("KYC SUBMISSION ERROR:", err);

      return res.status(500).json({
        success: false,
        message: err.message || "Failed to submit KYC",
        code: err.code || "SERVER_ERROR",
      });
    } finally {
      connection.release();
    }
  }
);




























// =============================================================
//  SAVE DRAFT  (POST /api/kyc/save-draft)
// =============================================================
router.post('/api/kyc/save-draft', async (req, res) => {
  const connection = await dbPromise.getConnection();
  try {
    const { userId, draftUuid, formData, currentStep } = req.body;

    if (!userId || !draftUuid) {
      return res.status(400).json({ success: false, message: 'Missing userId or draftUuid' });
    }

    // Check if draft already exists for this user + uuid
    const [existing] = await connection.query(
      `SELECT id FROM kyc_drafts WHERE userId = ? AND draft_uuid = ?`,
      [userId, draftUuid]
    );

    if (existing.length > 0) {
      // Update existing draft
      await connection.query(
        `UPDATE kyc_drafts
         SET form_data = ?, current_step = ?, updated_at = CURRENT_TIMESTAMP
         WHERE userId = ? AND draft_uuid = ?`,
        [JSON.stringify(formData), currentStep, userId, draftUuid]
      );
    } else {
      // Insert new draft (status defaults to 'draft')
      await connection.query(
        `INSERT INTO kyc_drafts (userId, draft_uuid, form_data, current_step, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'draft', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [userId, draftUuid, JSON.stringify(formData), currentStep]
      );
    }

    await connection.commit();
    res.json({ success: true, message: 'Draft saved' });
  } catch (err) {
    await connection.rollback();
    console.error('Draft save error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
});

// =============================================================
//  LOAD DRAFT  (GET /api/kyc/draft/:draftUuid)
//  Expects userId as a query param (or via auth middleware)
// =============================================================
router.get('/api/kyc/draft/:draftUuid', async (req, res) => {
  const connection = await dbPromise.getConnection();
  try {
    const { draftUuid } = req.params;
    // If you have authentication middleware, use req.user.userId instead.
    // Here we read userId from query for simplicity – adjust as needed.
    const userId = req.query.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized: missing userId' });
    }

    const [rows] = await connection.query(
      `SELECT draft_uuid, form_data, current_step, status
       FROM kyc_drafts
       WHERE userId = ? AND draft_uuid = ? AND status = 'draft'`,
      [userId, draftUuid]
    );

    if (rows.length === 0) {
      // No draft – return 404 so frontend knows nothing to load
      return res.status(404).json({ success: false, message: 'Draft not found' });
    }

    const draft = rows[0];
    // Parse form_data if stored as JSON string
    const formData = typeof draft.form_data === 'string'
      ? JSON.parse(draft.form_data)
      : draft.form_data;

    res.json({
      success: true,
      draft: {
        draftUuid: draft.draft_uuid,
        formData,
        currentStep: draft.current_step,
        status: draft.status,
      }
    });
  } catch (err) {
    console.error('Draft load error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
});
// Save full KYC (Manual – auto‑creates a user)


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