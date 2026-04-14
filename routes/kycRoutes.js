const express = require("express");
const router = express.Router();

const { validateStep } = require("../validation/kycValidation");

// STEP VALIDATION ROUTES
router.post("/validate/personal", validateStep("personal"), (req, res) => {
  res.json({ success: true, message: "Personal info valid" });
});

router.post("/validate/contact", validateStep("contact"), (req, res) => {
  res.json({ success: true, message: "Contact info valid" });
});

router.post("/validate/employment", validateStep("employment"), (req, res) => {
  res.json({ success: true, message: "Employment info valid" });
});

router.post("/validate/reference", validateStep("reference"), (req, res) => {
  res.json({ success: true, message: "Reference info valid" });
});

module.exports = router;