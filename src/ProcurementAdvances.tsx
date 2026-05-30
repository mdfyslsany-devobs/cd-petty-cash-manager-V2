import React, { useState, useEffect } from 'react';
import { Plus, Filter, Download, Printer, Search, MoreVertical } from 'lucide-react';
import { ProcurementAdvance } from '../types';
import { calculateProcurementStats, formatCurrency, formatDate } from './ModuleCalculations';
import { ConfirmDialog } from './ConfirmDialog';

interface ProcurementAdvancesPageProps {
  onNavigate?: (tab: string) => void;
}

export function ProcurementAdvancesPage({ onNavigate }: ProcurementAdvancesPageProps) {
  const [advances, setAdvances] = useState<ProcurementAdvance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [selectedAdvance, setSelectedAdvance] = useState<ProcurementAdvance | null>(null);
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
  onDelete: () => void;
}

function AdvanceCard({ advance, onAdjust, onDelete }: AdvanceCardProps) {
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
