/*import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Absolute path where files will be stored on disk
const uploadDir = path.join(__dirname, "../uploads");

// Create the uploads folder if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Custom storage engine that adds a 'relativePath' property
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename = file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname).toLowerCase();
    cb(null, filename);
  }
});

// File filter (only images)
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp", "image/heic", "image/heif"];
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];

  const hasValidMime = allowedTypes.includes(file.mimetype);
  const hasValidExt = allowedExtensions.some(ext =>
    file.originalname.toLowerCase().endsWith(ext)
  );

  if (hasValidMime || hasValidExt) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

// Create the multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

// ✅ Middleware to attach a 'relativePath' to every uploaded file
// This runs after multer has processed the files
export const attachRelativePath = (req, res, next) => {
  if (req.files) {
    // For multiple fields (upload.fields)
    Object.keys(req.files).forEach(fieldName => {
      req.files[fieldName] = req.files[fieldName].map(file => {
        // Build relative path: uploads\filename (Windows backslashes)
        const relativePath = `uploads\\${file.filename}`;
        return { ...file, relativePath };
      });
    });
  } else if (req.file) {
    // For single file (upload.single)
    const relativePath = `uploads\\${req.file.filename}`;
    req.file.relativePath = relativePath;
  }
  next();
};

// Export both the multer instance and the middleware
export { upload };*/




import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Absolute path where files will be stored on disk
const uploadDir = path.join(__dirname, "../uploads");

// Create the uploads folder if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Custom storage engine that adds a 'relativePath' property
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix =
      Date.now() + "-" + Math.round(Math.random() * 1e9);

    const filename =
      file.fieldname +
      "-" +
      uniqueSuffix +
      path.extname(file.originalname).toLowerCase();

    cb(null, filename);
  },
});

// File filter (images + PDF)
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/webp",
    "image/heic",
    "image/heif",
    "application/pdf",
  ];

  const allowedExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".heic",
    ".heif",
    ".pdf",
  ];

  const hasValidMime = allowedTypes.includes(file.mimetype);

  const hasValidExt = allowedExtensions.some((ext) =>
    file.originalname.toLowerCase().endsWith(ext)
  );

  if (hasValidMime || hasValidExt) {
    cb(null, true);
  } else {
    cb(new Error("Only image files and PDF files are allowed"), false);
  }
};

// Create the multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
  },
});

// ✅ Middleware to attach a 'relativePath' to every uploaded file
export const attachRelativePath = (req, res, next) => {
  if (req.files) {
    // For multiple fields (upload.fields)
    Object.keys(req.files).forEach((fieldName) => {
      req.files[fieldName] = req.files[fieldName].map((file) => {
        const relativePath = `uploads\\${file.filename}`;

        return {
          ...file,
          relativePath,
        };
      });
    });
  } else if (req.file) {
    // For single file (upload.single)
    const relativePath = `uploads\\${req.file.filename}`;
    req.file.relativePath = relativePath;
  }

  next();
};

// Export both the multer instance and the middleware
export { upload };