
import express from 'express';
import mysql from 'mysql2';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';   // ✅ ADD THIS
//import kycRoutes from "./routes/kycRoutes.js";
//import loanRoutes from "./routes/loanRoutes.js";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
//import { connect } from 'http2';
//import { useId } from 'react';
import fs from "fs";
//import http from "http";
//import { Server } from "socket.io";

//import loanRoutes from "./routes/loanRoutes.js";


// ✅ Load environment variables
dotenv.config();



// ✅ Create __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ✅ Use env port
const PORT = process.env.PORT || 5000;

// ✅ Use JWT secret from en
//const JWT_SECRET = process.env.JWT_SECRET
const JWT_SECRET = process.env.NODE_ENV === "development" 
  ? process.env.JWT_SECRET_DEV
  : process.env.JWT_SECRET_PROD;

const PAYSTACK_SECRET_KEY = process.env.NODE_ENV === "development" 
  ? process.env.PAYSTACK_SECRET_KEY_DEV
  : process.env.PAYSTACK_SECRET_KEY_PROD;

//app.use(cors());
app.use(bodyParser.json());
app.use(express.json());


//import cors from "cors";

/*app.use(cors({
  origin: "http://localhost:3000", // during development
  credentials: true
}));*/

/*app.use(cors({
  origin: "https://yonkopa-frontend-app.vercel.app",
  credentials: true
}));8/




//const cors = require("cors");

/*const allowedOrigin = process.env.NODE_ENV === "development"
  ? process.env.FRONTEND_URL_DEV
  : process.env.FRONTEND_URL_PROD;

app.use(cors({
  origin: allowedOrigin,
  credentials: true
}));*/
//app.options('*', cors());
const allowedOrigins = [
  "http://localhost:3000",
  "https://yonkopa-frontend.vercel.app",
  "https://yonkopa-frontend-app.vercel.app"
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.log("Blocked by CORS:", origin);
      return callback(null, true); // ✅ DON'T throw error
    }
  },
  credentials: true
}));

app.use(cors({
  origin: true,
  credentials: true
}));




// ✅ Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
//app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
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


/*const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});




db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Database connection failed:", err);
  } else {
    console.log("✅ Connected to MySQL database");
    connection.release();
  }
});
*/


//import mysql from "mysql2";

const dbConfig = process.env.NODE_ENV === "development" 
  ? {
      host: process.env.DB_HOST_DEV,
      user: process.env.DB_USER_DEV,
      password: process.env.DB_PASSWORD_DEV,
      database: process.env.DB_NAME_DEV,
      port: process.env.DB_PORT_DEV,
    }
  : {
      host: process.env.DB_HOST_PROD,
      user: process.env.DB_USER_PROD,
      password: process.env.DB_PASSWORD_PROD,
      database: process.env.DB_NAME_PROD,
      port: process.env.DB_PORT_PROD,
    };

const db = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Database connection failed:", err);
  } else {
    console.log("✅ Connected to MySQL database");
    connection.release();
  }
});

export default db;






