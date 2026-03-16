export const calculateLoanService = (data) => {
  const {
    loanAmount,
    loanTerm,
    repaymentFrequency,
    employmentStatus
  } = data;

  let monthlyRate = 0;

  if (employmentStatus === "self-employed") {
    monthlyRate = 0.0667;
  } else if (employmentStatus === "salary-worker") {
    monthlyRate = 0.06;
  }

  const interest = loanAmount * monthlyRate * loanTerm;
  const totalAmount = loanAmount + interest;

  const numberOfPayments =
    repaymentFrequency === "Weekly"
      ? loanTerm * 4
      : loanTerm;

  const monthlyPayment =
    numberOfPayments > 0
      ? totalAmount / numberOfPayments
      : 0;

  let loanFees = 0;

  if (employmentStatus === "self-employed") {
    loanFees = loanAmount * 0.07;
  } else if (employmentStatus === "salary-worker") {
    loanFees = loanAmount * 0.05;
  }

  return {
    interest,
    totalAmount,
    numberOfPayments,
    monthlyPayment,
    loanFees
  };
};