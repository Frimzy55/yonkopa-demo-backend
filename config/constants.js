// Allowed origins for CORS
export const allowedOrigins = [
  "http://localhost:3001",
    "http://localhost:3000",
  "https://www.yonkopamicrocredit.com",
  "https://yonkopamicrocredit.com",
  "https://207.154.233.29",
   "https://demo.yonkopamicrocredit.com"
];

// JWT secret based on environment
export const getJwtSecret = () => {
  return process.env.NODE_ENV === "development" 
    ? process.env.JWT_SECRET_DEV
    : process.env.JWT_SECRET;
};

// Paystack secret
export const getPaystackSecret = () => {
  return process.env.NODE_ENV === "development" 
    ? process.env.PAYSTACK_SECRET_KEY_DEV
    : process.env.PAYSTACK_SECRET_KEY_PROD;
};