// --- SIGNUP customer ENDPOINT --
app.post('/signup', async (req, res) => {
  const { fullName, identifier, password, confirmPassword, role } = req.body;

  // Check password match
  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  try {
    let email = null;
    let phone = null;

    // Detect if identifier is email or phone
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const isPhone = /^\d{10}$/.test(identifier.replace(/\D/g, ""));

    if (isEmail) {
      email = identifier;
    } else if (isPhone) {
      phone = identifier.replace(/\D/g, "");
    } else {
      return res.status(400).json({
        message: "Enter a valid email or 10-digit phone number"
      });
    }

    // Clean phone if exists
    const cleanPhone = phone;

    // 1️⃣ Check if user already exists
    const checkUserSql =
      "SELECT email, phone FROM users WHERE email = ? OR phone = ?";

    db.query(checkUserSql, [email, cleanPhone], async (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Database error" });
      }

      if (results.length > 0) {
        const existingUser = results[0];

        if (email && existingUser.email === email) {
          return res.status(400).json({
            message: "Email already registered. Please login."
          });
        }

        if (cleanPhone && existingUser.phone === cleanPhone) {
          return res.status(400).json({
            message: "Phone number already registered."
          });
        }
      }

      // 2️⃣ Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      const userRole = role || "customer";

      // 3️⃣ Insert new user
      const insertSql = `
        INSERT INTO users (full_name, email, phone, password, role)
        VALUES (?, ?, ?, ?, ?)
      `;

      db.query(
        insertSql,
        [fullName, email, cleanPhone, hashedPassword, userRole],
        (err, result) => {
          if (err) {
            console.error("Insert error:", err);
            return res.status(500).json({
              message: "Error creating account"
            });
          }

          res.status(201).json({
            message: "Account created successfully!",
            role: userRole
          });
        }
      );
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Signup admin endpoint
app.post('/signup1', async (req, res) => {
  const { full_name, email, phone, password, role } = req.body;

  if (!full_name || !email || !phone || !password || !role) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert into MySQL
    const query = `INSERT INTO users (full_name, email, phone, password, role, created_at) VALUES (?, ?, ?, ?, ?, NOW())`;
    db.query(query, [full_name, email, phone, hashedPassword, role], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Database error' });
      }
      res.status(200).json({ message: 'User registered successfully!' });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});







// --- LOGIN ENDPOINT ---
// --- LOGIN ENDPOINT ---
app.post('/login', (req, res) => {
  const { identifier, password } = req.body; // identifier can be email or phone

  // SQL: check if either email or phone matches
  const sql = 'SELECT * FROM users WHERE email = ? OR phone = ?';
  db.query(sql, [identifier, identifier], async (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Server error' });
    }

    if (results.length === 0)
      return res.status(404).json({ message: 'User not found' });

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch)
      return res.status(401).json({ message: 'Invalid credentials' });


    // Update status to 'online'
   // db.query("UPDATE users SET status='online', last_login=NOW() WHERE userId=?", [user.userId], (err2) => {
      //if (err2) console.error("Error updating status:", err2);
    //});

    // Create JWT token with role info
    const token = jwt.sign(
      { userId: user.userId, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        userId: user.userId,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  });
});





// CHANGE PASSWORD API
app.post("/api/change-password", (req, res) => {

  const { userId, currentPassword, newPassword } = req.body;

  if (!userId || !currentPassword || !newPassword) {
    return res.status(400).json({
      message: "All fields are required"
    });
  }

  // Get user from database
  const sql = "SELECT password FROM users WHERE id = ?";

  db.query(sql, [userId], async (err, result) => {

    if (err) {
      return res.status(500).json({
        message: "Database error"
      });
    }

    if (result.length === 0) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const storedPassword = result[0].password;

    // Compare current password
    const isMatch = await bcrypt.compare(currentPassword, storedPassword);

    if (!isMatch) {
      return res.status(400).json({
        message: "Current password is incorrect"
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updateSql = "UPDATE users SET password = ? WHERE id = ?";

    db.query(updateSql, [hashedPassword, userId], (err) => {

      if (err) {
        return res.status(500).json({
          message: "Failed to update password"
        });
      }

      res.json({
        message: "Password updated successfully"
      });

    });

  });

});













// --- AUTH MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) return res.status(401).json({ message: 'Access denied: No token provided' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.user = user; // attaches user data (id, email, role)
    next();
  });
};

// --- ROLE AUTHORIZATION MIDDLEWARE ---
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied: Unauthorized role' });
    }
    next();
  };
};

// --- PROTECTED ROUTES ---
app.get('/profile', authenticateToken, (req, res) => {
  res.json({
    message: `Welcome ${req.user.email}, your role is ${req.user.role}`,
    user: req.user
  });
});

// Only admin can access this route
app.get('/admin/dashboard', authenticateToken, authorizeRoles('admin'), (req, res) => {
  res.json({ message: 'Welcome Admin, this is your dashboard.' });
});

// Only loan officer or admin can access this route
app.get('/loan/management', authenticateToken, authorizeRoles('loan_officer','supervisor', 'manager','admin'), (req, res) => {
  res.json({ message: 'Loan management area accessed successfully.' });
});




app.use("/uploads", express.static("uploads"));

//app.use("/api/kyc", kycRoutes);

//app.use("/api/loan", loanRoutes);

//GET all customers
app.get("/api/customers/all", (req, res) => {
  const sql = `
    SELECT id, kycCode, firstName, middleName, lastName, dateOfBirth, gender,
           mobileNumber, email, city, employmentStatus, monthlyIncome
    FROM customer_kyc
    ORDER BY createdAt DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database query failed" });
    }
    res.json(results);
  });
});







// GET ALL LOAN APPLICATIONS
app.get("/api/admin/loan-progress", (req, res) => {

  const sql = `
    SELECT 
     *
    FROM loan_applications
    ORDER BY createdAt DESC
  `;

  db.query(sql, (err, results) => {

    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    res.json(results);

  });

});







app.post("/api/verify-customer",(req, res) => {
  const { userId, kycCode } = req.body;

  const query = `
  SELECT * 
   FROM personal_kyc
    WHERE userId = ? AND kycCode = ?;
  `;

  db.query(query, [userId, kycCode], (err, results) => {
    if (err) {
      console.error("Verify customer error:", err);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.length === 0) {
      return res.json({ verified: false });
    }

    res.json({
      verified: true,
      customer: results[0], // full joined data
    });
  });
});




app.get("/userss",authenticateToken,(req, res) => {
  const sql = `
    SELECT id, full_name, email, phone, role, created_at
    FROM users
    WHERE role IN ('customer')
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});





app.get("/users",authenticateToken, (req, res) => {
  const sql = `
    SELECT id, full_name, email, phone, role, created_at
    FROM users
    WHERE role IN ('admin', 'loan_officer')
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

// GET single user by ID (optional)
app.get("/users/:id", (req, res) => {
  const { id } = req.params;
  const sql = "SELECT id, full_name, email, phone, role, created_at FROM users WHERE id = ?";
  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results[0]);
  });
});

// CREATE user
app.post("/users", async (req, res) => {
  const { full_name, email, phone, password, role } = req.body;

  // Hash 
  const hashedPassword = await bcrypt.hash(password, 10);

  const sql = "INSERT INTO users (full_name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)";
  db.query(sql, [full_name, email, phone, hashedPassword, role], (err, results) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "User created", id: results.insertId });
  });
});

// UPDATE user
app.put("/users/:id", async (req, res) => {
  const { id } = req.params;
  const { full_name, email, phone, password, role } = req.body;

  let sql, params;
  if (password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    sql = "UPDATE users SET full_name=?, email=?, phone=?, password=?, role=? WHERE id=?";
    params = [full_name, email, phone, hashedPassword, role, id];
  } else {
    sql = "UPDATE users SET full_name=?, email=?, phone=?, role=? WHERE id=?";
    params = [full_name, email, phone, role, id];
  }

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "User updated" });
  });
});

// DELETE user
app.delete("/users/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM users WHERE id=?";
  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "User deleted" });
  });
});



// ✅ CREATE UPLOADS FOLDER IF NOT EXISTS
// ==============================
const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// ==============================
// ✅ MULTER CONFIG
// ==============================

app.post("/api/kyc/save-all", authenticateToken, upload.fields([
  { name: "avatar", maxCount: 1 },
  { name: "payslip", maxCount: 1 },
  { name: "ghanaCardFront", maxCount: 1 },
  { name: "ghanaCardBack", maxCount: 1 },
  { name: "employmentId", maxCount: 1 },
  { name: "businessPicture", maxCount: 1 },
]), async (req, res) => {
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();

   // const { userId } = req.body;
   const userId = req.user.userId; // ✅ SECURE
    const toNull = (v) => (v === "" ? null : v);

    // ==================
    // 1. Personal Info
    // ==================
    const avatarPath = req.files.avatar?.[0]?.filename || null;

    await connection.query(`
      INSERT INTO personal_kyc (
        userId, title, firstname, middlename, lastname, dateofbirth, gender, maritalstatus, nationalid, residentiallocation, spousename, spousecontact, avatar
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        title=VALUES(title),
        firstname=VALUES(firstname),
        middlename=VALUES(middlename),
        lastname=VALUES(lastname),
        dateofbirth=VALUES(dateofbirth),
        gender=VALUES(gender),
        maritalstatus=VALUES(maritalstatus),
        nationalid=VALUES(nationalid),
        residentiallocation=VALUES(residentiallocation),
        spousename=VALUES(spousename),
        spousecontact=VALUES(spousecontact),
        avatar=VALUES(avatar)
    `, [
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
    ]);

    // ==================
    // Generate KYC Code
    // ==================
    // Fetch the personal_kyc ID (auto-increment)
    const [kycResult] = await connection.query(`
      SELECT pid FROM personal_kyc WHERE userId = ? LIMIT 1
    `, [userId]);

   // const kycId = kycResult[0]?.id || 1;
   const kycId = kycResult[0]?.pid || 1;
    const kycCode = String(kycId).padStart(5, '0'); // "00001"

    // Update personal_kyc with generated code
    await connection.query(`
      UPDATE personal_kyc SET kycCode = ? WHERE userId = ?
    `, [kycCode, userId]);



    const message = `Your KYC has been submitted successfully. KYC Code: ${kycCode}`;
    const notificationSql = `
      INSERT INTO notification (userId, message, type, isRead)
      VALUES (?, ?, ?, ?)
`;
    await connection.query(notificationSql, [userId, message, 'kyc', 0]);

    // ==================
    // 2. Contact Info
    // ==================
    await connection.query(`
      INSERT INTO contact_kyc (userId, mobileNumber, email, residentialAddress, residentialLandmark, city, state, alternatePhone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        residentialAddress=VALUES(residentialAddress),
        residentialLandmark=VALUES(residentialLandmark),
        city=VALUES(city),
        state=VALUES(state),
        alternatePhone=VALUES(alternatePhone)
    `, [
      userId,
      req.body.mobileNumber,
      req.body.email,
      req.body.residentialAddress,
      req.body.residentialLandmark,
      req.body.city,
      req.body.state,
      req.body.alternatePhone
    ]);

    // ==================
    // 3. Employment Info
    // ==================
    await connection.query(`
      INSERT INTO employment_kyc (
        userId, employmentStatus, employerName, jobTitle, monthlyIncome, yearsInCurrentEmployment, workPlaceLocation, payslip, ghanaCardFront, ghanaCardBack, employmentId, businessName, businessType, monthlyBusinessIncome, businessLocation, businessGpsAddress, numberOfWorkers, yearsInBusiness, workingCapital, businessPicture
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        employmentStatus=VALUES(employmentStatus),
        employerName=VALUES(employerName),
        jobTitle=VALUES(jobTitle),
        monthlyIncome=VALUES(monthlyIncome),
        yearsInCurrentEmployment=VALUES(yearsInCurrentEmployment),
        workPlaceLocation=VALUES(workPlaceLocation),
        payslip=VALUES(payslip),
        ghanaCardFront=VALUES(ghanaCardFront),
        ghanaCardBack=VALUES(ghanaCardBack),
        employmentId=VALUES(employmentId),
        businessName=VALUES(businessName),
        businessType=VALUES(businessType),
        monthlyBusinessIncome=VALUES(monthlyBusinessIncome),
        businessLocation=VALUES(businessLocation),
        businessGpsAddress=VALUES(businessGpsAddress),
        numberOfWorkers=VALUES(numberOfWorkers),
        yearsInBusiness=VALUES(yearsInBusiness),
        workingCapital=VALUES(workingCapital),
        businessPicture=VALUES(businessPicture)
    `, [
      userId,
      req.body.employmentStatus,
      toNull(req.body.employerName),
      toNull(req.body.jobTitle),
      toNull(req.body.monthlyIncome),
      toNull(req.body.yearsInCurrentEmployment),
      toNull(req.body.workPlaceLocation),
      req.files.payslip?.[0]?.filename || null,
      req.files.ghanaCardFront?.[0]?.filename || null,
      req.files.ghanaCardBack?.[0]?.filename || null,
      req.files.employmentId?.[0]?.filename || null,
      toNull(req.body.businessName),
      toNull(req.body.businessType),
      toNull(req.body.monthlyBusinessIncome),
      toNull(req.body.businessLocation),
      toNull(req.body.businessGpsAddress),
      toNull(req.body.numberOfWorkers),
      toNull(req.body.yearsInBusiness),
      toNull(req.body.workingCapital),
      req.files.businessPicture?.[0]?.filename || null
    ]);

    // ==================
    // 4. Reference Info
    // ==================
    await connection.query(`
      INSERT INTO reference_kyc (userId, referenceName1, referencePhone1, referenceRelationship1, referenceName2, referencePhone2, referenceRelationship2)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        referenceName1=VALUES(referenceName1),
        referencePhone1=VALUES(referencePhone1),
        referenceRelationship1=VALUES(referenceRelationship1),
        referenceName2=VALUES(referenceName2),
        referencePhone2=VALUES(referencePhone2),
        referenceRelationship2=VALUES(referenceRelationship2)
    `, [
      userId,
      req.body.referenceName1,
      req.body.referencePhone1,
      req.body.referenceRelationship1,
      req.body.referenceName2,
      req.body.referencePhone2,
      req.body.referenceRelationship2
    ]);

    await connection.commit();

    res.json({ success: true, kycCode });
  } catch (err) {
    console.error("Transaction error:", err);
    await connection.rollback();
    res.status(500).json({ success: false, message: "Failed to save KYC" });
  } finally {
    connection.release();
  }
});





app.get("/api/kyc/avatar/:userId", (req, res) => {
  const { userId } = req.params;

  const sql = `SELECT avatar FROM personal_kyc WHERE userId = ? LIMIT 1`;

  db.query(sql, [userId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false });
    }

    if (!result[0] || !result[0].avatar) {
      return res.json({ success: true, avatar: null });
    }

    // Fix backslashes for URLs
    const avatarPath = result[0].avatar.replace(/\\/g, "/");

    res.json({ success: true, avatar: avatarPath });
  });
});




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






app.get("/api/kyc/check/:userId", (req, res) => {
  const { userId } = req.params;

  const sql = `
    SELECT kycCode 
    FROM personal_kyc 
    WHERE userId = ?
    LIMIT 1
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false });
    }

    if (results.length > 0 && results[0].kycCode) {
      return res.json({
        success: true,
        hasKyc: true,
        kycCode: results[0].kycCode,
      });
    }

    res.json({
      success: true,
      hasKyc: false,
    });
  });
});















