import React, { useState, useEffect } from 'react';
import { Plus, AlertTriangle, Clock, Search } from 'lucide-react';
import { StaffLoan, DEPARTMENTS } from './types';
import { calculateLoanStats, formatCurrency, formatDate, getRemainingBalance, isOverdue } from './ModuleCalculations';
import { ConfirmDialog } from './ConfirmDialog';

interface StaffLoanTrackerPageProps {
  onNavigate?: (tab: string) => void;
}

export function StaffLoanTrackerPage({ onNavigate }: StaffLoanTrackerPageProps) {
  const [loans, setLoans] = useState<StaffLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showRepayForm, setShowRepayForm] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<StaffLoan | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Unpaid' | 'Partially Paid' | 'Paid'>('All');
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, id: '' });

  useEffect(() => {
    fetchLoans();
  }, []);

  const fetchLoans = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/staff-loans');
      const data = await response.json();
      setLoans(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch loans:', error);
      setLoans([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLoan = async (formData: any) => {
    try {
      const response = await fetch('/api/staff-loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await response.json();
      if (response.ok) {
        setLoans([result.loan, ...loans]);
        setShowAddForm(false);
      }
    } catch (error) {
      console.error('Failed to add loan:', error);
    }
  };

  const handleAddRepayment = async (repaymentData: any) => {
    if (!selectedLoan) return;
    try {
      const response = await fetch(`/api/staff-loans/${selectedLoan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repayment: repaymentData }),
      });
      const result = await response.json();
      if (response.ok) {
        setLoans(loans.map(l => (l.id === result.loan.id ? result.loan : l)));
        setShowRepayForm(false);
        setSelectedLoan(null);
      }
    } catch (error) {
      console.error('Failed to add repayment:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/staff-loans/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setLoans(loans.filter(l => l.id !== id));
        setConfirmDialog({ isOpen: false, id: '' });
      }
    } catch (error) {
      console.error('Failed to delete loan:', error);
    }
  };

  const filteredLoans = loans.filter(l => {
    const matchesSearch = l.staffName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         l.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'All' || l.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const stats = calculateLoanStats(loans);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Staff Loan Tracker</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
        >
          <Plus className="w-5 h-5" />
          New Loan
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Loaned" value={formatCurrency(stats.totalLoaned)} color="green" />
        <StatCard label="Total Recovered" value={formatCurrency(stats.totalRecovered)} color="blue" />
        <StatCard label="Pending Amount" value={formatCurrency(stats.pendingAmount)} color="red" />
        <StatCard label="Overdue Loans" value={stats.overdueLoan.length.toString()} color="yellow" />
      </div>

      {/* Alert for Overdue Loans */}
      {stats.overdueLoan.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Overdue Loans Alert</h3>
            <p className="text-sm text-red-700">
              {stats.overdueLoan.length} loan{stats.overdueLoan.length !== 1 ? 's' : ''} have passed their return deadline.
            </p>
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow p-4 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by staff name or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
        >
          <option value="All">All Status</option>
          <option value="Unpaid">Unpaid</option>
          <option value="Partially Paid">Partially Paid</option>
          <option value="Paid">Paid</option>
        </select>
      </div>

      {/* Loans List */}
      <div className="space-y-3">
        {filteredLoans.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-500">No loans found</p>
          </div>
        ) : (
          filteredLoans.map(loan => (
            <LoanCard
              key={loan.id}
              loan={loan}
              onAddRepayment={() => {
                setSelectedLoan(loan);
                setShowRepayForm(true);
              }}
              onDelete={() => setConfirmDialog({ isOpen: true, id: loan.id })}
            />
          ))
        )}
      </div>

      {/* Forms */}
      {showAddForm && (
        <AddLoanForm
          onSubmit={handleAddLoan}
          onClose={() => setShowAddForm(false)}
        />
      )}

      {showRepayForm && selectedLoan && (
        <AddRepaymentForm
          loan={selectedLoan}
          onSubmit={handleAddRepayment}
          onClose={() => {
            setShowRepayForm(false);
            setSelectedLoan(null);
          }}
        />
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Delete Loan"
        message="Are you sure you want to delete this loan entry? This action cannot be undone."
        confirmText="Delete"
        isDangerous
        onConfirm={() => handleDelete(confirmDialog.id)}
        onCancel={() => setConfirmDialog({ isOpen: false, id: '' })}
      />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  color: 'green' | 'blue' | 'red' | 'yellow';
}

function StatCard({ label, value, color }: StatCardProps) {
  const colorClasses = {
    green: 'bg-green-50 border-green-200',
    blue: 'bg-blue-50 border-blue-200',
    red: 'bg-red-50 border-red-200',
    yellow: 'bg-yellow-50 border-yellow-200',
  };

  const textColorClasses = {
    green: 'text-green-700',
    blue: 'text-blue-700',
    red: 'text-red-700',
    yellow: 'text-yellow-700',
  };

  return (
    <div className={`${colorClasses[color]} border rounded-lg p-4`}>
      <p className="text-sm text-gray-600">{label}</p>
      <p className={`text-2xl font-bold ${textColorClasses[color]}`}>{value}</p>
    </div>
  );
}

interface LoanCardProps {
  loan: StaffLoan;
  onAddRepayment: () => void;
  onDelete: () => void;
}

function LoanCard({ loan, onAddRepayment, onDelete }: LoanCardProps) {
  const statusColors = {
    Unpaid: 'bg-red-100 text-red-800',
    'Partially Paid': 'bg-yellow-100 text-yellow-800',
    Paid: 'bg-green-100 text-green-800',
  };

  const repaid = loan.repayments.reduce((sum, r) => sum + r.paidAmount, 0);
  const remaining = getRemainingBalance(loan.amount, loan.repayments);
  const isLoanOverdue = isOverdue(loan.returnDeadline) && loan.status !== 'Paid';

  return (
    <div className={`rounded-lg shadow p-4 hover:shadow-md transition ${isLoanOverdue ? 'bg-red-50 border-2 border-red-300' : 'bg-white'}`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="font-semibold text-gray-900">{loan.staffName}</h3>
            <p className="text-sm text-gray-600">{loan.department}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isLoanOverdue && (
            <div className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded text-sm font-medium">
              <AlertTriangle className="w-4 h-4" />
              Overdue
            </div>
          )}
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColors[loan.status]}`}>
            {loan.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
        <div>
          <span className="text-gray-500">Total Amount</span>
          <p className="font-semibold text-gray-900">{formatCurrency(loan.amount)}</p>
        </div>
        <div>
          <span className="text-gray-500">Paid</span>
          <p className="font-semibold text-green-700">{formatCurrency(repaid)}</p>
        </div>
        <div>
          <span className="text-gray-500">Remaining</span>
          <p className="font-semibold text-red-700">{formatCurrency(remaining)}</p>
        </div>
        <div>
          <span className="text-gray-500">Due Date</span>
          <p className="font-semibold text-gray-900">{formatDate(loan.returnDeadline)}</p>
        </div>
      </div>

      {/* Repayment Progress */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>Repayment Progress</span>
          <span>{Math.round((repaid / loan.amount) * 100)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-green-600 h-2 rounded-full transition-all"
            style={{ width: `${Math.min((repaid / loan.amount) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Repayments List */}
      {loan.repayments.length > 0 && (
        <div className="mb-4 bg-gray-50 rounded p-3 text-sm">
          <p className="font-semibold text-gray-900 mb-2">Repayments ({loan.repayments.length})</p>
          <ul className="space-y-1">
            {loan.repayments.map((r, i) => (
              <li key={r.id} className="flex justify-between text-gray-700">
                <span>{formatDate(r.paymentDate)}</span>
                <span className="font-semibold">{formatCurrency(r.paidAmount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        {loan.status !== 'Paid' && (
          <button
            onClick={onAddRepayment}
            className="flex-1 px-3 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm font-medium"
          >
            Add Repayment
          </button>
        )}
        <button
          onClick={onDelete}
          className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm font-medium"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

interface AddLoanFormProps {
  onSubmit: (data: any) => void;
  onClose: () => void;
}

function AddLoanForm({ onSubmit, onClose }: AddLoanFormProps) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    staffName: '',
    department: DEPARTMENTS[0],
    amount: '',
    reason: '',
    returnDeadline: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      amount: parseFloat(formData.amount),
      createdBy: 'user',
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white">
          <h2 className="text-2xl font-bold text-gray-900">Add New Loan</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Staff Name</label>
              <input
                type="text"
                required
                value={formData.staffName}
                onChange={(e) => setFormData({ ...formData, staffName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                placeholder="Enter staff name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select
                required
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
              >
                {DEPARTMENTS.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
              <input
                type="number"
                required
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Return Deadline</label>
              <input
                type="date"
                required
                value={formData.returnDeadline}
                onChange={(e) => setFormData({ ...formData, returnDeadline: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Loan</label>
            <textarea
              required
              rows={3}
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
              placeholder="Enter reason or description"
            />
          </div>
          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Save Loan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AddRepaymentFormProps {
  loan: StaffLoan;
  onSubmit: (data: any) => void;
  onClose: () => void;
}

function AddRepaymentForm({ loan, onSubmit, onClose }: AddRepaymentFormProps) {
  const remaining = getRemainingBalance(loan.amount, loan.repayments);
  const [formData, setFormData] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    paidAmount: remaining.toString(),
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      paidAmount: parseFloat(formData.paidAmount),
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Add Repayment - {loan.staffName}</h2>
          <p className="text-sm text-gray-600 mt-1">Remaining Balance: {formatCurrency(remaining)}</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
              <input
                type="date"
                required
                value={formData.paymentDate}
                onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paid Amount</label>
              <input
                type="number"
                required
                step="0.01"
                min="0"
                max={remaining}
                value={formData.paidAmount}
                onChange={(e) => setFormData({ ...formData, paidAmount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
              placeholder="Enter payment notes"
            />
          </div>
          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Save Repayment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
