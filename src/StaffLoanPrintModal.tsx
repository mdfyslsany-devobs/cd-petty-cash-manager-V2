import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  X, 
  FileText, 
  Receipt, 
  CheckCircle2, 
  AlertTriangle, 
  Building2, 
  User, 
  Calendar, 
  DollarSign, 
  ShieldCheck, 
  FileSignature 
} from 'lucide-react';
import { StaffLoan } from './types';
import { 
  formatDate, 
  formatBDT, 
  getRemainingBalance, 
  numberToWords, 
  isOverdue 
} from './ModuleCalculations';

// Brand Logo URL
const logoUrl = new URL('../CDPathlogo.png', import.meta.url).href;

export interface StaffLoanPrintModalProps {
  loan: StaffLoan;
  onClose: () => void;
}

export function StaffLoanPrintModal({ loan, onClose }: StaffLoanPrintModalProps) {
  const [printMode, setPrintMode] = useState<'a4' | 'pos'>('a4');

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handlePrint = () => {
    // Small delay to ensure all assets and styles are fully rendered
    setTimeout(() => {
      window.print();
    }, 120);
  };

  const repaid = loan.repayments.reduce((sum, r) => sum + r.paidAmount, 0);
  const remaining = getRemainingBalance(loan.amount, loan.repayments);
  const voucherId = `SLR-${loan.id.slice(-6).toUpperCase()}`;
  const isLoanOverdue = isOverdue(loan.returnDeadline) && loan.status !== 'Paid';

  // Status color styles
  const statusBadgeStyle = {
    Unpaid: 'bg-red-50 text-red-700 border-red-200',
    'Partially Paid': 'bg-amber-50 text-amber-700 border-amber-200',
    Paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }[loan.status] || 'bg-slate-50 text-slate-700 border-slate-200';

  return (
    <div className="voucher-print-root fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto print:p-0 print:static print:bg-transparent">
      <div className="relative w-full max-w-4xl max-h-[94vh] flex flex-col bg-slate-100 rounded-2xl shadow-2xl overflow-hidden border border-slate-300 print:max-w-full print:max-h-none print:shadow-none print:rounded-none print:border-none print:bg-white print:overflow-visible">
        
        {/* Modal Toolbar Header - Hidden during print */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 bg-white border-b border-slate-200 print:hidden z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">
                Staff Loan Agreement & Receipt
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Voucher Ref: <span className="font-mono font-semibold text-slate-700">{voucherId}</span> &bull; {loan.staffName}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Format Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPrintMode('a4')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  printMode === 'a4'
                    ? 'bg-white text-emerald-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Standard A4 Document Layout"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Standard A4</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintMode('pos')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  printMode === 'pos'
                    ? 'bg-white text-emerald-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Thermal POS Receipt Layout (80mm)"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Thermal POS</span>
              </button>
            </div>

            {/* Print Trigger Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm shadow-emerald-600/20"
            >
              <Printer className="w-4 h-4" />
              <span>Print Invoice / Receipt</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              aria-label="Close modal"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 flex justify-center print:p-0 print:overflow-visible print:block">
          
          {/* ========================================================================= */}
          {/* A4 FORMAT LAYOUT - OPTIMIZED FOR STRICT 1-PAGE A4 PRINTING */}
          {/* ========================================================================= */}
          {printMode === 'a4' && (
            <div
              id="printable-loan-voucher"
              className="voucher-print-sheet loan-print-sheet bg-white rounded-xl shadow-lg border border-slate-200 w-full max-w-[210mm] p-6 sm:p-8 space-y-2.5 print:space-y-2 text-slate-900 relative print:shadow-none print:border-none print:rounded-none print:w-full print:max-w-full print:p-0 print:m-0"
            >
              {/* Header: Hospital Branding & Document Title */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-3 print:pb-2">
                <div className="flex items-start gap-3">
                  <img
                    src={logoUrl}
                    alt="CD Path & Hospital Logo"
                    className="h-12 w-12 object-contain rounded flex-shrink-0"
                  />
                  <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">
                      CD PATH & HOSPITAL
                    </h1>
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">
                      Petty Cash & Staff Accounts Division
                    </p>
                    <p className="text-[9.5px] text-slate-500 mt-0.5">
                      CD Path Road, Hospital Square &bull; Dhaka, Bangladesh &bull; Hotline: +880 2-9876543
                    </p>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end">
                  <span className="inline-block bg-slate-900 text-white font-extrabold text-[11px] px-3 py-1 rounded uppercase tracking-wider mb-1 print:bg-black print:text-white">
                    Staff Loan Agreement & Receipt
                  </span>
                  <div className="text-[11px] text-slate-600 space-y-0.5">
                    <p>
                      Voucher No: <strong className="font-mono text-slate-900 font-bold">{voucherId}</strong>
                    </p>
                    <p>
                      Disbursal Date: <strong className="text-slate-800">{formatDate(loan.date)}</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* Status & Overdue Alert Banner */}
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs print:text-[10px] print:py-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-600 uppercase tracking-wider text-[10px]">
                    Account Status:
                  </span>
                  <span className={`px-2 py-0.5 rounded-full font-bold border text-[10px] ${statusBadgeStyle}`}>
                    {loan.status}
                  </span>
                  {isLoanOverdue && (
                    <span className="flex items-center gap-1 bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full border border-red-300 text-[10px]">
                      <AlertTriangle className="w-3 h-3" />
                      OVERDUE DEADLINE
                    </span>
                  )}
                </div>
                <div className="text-slate-500 font-medium">
                  Repayment Due Date: <strong className="text-slate-900">{formatDate(loan.returnDeadline)}</strong>
                </div>
              </div>

              {/* Staff & Loan Metadata Grid */}
              <div className="grid grid-cols-2 gap-2.5 border border-slate-300 rounded-lg p-2.5 print:p-2 bg-slate-50/60 text-xs">
                <div>
                  <p className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                    Staff Member / Borrower Name
                  </p>
                  <p className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-600 print:hidden" />
                    {loan.staffName}
                  </p>
                </div>
                <div>
                  <p className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                    Hospital Department / Unit
                  </p>
                  <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-500 print:hidden" />
                    {loan.department}
                  </p>
                </div>
                <div>
                  <p className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                    Disbursed Date
                  </p>
                  <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 print:hidden" />
                    {formatDate(loan.date)}
                  </p>
                </div>
                <div>
                  <p className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                    Agreed Repayment Deadline
                  </p>
                  <p className={`font-bold flex items-center gap-1.5 ${isLoanOverdue ? 'text-red-700' : 'text-slate-900'}`}>
                    <Calendar className="w-3.5 h-3.5 text-slate-400 print:hidden" />
                    {formatDate(loan.returnDeadline)}
                  </p>
                </div>
              </div>

              {/* Loan Purpose / Particulars */}
              <div className="border border-slate-300 rounded-lg p-2.5 print:p-2 text-xs bg-white">
                <p className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                  Purpose / Reason for Loan
                </p>
                <p className="font-medium text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {loan.reason || 'Staff Personal Advance / Official Loan Request'}
                </p>
              </div>

              {/* Financial Balance Summary Table */}
              <div className="border border-slate-300 rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-300">
                    <tr>
                      <th className="px-3 py-2">Total Principal Loan</th>
                      <th className="px-3 py-2 text-right">Total Recovered / Repaid</th>
                      <th className="px-3 py-2 text-right">Remaining Balance Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr className="bg-white">
                      <td className="px-3 py-2">
                        <span className="text-base font-black text-slate-900">
                          {formatBDT(loan.amount)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-emerald-700">
                        {formatBDT(repaid)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className={`text-base font-black ${remaining > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                          {formatBDT(remaining)}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Amount In Words Highlight Box */}
              <div className="bg-slate-900 text-white rounded-lg px-3 py-2 print:bg-slate-100 print:text-slate-900 print:border print:border-slate-400">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 print:text-slate-600">
                  Principal Loan Amount (In Words)
                </p>
                <p className="text-xs font-bold text-amber-300 print:text-slate-900 mt-0.5 italic tracking-wide">
                  {numberToWords(loan.amount)}
                </p>
              </div>

              {/* Repayments Ledger (if installments exist) */}
              {loan.repayments && loan.repayments.length > 0 && (
                <div className="border border-slate-300 rounded-lg p-2.5 text-xs space-y-1.5 bg-slate-50/40">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                    <h4 className="font-bold text-slate-900 text-[10px] uppercase tracking-wider">
                      Repayment Installment Ledger ({loan.repayments.length} Entry{loan.repayments.length !== 1 ? 's' : ''})
                    </h4>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Recovered: <strong className="text-emerald-700">{formatBDT(repaid)}</strong>
                    </span>
                  </div>
                  <table className="w-full text-[10px] text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-bold">
                        <th className="py-1 px-1.5">#</th>
                        <th className="py-1 px-1.5">Payment Date</th>
                        <th className="py-1 px-1.5 text-right">Paid Amount</th>
                        <th className="py-1 px-1.5">Notes / Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loan.repayments.map((rep, idx) => (
                        <tr key={rep.id || idx} className="hover:bg-slate-50/80">
                          <td className="py-1 px-1.5 font-mono text-slate-500">{idx + 1}</td>
                          <td className="py-1 px-1.5 font-semibold text-slate-800">{formatDate(rep.paymentDate)}</td>
                          <td className="py-1 px-1.5 text-right font-bold text-emerald-700">{formatBDT(rep.paidAmount)}</td>
                          <td className="py-1 px-1.5 text-slate-600">{rep.notes || 'Repayment installment received'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Terms & Conditions / Repayment Undertaking */}
              <div className="border border-slate-300 rounded-lg p-2.5 print:p-2 text-[10px] print:text-[9.5px] text-slate-700 bg-slate-50/50 space-y-1 leading-snug">
                <div className="flex items-center gap-1 font-bold text-slate-900 uppercase tracking-wider text-[10px]">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 print:hidden" />
                  <span>Declaration & Repayment Terms</span>
                </div>
                <div className="space-y-1 text-slate-600 leading-tight">
                  <p>
                    1. <strong>Acknowledgment of Receipt:</strong> I, the undersigned borrower (<strong className="text-slate-900">{loan.staffName}</strong>), acknowledge receiving the loan sum of <strong className="text-slate-900">{formatBDT(loan.amount)}</strong> (<em className="text-slate-800">{numberToWords(loan.amount)}</em>) in cash from the Petty Cash fund of <strong>CD Path & Hospital</strong>.
                  </p>
                  <p>
                    2. <strong>Repayment Undertaking:</strong> I agree and undertake to repay the entire outstanding loan balance on or before the due date (<strong className="text-slate-900">{formatDate(loan.returnDeadline)}</strong>) in accordance with the hospital policy.
                  </p>
                  <p>
                    3. <strong>Salary Deduction Authorization:</strong> In case of default or departure from service, I unconditionally authorize <strong>CD Path & Hospital</strong> management to deduct the remaining unpaid loan balance directly from my monthly salary, allowances, or final settlement dues.
                  </p>
                  <p>
                    4. <strong>Binding Agreement:</strong> This voucher constitutes a legally binding acknowledgement of debt and official financial agreement.
                  </p>
                </div>
              </div>

              {/* Signatures Block: 3 Side-by-Side Zones */}
              <div className="pt-6 sm:pt-8 print:pt-4 grid grid-cols-3 gap-6 text-center text-xs font-semibold text-slate-700 page-break-inside-avoid">
                {/* Zone 1: Prepared By */}
                <div className="flex flex-col items-center">
                  <div className="w-full border-t-2 border-slate-900 pt-1.5 print:border-black">
                    <p className="font-bold text-slate-900 uppercase tracking-wider text-[10.5px]">
                      Prepared By
                    </p>
                    <p className="text-[9.5px] text-slate-500 font-normal mt-0.5">
                      Accounts Officer / Cashier
                    </p>
                    <p className="text-[8.5px] text-slate-400 font-mono mt-0.5">
                      Date: _______________
                    </p>
                  </div>
                </div>

                {/* Zone 2: Received By (Staff Member) */}
                <div className="flex flex-col items-center">
                  <div className="w-full border-t-2 border-slate-900 pt-1.5 print:border-black">
                    <p className="font-bold text-slate-900 uppercase tracking-wider text-[10.5px]">
                      Received By (Staff Member)
                    </p>
                    <p className="text-[10px] text-slate-800 font-bold mt-0.5 truncate max-w-full">
                      {loan.staffName}
                    </p>
                    <p className="text-[8.5px] text-slate-500">
                      Dept: {loan.department}
                    </p>
                  </div>
                </div>

                {/* Zone 3: Authorized Signature (Authority) */}
                <div className="flex flex-col items-center">
                  <div className="w-full border-t-2 border-slate-900 pt-1.5 print:border-black">
                    <p className="font-bold text-slate-900 uppercase tracking-wider text-[10.5px]">
                      Authorized Signature
                    </p>
                    <p className="text-[9.5px] text-slate-500 font-normal mt-0.5">
                      Director / Accounts Head
                    </p>
                    <p className="text-[8.5px] text-slate-400 font-mono mt-0.5">
                      Official Seal & Approval
                    </p>
                  </div>
                </div>
              </div>

              {/* System Footer Note */}
              <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-[9px] text-slate-400 print:text-slate-500">
                <span>CD Path & Hospital &bull; Staff Loan Agreement & Receipt &bull; {voucherId}</span>
                <span>Printed: {new Date().toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* THERMAL POS RECEIPT LAYOUT (80mm) */}
          {/* ========================================================================= */}
          {printMode === 'pos' && (
            <div
              id="printable-loan-voucher"
              className="voucher-print-sheet loan-pos-sheet bg-white rounded-xl shadow-lg border border-slate-200 w-full max-w-[80mm] p-4 text-slate-900 font-mono text-[11px] leading-tight space-y-3 print:shadow-none print:border-none print:rounded-none print:w-[78mm] print:max-w-[78mm] print:p-0 print:m-0"
            >
              {/* POS Header */}
              <div className="text-center space-y-1 pb-2 border-b border-dashed border-slate-800">
                <h2 className="text-sm font-black text-slate-900 uppercase">
                  CD PATH & HOSPITAL
                </h2>
                <p className="text-[9px] uppercase tracking-wider text-slate-600">
                  Petty Cash & Staff Accounts
                </p>
                <p className="text-[8px] text-slate-500">
                  CD Path Road, Hospital Square, Dhaka
                </p>
                <div className="pt-1">
                  <span className="inline-block bg-slate-900 text-white font-bold text-[9px] px-2 py-0.5 rounded uppercase print:bg-black print:text-white">
                    STAFF LOAN RECEIPT
                  </span>
                </div>
              </div>

              {/* POS Meta */}
              <div className="space-y-1 text-[10px] pb-2 border-b border-dashed border-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Voucher No:</span>
                  <span className="font-bold">{voucherId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Disbursed Date:</span>
                  <span>{formatDate(loan.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Due Date:</span>
                  <span className="font-bold">{formatDate(loan.returnDeadline)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className="font-bold">{loan.status}</span>
                </div>
              </div>

              {/* Staff Details */}
              <div className="space-y-1 text-[10px] pb-2 border-b border-dashed border-slate-300">
                <div>
                  <span className="text-slate-500 text-[9px] block uppercase">Staff Member</span>
                  <span className="font-bold text-[11px]">{loan.staffName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Department:</span>
                  <span>{loan.department}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[9px] block uppercase">Purpose:</span>
                  <span className="text-[10px] text-slate-800">{loan.reason || 'Staff Personal Loan'}</span>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="space-y-1.5 py-1 text-[11px] pb-2 border-b border-dashed border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Principal:</span>
                  <span className="font-black text-xs">{formatBDT(loan.amount)}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>Paid / Recovered:</span>
                  <span className="font-bold">{formatBDT(repaid)}</span>
                </div>
                <div className="flex justify-between text-red-700 pt-0.5 border-t border-dotted border-slate-300">
                  <span className="font-bold">Balance Due:</span>
                  <span className="font-black text-xs">{formatBDT(remaining)}</span>
                </div>
              </div>

              {/* Amount In Words */}
              <div className="bg-slate-100 p-2 rounded text-[9px] text-slate-800 border border-slate-200">
                <span className="font-bold block text-slate-500 text-[8px] uppercase">Amount in Words:</span>
                <span className="italic font-semibold">{numberToWords(loan.amount)}</span>
              </div>

              {/* Repayments if any */}
              {loan.repayments && loan.repayments.length > 0 && (
                <div className="space-y-1 text-[9px] pb-2 border-b border-dashed border-slate-300">
                  <span className="font-bold uppercase text-[8px] text-slate-500 block">Repayment Log:</span>
                  {loan.repayments.map((rep, i) => (
                    <div key={rep.id || i} className="flex justify-between text-slate-700">
                      <span>{formatDate(rep.paymentDate)}</span>
                      <span className="font-bold">{formatBDT(rep.paidAmount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Brief POS Declaration */}
              <div className="text-[8px] text-slate-600 leading-snug p-1.5 bg-slate-50 border border-slate-200 rounded">
                <p>
                  <strong>Undertaking:</strong> I acknowledge receipt of {formatBDT(loan.amount)} and promise to repay by {formatDate(loan.returnDeadline)}. In default, I authorize salary deduction.
                </p>
              </div>

              {/* Stacked POS Signatures */}
              <div className="space-y-5 pt-3 text-[9px] text-slate-700">
                <div>
                  <div className="border-t border-slate-800 pt-1 flex justify-between">
                    <span className="font-bold">Prepared By:</span>
                    <span className="text-slate-500">Accounts</span>
                  </div>
                </div>
                <div>
                  <div className="border-t border-slate-800 pt-1 flex justify-between">
                    <span className="font-bold">Received By:</span>
                    <span className="text-slate-900 font-semibold">{loan.staffName}</span>
                  </div>
                </div>
                <div>
                  <div className="border-t border-slate-800 pt-1 flex justify-between">
                    <span className="font-bold">Authorized Authority:</span>
                    <span className="text-slate-500">Approved</span>
                  </div>
                </div>
              </div>

              {/* POS Footer */}
              <div className="text-center pt-2 text-[8px] text-slate-400 border-t border-dotted border-slate-300">
                <p>Thank you &bull; Official Accounts Slip</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