app.put("/api/notifications/mark-read/:userId", (req, res) => {
  const { userId } = req.params;

  const query = `
    UPDATE notification
    SET isRead = 1
    WHERE userId = ? AND isRead = 0
  `;

  db.query(query, [userId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({
        message: "Failed to mark notifications as read"
      });
    }

    res.json({ message: "Notifications marked as read" });
  });
});









   //GET KYC BY USER ID

app.get("/api/customer1-kyc/:userId", (req, res) => {
  const userId = req.params.userId;

  const sql = "SELECT * FROM customer_kyc WHERE userId = ?";

  db.query(sql, [userId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    if (result.length === 0) {
      return res.status(404).json({ message: "KYC not found" });
    }

    res.json(result[0]);
  });
});





app.get("/api/kyc/checks-national-id", (req, res) => { 
  let { nationalId } = req.query;
  nationalId = nationalId.trim().toUpperCase(); // trim & uppercase

  const sql = "SELECT id FROM customer_kyc WHERE UPPER(TRIM(nationalId)) = ?";
  db.query(sql, [nationalId], (err, rows) => {
    if (err) return res.status(500).json({ exists: false });
    res.json({ exists: rows.length > 0 });
  });
});







app.post("/api/applications/submit-all", (req, res) => {
  const data = req.body;
  //const bc = data.borrowerCredit || {};

  const sql = `
    INSERT INTO borrower_credit_assessment (
      loan_id, customer_id, applicant_name, contact_number, credit_officer,
      loan_type, loan_amount, application_date,

      lending_type, collateral_type, collateral_details,

      is_creditworthy, business_overview, business_location,
      business_start_date, nearest_landmark, business_description,

      is_able_to_pay,

      current_stock_value, started_business_with, source_of_fund,

      principal, rate, loan_term,
      interest, monthly_installment,

      gross_margin_percentage, monthly_sales_revenue,
      cost_of_goods_sold, gross_profit,

      total_operating_expenses, net_business_profit,

      household_expenses, other_income, household_surplus,

      loan_recommendation,
      expected_monthly_installment,
      allowable_disposable_loan_service,

      internal_comment, external_comment, decision
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)
  `;

  const values = [
    data.loanId,
    data.customerId,
    data.applicantName,
    data.contactNumber,
    data.creditOfficer,
    data.loanType,
    data.loanAmount ? Number(data.loanAmount) : null,
    data.applicationDate,

    data.lendingType || null,
    data.collateralType || null,
    JSON.stringify(data.details || {}),

    data.isCreditworthy || false,
    data.businessOverview || null,
    data.businessLocation || null,
    data.businessStartDate || null,
    data.nearestLandmark || null,
    data.businessDescription || null,

    data.isAbleToPay || false,

    data.currentStockValue || 0,
    data.startedBusinessWith || 0,
    data.sourceOfFund || null,

    data.principal || 0,
    data.rate || 0,
    data.loanTerm || 0,
    data.interest || 0,
    data.monthlyInstallment || 0,

    data.grossMarginPercentage || 0,
    data.monthlySalesRevenue || 0,
    data.costOfGoodsSold || 0,
    data.grossProfit || 0,

    data.totalOperatingExpenses || 0,
    data.netBusinessProfit || 0,

    data.householdExpenses || 0,
    data.otherIncome || 0,
    data.householdSurplus || 0,

    data.loanRecommendation || 0,
    data.expectedMonthlyInstallment || 0,
    data.allowableDisposableLoanService || 0,

    data.internalComment || null,
    data.externalComment || null,
    data.decision || "pending",
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error("Database insert error:", err);
      return res.status(500).json({
        success: false,
        message: "Database error",
        error: err
      });
    }

    res.json({
      success: true,
      message: "Application submitted successfully",
      id: result.insertId
    });
  });
});







