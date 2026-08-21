// clientKycRoute.js – Updated with full_name support
import express from "express";
import path from "path";
import fs from "fs";
import { dbPromise } from "../config/db.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

// -----------------------------------------------------------------
// Ensure upload directories exist
// -----------------------------------------------------------------
const uploadDir = path.join(process.cwd(), "uploads");
const subDirs = ["clients", "guarantors", "collateral", "ownership", "client_docs", "guarantor_docs"];
subDirs.forEach((dir) => {
  const fullPath = path.join(uploadDir, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

// Helper: get today's date as YYYY-MM-DD
const today = () => new Date().toISOString().split('T')[0];

// Helper: return relative file path
const getRelativePath = (file, uploadDir) => {
  if (!file) return null;
  const relativePath = path.relative(uploadDir, file.path);
  return relativePath.replace(/\\/g, "/");
};

// -----------------------------------------------------------------
// SINGLE SUBMIT ROUTE – accepts all fields via upload.any()
// -----------------------------------------------------------------
router.post(
  "/submit",
  upload.any(),
  async (req, res) => {
    const connection = await dbPromise.getConnection();
    try {
      await connection.beginTransaction();

      const body = req.body;

      // 1. Create client record (or use provided clientId)
      let clientId = body.clientId ? parseInt(body.clientId, 10) : null;
      if (!clientId) {
        const [result] = await connection.query("INSERT INTO clients (client_id) VALUES (NULL)");
        clientId = result.insertId;
      }

      // 2. Extract files from req.files
      const clientPhotoFile = req.files.find(f => f.fieldname === 'clientPhoto');
      const guarantorPhotoFile = req.files.find(f => f.fieldname === 'guarantorPhoto');
      const collateralPhotoFile = req.files.find(f => f.fieldname === 'collateralPhoto');
      const ownershipDocFile = req.files.find(f => f.fieldname === 'ownershipDocument');
      const clientDocFiles = req.files.filter(f => f.fieldname.startsWith('clientDocuments'));
      const guarantorDocFiles = req.files.filter(f => f.fieldname.startsWith('guarantorDocuments'));

      // 3. Save individual files
      const clientPhotoPath = getRelativePath(clientPhotoFile, uploadDir);
      const guarantorPhotoPath = getRelativePath(guarantorPhotoFile, uploadDir);
      const collateralPhotoPath = getRelativePath(collateralPhotoFile, uploadDir);
      const ownershipDocPath = getRelativePath(ownershipDocFile, uploadDir);

      // =============================================================
      // STEP 1 – Personal Information
      // =============================================================
      const step1Sql = `
        INSERT INTO client_kyc_step1 (
          client_id, photo, first_name, surname, popular_name, phone, alt_phone,
          hometown, place_of_birth, ghana_card_number, date_issued, expiry_date,
          date_of_birth, marital_status, father_name, father_contact, mother_name,
          mother_contact, spouse_name, spouse_contact, spouse_occupation,
          residential_location, district, residential_ownership, nearest_landmark,
          gps_address, years_at_address, rent_advance, number_of_dependents,
          household_members, dependents_schooling, religion, church_name,
          church_location, pastor_name, pastor_contact
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          photo = VALUES(photo),
          first_name = VALUES(first_name),
          surname = VALUES(surname),
          popular_name = VALUES(popular_name),
          phone = VALUES(phone),
          alt_phone = VALUES(alt_phone),
          hometown = VALUES(hometown),
          place_of_birth = VALUES(place_of_birth),
          ghana_card_number = VALUES(ghana_card_number),
          date_issued = VALUES(date_issued),
          expiry_date = VALUES(expiry_date),
          date_of_birth = VALUES(date_of_birth),
          marital_status = VALUES(marital_status),
          father_name = VALUES(father_name),
          father_contact = VALUES(father_contact),
          mother_name = VALUES(mother_name),
          mother_contact = VALUES(mother_contact),
          spouse_name = VALUES(spouse_name),
          spouse_contact = VALUES(spouse_contact),
          spouse_occupation = VALUES(spouse_occupation),
          residential_location = VALUES(residential_location),
          district = VALUES(district),
          residential_ownership = VALUES(residential_ownership),
          nearest_landmark = VALUES(nearest_landmark),
          gps_address = VALUES(gps_address),
          years_at_address = VALUES(years_at_address),
          rent_advance = VALUES(rent_advance),
          number_of_dependents = VALUES(number_of_dependents),
          household_members = VALUES(household_members),
          dependents_schooling = VALUES(dependents_schooling),
          religion = VALUES(religion),
          church_name = VALUES(church_name),
          church_location = VALUES(church_location),
          pastor_name = VALUES(pastor_name),
          pastor_contact = VALUES(pastor_contact)
      `;
      await connection.query(step1Sql, [
        clientId, clientPhotoPath,
        body.firstName || "", body.surname || "", body.popularName || "",
        body.phone || "", body.altPhone || "", body.hometown || "",
        body.placeOfBirth || "", body.ghanaCardNumber || "",
        body.dateIssued || today(),
        body.expiryDate || today(),
        body.dateOfBirth || today(),
        body.maritalStatus || null,
        body.fatherName || "", body.fatherContact || "",
        body.motherName || "", body.motherContact || "",
        body.spouseName || "", body.spouseContact || "",
        body.spouseOccupation || "",
        body.residentialLocation || "", body.district || "",
        body.residentialOwnership || null,
        body.nearestLandmark || "",
        body.gpsAddress || "", body.yearsAtAddress || null,
        body.rentAdvance || null, body.numberOfDependents || null,
        body.householdMembers || null, body.dependentsSchooling || "",
        body.religion || "", body.churchName || "",
        body.churchLocation || "", body.pastorName || "",
        body.pastorContact || "",
      ]);

      // =============================================================
      // Update clients.full_name with first_name and surname
      // =============================================================
      const fullName = `${body.firstName || ''} ${body.surname || ''}`.trim();
      if (fullName) {
        await connection.query('UPDATE clients SET full_name = ? WHERE client_id = ?', [fullName, clientId]);
      }

      // =============================================================
      // STEP 2 – Business
      // =============================================================
      const step2Sql = `
        INSERT INTO client_kyc_step2 (
          client_id, business_name, business_sector,
          types_of_business, business_description, business_location,
          business_location_status, working_capital, stock_value,
          business_gps_address, years_in_business, business_landmark,
          minimum_sale, maximum_sale
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          business_name = VALUES(business_name),
          business_sector = VALUES(business_sector),
          types_of_business = VALUES(types_of_business),
          business_description = VALUES(business_description),
          business_location = VALUES(business_location),
          business_location_status = VALUES(business_location_status),
          working_capital = VALUES(working_capital),
          stock_value = VALUES(stock_value),
          business_gps_address = VALUES(business_gps_address),
          years_in_business = VALUES(years_in_business),
          business_landmark = VALUES(business_landmark),
          minimum_sale = VALUES(minimum_sale),
          maximum_sale = VALUES(maximum_sale)
      `;
      await connection.query(step2Sql, [
        clientId,
        body.businessName || "",
        body.businessSector || "",
        body.typesOfBusiness || "",
        body.businessDescription || "",
        body.businessLocation || "",
        body.businessLocationStatus || null,
        body.workingCapital || "",
        body.stockValue || "",
        body.businessGpsAddress || "",
        body.yearsInBusiness || null,
        body.businessLandmark || "",
        body.minimumSale || "",
        body.maximumSale || "",
      ]);

      // =============================================================
      // STEP 3 – Loan Details
      // =============================================================
      const step3Sql = `
        INSERT INTO client_kyc_step3 (
          client_id, loan_amount, loan_purpose, loan_term, weekly_installment,
          repayment_amount, previous_loan_request, previous_loan_approved,
          expected_due_date, actual_due_date, repayment_frequency,
          existing_loan_balance, loan_need_reason, what_if_not_approved,
          comfortable_repayment, existing_debt_repayment,
          security_type, security_description, security_owner,
          security_purchase_date, security_market_value,
          security_forced_sale_value, security_serial, security_registration,
          collateral_photo_path, ownership_document_path,
          security_verification_status, security_encumbrances,
          prev_repayment_behaviour, total_borrowed, loan_cycle_completed,
          max_past_due_days, missed_instalments,
          total_arrears, write_off_loans, extensions, number_of_pay_off,
          current_outstanding_balance, avg_repayment_performance,
          visit_business, business_operating, observed_sales_correspondence,
          daily_customer_volume, key_risk_observed,
          known_client_since, adverse_info, repayment_concerns,
          verified_monthly_income, reasonable_repayment,
          recommended_amount, recommended_term, recommendation_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          loan_amount = VALUES(loan_amount),
          loan_purpose = VALUES(loan_purpose),
          loan_term = VALUES(loan_term),
          weekly_installment = VALUES(weekly_installment),
          repayment_amount = VALUES(repayment_amount),
          previous_loan_request = VALUES(previous_loan_request),
          previous_loan_approved = VALUES(previous_loan_approved),
          expected_due_date = VALUES(expected_due_date),
          actual_due_date = VALUES(actual_due_date),
          repayment_frequency = VALUES(repayment_frequency),
          existing_loan_balance = VALUES(existing_loan_balance),
          loan_need_reason = VALUES(loan_need_reason),
          what_if_not_approved = VALUES(what_if_not_approved),
          comfortable_repayment = VALUES(comfortable_repayment),
          existing_debt_repayment = VALUES(existing_debt_repayment),
          security_type = VALUES(security_type),
          security_description = VALUES(security_description),
          security_owner = VALUES(security_owner),
          security_purchase_date = VALUES(security_purchase_date),
          security_market_value = VALUES(security_market_value),
          security_forced_sale_value = VALUES(security_forced_sale_value),
          security_serial = VALUES(security_serial),
          security_registration = VALUES(security_registration),
          collateral_photo_path = VALUES(collateral_photo_path),
          ownership_document_path = VALUES(ownership_document_path),
          security_verification_status = VALUES(security_verification_status),
          security_encumbrances = VALUES(security_encumbrances),
          prev_repayment_behaviour = VALUES(prev_repayment_behaviour),
          total_borrowed = VALUES(total_borrowed),
          loan_cycle_completed = VALUES(loan_cycle_completed),
          max_past_due_days = VALUES(max_past_due_days),
          missed_instalments = VALUES(missed_instalments),
          total_arrears = VALUES(total_arrears),
          write_off_loans = VALUES(write_off_loans),
          extensions = VALUES(extensions),
          number_of_pay_off = VALUES(number_of_pay_off),
          current_outstanding_balance = VALUES(current_outstanding_balance),
          avg_repayment_performance = VALUES(avg_repayment_performance),
          visit_business = VALUES(visit_business),
          business_operating = VALUES(business_operating),
          observed_sales_correspondence = VALUES(observed_sales_correspondence),
          daily_customer_volume = VALUES(daily_customer_volume),
          key_risk_observed = VALUES(key_risk_observed),
          known_client_since = VALUES(known_client_since),
          adverse_info = VALUES(adverse_info),
          repayment_concerns = VALUES(repayment_concerns),
          verified_monthly_income = VALUES(verified_monthly_income),
          reasonable_repayment = VALUES(reasonable_repayment),
          recommended_amount = VALUES(recommended_amount),
          recommended_term = VALUES(recommended_term),
          recommendation_reason = VALUES(recommendation_reason)
      `;
      await connection.query(step3Sql, [
        clientId,
        body.loanAmount || "0",
        body.loanPurpose || "Not specified",
        body.loanTerm || 0,
        body.weeklyInstallment || "0",
        body.repaymentAmount || "0",
        body.previousLoanRequest || "",
        body.previousLoanApproved || "",
        body.expectedDueDate || today(),
        body.actualDueDate || null,
        body.repaymentFrequency || "",
        body.existingLoanBalance || "",
        body.loanNeedReason || "",
        body.whatIfNotApproved || "",
        body.comfortableRepayment || "",
        body.existingDebtRepayment || "",
        body.securityType || null,
        body.securityDescription || "",
        body.securityOwner || "",
        body.securityPurchaseDate || null,
        body.securityMarketValue || "",
        body.securityForcedSaleValue || "",
        body.securitySerial || "",
        body.securityRegistration || "",
        collateralPhotoPath || "",
        ownershipDocPath || "",
        body.securityVerificationStatus || null,
        body.securityEncumbrances || "",
        body.prevRepaymentBehaviour || "",
        body.totalBorrowed || "",
        body.loanCycleCompleted || 0,
        body.maxPastDueDays || 0,
        body.missedInstalments || 0,
        body.totalArrears || "",
        body.writeOffLoans || 0,
        body.extensions || 0,
        body.numberOfPayOff || 0,
        body.currentOutstandingBalance || "",
        body.avgRepaymentPerformance || "",
        body.visitBusiness || null,
        body.businessOperating || null,
        body.observedSalesCorrespondence || null,
        body.dailyCustomerVolume || "",
        body.keyRiskObserved || "",
        body.knownClientSince || "",
        body.adverseInfo || "",
        body.repaymentConcerns || "",
        body.verifiedMonthlyIncome || "",
        body.reasonableRepayment || "",
        body.recommendedAmount || "",
        body.recommendedTerm || 0,
        body.recommendationReason || "",
      ]);

      // =============================================================
      // STEP 4 – References (multiple rows)
      // =============================================================
      await connection.query("DELETE FROM client_kyc_step4 WHERE client_id = ?", [clientId]);

      let references = [];
      try {
        references = body.references ? JSON.parse(body.references) : [];
      } catch (e) {
        references = [];
      }
      if (Array.isArray(references) && references.length > 0) {
        for (const ref of references) {
          await connection.query(
            `INSERT INTO client_kyc_step4 (client_id, reference_name, reference_relationship, reference_location, reference_contact)
             VALUES (?, ?, ?, ?, ?)`,
            [
              clientId,
              ref.referenceName || "",
              ref.referenceRelationship || "",
              ref.referenceLocation || "",
              ref.referenceContact || "",
            ]
          );
        }
      }

      // =============================================================
      // STEP 6 – Guarantor Details
      // =============================================================
      const step6Sql = `
        INSERT INTO client_kyc_step6_guarantor (
          client_id, employee_type,
          guarantor_rank, guarantor_name_of_employer,
          guarantor_work_location, guarantor_years_in_service,
          guarantor_business_name, guarantor_business_location,
          guarantor_years_in_business,
          guarantor_first_name, guarantor_last_name,
          guarantor_phone, guarantor_alt_phone,
          guarantor_id_number, guarantor_relationship,
          guarantor_address, guarantor_residence_location,
          guarantor_church_name, guarantor_church_location,
          photo_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          employee_type = VALUES(employee_type),
          guarantor_rank = VALUES(guarantor_rank),
          guarantor_name_of_employer = VALUES(guarantor_name_of_employer),
          guarantor_work_location = VALUES(guarantor_work_location),
          guarantor_years_in_service = VALUES(guarantor_years_in_service),
          guarantor_business_name = VALUES(guarantor_business_name),
          guarantor_business_location = VALUES(guarantor_business_location),
          guarantor_years_in_business = VALUES(guarantor_years_in_business),
          guarantor_first_name = VALUES(guarantor_first_name),
          guarantor_last_name = VALUES(guarantor_last_name),
          guarantor_phone = VALUES(guarantor_phone),
          guarantor_alt_phone = VALUES(guarantor_alt_phone),
          guarantor_id_number = VALUES(guarantor_id_number),
          guarantor_relationship = VALUES(guarantor_relationship),
          guarantor_address = VALUES(guarantor_address),
          guarantor_residence_location = VALUES(guarantor_residence_location),
          guarantor_church_name = VALUES(guarantor_church_name),
          guarantor_church_location = VALUES(guarantor_church_location),
          photo_path = VALUES(photo_path)
      `;
      await connection.query(step6Sql, [
        clientId,
        body.guarantorEmployeeType || "salary worker",
        body.guarantorRank || "",
        body.guarantorNameOfEmployer || "",
        body.guarantorWorkLocation || "",
        body.guarantorYearsInService || null,
        body.guarantorBusinessName || "",
        body.guarantorBusinessLocation || "",
        body.guarantorYearsInBusiness || null,
        body.guarantorFirstName || "",
        body.guarantorLastName || "",
        body.guarantorPhone || "",
        body.guarantorAltPhone || "",
        body.guarantorIdNumber || "",
        body.guarantorRelationship || "",
        body.guarantorAddress || "",
        body.guarantorResidenceLocation || "",
        body.guarantorChurchName || "",
        body.guarantorChurchLocation || "",
        guarantorPhotoPath || "",
      ]);

      // =============================================================
      // STEP 5 – Client Documents
      // =============================================================
      for (const file of clientDocFiles) {
        const match = file.fieldname.match(/clientDocuments\[(\d+)\]\[file\]/);
        if (match) {
          const idx = parseInt(match[1], 10);
          const displayName = body[`clientDocuments[${idx}][name]`] || file.originalname;
          const relativePath = getRelativePath(file, uploadDir);
          await connection.query(
            `INSERT INTO client_documents (client_id, display_name, original_filename, file_path, file_size, mime_type)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [clientId, displayName, file.originalname, relativePath, file.size, file.mimetype]
          );
        }
      }

      // =============================================================
      // STEP 7 – Guarantor Documents
      // =============================================================
      for (const file of guarantorDocFiles) {
        const match = file.fieldname.match(/guarantorDocuments\[(\d+)\]\[file\]/);
        if (match) {
          const idx = parseInt(match[1], 10);
          const displayName = body[`guarantorDocuments[${idx}][name]`] || file.originalname;
          const relativePath = getRelativePath(file, uploadDir);
          await connection.query(
            `INSERT INTO client_guarantor_documents (client_id, display_name, original_filename, file_path, file_size, mime_type)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [clientId, displayName, file.originalname, relativePath, file.size, file.mimetype]
          );
        }
      }

      // =============================================================
      // STEP 8 – Loan History
      // =============================================================
      if (body.loans) {
        let loans = [];
        try {
          loans = JSON.parse(body.loans);
        } catch (e) {}
        if (Array.isArray(loans) && loans.length > 0) {
          await connection.query("DELETE FROM client_loan_history WHERE client_id = ?", [clientId]);
          for (const loan of loans) {
            await connection.query(
              `INSERT INTO client_loan_history (
                client_id, date_disbursed, institution, principal_amount,
                installment_amount, current_balance, arrears_balance, expiry_date
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                clientId,
                loan.dateDisbursed || null,
                loan.institution || "",
                loan.principalAmount || 0,
                loan.installmentAmount || 0,
                loan.currentBalance || 0,
                loan.arrearsBalance || 0,
                loan.expiryDate || null,
              ]
            );
          }
        }
      }

      // Commit transaction
      await connection.commit();
      res.status(200).json({ success: true, clientId });

    } catch (err) {
      await connection.rollback();
      console.error("Submit error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    } finally {
      connection.release();
    }
  }
);







export default router;