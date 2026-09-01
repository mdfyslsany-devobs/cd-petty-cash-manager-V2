import React, { useState, useEffect } from 'react';
import { Plus, Filter, Download, Printer, Search, MoreVertical } from 'lucide-react';
import { ProcurementAdvance } from './types';
import { calculateProcurementStats, formatCurrency, formatDate, numberToWords } from './ModuleCalculations';
import { ConfirmDialog } from './ConfirmDialog';

// Brand Logo URL
const logoUrl = new URL('../CDPathlogo.png', import.meta.url).href;

interface ProcurementAdvancesPageProps {
  onNavigate?: (tab: string) => void;
}

export function ProcurementAdvancesPage({ onNavigate }: ProcurementAdvancesPageProps) {
  const [advances, setAdvances] = useState<ProcurementAdvance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [selectedAdvance, setSelectedAdvance] = useState<ProcurementAdvance | null>(null);
  const [voucherAdvance, setVoucherAdvance] = useState<ProcurementAdvance | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Adjusted' | 'Returned'>('All');
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, id: '' });

  useEffect(() => {
    fetchAdvances();
  }, []);

  const fetchAdvances = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/procurement-advances');
      const data = await response.json();
      setAdvances(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch advances:', error);
      setAdvances([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdvance = async (formData: any) => {
    try {
      const response = await fetch('/api/procurement-advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await response.json();
      if (response.ok) {
        setAdvances([result.advance, ...advances]);
        setShowAddForm(false);
        setVoucherAdvance(result.advance);
      }
    } catch (error) {
      console.error('Failed to add advance:', error);
    }
  };

  const handleAdjust = async (adjustmentData: any) => {
    if (!selectedAdvance) return;
    try {
      const response = await fetch(`/api/procurement-advances/${selectedAdvance.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adjustment: adjustmentData,
          status: adjustmentData.finalStatus || selectedAdvance.status,
        }),
      });
      const result = await response.json();
      if (response.ok) {
        setAdvances(advances.map(a => (a.id === result.advance.id ? result.advance : a)));
        setShowAdjustForm(false);
        setSelectedAdvance(null);
      }
    } catch (error) {
      console.error('Failed to adjust advance:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/procurement-advances/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setAdvances(advances.filter(a => a.id !== id));
        setConfirmDialog({ isOpen: false, id: '' });
      }
    } catch (error) {
      console.error('Failed to delete advance:', error);
    }
  };

  const filteredAdvances = advances.filter(a => {
    const matchesSearch = a.officerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         a.purpose.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'All' || a.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const stats = calculateProcurementStats(advances);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Procurement Advance Tracking</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Add Advance
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Pending" value={formatCurrency(stats.totalPending)} color="orange" />
        <StatCard label="Total Adjusted" value={formatCurrency(stats.totalAdjusted)} color="green" />
        <StatCard label="Total Returned" value={formatCurrency(stats.totalReturned)} color="blue" />
        <StatCard label="Total Entries" value={advances.length.toString()} color="purple" />
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow p-4 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by officer name or purpose..."
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
          <option value="Pending">Pending</option>
          <option value="Adjusted">Adjusted</option>
          <option value="Returned">Returned</option>
        </select>
      </div>

      {/* Advances List */}
      <div className="space-y-3">
        {filteredAdvances.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-500">No advances found</p>
          </div>
        ) : (
          filteredAdvances.map(advance => (
            <AdvanceCard
              key={advance.id}
              advance={advance}
              onAdjust={() => {
                setSelectedAdvance(advance);
                setShowAdjustForm(true);
              }}
              onPrintVoucher={() => setVoucherAdvance(advance)}
              onDelete={() => setConfirmDialog({ isOpen: true, id: advance.id })}
            />
          ))
        )}
      </div>

      {/* Forms */}
      {showAddForm && (
        <AddAdvanceForm
          onSubmit={handleAddAdvance}
          onClose={() => setShowAddForm(false)}
        />
      )}

      {showAdjustForm && selectedAdvance && (
        <AdjustAdvanceForm
          advance={selectedAdvance}
          onSubmit={handleAdjust}
          onClose={() => {
            setShowAdjustForm(false);
            setSelectedAdvance(null);
          }}
        />
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Delete Advance"
        message="Are you sure you want to delete this advance entry? This action cannot be undone."
        confirmText="Delete"
        isDangerous
        onConfirm={() => handleDelete(confirmDialog.id)}
        onCancel={() => setConfirmDialog({ isOpen: false, id: '' })}
      />

      {/* Printable Voucher Modal */}
      {voucherAdvance && (
        <ProcurementVoucherModal
          advance={voucherAdvance}
          onClose={() => setVoucherAdvance(null)}
        />
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  color: 'orange' | 'green' | 'blue' | 'purple';
}

function StatCard({ label, value, color }: StatCardProps) {
  const colorClasses = {
    orange: 'bg-orange-50 border-orange-200',
    green: 'bg-green-50 border-green-200',
    blue: 'bg-blue-50 border-blue-200',
    purple: 'bg-purple-50 border-purple-200',
  };

  const textColorClasses = {
    orange: 'text-orange-700',
    green: 'text-green-700',
    blue: 'text-blue-700',
    purple: 'text-purple-700',
  };

  return (
    <div className={`${colorClasses[color]} border rounded-lg p-4`}>
      <p className="text-sm text-gray-600">{label}</p>
      <p className={`text-2xl font-bold ${textColorClasses[color]}`}>{value}</p>
    </div>
  );
}

interface AdvanceCardProps {
  advance: ProcurementAdvance;
  onAdjust: () => void;
  onPrintVoucher: () => void;
  onDelete: () => void;
  key?: React.Key;
}

function AdvanceCard({ advance, onAdjust, onPrintVoucher, onDelete }: AdvanceCardProps) {
  const statusColors = {
    Pending: 'bg-orange-100 text-orange-800',
    Adjusted: 'bg-green-100 text-green-800',
    Returned: 'bg-blue-100 text-blue-800',
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-semibold text-gray-900">{advance.officerName}</h3>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColors[advance.status]}`}>
              {advance.status}
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-2">{advance.purpose}</p>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Amount</span>
              <p className="font-semibold text-gray-900">{formatCurrency(advance.advanceAmount)}</p>
            </div>
            <div>
              <span className="text-gray-500">Date</span>
              <p className="font-semibold text-gray-900">{formatDate(advance.date)}</p>
            </div>
            <div>
              <span className="text-gray-500">Expected Purchase</span>
              <p className="font-semibold text-gray-900">{formatDate(advance.expectedPurchaseDate)}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onPrintVoucher}
            className="px-3 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded text-sm font-medium flex items-center gap-1"
          >
            <Printer size={15} />
            Print Voucher
          </button>
          <button
            onClick={onAdjust}
            className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm font-medium"
          >
            Adjust
          </button>
          <button
            onClick={onDelete}
            className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm font-medium"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

interface AddAdvanceFormProps {
  onSubmit: (data: any) => void;
  onClose: () => void;
}

function AddAdvanceForm({ onSubmit, onClose }: AddAdvanceFormProps) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    officerName: '',
    advanceAmount: '',
    purpose: '',
    expectedPurchaseDate: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      advanceAmount: parseFloat(formData.advanceAmount),
      status: 'Pending',
      createdBy: 'user',
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white">
          <h2 className="text-2xl font-bold text-gray-900">Add Procurement Advance</h2>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Officer Name</label>
              <input
                type="text"
                required
                value={formData.officerName}
                onChange={(e) => setFormData({ ...formData, officerName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Enter officer name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Advance Amount</label>
              <input
                type="number"
                required
                step="0.01"
                value={formData.advanceAmount}
                onChange={(e) => setFormData({ ...formData, advanceAmount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expected Purchase Date</label>
              <input
                type="date"
                required
                value={formData.expectedPurchaseDate}
                onChange={(e) => setFormData({ ...formData, expectedPurchaseDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Purpose/Description</label>
            <textarea
              required
              rows={3}
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter purpose or description"
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
              Save Advance
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AdjustAdvanceFormProps {
  advance: ProcurementAdvance;
  onSubmit: (data: any) => void;
  onClose: () => void;
}

function AdjustAdvanceForm({ advance, onSubmit, onClose }: AdjustAdvanceFormProps) {
  const [formData, setFormData] = useState({
    finalPurchaseAmount: '',
    returnedAmount: '',
    notes: '',
    finalStatus: advance.status,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      finalPurchaseAmount: formData.finalPurchaseAmount ? parseFloat(formData.finalPurchaseAmount) : undefined,
      returnedAmount: formData.returnedAmount ? parseFloat(formData.returnedAmount) : undefined,
      notes: formData.notes,
      finalStatus: formData.finalStatus,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Adjust Advance - {advance.officerName}</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Final Purchase Amount</label>
              <input
                type="number"
                step="0.01"
                value={formData.finalPurchaseAmount}
                onChange={(e) => setFormData({ ...formData, finalPurchaseAmount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Leave empty if not applicable"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Returned Amount</label>
              <input
                type="number"
                step="0.01"
                value={formData.returnedAmount}
                onChange={(e) => setFormData({ ...formData, returnedAmount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Leave empty if not applicable"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={formData.finalStatus}
              onChange={(e) => setFormData({ ...formData, finalStatus: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="Pending">Pending</option>
              <option value="Adjusted">Adjusted</option>
              <option value="Returned">Returned</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter adjustment notes"
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
              Save Adjustment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ProcurementVoucherModalProps {
  advance: ProcurementAdvance;
  onClose: () => void;
}

function ProcurementVoucherModal({ advance, onClose }: ProcurementVoucherModalProps) {
  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const voucherId = `PAV-${advance.id.slice(-6).toUpperCase()}`;

  return (
    <div className="voucher-print-root fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto print:p-0 print:static print:bg-transparent">
      <div
        id="printable-procurement-voucher"
        className="voucher-print-sheet bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-8 border border-slate-200 printable-voucher relative print:shadow-none print:border-none print:w-full print:max-w-full"
      >
        {/* Control Header - Hidden during print */}
        <div className="flex items-center justify-between border-b pb-4 mb-6 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">Procurement Advance Voucher</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm"
            >
              <Printer size={16} />
              Print Voucher
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-all"
            >
              Close
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="space-y-6 text-slate-900">
          {/* Voucher Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <img
                src={logoUrl}
                alt="CD PATH Logo"
                className="h-14 w-14 object-contain"
              />
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">CD PATH & HOSPITAL</h1>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Petty Cash & Accounts Department</p>
                <p className="text-[11px] text-slate-400">CD Path Road, Hospital Square</p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block bg-blue-100 text-blue-800 font-extrabold text-xs px-3 py-1 rounded-md border border-blue-200 mb-1">
                PROCUREMENT ADVANCE VOUCHER
              </span>
              <p className="text-xs font-mono text-slate-600">Voucher No: <strong className="text-slate-900">{voucherId}</strong></p>
              <p className="text-xs text-slate-500">Disbursed Date: {formatDate(advance.date)}</p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4 border border-slate-300 rounded-xl p-4 bg-slate-50 text-sm">
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold">Recipient / Officer Name</p>
              <p className="text-base font-bold text-slate-900">{advance.officerName}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold">Status</p>
              <p className="text-base font-bold text-blue-700">{advance.status}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold">Disbursed Date</p>
              <p className="font-semibold text-slate-800">{formatDate(advance.date)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold">Expected Purchase Date</p>
              <p className="font-semibold text-slate-800">{formatDate(advance.expectedPurchaseDate)}</p>
            </div>
          </div>

          {/* Purpose */}
          <div className="border border-slate-300 rounded-xl p-4 text-sm">
            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Purpose / Reason of Advance</p>
            <p className="font-medium text-slate-800 whitespace-pre-wrap">{advance.purpose}</p>
          </div>

          {/* Amount Box */}
          <div className="bg-slate-900 text-white rounded-xl p-5 flex justify-between items-center gap-4">
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Advance Amount (In Words)</p>
              <p className="text-sm font-semibold text-emerald-400 mt-0.5 italic">{numberToWords(advance.advanceAmount)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Amount</p>
              <p className="text-2xl font-black text-white">{formatCurrency(advance.advanceAmount)}</p>
            </div>
          </div>

          {/* Adjustments Section */}
          {advance.adjustments && advance.adjustments.length > 0 && (
            <div className="border border-slate-300 rounded-xl p-4 text-sm space-y-2">
              <h4 className="font-bold text-slate-900 border-b pb-2 text-xs uppercase tracking-wider">Adjustment & Settlement Log</h4>
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="py-1">Date</th>
                    <th className="py-1 text-right">Purchase Amount</th>
                    <th className="py-1 text-right">Returned Amount</th>
                    <th className="py-1">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {advance.adjustments.map((adj) => (
                    <tr key={adj.id} className="border-b last:border-0">
                      <td className="py-1.5">{formatDate(new Date(adj.adjustedAt).toISOString())}</td>
                      <td className="py-1.5 text-right font-medium">{adj.finalPurchaseAmount ? formatCurrency(adj.finalPurchaseAmount) : '-'}</td>
                      <td className="py-1.5 text-right font-medium text-green-700">{adj.returnedAmount ? formatCurrency(adj.returnedAmount) : '-'}</td>
                      <td className="py-1.5 text-slate-600">{adj.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Signature Block */}
          <div className="pt-16 grid grid-cols-3 gap-8 text-center text-xs font-semibold text-slate-700">
            <div>
              <div className="border-t-2 border-slate-800 pt-2">
                <p className="font-bold text-slate-900">Prepared By</p>
                <p className="text-[10px] text-slate-500">Accounts / Staff</p>
              </div>
            </div>
            <div>
              <div className="border-t-2 border-slate-800 pt-2">
                <p className="font-bold text-slate-900">Approved By</p>
                <p className="text-[10px] text-slate-500">Authorized Authority</p>
              </div>
            </div>
            <div>
              <div className="border-t-2 border-slate-800 pt-2">
                <p className="font-bold text-slate-900">Receiver's Signature</p>
                <p className="text-[10px] text-slate-500">Mandatory Confirmation</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