// Change from kycCode to userId




// GET KYC DETAILS BY USER ID
app.get("/api/kyc-view/:userId", (req, res) => {
  const userId = req.params.userId;

  const sql = `
    SELECT 
        p.*,
        
        c.mobileNumber,
        c.email,
        c.residentialAddress,
        c.city,
        c.state,
        e.employmentStatus,
        e.employerName,
        e.jobTitle,
        e.monthlyIncome,
        e.businessName,
        e.businessType,
        r.referenceName1,
        r.referencePhone1,
        r.referenceRelationship1,
        r.referenceName2,
        r.referencePhone2,
        r.referenceRelationship2,
        r.kyc_code
    FROM personal_kyc p
    LEFT JOIN contact_kyc c ON p.userId = c.userId
    LEFT JOIN employment_kyc e ON p.userId = e.userId
    LEFT JOIN reference_kyc r ON p.userId = r.userId
    WHERE p.userId = ?
  `;

  db.query(sql, [userId], (err, result) => {
    if (err) return res.status(500).json({ success: false, error: err });

    if (result.length === 0) {
      return res.status(404).json({ success: false, message: "No KYC found" });
    }

    res.json({ success: true, data: result[0] }); // ✅ wrap in success/data
  });
});

app.post(
  "/api/loan/submit-full-application",
  upload.fields([
    { name: "guarantorProfilePicture" },
    { name: "guarantorPayslip" },
    { name: "guarantorBusinessPicture" },
    { name: "guarantorGhanaCardFront" },
    { name: "guarantorGhanaCardBack" },
  ]),
  (req, res) => {

    console.log("📦 BODY:", req.body);
    console.log("📁 FILES:", req.files);

    db.getConnection((err, connection) => {
      if (err) {
        console.error("❌ Connection Error:", err);
        return res.status(500).json({ success: false, error: err.message });
      }

      connection.beginTransaction((err) => {
        if (err) {
          connection.release();
          console.error("❌ Transaction Error:", err);
          return res.status(500).json({ success: false, error: err.message });
        }

        const {
          userId, fullName, phone, email, kycCode, dob, gender, nationalid,
          maritalStatus, dependents, residentialAddress, residentialGPS,
          employmentStatus, loanAmount, loanPurpose, loanTerm,
          repaymentFrequency, ratePerAnnum, interest, totalInterest,
          numberOfPayments, monthlyPayment, loanFees, guarantorName,
          guarantorPhone, guarantorAddress, guarantorResidenceLocation,
          guarantorIdNumber, guarantorEmployeeType, guarantorRank,
          guarantorWorkLocation, guarantorNameOfEmployer, guarantorYearsInService,
          guarantorBusinessName, guarantorBusinessLocation, guarantorYearsInBusiness,
          momoProvider, momoNumber, momoAccountName
        } = req.body;

        // ================= APPLICANT =================
        const applicantData = {
          userId, fullName, phone, email, kyc_code: kycCode, dob,
          gender, nationalid, maritalStatus,
          dependents: dependents ? parseInt(dependents) : null,
          residentialAddress, residentialGPS, employmentStatus
        };

        connection.query(
          "INSERT INTO applicant_details SET ?",
          applicantData,
          (err) => {
            if (err) {
              console.error("❌ Applicant Error:", err);
              return connection.rollback(() => {
                connection.release();
                res.status(500).json({ success: false, error: err.message });
              });
            }

            // ================= LOAN =================
            const loanData = {
              userId, kyc_code: kycCode,
              loanAmount: loanAmount ? parseFloat(loanAmount) : null,
              loanPurpose,
              loanTerm: loanTerm ? parseInt(loanTerm) : null,
              repaymentFrequency,
              ratePerAnnum: ratePerAnnum ? parseFloat(ratePerAnnum) : null,
              interest: interest ? parseFloat(interest) : null,
              totalInterest: totalInterest ? parseFloat(totalInterest) : null,
              numberOfPayments: numberOfPayments ? parseInt(numberOfPayments) : null,
              monthlyPayment: monthlyPayment ? parseFloat(monthlyPayment) : null,
              loanFees: loanFees ? parseFloat(loanFees) : null,
            };

            connection.query("INSERT INTO loan_details SET ?", loanData, (err) => {
              if (err) {
                console.error("❌ Loan Error:", err);
                return connection.rollback(() => {
                  connection.release();
                  res.status(500).json({ success: false, error: err.message });
                });
              }

              // ================= GUARANTOR =================
              const guarantorData = {
                userId,
                kyc_code: kycCode,
                guarantorName,
                guarantorPhone,
                guarantorAddress,
                guarantorResidenceLocation,
                guarantorIdNumber,
                guarantorEmployeeType,
                guarantorRank,
                guarantorWorkLocation,
                guarantorNameOfEmployer,
                guarantorYearsInService: guarantorYearsInService ? parseInt(guarantorYearsInService) : null,
                guarantorBusinessName,
                guarantorBusinessLocation,
                guarantorYearsInBusiness: guarantorYearsInBusiness ? parseInt(guarantorYearsInBusiness) : null,
                guarantorProfilePicture: req.files?.guarantorProfilePicture?.[0]?.path || null,
                guarantorPayslip: req.files?.guarantorPayslip?.[0]?.path || null,
                guarantorBusinessPicture: req.files?.guarantorBusinessPicture?.[0]?.path || null,
                guarantorGhanaCardFront: req.files?.guarantorGhanaCardFront?.[0]?.path || null,
                guarantorGhanaCardBack: req.files?.guarantorGhanaCardBack?.[0]?.path || null,
              };

              connection.query("INSERT INTO guarantor_info SET ?", guarantorData, (err) => {
                if (err) {
                  console.error("❌ Guarantor Error:", err);
                  return connection.rollback(() => {
                    connection.release();
                    res.status(500).json({ success: false, error: err.message });
                  });
                }

                // ================= MOMO ===========
                const momoData = {
                  userId,
                  kyc_code: kycCode,
                  momoProvider,
                  momoNumber,
                  momoAccountName
                };

                connection.query("INSERT INTO momo_details SET ?", momoData, (err) => {
                  if (err) {
                    console.error("❌ Momo Error:", err);
                    return connection.rollback(() => {
                      connection.release();
                      res.status(500).json({ success: false, error: err.message });
                    });
                  }

                  connection.commit((err) => {
                    connection.release();

                    if (err) {
                      console.error("❌ Commit Error:", err);
                      return res.status(500).json({ success: false, error: err.message });
                    }

                    res.json({ success: true });
                  });
                });
              });
            });
          }
        );
      });
    });
  }
);

