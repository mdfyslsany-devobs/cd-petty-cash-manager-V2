export type Department = 'Pathology' | 'ICU' | 'NICU' | 'ICU/CCU Pharmacy' | 'Dialysis' | 'CT Scan' | 'Hospital';

export type Category = string;

export interface Expense {
  id: string;
  date: string;
  department: Department;
  category: Category;
  amount: number;
  description: string;
  receiptUrl?: string;
  createdAt: number;
  createdBy: string;
}

export interface CashIn {
  id: string;
  date: string;
  amount: number;
  source: string;
  createdAt: number;
  createdBy: string;
}

export const DEPARTMENTS: Department[] = [
  'Pathology',
  'ICU',
  'ICU/CCU Pharmacy',
  'NICU',
  'Dialysis',
  'CT Scan',
  'Hospital'
];

export const DEFAULT_CATEGORIES: Category[] = [
  'Medical Supplies',
  'Laboratory Reagents',
  'Cleaning Supplies',
  'Stationaries',
  'Office Supplies',
  'Maintenance',
  'Repairs & Maintenance',
  'Emergency Staff Refreshments',
  'Utilities',
  'IT Support & Software',
  'Laundry Services',
  'Waste Management',
  'Patient Food & Nutrition',
  'Travel & Transport',
  'Printing & Photocopying',
  'Uniforms & Apparel',
  'Security Services',
  'Postage & Courier',
  'Miscellaneous'
];

// ==================== PROCUREMENT ADVANCE TYPES ====================

export type ProcurementAdvanceStatus = 'Pending' | 'Adjusted' | 'Returned';

export interface ProcurementAdvance {
  id: string;
  date: string;
  officerName: string;
  advanceAmount: number;
  purpose: string;
  expectedPurchaseDate: string;
  status: ProcurementAdvanceStatus;
  adjustments?: ProcurementAdjustment[];
  createdAt: number;
  createdBy: string;
  updatedAt?: number;
}

export interface ProcurementAdjustment {
  id: string;
  finalPurchaseAmount?: number;
  returnedAmount?: number;
  notes: string;
  invoiceUrl?: string;
  adjustedAt: number;
}

// ==================== STAFF LOAN TYPES ====================

export type LoanStatus = 'Unpaid' | 'Partially Paid' | 'Paid';

export interface StaffLoan {
  id: string;
  date: string;
  staffName: string;
  department: Department;
  amount: number;
  reason: string;
  returnDeadline: string;
  status: LoanStatus;
  repayments: RepaymentEntry[];
  createdAt: number;
  createdBy: string;
  updatedAt?: number;
}

export interface RepaymentEntry {
  id: string;
  paymentDate: string;
  paidAmount: number;
  notes: string;
  recordedAt: number;
}

// ==================== CREDIT PURCHASE TYPES ====================

export type CreditPurchaseStatus = 'Unpaid' | 'Partially Paid' | 'Paid';

export interface CreditPurchase {
  id: string;
  date: string;
  vendorName: string;
  description: string;
  billAmount: number;
  duePaymentDate: string;
  invoiceNumber: string;
  department: Department;
  notes?: string;
  status: CreditPurchaseStatus;
  payments: PaymentEntry[];
  invoiceUrl?: string;
  createdAt: number;
  createdBy: string;
  updatedAt?: number;
}

export interface PaymentEntry {
  id: string;
  paymentDate: string;
  paidAmount: number;
  notes: string;
  recordedAt: number;
}

// ==================== EXPORT/IMPORT TYPES ====================

export interface ModuleDataBackup {
  procurementAdvances: ProcurementAdvance[];
  staffLoans: StaffLoan[];
  creditPurchases: CreditPurchase[];
  exportedAt: number;
}
