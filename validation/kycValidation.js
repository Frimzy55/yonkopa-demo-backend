// validation/kycValidation.js
const Joi = require('joi');

// Personal Info Validation Schema
const personalInfoSchema = Joi.object({
  title: Joi.string().valid('Mr', 'Mrs', 'Ms', 'Dr', 'Prof').required(),
  firstName: Joi.string().min(2).max(50).required(),
  middleName: Joi.string().max(50).allow('', null),
  lastName: Joi.string().min(2).max(50).required(),
  dateOfBirth: Joi.date().max('now').required().custom((value, helpers) => {
    const age = new Date().getFullYear() - new Date(value).getFullYear();
    if (age < 18) return helpers.error('age.invalid');
    return value;
  }).messages({
    'age.invalid': 'You must be at least 18 years old'
  }),
  gender: Joi.string().valid('Male', 'Female', 'Other').required(),
  maritalStatus: Joi.string().valid('Single', 'Married', 'Divorced', 'Widowed').required(),
  nationalId: Joi.string().pattern(/^[A-Z0-9-]+$/i).min(6).max(20).required(),
  residentialLocation: Joi.string().min(5).max(200).required(),
  spouseName: Joi.string().max(100).when('maritalStatus', {
    is: 'Married',
    then: Joi.required(),
    otherwise: Joi.allow('', null)
  }),
  spouseContact: Joi.string().pattern(/^[0-9]{10,15}$/).when('maritalStatus', {
    is: 'Married',
    then: Joi.required(),
    otherwise: Joi.allow('', null)
  })
});

// Contact Info Validation Schema
const contactInfoSchema = Joi.object({
  mobileNumber: Joi.string().pattern(/^[0-9]{10,15}$/).required(),
  email: Joi.string().email().required(),
  residentialAddress: Joi.string().min(10).max(200).required(),
  residentialLandmark: Joi.string().max(100).required(),
  city: Joi.string().min(2).max(50).required(),
  state: Joi.string().min(2).max(50).required(),
  alternatePhone: Joi.string().pattern(/^[0-9]{10,15}$/).allow('', null)
});

// Employment Info Validation Schema
const employmentInfoSchema = Joi.object({
  employmentStatus: Joi.string().valid('Employed', 'Self-Employed', 'Unemployed', 'Student', 'Retired').required(),
  
  // Employed fields
  employerName: Joi.string().min(2).max(100).when('employmentStatus', {
    is: 'Employed',
    then: Joi.required(),
    otherwise: Joi.allow('', null)
  }),
  jobTitle: Joi.string().min(2).max(100).when('employmentStatus', {
    is: 'Employed',
    then: Joi.required(),
    otherwise: Joi.allow('', null)
  }),
  monthlyIncome: Joi.number().positive().when('employmentStatus', {
    is: 'Employed',
    then: Joi.required(),
    otherwise: Joi.allow('', null)
  }),
  yearsInCurrentEmployment: Joi.number().min(0).max(50).when('employmentStatus', {
    is: 'Employed',
    then: Joi.required(),
    otherwise: Joi.allow('', null)
  }),
  workPlaceLocation: Joi.string().min(5).max(200).when('employmentStatus', {
    is: 'Employed',
    then: Joi.required(),
    otherwise: Joi.allow('', null)
  }),
  
  // Self-Employed fields
  businessName: Joi.string().min(2).max(100).when('employmentStatus', {
    is: 'Self-Employed',
    then: Joi.required(),
    otherwise: Joi.allow('', null)
  }),
  businessType: Joi.string().min(2).max(50).when('employmentStatus', {
    is: 'Self-Employed',
    then: Joi.required(),
    otherwise: Joi.allow('', null)
  }),
  monthlyBusinessIncome: Joi.number().positive().when('employmentStatus', {
    is: 'Self-Employed',
    then: Joi.required(),
    otherwise: Joi.allow('', null)
  }),
  businessLocation: Joi.string().min(5).max(200).when('employmentStatus', {
    is: 'Self-Employed',
    then: Joi.required(),
    otherwise: Joi.allow('', null)
  }),
  businessGpsAddress: Joi.string().pattern(/^[A-Z0-9-]{5,20}$/i).allow('', null),
  numberOfWorkers: Joi.number().min(0).max(1000).when('employmentStatus', {
    is: 'Self-Employed',
    then: Joi.required(),
    otherwise: Joi.allow('', null)
  }),
  yearsInBusiness: Joi.number().min(0).max(100).when('employmentStatus', {
    is: 'Self-Employed',
    then: Joi.required(),
    otherwise: Joi.allow('', null)
  }),
  workingCapital: Joi.number().positive().allow('', null),
  
  // File validations (to be checked separately)
  payslip: Joi.any(),
  ghanaCardFront: Joi.any(),
  ghanaCardBack: Joi.any(),
  employmentId: Joi.any(),
  businessPicture: Joi.any()
});

