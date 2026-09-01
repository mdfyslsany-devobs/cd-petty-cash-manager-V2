// ============================================================================
// PROCUREMENT ADVANCE MODULE - TYPES & UTILITIES
// ============================================================================

import { ProcurementAdvance, StaffLoan, CreditPurchase, ProcurementAdvanceStatus } from './types';

export function calculateProcurementStats(advances: ProcurementAdvance[]) {
  const totalPending = advances
    .filter(a => a.status === 'Pending')
    .reduce((sum, a) => sum + a.advanceAmount, 0);

  const totalAdjusted = advances
    .filter(a => a.status === 'Adjusted')
    .reduce((sum, a) => sum + a.advanceAmount, 0);

  const totalReturned = advances
    .filter(a => a.status === 'Returned')
    .reduce((sum, a) => sum + a.advanceAmount, 0);

  const officerSummary = advances.reduce((acc: Record<string, { pending: number; adjusted: number; returned: number }>, a) => {
    if (!acc[a.officerName]) {
      acc[a.officerName] = { pending: 0, adjusted: 0, returned: 0 };
    }
    if (a.status === 'Pending') acc[a.officerName].pending += a.advanceAmount;
    if (a.status === 'Adjusted') acc[a.officerName].adjusted += a.advanceAmount;
    if (a.status === 'Returned') acc[a.officerName].returned += a.advanceAmount;
    return acc;
  }, {});

  return { totalPending, totalAdjusted, totalReturned, officerSummary };
}

// ============================================================================
// STAFF LOAN MODULE - CALCULATIONS
// ============================================================================

export function calculateLoanStats(loans: StaffLoan[]) {
  const totalLoaned = loans.reduce((sum, l) => sum + l.amount, 0);

  const totalRecovered = loans.reduce((sum, l) => {
    const repaid = l.repayments.reduce((rsum, r) => rsum + r.paidAmount, 0);
    return sum + repaid;
  }, 0);

  const pendingAmount = totalLoaned - totalRecovered;

  const staffSummary = loans.reduce((acc: Record<string, { amount: number; repaid: number; pending: number; status: string }>, l) => {
    const repaid = l.repayments.reduce((sum, r) => sum + r.paidAmount, 0);
    const pending = l.amount - repaid;
    if (!acc[l.staffName]) {
      acc[l.staffName] = { amount: 0, repaid: 0, pending: 0, status: l.status };
    }
    acc[l.staffName].amount += l.amount;
    acc[l.staffName].repaid += repaid;
    acc[l.staffName].pending += pending;
    return acc;
  }, {});

  const overdueLoan = loans.filter(l => {
    const deadline = new Date(l.returnDeadline);
    const today = new Date();
    return deadline < today && l.status !== 'Paid';
  });

  return { totalLoaned, totalRecovered, pendingAmount, staffSummary, overdueLoan };
}

// ============================================================================
// CREDIT PURCHASE MODULE - CALCULATIONS
// ============================================================================

export function calculateCreditStats(purchases: CreditPurchase[]) {
  const totalPurchase = purchases.reduce((sum, p) => sum + p.billAmount, 0);

  const totalPaid = purchases.reduce((sum, p) => {
    const paid = p.payments.reduce((psum, pm) => psum + pm.paidAmount, 0);
    return sum + paid;
  }, 0);

  const totalDue = totalPurchase - totalPaid;

  const vendorSummary = purchases.reduce((acc: Record<string, { purchase: number; paid: number; due: number }>, p) => {
    const paid = p.payments.reduce((sum, pm) => sum + pm.paidAmount, 0);
    if (!acc[p.vendorName]) {
      acc[p.vendorName] = { purchase: 0, paid: 0, due: 0 };
    }
    acc[p.vendorName].purchase += p.billAmount;
    acc[p.vendorName].paid += paid;
    acc[p.vendorName].due += p.billAmount - paid;
    return acc;
  }, {});

  const monthlyDue = calculateMonthlyDue(purchases);

  const overduePayments = purchases.filter(p => {
    const dueDate = new Date(p.duePaymentDate);
    const today = new Date();
    return dueDate < today && p.status !== 'Paid';
  });

  return { totalPurchase, totalPaid, totalDue, vendorSummary, monthlyDue, overduePayments };
}

export function calculateMonthlyDue(purchases: CreditPurchase[]): Record<string, number> {
  const monthlyMap: Record<string, number> = {};

  purchases.forEach(p => {
    const dueDate = new Date(p.duePaymentDate);
    const monthKey = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;
    const paid = p.payments.reduce((sum, pm) => sum + pm.paidAmount, 0);
    const due = p.billAmount - paid;
    if (!monthlyMap[monthKey]) monthlyMap[monthKey] = 0;
    monthlyMap[monthKey] += due;
  });

  return monthlyMap;
}

// ============================================================================
// COMMON UTILITY FUNCTIONS
// ============================================================================

export function getRemainingBalance(amount: number, payments: Array<{ paidAmount: number }>): number {
  const paid = payments.reduce((sum, p) => sum + p.paidAmount, 0);
  return Math.max(0, amount - paid);
}

export function isOverdue(dueDate: string): boolean {
  return new Date(dueDate) < new Date();
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatBDT(amount: number): string {
  const safe = Number(amount) || 0;
  return `৳${safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function numberToWords(num: number): string {
  const safeNum = Number(num);
  if (!Number.isFinite(safeNum) || safeNum === 0) return "Zero Taka Only";
  
  const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", 
                 "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertChunk(n: number): string {
    let str = "";
    if (n >= 100) {
      str += units[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + " ";
      n %= 10;
    }
    if (n > 0) {
      str += units[n] + " ";
    }
    return str.trim();
  }

  let taka = Math.floor(Math.abs(safeNum));
  let poisha = Math.round((Math.abs(safeNum) - taka) * 100);
  let words = "";

  if (taka >= 10000000) {
    words += convertChunk(Math.floor(taka / 10000000)) + " Crore ";
    taka %= 10000000;
  }
  if (taka >= 100000) {
    words += convertChunk(Math.floor(taka / 100000)) + " Lakh ";
    taka %= 100000;
  }
  if (taka >= 1000) {
    words += convertChunk(Math.floor(taka / 1000)) + " Thousand ";
    taka %= 1000;
  }
  if (taka > 0) {
    words += convertChunk(taka) + " ";
  }

  words = words.trim() + " Taka";

  if (poisha > 0) {
    words += " and " + convertChunk(poisha) + " Poisha";
  }

  return words + " Only";
}
