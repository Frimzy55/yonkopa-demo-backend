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
//import fs from "fs";
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

// ✅ Use JWT secret from env
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors());
app.use(bodyParser.json());
app.use(express.json());


//import cors from "cors";

/*app.use(cors({
  origin: "http://localhost:3000", // during development
  credentials: true
}));*/

/*app.use(cors({
  origin: "https://yonkopa-frontend.vercel.app/",
  credentials: true
}));*/






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


const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

//const db = mysql.createConnection(process.env.MYSQL_URL)

/*db.connect(err => {
  if (err) console.error('❌ Database connection failed :', err);
  else console.log('✅ Connected to MySQL database');
});*/


db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Database connection failed:", err);
  } else {
    console.log("✅ Connected to MySQL database");
    connection.release();
  }
});






/*const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // or your frontend URL
  },
});

app.set("io", io);*/






/*const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // change to your frontend URL in production
  },
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // User joins their own room using userId
  socket.on("joinRoom", (userId) => {
    socket.join(userId);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

// Make io accessible in routes
app.set("io", io);
//app.use("/api/loan", loanRoutes);



*/





// --- SIGNUP customer ENDPOINT ---
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
    db.query("UPDATE users SET status='online', last_login=NOW() WHERE userId=?", [user.userId], (err2) => {
      if (err2) console.error("Error updating status:", err2);
    });

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











// LOGOUT ROUTE
app.post("/logout", (req, res) => {
  const { userId } = req.body;

  db.query("UPDATE users SET status='offline' WHERE id=?", [userId], (err) => {
    if (err) {
      console.error("Error updating logout status:", err);
      return res.status(500).json({ message: "Server error" });
    }
    res.json({ message: "Logged out successfully" });
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





app.post("/api/verify-customer", (req, res) => {
  const { userId, kycCode } = req.body;

  const query = `
    SELECT 
      *
    FROM customer_kyc
    WHERE userId = ? AND kycCode = ?
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
      customer: results[0]
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














// Search endpoint
app.get("/api/customers/search", (req, res) => {
  const { q } = req.query;

  if (!q || q.trim() === "") {
    return res.status(400).json({ message: "Query is required" });
  }

  const sql = `
    SELECT id, kyc_code, firstName, middleName, lastName, mobileNumber, email
    FROM customers_kyc
    WHERE kyc_code LIKE ? 
      OR CONCAT(firstName, ' ', middleName, ' ', lastName) LIKE ?
    LIMIT 50
  `;

  const values = [`%${q}%`, `%${q}%`];

  db.query(sql, values, (err, rows) => {
    if (err) {
      console.error("Search error:", err);
      return res.status(500).json({ message: "Server error" });
    }

    res.json(rows);
  });
});





// GET pending loan applications (async/await)
// GET pending loan applications (CALLBACK STYLE – CORRECT)
app.get('/api/loan-applications/pending', (req, res) => {
  const sql = `
    SELECT 
     *
    FROM loans
    ORDER BY createdAt DESC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error('Error fetching applications:', err);
      return res.status(500).json({ message: 'Error fetching applications' });
    }

    res.json(rows);
  });
});


//app.use("/uploads", express.static("uploads"));



//app.use("/api/loan", loanRoutes);




// DELETE /api/loans/delete/:id
app.delete("/api/loans/delete/:id", (req, res) => {
  const { id } = req.params;

  const sql = "DELETE FROM loans WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Loan not found" });
    res.json({ message: "Loan deleted successfully" });
  });
});






app.post("/api/loan/apply-loan1", (req, res) => {
  const formData = { ...req.body };

  // List of allowed columns in loans table
  const allowedFields = [
    "kycCode","fullName","phone","email","dob","gender","nationalId","maritalStatus","dependents",
    "residentialAddress","residentialGPS","loanType","employerName","jobTitle",
    "monthlySalary","businessName","businessType","businessRegNo","businessAddress",
    "businessRevenue","yearsInBusiness","loanAmount","loanPurpose","loanTerm",
    "repaymentFrequency","guarantorName","guarantorPhone","guarantorAddress",
    "guarantorRelationship","guarantorNationality","guarantorGender","guarantorDOB"
  ];

  // Remove unknown fields
  for (const key in formData) {
    if (!allowedFields.includes(key)) delete formData[key];
  }

  // Convert empty strings to null
  for (const key in formData) {
    if (formData[key] === "") formData[key] = null;
  }

  // Insert into MySQL
  const query = "INSERT INTO loans SET ?";
  db.query(query, formData, (err, result) => {
    if (err) {
      console.error("MySQL Insert Error:", err);
      return res.status(500).json({ success: false, message: "DB error" });
    }
    res.json({ success: true, id: result.insertId });
  });
});