// Reference Info Validation Schema
const referenceInfoSchema = Joi.object({
  referenceName1: Joi.string().min(2).max(100).required(),
  referencePhone1: Joi.string().pattern(/^[0-9]{10,15}$/).required(),
  referenceRelationship1: Joi.string().min(2).max(50).required(),
  referenceName2: Joi.string().min(2).max(100).required(),
  referencePhone2: Joi.string().pattern(/^[0-9]{10,15}$/).required(),
  referenceRelationship2: Joi.string().min(2).max(50).required()
});

// File validation function
const validateFiles = (files, employmentStatus) => {
  const errors = [];
  const maxSize = 5 * 1024 * 1024; // 5MB
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];

  // Validate avatar
  if (!files.avatar?.[0]) {
    errors.push('Avatar is required');
  } else if (files.avatar[0].size > maxSize) {
    errors.push('Avatar must be less than 5MB');
  } else if (!allowedTypes.includes(files.avatar[0].mimetype)) {
    errors.push('Avatar must be JPEG, PNG, or PDF');
  }

  // Validate Ghana Card
  if (!files.ghanaCardFront?.[0]) {
    errors.push('Ghana Card Front is required');
  } else if (files.ghanaCardFront[0].size > maxSize) {
    errors.push('Ghana Card Front must be less than 5MB');
  }

  if (!files.ghanaCardBack?.[0]) {
    errors.push('Ghana Card Back is required');
  } else if (files.ghanaCardBack[0].size > maxSize) {
    errors.push('Ghana Card Back must be less than 5MB');
  }

  // Employment-based file validations
  if (employmentStatus === 'Employed') {
    if (!files.payslip?.[0]) {
      errors.push('Payslip is required for employed individuals');
    } else if (files.payslip[0].size > maxSize) {
      errors.push('Payslip must be less than 5MB');
    }
    
    if (!files.employmentId?.[0]) {
      errors.push('Employment ID is required for employed individuals');
    } else if (files.employmentId[0].size > maxSize) {
      errors.push('Employment ID must be less than 5MB');
    }
  } else if (employmentStatus === 'Self-Employed') {
    if (!files.businessPicture?.[0]) {
      errors.push('Business Picture is required for self-employed individuals');
    } else if (files.businessPicture[0].size > maxSize) {
      errors.push('Business Picture must be less than 5MB');
    }
  }

  return errors;
};

// Validation middleware
const validateStep = (step) => {
  return async (req, res, next) => {
    let schema;
    let dataToValidate = req.body;

    switch(step) {
      case 'personal':
        schema = personalInfoSchema;
        break;
      case 'contact':
        schema = contactInfoSchema;
        break;
      case 'employment':
        schema = employmentInfoSchema;
        break;
      case 'reference':
        schema = referenceInfoSchema;
        break;
      default:
        return next();
    }

    try {
      await schema.validateAsync(dataToValidate, { abortEarly: false });
      
      // Additional file validation for employment step
      if (step === 'employment' && req.files) {
        const fileErrors = validateFiles(req.files, req.body.employmentStatus);
        if (fileErrors.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'File validation failed',
            errors: fileErrors
          });
        }
      }
      
      next();
    } catch (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors
      });
    }
  };
};

module.exports = { validateStep };