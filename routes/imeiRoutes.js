// routes/imeiRoutes.js
import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import { db, dbPromise } from '../config/db.js';

dotenv.config();

const router = express.Router();

// ============================================================
// CEIR CONFIGURATION (no changes here)
// ============================================================
const CEIR_BASE_URL = process.env.CEIR_BASE_URL;
const CEIR_API_KEY = process.env.CEIR_API_KEY;
const CEIR_API_SECRET = process.env.CEIR_API_SECRET;

function checkCEIRConfiguration() {
  if (!CEIR_BASE_URL) throw new Error("CEIR_BASE_URL is not configured");
  if (!CEIR_API_KEY) throw new Error("CEIR_API_KEY is not configured");
}

// ============================================================
// IMEI VALIDATION (no changes)
// ============================================================
function validateIMEI(imei) {
  imei = String(imei).replace(/\D/g, "");
  if (imei.length !== 15) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let digit = parseInt(imei[i], 10);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

// ============================================================
// CEIR API CALLS (no changes)
// ============================================================
async function blockIMEI(imei, reason) {
  checkCEIRConfiguration();
  const response = await axios.post(
    `${CEIR_BASE_URL}/devices/block`,
    { imei, reason },
    {
      headers: {
        Authorization: `Bearer ${CEIR_API_KEY}`,
        "X-API-SECRET": CEIR_API_SECRET,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    }
  );
  return response.data;
}

async function unblockIMEI(imei, reason) {
  checkCEIRConfiguration();
  const response = await axios.post(
    `${CEIR_BASE_URL}/devices/unblock`,
    { imei, reason },
    {
      headers: {
        Authorization: `Bearer ${CEIR_API_KEY}`,
        "X-API-SECRET": CEIR_API_SECRET,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    }
  );
  return response.data;
}

async function getIMEIStatus(imei) {
  checkCEIRConfiguration();
  const response = await axios.get(
    `${CEIR_BASE_URL}/devices/${encodeURIComponent(imei)}`,
    {
      headers: {
        Authorization: `Bearer ${CEIR_API_KEY}`,
        "X-API-SECRET": CEIR_API_SECRET,
      },
      timeout: 15000,
    }
  );
  return response.data;
}

// ============================================================
// ROUTES (all prefixed with /devices)
// ============================================================

// POST /api/devices - Register a new financed device
router.post("/devices", async (req, res) => {
  try {
    const { customer_id, loan_id, imei_1, imei_2, serial_number, device_model } =
      req.body;

    if (!customer_id || !loan_id || !imei_1) {
      return res.status(400).json({
        success: false,
        message: "customer_id, loan_id and imei_1 are required",
      });
    }

    if (!validateIMEI(imei_1)) {
      return res.status(400).json({ success: false, message: "Invalid IMEI 1" });
    }

    if (imei_2 && !validateIMEI(imei_2)) {
      return res.status(400).json({ success: false, message: "Invalid IMEI 2" });
    }

    const [existing] = await db.query(
      `SELECT id FROM financed_devices WHERE imei_1 = ? OR imei_2 = ? LIMIT 1`,
      [imei_1, imei_2 || null]
    );

    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: "IMEI already registered" });
    }

    const [result] = await db.query(
      `INSERT INTO financed_devices
       (customer_id, loan_id, imei_1, imei_2, serial_number, device_model, status)
       VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [customer_id, loan_id, imei_1, imei_2 || null, serial_number || null, device_model || null]
    );

    res.status(201).json({
      success: true,
      message: "Device registered successfully",
      device_id: result.insertId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /api/devices/:id - Fetch device by ID
router.get("/devices/:id", async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM financed_devices WHERE id = ?`, [
      req.params.id,
    ]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Device not found" });
    }
    res.json({ success: true, device: rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// PUT /api/devices/:id/default - Mark as DEFAULT
router.put("/devices/:id/default", async (req, res) => {
  try {
    const [result] = await db.query(
      `UPDATE financed_devices SET status = 'DEFAULT' WHERE id = ?`,
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Device not found" });
    }
    res.json({ success: true, message: "Device marked as DEFAULT" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/devices/:id/block - Block IMEI via CEIR
router.post("/devices/:id/block", async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM financed_devices WHERE id = ?`, [
      req.params.id,
    ]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Device not found" });
    }

    const device = rows[0];
    if (device.status !== "DEFAULT") {
      return res.status(400).json({
        success: false,
        message: "Device is not eligible for blocking",
      });
    }

    await db.query(
      `UPDATE financed_devices SET status = 'BLOCK_REQUESTED', block_requested_at = NOW() WHERE id = ?`,
      [device.id]
    );

    const result = await blockIMEI(device.imei_1, "LOAN_DEFAULT");

    if (result.status !== "BLOCKED") {
      await db.query(`UPDATE financed_devices SET status = 'DEFAULT' WHERE id = ?`, [
        device.id,
      ]);
      return res.status(502).json({
        success: false,
        message: "Provider did not confirm the block",
        provider_response: result,
      });
    }

    await db.query(
      `UPDATE financed_devices
       SET status = 'BLOCKED', blocked_at = NOW(), block_reference = ?
       WHERE id = ?`,
      [result.reference || null, device.id]
    );

    await db.query(
      `INSERT INTO imei_block_events
       (device_id, imei, action, status, external_reference, response_data)
       VALUES (?, ?, 'BLOCK_RESPONSE', ?, ?, ?)`,
      [device.id, device.imei_1, result.status, result.reference || null, JSON.stringify(result)]
    );

    res.json({
      success: true,
      message: "IMEI successfully blocked",
      reference: result.reference,
    });
  } catch (error) {
    console.error("BLOCK ERROR:", error);
    res.status(500).json({
      success: false,
      message: "IMEI block failed",
      error: error.message,
    });
  }
});

// POST /api/devices/:id/unblock - Unblock IMEI via CEIR
router.post("/devices/:id/unblock", async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM financed_devices WHERE id = ?`, [
      req.params.id,
    ]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Device not found" });
    }

    const device = rows[0];
    if (device.status !== "BLOCKED") {
      return res.status(400).json({
        success: false,
        message: "Device is not blocked",
      });
    }

    await db.query(
      `UPDATE financed_devices SET status = 'UNBLOCK_REQUESTED', unblock_requested_at = NOW() WHERE id = ?`,
      [device.id]
    );

    const result = await unblockIMEI(device.imei_1, "LOAN_PAYMENT");

    if (result.status !== "UNBLOCKED") {
      await db.query(`UPDATE financed_devices SET status = 'BLOCKED' WHERE id = ?`, [
        device.id,
      ]);
      return res.status(502).json({
        success: false,
        message: "Provider did not confirm the unblock",
        provider_response: result,
      });
    }

    await db.query(
      `UPDATE financed_devices
       SET status = 'UNBLOCKED', unblocked_at = NOW(), unblock_reference = ?
       WHERE id = ?`,
      [result.reference || null, device.id]
    );

    await db.query(
      `INSERT INTO imei_block_events
       (device_id, imei, action, status, external_reference, response_data)
       VALUES (?, ?, 'UNBLOCK_RESPONSE', ?, ?, ?)`,
      [device.id, device.imei_1, result.status, result.reference || null, JSON.stringify(result)]
    );

    res.json({
      success: true,
      message: "IMEI successfully unblocked",
      reference: result.reference,
    });
  } catch (error) {
    console.error("UNBLOCK ERROR:", error);
    res.status(500).json({
      success: false,
      message: "IMEI unblock failed",
      error: error.message,
    });
  }
});

// GET /api/devices/:id/ceir-status - Check CEIR status
router.get("/devices/:id/ceir-status", async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM financed_devices WHERE id = ?`, [
      req.params.id,
    ]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Device not found" });
    }
    const device = rows[0];
    const result = await getIMEIStatus(device.imei_1);
    res.json({
      success: true,
      imei: device.imei_1,
      provider_status: result,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Unable to check CEIR status",
    });
  }
});

export default router;