// ================================
// KYC SUBMISSION + NOTIFICATION
// ================================
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
          userId,kycCode, avatar, title, firstName, middleName, lastName, dateOfBirth, gender, maritalStatus,
          nationalId, taxId, residentialLocation, residentialLandmark, spouseName, spouseContact,
          mobileNumber, email, residentialAddress, city, state, zipCode,
          employmentStatus, employerName, jobTitle, monthlyIncome, yearsInCurrentEmployment,
          workPlaceLocation, businessName, businessType, monthlyBusinessIncome,
          businessLocation, businessGpsAddress, numberOfWorkers, yearsInBusiness,
          workingCapital, payslip, ghanaCardFront, ghanaCardBack, employmentId, businessPicture,
          referenceName1, referencePhone1, referenceRelationship1,
          referenceName2, referencePhone2, referenceRelationship2, createdAt

          
        ) VALUES (?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?)
      `;

      const values = [
         data.userId || null,
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



app.get("/api/customer-kyc/:userId", (req, res) => {
  const { userId } = req.params;

  const query = "SELECT avatar FROM customer_kyc WHERE userId = ?";

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error("DB Error:", err);
      return res.status(500).json({ error: "Server error" });
    }

    if (results.length === 0) {
      return res.json({});
    }

    res.json(results[0]); // { avatar: "image.jpg" }
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





app.post(
  "/apply-loan",
  upload.fields([
    { name: "guarantorProfilePicture" },
    { name: "guarantorPayslip" },
    { name: "guarantorGhanaCardFront" },
    { name: "guarantorGhanaCardBack" },
    { name: "guarantorBusinessPicture" },
  ]),
  (req, res) => {
    const body = req.body;
    const files = req.files || {};

    // ✅ UPDATED COLUMNS (added momo fields at the end)
    const columns = [
      "userId","fullName", "phone", "email", "kycCode", "dob", "gender", "nationalId", "maritalStatus", "dependents",
      "residentialAddress", "residentialGPS", "employmentStatus", "loanAmount", "loanPurpose", "loanTerm",
      "repaymentFrequency", "ratePerAnnum", "interest", "totalInterest", "numberOfPayments", "monthlyPayment",
      "loanFees", "guarantorName", "guarantorPhone", "guarantorAddress", "guarantorResidenceLocation",
      "guarantorIdNumber", "guarantorEmployeeType", "guarantorRank", "guarantorWorkLocation", "guarantorNameOfEmployer",
      "guarantorYearsInService", "guarantorPayslip", "guarantorGhanaCardFront", "guarantorGhanaCardBack",
      "guarantorBusinessName", "guarantorBusinessLocation", "guarantorYearsInBusiness",
      "guarantorBusinessPicture", "guarantorProfilePicture",

      // ✅ NEW MOMO FIELDS
      "momoProvider",
      "momoNumber",
      "momoAccountName"
    ];

    // ✅ UPDATED VALUES (same order as columns)
    const values = [
       body.userId || null,
      body.fullName || null,
      body.phone || null,
      body.email || null,
      body.kycCode || null,
      body.dob || null,
      body.gender || null,
      body.nationalId || null,
      body.maritalStatus || null,
      body.dependents ? parseInt(body.dependents) : 0,
      body.residentialAddress || null,
      body.residentialGPS || null,
      body.employmentStatus || null,
      body.loanAmount ? parseFloat(body.loanAmount) : 0,
      body.loanPurpose || null,
      body.loanTerm ? parseInt(body.loanTerm) : 0,
      body.repaymentFrequency || null,
      body.ratePerAnnum ? parseFloat(body.ratePerAnnum) : 0,
      body.interest ? parseFloat(body.interest) : 0,
      body.totalInterest ? parseFloat(body.totalInterest) : 0,
      body.numberOfPayments ? parseInt(body.numberOfPayments) : 0,
      body.monthlyPayment ? parseFloat(body.monthlyPayment) : 0,
      body.loanFees ? parseFloat(body.loanFees) : 0,
      body.guarantorName || null,
      body.guarantorPhone || null,
      body.guarantorAddress || null,
      body.guarantorResidenceLocation || null,
      body.guarantorIdNumber || null,
      body.guarantorEmployeeType || null,
      body.guarantorRank || null,
      body.guarantorWorkLocation || null,
      body.guarantorNameOfEmployer || null,
      body.guarantorYearsInService ? parseInt(body.guarantorYearsInService) : 0,
      files?.guarantorPayslip?.[0]?.filename || null,
      files?.guarantorGhanaCardFront?.[0]?.filename || null,
      files?.guarantorGhanaCardBack?.[0]?.filename || null,
      body.guarantorBusinessName || null,
      body.guarantorBusinessLocation || null,
      body.guarantorYearsInBusiness ? parseInt(body.guarantorYearsInBusiness) : 0,
      files?.guarantorBusinessPicture?.[0]?.filename || null,
      files?.guarantorProfilePicture?.[0]?.filename || null,

      // ✅ MOMO VALUES (ORDER MUST MATCH)
      body.momoProvider || null,
      body.momoNumber || null,
      body.momoAccountName || null
    ];

    const placeholders = columns.map(() => "?").join(", ");

    const query = `
      INSERT INTO loan_applications (${columns.join(", ")})
      VALUES (${placeholders})
    `;

    db.query(query, values, (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({
          success: false,
          message: err.message,
        });
      }

      res.json({
        success: true,
        message: "Loan submitted successfully!",
      });
    });
  }
);



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
app.get("/api/loan-status/:userId", (req, res) => {
  const { userId } = req.params;

  const query = `
    SELECT status 
    FROM loan_applications
    WHERE userId = ?
    ORDER BY createdAt DESC
    LIMIT 1
  `;

  db.query(query, [userId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Error fetching loan status" });
    }

    if (result.length === 0) {
      return res.json({ status: "No Loan" });
    }

    res.json({ status: result[0].status });
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
