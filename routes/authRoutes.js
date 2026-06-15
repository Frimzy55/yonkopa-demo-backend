import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../config/db.js';
import { getJwtSecret } from '../config/constants.js';
import { authenticateToken } from '../middleware/auth.js';
import rateLimit from "express-rate-limit";

const router = express.Router();
const JWT_SECRET = getJwtSecret();



const staffLoginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 30 mins
  max: 15,

    

  message: {
    success: false,
    message: "Too many staff login attempts.",
  },
});


const loginLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 15 minutes

  max: 5,

    

  message: {
    success: false,
    message: "Too many login attempts. Try again after 15 minutes.",
  },

  standardHeaders: true,
  legacyHeaders: false,
});



// Signup (customer)
router.post('/signup', async (req, res) => {
  const { fullName, identifier, password, confirmPassword, role } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  try {
    let email = null, phone = null;
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const isPhone = /^\d{10}$/.test(identifier.replace(/\D/g, ""));

    if (isEmail) email = identifier;
    else if (isPhone) phone = identifier.replace(/\D/g, "");
    else return res.status(400).json({ message: "Enter a valid email or 10-digit phone number" });

    const cleanPhone = phone;
    const checkUserSql = "SELECT email, phone FROM users WHERE email = ? OR phone = ?";
    db.query(checkUserSql, [email, cleanPhone], async (err, results) => {
      if (err) return res.status(500).json({ message: "Database error" });
      if (results.length > 0) {
        const existingUser = results[0];
        if (email && existingUser.email === email) return res.status(400).json({ message: "Email already registered. Please login." });
        if (cleanPhone && existingUser.phone === cleanPhone) return res.status(400).json({ message: "Phone number already registered." });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userRole = role || "customer";
      const insertSql = `INSERT INTO users (full_name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)`;
      db.query(insertSql, [fullName, email, cleanPhone, hashedPassword, userRole], (err) => {
        if (err) return res.status(500).json({ message: "Error creating account" });
        res.status(201).json({ message: "Account created successfully!", role: userRole });
      });
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Staff signup (users1 table)
router.post('/signup2', async (req, res) => {
  const { fullName, full_name, username, identifier, password, confirmPassword, role } = req.body;
  const name = fullName || full_name;
  if (!name?.trim()) return res.status(400).json({ message: "Full name is required" });
  if (!username?.trim()) return res.status(400).json({ message: "Username is required" });
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ message: "Username can only contain letters, numbers, and underscores" });
  if (!identifier?.trim()) return res.status(400).json({ message: "Email or phone number is required" });
  if (!password) return res.status(400).json({ message: "Password is required" });
  if (password !== confirmPassword) return res.status(400).json({ message: "Passwords do not match" });
  if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) return res.status(400).json({ message: "Password must contain uppercase, lowercase, and a number" });

  try {
    let email = null, phone = null;
    const cleanIdentifier = identifier.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanIdentifier);
    const phoneDigits = cleanIdentifier.replace(/\D/g, '');
    const isPhone = /^\d{10,12}$/.test(phoneDigits);
    if (isEmail) email = cleanIdentifier.toLowerCase();
    else if (isPhone) phone = phoneDigits;
    else return res.status(400).json({ message: "Enter valid email or phone number" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role || "customer";
    const insertSql = `INSERT INTO users1 (full_name, username, email, phone, password, role, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())`;
    db.query(insertSql, [name.trim(), username.trim().toLowerCase(), email, phone, hashedPassword, userRole], (err) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: "Username or email already exists" });
        return res.status(500).json({ message: "Error creating account" });
      }
      res.status(201).json({ message: "Account created successfully", userId: err?.insertId });
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Admin signup (users table)
router.post('/signup1', async (req, res) => {
  const { full_name, email, phone, password, role } = req.body;
  if (!full_name || !email || !phone || !password || !role) return res.status(400).json({ message: 'All fields are required' });
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = `INSERT INTO users (full_name, email, phone, password, role, created_at) VALUES (?, ?, ?, ?, ?, NOW())`;
    db.query(query, [full_name, email, phone, hashedPassword, role], (err) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.status(200).json({ message: 'User registered successfully!' });
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Customer login (users table)
router.post('/login', loginLimiter, async (req, res) => {
  try {
    let { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ message: 'Identifier and password required' });
    identifier = identifier.trim();
    const isEmail = identifier.includes('@');
    if (isEmail) identifier = identifier.toLowerCase();
    let phone = null;
    if (!isEmail) {
      phone = identifier.replace(/\D/g, '');
      if (phone.startsWith('233') && phone.length === 12) phone = '0' + phone.slice(3);
    }
    const sql = isEmail ? 'SELECT * FROM users WHERE LOWER(email) = ?' : 'SELECT * FROM users WHERE phone = ?';
    db.query(sql, [isEmail ? identifier : phone], async (err, results) => {
      if (err) return res.status(500).json({ message: 'Server error' });
      if (results.length === 0) return res.status(404).json({ message: 'User not found' });
      const user = results[0];
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });
      const token = jwt.sign({ userId: user.userId, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '2h' });
      res.json({ message: 'Login successful', token, user: { userId: user.userId, fullName: user.full_name, email: user.email, phone: user.phone, role: user.role } });
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});




router.post('/login2', staffLoginLimiter, async (req, res) => {
  try {
    let { identifier, password } = req.body;

    if (!identifier || !password)
      return res.status(400).json({ message: 'Identifier and password required' });

    identifier = identifier.trim();

    const isEmail = identifier.includes('@');
    let phone = null;
    let username = null;

    if (isEmail) {
      identifier = identifier.toLowerCase();
    } else {
      const digits = identifier.replace(/\D/g, '');

      if (digits.length >= 10) {
        phone = digits;

        if (phone.startsWith('233') && phone.length === 12) {
          phone = '0' + phone.slice(3);
        }
      } else {
        username = identifier.toLowerCase();
      }
    }

    let sql;
    let params;

    if (isEmail) {
      sql = 'SELECT * FROM users1 WHERE LOWER(email) = ?';
      params = [identifier];
    } 
    else if (phone) {
      sql = 'SELECT * FROM users1 WHERE phone = ?';
      params = [phone];
    } 
    else {
      sql = 'SELECT * FROM users1 WHERE LOWER(username) = ?';
      params = [username];
    }

    db.query(sql, params, async (err, results) => {
      if (err) return res.status(500).json({ message: 'Server error' });

      if (results.length === 0)
        return res.status(404).json({ message: 'User not found' });

      const user = results[0];

      // status check
      if (user.status === 'inactive') {
        db.query(
          `INSERT INTO login_logs (userId, ip_address, user_agent, status)
           VALUES (?, ?, ?, 'failed')`,
          [user.userId, req.ip, req.headers['user-agent']]
        );

        return res.status(403).json({
          message: 'Your account has been deactivated'
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        db.query(
          `INSERT INTO login_logs (userId, ip_address, user_agent, status)
           VALUES (?, ?, ?, 'failed')`,
          [user.userId, req.ip, req.headers['user-agent']]
        );

        return res.status(401).json({
          message: 'Invalid credentials'
        });
      }

      const token = jwt.sign(
        {
          userId: user.userId,
          email: user.email,
          role: user.role
        },
        JWT_SECRET,
        { expiresIn: '2h' }
      );

      db.query(
        `INSERT INTO login_logs (userId, ip_address, user_agent, status)
         VALUES (?, ?, ?, 'success')`,
        [user.userId, req.ip, req.headers['user-agent']]
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          userId: user.userId,
          fullName: user.full_name,
          username: user.username,
          email: user.email,
          phone: user.phone,
          role: user.role,
          status: user.status
        }
      });
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});



/*router.post('/login', loginLimiter, async (req, res) => {
  try {
    let { identifier, password } = req.body;

    if (!identifier || !password)
      return res.status(400).json({ message: 'Identifier and password required' });

    identifier = identifier.trim();
    const isEmail = identifier.includes('@');

    if (isEmail) {
      identifier = identifier.toLowerCase();
    }

    let phone = null;

    if (!isEmail) {
      phone = identifier.replace(/\D/g, '');
      if (phone.startsWith('233') && phone.length === 12) {
        phone = '0' + phone.slice(3);
      }
    }

    const sql = isEmail
      ? 'SELECT * FROM users WHERE LOWER(email) = ?'
      : 'SELECT * FROM users WHERE phone = ?';

    db.query(sql, [isEmail ? identifier : phone], async (err, results) => {
      if (err) return res.status(500).json({ message: 'Server error' });

      if (results.length === 0)
        return res.status(404).json({ message: 'User not found' });

      const user = results[0];

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch)
        return res.status(401).json({ message: 'Invalid credentials' });

      // ✅ USE UUID HERE
      const token = jwt.sign(
        {
          user_uuid: user.user_uuid,
          email: user.email,
          role: user.role
        },
        JWT_SECRET,
        { expiresIn: '2h' }
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          user_uuid: user.user_uuid,   // ✅ IMPORTANT
          fullName: user.full_name,
          email: user.email,
          phone: user.phone,
          role: user.role
        }
      });
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});*/






// Staff login (users1 table) with status check and logging
/*router.post('/login2', staffLoginLimiter, async (req, res) => {
  try {
    let { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Identifier and password required' });
    }

    identifier = identifier.trim();

    const isEmail = identifier.includes('@');

    let phone = null;
    let username = null;

    if (isEmail) {
      identifier = identifier.toLowerCase();
    } else {
      phone = identifier.replace(/\D/g, '');

      // normalize Ghana number
      if (phone.startsWith('233') && phone.length === 12) {
        phone = '0' + phone.slice(3);
      }

      username = identifier.toLowerCase(); // allow username login too
    }

    let sql;
    let params;

    if (isEmail) {
      sql = 'SELECT * FROM users1 WHERE LOWER(email) = ?';
      params = [identifier];
    } else {
      sql = `
        SELECT * FROM users1 
        WHERE phone = ? 
        OR LOWER(username) = ?
      `;
      params = [phone, username];
    }

    db.query(sql, params, async (err, results) => {
      if (err) return res.status(500).json({ message: 'Server error' });

      if (results.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      const user = results[0];

      // check status
      if (user.status === 'inactive') {
        db.query(
          `INSERT INTO login_logs (userId, ip_address, user_agent, status) VALUES (?, ?, ?, 'failed')`,
          [user.userId, req.ip, req.headers['user-agent']]
        );
        return res.status(403).json({ message: 'Your account has been deactivated' });
      }

      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        db.query(
          `INSERT INTO login_logs (userId, ip_address, user_agent, status) VALUES (?, ?, ?, 'failed')`,
          [user.userId, req.ip, req.headers['user-agent']]
        );
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { userId: user.userId, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '2h' }
      );

      db.query(
        `INSERT INTO login_logs (userId, ip_address, user_agent, status) VALUES (?, ?, ?, 'success')`,
        [user.userId, req.ip, req.headers['user-agent']]
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          userId: user.userId,
          fullName: user.full_name,
          username: user.username,
          email: user.email,
          phone: user.phone,
          role: user.role,
          status: user.status
        }
      });
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});
*/





/*router.post('/login2', staffLoginLimiter, async (req, res) => {
  try {
    let { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Identifier and password required' });
    }

    identifier = identifier.trim();
    const isEmail = identifier.includes('@');

    let phone = null;
    let username = null;

    if (isEmail) {
      identifier = identifier.toLowerCase();
    } else {
      phone = identifier.replace(/\D/g, '');

      if (phone.startsWith('233') && phone.length === 12) {
        phone = '0' + phone.slice(3);
      }

      username = identifier.toLowerCase();
    }

    let sql;
    let params;

    if (isEmail) {
      sql = 'SELECT * FROM users1 WHERE LOWER(email) = ?';
      params = [identifier];
    } else {
      sql = `
        SELECT * FROM users1 
        WHERE phone = ? 
        OR LOWER(username) = ?
      `;
      params = [phone, username];
    }

    db.query(sql, params, async (err, results) => {
      if (err) return res.status(500).json({ message: 'Server error' });

      if (results.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      const user = results[0];

      // ❌ inactive check
      if (user.status === 'inactive') {
        db.query(
          `INSERT INTO login_logs (user_uuid, ip_address, user_agent, status)
           VALUES (?, ?, ?, 'failed')`,
          [user.user_uuid, req.ip, req.headers['user-agent']]
        );

        return res.status(403).json({ message: 'Your account has been deactivated' });
      }

      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        db.query(
          `INSERT INTO login_logs (user_uuid, ip_address, user_agent, status)
           VALUES (?, ?, ?, 'failed')`,
          [user.user_uuid, req.ip, req.headers['user-agent']]
        );

        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // 🔐 JWT using UUID
      const token = jwt.sign(
        {
          user_uuid: user.user_uuid,
          email: user.email,
          role: user.role
        },
        JWT_SECRET,
        { expiresIn: '2h' }
      );

      // ✅ success log
      db.query(
        `INSERT INTO login_logs (user_uuid, ip_address, user_agent, status)
         VALUES (?, ?, ?, 'success')`,
        [user.user_uuid, req.ip, req.headers['user-agent']]
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          user_uuid: user.user_uuid,
          fullName: user.full_name,
          username: user.username,
          email: user.email,
          phone: user.phone,
          role: user.role,
          status: user.status
        }
      });
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});*/




// Change password (using users table)
router.put("/api/auth/change-password", (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;
  db.query("SELECT password FROM users WHERE userId = ?", [userId], async (err, result) => {
    if (err) return res.status(500).json({ message: "DB error" });
    if (result.length === 0) return res.status(404).json({ message: "User not found" });
    const isMatch = await bcrypt.compare(oldPassword, result[0].password);
    if (!isMatch) return res.status(400).json({ message: "Old password incorrect" });
    const newHashedPassword = await bcrypt.hash(newPassword, 10);
    db.query("UPDATE users SET password = ? WHERE userId = ?", [newHashedPassword, userId], (err2) => {
      if (err2) return res.status(500).json({ message: "Update failed" });
      res.json({ message: "Password updated successfully" });
    });
  });
});

router.post("/api/change-password", (req, res) => {
  const { userId, currentPassword, newPassword } = req.body;
  if (!userId || !currentPassword || !newPassword) return res.status(400).json({ message: "All fields are required" });
  db.query("SELECT password FROM users WHERE id = ?", [userId], async (err, result) => {
    if (err) return res.status(500).json({ message: "Database error" });
    if (result.length === 0) return res.status(404).json({ message: "User not found" });
    const isMatch = await bcrypt.compare(currentPassword, result[0].password);
    if (!isMatch) return res.status(400).json({ message: "Current password is incorrect" });
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    db.query("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, userId], (err) => {
      if (err) return res.status(500).json({ message: "Failed to update password" });
      res.json({ message: "Password updated successfully" });
    });
  });
});








router.post('/api/change-staff-password', async (req, res) => {

  const {
    currentPassword,
    newPassword,
    userId
  } = req.body;

  if (!userId) {
    return res.status(400).json({
      message: 'User ID required'
    });
  }

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      message: 'Current password and new password are required'
    });
  }

  try {

    const [rows] = await db.promise().query(
      'SELECT password FROM users1 WHERE userId = ?',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    const isValid = await bcrypt.compare(
      currentPassword,
      rows[0].password
    );

    if (!isValid) {
      return res.status(401).json({
        message: 'Current password is incorrect'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.promise().query(
      'UPDATE users1 SET password = ? WHERE userId = ?',
      [hashedPassword, userId]
    );

    res.json({
      message: 'Password changed successfully'
    });

  } catch (error) {

    console.error('Change password error:', error);

    res.status(500).json({
      message: 'Server error'
    });
  }
});



// Protected profile route
router.get('/profile', authenticateToken, (req, res) => {
  res.json({ message: `Welcome ${req.user.email}, your role is ${req.user.role}`, user: req.user });
});

export default router;