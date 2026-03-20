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
      const files = req.files || {};

      const query = `
        INSERT INTO customer_kyc (
          kycCode, avatar, title, firstName, middleName, lastName, dateOfBirth, gender, maritalStatus,
          nationalId, taxId, residentialLocation, residentialLandmark, spouseName, spouseContact,
          mobileNumber, email, residentialAddress, city, state, zipCode,
          employmentStatus, employerName, jobTitle, monthlyIncome, yearsInCurrentEmployment,
          workPlaceLocation, businessName, businessType, monthlyBusinessIncome,
          businessLocation, businessGpsAddress, numberOfWorkers, yearsInBusiness,
          workingCapital, payslip, ghanaCardFront, ghanaCardBack, employmentId, businessPicture, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        new Date()
      ];

      db.query(query, values, (err, result) => {
        if (err) {
          console.error("Insert error:", err);
          return res.status(500).json({
            message: "Failed to submit KYC",
            error: err.message
          });
        }

        res.status(200).json({
          message: "KYC submitted successfully",
          id: result.insertId
        });
      });

    } catch (error) {
      console.error("Server error:", error);
      res.status(500).json({
        message: "Server error",
        error: error.message
      });
    }
  }
);








































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
      const files = req.files || {};

      const query = `
        INSERT INTO customer_kyc (
          kycCode, avatar, title, firstName, middleName, lastName, dateOfBirth, gender, maritalStatus,
          nationalId, taxId, residentialLocation, residentialLandmark, spouseName, spouseContact,
          mobileNumber, email, residentialAddress, city, state, zipCode,
          employmentStatus, employerName, jobTitle, monthlyIncome, yearsInCurrentEmployment,
          workPlaceLocation, businessName, businessType, monthlyBusinessIncome,
          businessLocation, businessGpsAddress, numberOfWorkers, yearsInBusiness,
          workingCapital, payslip, ghanaCardFront, ghanaCardBack, employmentId, businessPicture,
          referenceName1, referencePhone1, referenceRelationship1,
          referenceName2, referencePhone2, referenceRelationship2, createdAt

          
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?)
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


        // ✅ NEW REFERENCES
       data.referenceName1 || null,
       data.referencePhone1 || null,
       data.referenceRelationship1 || null,
       data.referenceName2 || null,
       data.referencePhone2 || null,
       data.referenceRelationship2 || null,
        new Date()
      ];

      db.query(query, values, (err, result) => {

        if (err) {
          console.error("Insert error:", err);
          return res.status(500).json({
            message: "Failed to submit KYC",
            error: err.message
          });
        }

       // const kycId = result.insertId;

          // 🔥 Generate KYC CODE PROPERLY
        const kycId = result.insertId;
       // const kycCode = `KYC-${kycId}`;
        const kycCode = `${String(kycId).padStart(5, "0")}`;

        // 🔔 CREATE NOTIFICATION
        const notificationQuery = `
        INSERT INTO notification (userId, message, type, createdAt)
           VALUES (?, ?, ?, NOW())
         `;

        const notificationValues = [
         // kycId,
         data.userId, // ✅ correct

         //data.kycCode || null, // ✅ NEW: include KYC code
          //`KYC submitted successfully for ${data.firstName} ${data.lastName} ${data.kycCode}`,
          `Hello  ${data.firstName} ${data.lastName} Your KYC code is ${kycCode}`,
          "KYC_SUBMITTED"
        ];

        db.query(notificationQuery, notificationValues, (notifyErr) => {

          if (notifyErr) {
            console.error("Notification error:", notifyErr);
          }

          res.status(200).json({
            message: "KYC submitted successfully",
            id: kycId
          });

        });

      });

    } catch (error) {

      console.error("Server error:", error);

      res.status(500).json({
        message: "Server error",
        error: error.message
      });

    }
  }
);




app.get("/api/notifications/:userId", (req, res) => {

  const { userId } = req.params;

  const query = `
    SELECT * FROM notification
    WHERE userId = ?
    ORDER BY createdAt DESC
  `;

  db.query(query, [userId], (err, results) => {

    if (err) {
      return res.status(500).json({
        message: "Failed to fetch notifications"
      });
    }

    res.json(results);

  });

});



// ================================
app.put("/api/notifications/mark-read/:userId", (req, res) => {

  const { userId } = req.params;

  const query = `
    UPDATE notification
    SET isRead = 1
    WHERE userId = ? AND isRead = 0
  `;

  db.query(query, [userId], (err) => {

    if (err) {
      console.error(err);
      return res.status(500).json({
        message: "Failed to mark notifications as read"
      });
    }

    res.json({
      message: "Notifications marked as read"
    });

  });

});

