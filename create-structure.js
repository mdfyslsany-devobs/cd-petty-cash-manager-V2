const fs = require('fs');
const path = require('path');

const baseDir = 'c:\\Users\\User\\AppData\\Local\\cd-petty-cash-manager V2\\src';

// Create directories
const dirs = [
  path.join(baseDir, 'utils'),
  path.join(baseDir, 'components'),
  path.join(baseDir, 'components', 'shared'),
  path.join(baseDir, 'components', 'procurement'),
  path.join(baseDir, 'components', 'loans'),
  path.join(baseDir, 'components', 'creditpurchase')
];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('Created:', dir);
  }
});

// Create cn.ts
const cnTs = `import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}`;

fs.writeFileSync(path.join(baseDir, 'utils', 'cn.ts'), cnTs);
console.log('Created: src/utils/cn.ts');

// Create calculations.ts
const calculationsTs = `export interface Expense {
  amount: number;
  dueDate?: string;
  status?: string;
}

export function calculateTotal(expenses: Expense[]): number {
  return expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
}

export function calculateBalance(totalExpenses: number, totalPaid: number): number {
  return totalExpenses - totalPaid;
}

export function isOverdue(dueDate: string): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

export function calculateOverdueAmount(expenses: Expense[]): number {
  return expenses
    .filter(expense => expense.dueDate && isOverdue(expense.dueDate) && expense.status !== 'paid')
    .reduce((sum, expense) => sum + (expense.amount || 0), 0);
}

export function calculateProcurementMetrics(expenses: Expense[]) {
  const total = calculateTotal(expenses);
  const pending = expenses.filter(e => e.status === 'pending').length;
  const approved = expenses.filter(e => e.status === 'approved').length;
  return { total, pending, approved };
}

export function calculateLoanMetrics(expenses: Expense[]) {
  const total = calculateTotal(expenses);
  const outstandingBalance = calculateBalance(total, 0);
  const overdueAmount = calculateOverdueAmount(expenses);
  return { total, outstandingBalance, overdueAmount };
}

export function calculateCreditPurchaseMetrics(expenses: Expense[]) {
  const total = calculateTotal(expenses);
  const outstanding = expenses.filter(e => e.status !== 'settled').length;
  const overdue = calculateOverdueAmount(expenses);
  return { total, outstanding, overdue };
}`;

fs.writeFileSync(path.join(baseDir, 'utils', 'calculations.ts'), calculationsTs);
console.log('Created: src/utils/calculations.ts');

// Create StatusBadge.tsx
const statusBadgeTsx = `import React from 'react';
import { cn } from '../../utils/cn';

interface StatusBadgeProps {
  status: string;
  module?: 'procurement' | 'loans' | 'creditpurchase';
  className?: string;
}

const statusColorMap: Record<string, Record<string, string>> = {
  procurement: {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  },
  loans: {
    active: 'bg-blue-100 text-blue-800',
    paid: 'bg-green-100 text-green-800',
    overdue: 'bg-red-100 text-red-800',
    settled: 'bg-gray-100 text-gray-800',
  },
  creditpurchase: {
    pending: 'bg-yellow-100 text-yellow-800',
    settled: 'bg-green-100 text-green-800',
    overdue: 'bg-red-100 text-red-800',
  },
};

export function StatusBadge({ status, module = 'procurement', className }: StatusBadgeProps) {
  const moduleColors = statusColorMap[module] || statusColorMap.procurement;
  const badgeColor = moduleColors[status] || 'bg-gray-100 text-gray-800';

  return (
    <span className={cn('px-3 py-1 rounded-full text-sm font-medium', badgeColor, className)}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}`;

fs.writeFileSync(path.join(baseDir, 'components', 'shared', 'StatusBadge.tsx'), statusBadgeTsx);
console.log('Created: src/components/shared/StatusBadge.tsx');

// Create ConfirmDialog.tsx
const confirmDialogTsx = `import React from 'react';
import { cn } from '../../utils/cn';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDangerous?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isDangerous = false,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full mx-4">
        <h2 className="text-lg font-semibold mb-2">{title}</h2>
        <p className="text-gray-600 mb-6">{message}</p>
        
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50 font-medium"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              'px-4 py-2 rounded text-white font-medium',
              isDangerous
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}`;

fs.writeFileSync(path.join(baseDir, 'components', 'shared', 'ConfirmDialog.tsx'), confirmDialogTsx);
console.log('Created: src/components/shared/ConfirmDialog.tsx');

// Create ExportDialog.tsx
const exportDialogTsx = `import React, { useState } from 'react';
import { cn } from '../../utils/cn';

interface ExportDialogProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  onExport: (format: 'csv' | 'pdf' | 'excel') => void;
}

export function ExportDialog({ open, title = 'Export Data', onClose, onExport }: ExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'pdf' | 'excel'>('csv');

  if (!open) return null;

  const handleExport = () => {
    onExport(selectedFormat);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full mx-4">
        <h2 className="text-lg font-semibold mb-4">{title}</h2>
        
        <div className="space-y-3 mb-6">
          {['csv', 'pdf', 'excel'].map((format) => (
            <label key={format} className="flex items-center">
              <input
                type="radio"
                name="format"
                value={format}
                checked={selectedFormat === format as typeof selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value as typeof selectedFormat)}
                className="mr-3"
              />
              <span className="text-gray-700 capitalize font-medium">{format}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 font-medium"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}`;

fs.writeFileSync(path.join(baseDir, 'components', 'shared', 'ExportDialog.tsx'), exportDialogTsx);
console.log('Created: src/components/shared/ExportDialog.tsx');

console.log('\\n✓ All directories and files created successfully!');
