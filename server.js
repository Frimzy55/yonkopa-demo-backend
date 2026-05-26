import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { allowedOrigins } from './config/constants.js';

// Import routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import kycRoutes from './routes/kycRoutes.js';
import loanRoutes from './routes/loanRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import accountRoutes from './routes/accountRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration
/*app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      return callback(null, true);
    } else {
      console.log("Blocked by CORS:", origin);
      return callback(null, true); // Allow anyway for now, adjust as needed
    }
  },
  credentials: true
}));*/





app.use(cors({
  origin: function (origin, callback) {
    // allow mobile apps / postman
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log("❌ Blocked by CORS:", origin);
    return callback(new Error("Not allowed by CORS"));
  },

  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],

  allowedHeaders: ["Content-Type", "Authorization"],

  credentials: true
}));

// IMPORTANT: handle preflight requests
app.options("*", cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Register routes
app.use('/', authRoutes);
app.use('/', userRoutes);
app.use('/', kycRoutes);
app.use('/', loanRoutes);
app.use('/', adminRoutes);
app.use('/', notificationRoutes);
app.use('/', taskRoutes);
app.use('/', accountRoutes);

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});