app.get("/api/loan-status/:userId", (req, res) => {
  const { userId } = req.params;

  const sql = `
    SELECT loan_status 
    FROM momo_details
    WHERE userId = ?
    ORDER BY created_at DESC
    LIMIT 1
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error("SQL ERROR:", err);
      return res.status(500).json({ status: "No Loan" });
    }

    // ✅ If no record found
    if (results.length === 0) {
      return res.json({ status: "No Loan" });
    }

    // ✅ Return actual status
    const status = results[0].loan_status;

    res.json({ status });
  });
});




// backend/routes/admin.js
app.get("/api/admin/full-loan-kyc", (req, res) => {
  const sql = "SELECT * FROM full_loan_kyc_view ORDER BY applicant_created_at DESC";
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false, error: err });
    res.json(results);
  });
});





app.get("/api/users", (req, res) => {
  const sql = "SELECT * FROM users";

  db.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Failed to fetch users" });
    }

    const users = results.map(user => {
      const names = user.full_name ? user.full_name.split(" ") : [];

      return {
        id: user.userId,
        username: user.email, // using email as username
        firstName: names[0] || "",
        lastName: names.slice(1).join(" ") || "",
        email: user.email,
        phoneNumber: user.phone,
        roleId: user.role, // enum value
        status: "Active", // default (since not in DB)
        branch: "",
        createdAt: user.created_at
      };
    });

    res.json(users);
  });
});





app.get("/api/users/stats", (req, res) => {
  const sql = "SELECT COUNT(*) AS totalUsers FROM users";

  db.query(sql, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Error fetching stats" });
    }

    res.json({
      totalUsers: result[0].totalUsers
    });
  });
});




app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
