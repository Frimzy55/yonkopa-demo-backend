import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { allowedOrigins } from "./config/constants.js";

// Routes
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import kycRoutes from "./routes/kycRoutes.js";
import loanRoutes from "./routes/loanRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import accountRoutes from "./routes/accountRoutes.js";
import enquiryRoutes from "./routes/enquiryRoutes.js";
import glAccountRoutes from "./routes/glAccountsRoutes.js";
import tellerRoutes from "./routes/tellerRoutes.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5002;

/**
 * =========================
 * CORS CONFIG
 * =========================
 */
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // Postman/mobile apps

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log("❌ Blocked by CORS:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

/**
 * =========================
 * MIDDLEWARE
 * =========================
 */
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/**
 * =========================
 * OPTIONAL DEV LOGGER ONLY
 * (Prevents spam in production)
 * =========================
 */
if (process.env.NODE_ENV === "development") {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });
}

/**
 * =========================
 * PRE-FLIGHT HANDLER
 * =========================
 */
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

/**
 * =========================
 * ROUTES
 * =========================
 */
app.use("/", authRoutes);
app.use("/", userRoutes);
app.use("/", kycRoutes);
app.use("/", loanRoutes);
app.use("/", adminRoutes);
app.use("/", notificationRoutes);
app.use("/", taskRoutes);
app.use("/", accountRoutes);
app.use("/", enquiryRoutes);
app.use("/", glAccountRoutes);
app.use("/api/teller", tellerRoutes);

/**
 * =========================
 * GLOBAL ERROR HANDLER
 * =========================
 */
app.use((err, req, res, next) => {
  console.error("🔥 ERROR:", err.message);

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "Blocked by CORS policy",
    });
  }

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

/**
 * =========================
 * START SERVER
 * =========================
 */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});