import React, { useState, useEffect } from 'react';
import { Plus, AlertTriangle, TrendingUp, Search } from 'lucide-react';
import { CreditPurchase, DEPARTMENTS } from './types';
import { calculateCreditStats, formatCurrency, formatDate, getRemainingBalance, isOverdue } from './ModuleCalculations';
import { ConfirmDialog } from './ConfirmDialog';

interface CreditPurchaseTrackerPageProps {
  onNavigate?: (tab: string) => void;
}

export function CreditPurchaseTrackerPage({ onNavigate }: CreditPurchaseTrackerPageProps) {
  const [purchases, setPurchases] = useState<CreditPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<CreditPurchase | null>(null);
  const [showVendorLedger, setShowVendorLedger] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Unpaid' | 'Partially Paid' | 'Paid'>('All');
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, id: '' });

  useEffect(() => {
    fetchPurchases();
  }, []);

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/credit-purchases');
      const data = await response.json();
      setPurchases(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch purchases:', error);
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPurchase = async (formData: any) => {
    try {
      const response = await fetch('/api/credit-purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await response.json();
      if (response.ok) {
        setPurchases([result.purchase, ...purchases]);
        setShowAddForm(false);
      }
    } catch (error) {
      console.error('Failed to add purchase:', error);
    }
  };

  const handleAddPayment = async (paymentData: any) => {
    if (!selectedPurchase) return;
    try {
      const response = await fetch(`/api/credit-purchases/${selectedPurchase.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment: paymentData }),
      });
      const result = await response.json();
      if (response.ok) {
        setPurchases(purchases.map(p => (p.id === result.purchase.id ? result.purchase : p)));
        setShowPaymentForm(false);
        setSelectedPurchase(null);
      }
    } catch (error) {
      console.error('Failed to add payment:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/credit-purchases/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setPurchases(purchases.filter(p => p.id !== id));
        setConfirmDialog({ isOpen: false, id: '' });
      }
    } catch (error) {
      console.error('Failed to delete purchase:', error);
    }
  };

  const filteredPurchases = purchases.filter(p => {
    const matchesSearch = p.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'All' || p.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const stats = calculateCreditStats(purchases);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Credit Purchase Tracker</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowVendorLedger(true)}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            <TrendingUp className="w-5 h-5" />
            Vendor Ledger
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            New Purchase
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Purchase" value={formatCurrency(stats.totalPurchase)} color="blue" />
        <StatCard label="Total Paid" value={formatCurrency(stats.totalPaid)} color="green" />
        <StatCard label="Total Due" value={formatCurrency(stats.totalDue)} color="red" />
        <StatCard label="Overdue Payments" value={stats.overduePayments.length.toString()} color="yellow" />
      </div>

      {/* Alert for Overdue Payments */}
      {stats.overduePayments.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Overdue Payments Alert</h3>
            <p className="text-sm text-red-700">
              {stats.overduePayments.length} payment{stats.overduePayments.length !== 1 ? 's' : ''} are overdue.
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
            placeholder="Search by vendor name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="All">All Status</option>
          <option value="Unpaid">Unpaid</option>
          <option value="Partially Paid">Partially Paid</option>
          <option value="Paid">Paid</option>
        </select>
      </div>

      {/* Purchases List */}
      <div className="space-y-3">
        {filteredPurchases.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-500">No purchases found</p>
          </div>
        ) : (
          filteredPurchases.map(purchase => (
            <PurchaseCard
              key={purchase.id}
              purchase={purchase}
              onAddPayment={() => {
                setSelectedPurchase(purchase);
                setShowPaymentForm(true);
              }}
              onDelete={() => setConfirmDialog({ isOpen: true, id: purchase.id })}
            />
          ))
        )}
      </div>

      {/* Forms */}
      {showAddForm && (
        <AddPurchaseForm
          onSubmit={handleAddPurchase}
          onClose={() => setShowAddForm(false)}
        />
      )}

      {showPaymentForm && selectedPurchase && (
        <AddPaymentForm
          purchase={selectedPurchase}
          onSubmit={handleAddPayment}
          onClose={() => {
            setShowPaymentForm(false);
            setSelectedPurchase(null);
          }}
        />
      )}

      {/* Vendor Ledger */}
      {showVendorLedger && (
        <VendorLedgerModal
          stats={stats}
          onClose={() => setShowVendorLedger(false)}
        />
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Delete Purchase"
        message="Are you sure you want to delete this purchase entry? This action cannot be undone."
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
  color: 'blue' | 'green' | 'red' | 'yellow';
}

function StatCard({ label, value, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    red: 'bg-red-50 border-red-200',
    yellow: 'bg-yellow-50 border-yellow-200',
  };

  const textColorClasses = {
    blue: 'text-blue-700',
    green: 'text-green-700',
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

interface PurchaseCardProps {
  purchase: CreditPurchase;
  onAddPayment: () => void;
  onDelete: () => void;
}

function PurchaseCard({ purchase, onAddPayment, onDelete }: PurchaseCardProps) {
  const statusColors = {
    Unpaid: 'bg-red-100 text-red-800',
    'Partially Paid': 'bg-yellow-100 text-yellow-800',
    Paid: 'bg-green-100 text-green-800',
  };

  const paid = purchase.payments.reduce((sum, p) => sum + p.paidAmount, 0);
  const remaining = getRemainingBalance(purchase.billAmount, purchase.payments);
  const isPurchaseOverdue = isOverdue(purchase.duePaymentDate) && purchase.status !== 'Paid';

  return (
    <div className={`rounded-lg shadow p-4 hover:shadow-md transition ${isPurchaseOverdue ? 'bg-red-50 border-2 border-red-300' : 'bg-white'}`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{purchase.vendorName}</h3>
          <p className="text-sm text-gray-600">{purchase.description}</p>
          <p className="text-xs text-gray-500 mt-1">Invoice: {purchase.invoiceNumber} • Dept: {purchase.department}</p>
        </div>
        <div className="flex items-center gap-3">
          {isPurchaseOverdue && (
            <div className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded text-sm font-medium">
              <AlertTriangle className="w-4 h-4" />
              Overdue
            </div>
          )}
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColors[purchase.status]}`}>
            {purchase.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
        <div>
          <span className="text-gray-500">Bill Amount</span>
          <p className="font-semibold text-gray-900">{formatCurrency(purchase.billAmount)}</p>
        </div>
        <div>
          <span className="text-gray-500">Paid</span>
          <p className="font-semibold text-green-700">{formatCurrency(paid)}</p>
        </div>
        <div>
          <span className="text-gray-500">Due Amount</span>
          <p className="font-semibold text-red-700">{formatCurrency(remaining)}</p>
        </div>
        <div>
          <span className="text-gray-500">Due Date</span>
          <p className="font-semibold text-gray-900">{formatDate(purchase.duePaymentDate)}</p>
        </div>
      </div>

      {/* Payment Progress */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>Payment Progress</span>
          <span>{Math.round((paid / purchase.billAmount) * 100)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-green-600 h-2 rounded-full transition-all"
            style={{ width: `${Math.min((paid / purchase.billAmount) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Payments List */}
      {purchase.payments.length > 0 && (
        <div className="mb-4 bg-gray-50 rounded p-3 text-sm">
          <p className="font-semibold text-gray-900 mb-2">Payments ({purchase.payments.length})</p>
          <ul className="space-y-1">
            {purchase.payments.map((p, i) => (
              <li key={p.id} className="flex justify-between text-gray-700">
                <span>{formatDate(p.paymentDate)}</span>
                <span className="font-semibold">{formatCurrency(p.paidAmount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        {purchase.status !== 'Paid' && (
          <button
            onClick={onAddPayment}
            className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm font-medium"
          >
            Add Payment
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

interface AddPurchaseFormProps {
  onSubmit: (data: any) => void;
  onClose: () => void;
}

function AddPurchaseForm({ onSubmit, onClose }: AddPurchaseFormProps) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    vendorName: '',
    description: '',
    billAmount: '',
    duePaymentDate: '',
    invoiceNumber: '',
    department: DEPARTMENTS[0],
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      billAmount: parseFloat(formData.billAmount),
      createdBy: 'user',
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white">
          <h2 className="text-2xl font-bold text-gray-900">Add Credit Purchase</h2>
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Name</label>
              <input
                type="text"
                required
                value={formData.vendorName}
                onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Enter vendor name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
              <input
                type="text"
                required
                value={formData.invoiceNumber}
                onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Enter invoice number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bill Amount</label>
              <input
                type="number"
                required
                step="0.01"
                value={formData.billAmount}
                onChange={(e) => setFormData({ ...formData, billAmount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Payment Date</label>
              <input
                type="date"
                required
                value={formData.duePaymentDate}
                onChange={(e) => setFormData({ ...formData, duePaymentDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select
                required
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {DEPARTMENTS.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product/Service Description</label>
            <textarea
              required
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter product/service description"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter any notes"
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
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Save Purchase
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AddPaymentFormProps {
  purchase: CreditPurchase;
  onSubmit: (data: any) => void;
  onClose: () => void;
}

function AddPaymentForm({ purchase, onSubmit, onClose }: AddPaymentFormProps) {
  const remaining = getRemainingBalance(purchase.billAmount, purchase.payments);
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
          <h2 className="text-2xl font-bold text-gray-900">Add Payment - {purchase.vendorName}</h2>
          <p className="text-sm text-gray-600 mt-1">Remaining Due: {formatCurrency(remaining)}</p>
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Save Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface VendorLedgerModalProps {
  stats: ReturnType<typeof calculateCreditStats>;
  onClose: () => void;
}

function VendorLedgerModal({ stats, onClose }: VendorLedgerModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-screen overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white">
          <h2 className="text-2xl font-bold text-gray-900">Vendor Ledger</h2>
        </div>
        <div className="p-6">
          {Object.keys(stats.vendorSummary).length === 0 ? (
            <p className="text-center text-gray-500">No vendor data available</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Vendor Name</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-900">Total Purchase</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-900">Total Paid</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-900">Due Amount</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-900">Payment %</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(stats.vendorSummary).map(([vendor, data]) => (
                    <tr key={vendor} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{vendor}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(data.purchase)}</td>
                      <td className="px-4 py-3 text-right text-green-700 font-medium">{formatCurrency(data.paid)}</td>
                      <td className="px-4 py-3 text-right text-red-700 font-medium">{formatCurrency(data.due)}</td>
                      <td className="px-4 py-3 text-center text-gray-900 font-medium">
                        {Math.round((data.paid / data.purchase) * 100)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
