import { calculateLoanService } from "../services/loanService.js";

export const calculateLoan = (req, res) => {
  const result = calculateLoanService(req.body);
  res.json(result);
};