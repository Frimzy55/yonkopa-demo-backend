import express from "express";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { db } from "../config/db.js";

const router = express.Router();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

router.post("/forgot-password", (req, res) => {
  let { identifier } = req.body;

  if (!identifier || !identifier.trim()) {
    return res.status(400).json({
      message: "Email or phone number is required",
    });
  }

  identifier = identifier.trim();

  const isEmail = identifier.includes("@");

  let sql;
  let queryValue;

  // =========================
  // EMAIL
  // =========================

  if (isEmail) {
    queryValue = identifier.toLowerCase();

    sql = `
      SELECT userId, email, phone
      FROM users
      WHERE LOWER(email) = ?
      LIMIT 1
    `;
  }

  // =========================
  // PHONE
  // =========================
  else {
    let phone = identifier.replace(/\D/g, "");

    // 233XXXXXXXXX -> 0XXXXXXXXX
    if (phone.startsWith("233") && phone.length === 12) {
      phone = "0" + phone.slice(3);
    }

    queryValue = phone;

    sql = `
      SELECT userId, email, phone
      FROM users
      WHERE phone = ?
      LIMIT 1
    `;
  }

  // =========================
  // FIND USER
  // =========================

  db.query(sql, [queryValue], (err, users) => {
    if (err) {
      console.error("Forgot password user lookup error:", err);

      return res.status(500).json({
        message: "Unable to process password reset request.",
      });
    }

    /*
     * Don't reveal whether an account exists.
     */
    if (users.length === 0) {
      return res.status(200).json({
        message:
          "If an account exists with that email or phone number, reset instructions will be sent shortly.",
      });
    }

    const user = users[0];

    /*
     * Our first version sends the reset link through EMAIL.
     */
    if (!user.email) {
      return res.status(200).json({
        message:
          "If an account exists with that email or phone number, reset instructions will be sent shortly.",
      });
    }

    // =========================
    // GENERATE TOKEN
    // =========================

    const resetToken = crypto.randomBytes(32).toString("hex");

    const tokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // 15-minute expiration
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // =========================
    // DELETE OLD TOKENS
    // =========================

    db.query(
      `
      DELETE FROM password_reset_tokens
      WHERE user_id = ?
      AND used_at IS NULL
      `,
      [user.userId],
      (deleteErr) => {
        if (deleteErr) {
          console.error("Delete old password reset token error:", deleteErr);

          return res.status(500).json({
            message: "Unable to process password reset request.",
          });
        }

        // =========================
        // SAVE NEW TOKEN
        // =========================

        db.query(
          `
          INSERT INTO password_reset_tokens
          (
            user_id,
            token_hash,
            expires_at
          )
          VALUES (?, ?, ?)
          `,
          [user.userId, tokenHash, expiresAt],
          (insertErr) => {
            if (insertErr) {
              console.error("Insert password reset token error:", insertErr);

              return res.status(500).json({
                message: "Unable to process password reset request.",
              });
            }

            // =========================
            // CREATE RESET URL
            // =========================

            const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

            // =========================
            // SEND EMAIL
            // =========================
            transporter.sendMail(
              {
                from: `"Yonkopa Microcredit" <${process.env.SMTP_USER}>`,
                to: user.email,
                subject: "Reset Your Yonkopa Password",

                html: `
      <div style="
        font-family: Arial, sans-serif;
        max-width: 600px;
        margin: 0 auto;
        padding: 30px;
        background: #ffffff;
      ">

        <h2 style="color: #0d6efd;">
          Reset Your Password
        </h2>

        <p>
          We received a request to reset your
          Yonkopa Microcredit account password.
        </p>

        <p>
          Click the button below to create a new password.
        </p>

        <div style="margin: 30px 0;">
          <a
            href="${resetUrl}"
            style="
              display: inline-block;
              padding: 12px 25px;
              background-color: #f97316;
              color: #ffffff;
              text-decoration: none;
              border-radius: 6px;
              font-weight: bold;
            "
          >
            Reset Password
          </a>
        </div>

        <p>
          This link will expire in
          <strong>15 minutes</strong>.
        </p>

        <p>
          If you did not request a password reset,
          you can safely ignore this email.
        </p>

        <hr style="margin: 30px 0;" />

        <p style="font-size: 12px; color: #777;">
          Yonkopa Microcredit
        </p>

      </div>
    `,
              },

              (emailError, info) => {
                if (emailError) {
                  console.error("❌ Password reset email error:", emailError);

                  // Remove token because email failed
                  db.query(
                    `
        DELETE FROM password_reset_tokens
        WHERE token_hash = ?
        `,
                    [tokenHash],
                    () => {},
                  );

                  return res.status(500).json({
                    message:
                      "Unable to send password reset email. Please try again later.",
                  });
                }

                // Email accepted by SMTP server
                console.log("✅ Password reset email accepted by Brevo");
                console.log("📧 Message ID:", info.messageId);
                console.log("📨 SMTP Response:", info.response);

                return res.status(200).json({
                  message:
                    "If an account exists with that email or phone number, reset instructions will be sent shortly.",
                });
              },
            );
          },
        );
      },
    );
  });
});

export default router;
