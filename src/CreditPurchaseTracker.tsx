import React, { useState, useEffect } from 'react';
import { Plus, AlertTriangle, TrendingUp, Search, Download, CalendarDays, ShieldAlert, Printer } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { CreditPurchase, DEPARTMENTS } from './types';
import { calculateCreditStats, formatCurrency, formatDate, getRemainingBalance, isOverdue, numberToWords } from './ModuleCalculations';
import { ConfirmDialog } from './ConfirmDialog';

// Brand Logo URL
const logoUrl = new URL('../CDPathlogo.png', import.meta.url).href;

interface CreditPurchaseTrackerPageProps {
  onNavigate?: (tab: string) => void;
}

export function CreditPurchaseTrackerPage({ onNavigate }: CreditPurchaseTrackerPageProps) {
  const [purchases, setPurchases] = useState<CreditPurchase[]>([]);
  const [vendorOptions, setVendorOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<CreditPurchase | null>(null);
  const [showVendorLedger, setShowVendorLedger] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Unpaid' | 'Partially Paid' | 'Paid'>('All');
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, id: '' });
  const [datePreset, setDatePreset] = useState<'Today' | 'This Week' | 'This Month' | 'Last Month' | 'Custom Range'>('This Month');
  const [dateRangeStart, setDateRangeStart] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dateRangeEnd, setDateRangeEnd] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [sortByUrgency, setSortByUrgency] = useState(true);
  const [vendorDirectorySearch, setVendorDirectorySearch] = useState('');
  const [showVendorSummaryModal, setShowVendorSummaryModal] = useState(false);
  const [selectedVendorSummary, setSelectedVendorSummary] = useState<{
    vendorName: string;
    contactInfo: string;
    totalInvoiced: number;
    totalPaid: number;
    balanceDue: number;
    lastPaymentDate: string | null;
    purchases: CreditPurchase[];
  } | null>(null);
  const [voucherPurchase, setVoucherPurchase] = useState<CreditPurchase | null>(null);

  useEffect(() => {
    fetchPurchases();
    fetchVendors();
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

  const fetchVendors = async () => {
    try {
      const response = await fetch('/api/vendors');
      const data = await response.json();
      setVendorOptions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
      setVendorOptions([]);
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
        setPurchases(prev => [result.purchase, ...prev]);
        setVendorOptions(prev => {
          const nextVendor = result.purchase.vendorName;
          return prev.includes(nextVendor) ? prev : [...prev, nextVendor].sort((a, b) => a.localeCompare(b));
        });
        setVoucherPurchase(result.purchase);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to add purchase:', error);
      return false;
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
        setPurchases(prev => prev.map(p => (p.id === result.purchase.id ? result.purchase : p)));
        setShowPaymentForm(false);
        setSelectedPurchase(null);
      }
    } catch (error) {
      console.error('Failed to add payment:', error);
      const remaining = getRemainingBalance(selectedPurchase.billAmount, selectedPurchase.payments);
      const paidAmount = Number(paymentData.paidAmount);
      const nextPaid = selectedPurchase.payments.reduce((sum, payment) => sum + payment.paidAmount, 0) + paidAmount;
      const nextStatus: CreditPurchase['status'] = nextPaid >= selectedPurchase.billAmount ? 'Paid' : nextPaid > 0 ? 'Partially Paid' : 'Unpaid';
      const updatedPurchase: CreditPurchase = {
        ...selectedPurchase,
        payments: [
          ...selectedPurchase.payments,
          {
            id: `local-${Date.now()}`,
            paymentDate: paymentData.paymentDate,
            paidAmount,
            notes: paymentData.notes,
            recordedAt: Date.now(),
          },
        ],
        status: nextStatus,
        updatedAt: Date.now(),
      };
      setPurchases(prev => prev.map(p => (p.id === selectedPurchase.id ? updatedPurchase : p)));
      setShowPaymentForm(false);
      setSelectedPurchase(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/credit-purchases/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setPurchases(prev => prev.filter(p => p.id !== id));
        setConfirmDialog({ isOpen: false, id: '' });
      }
    } catch (error) {
      console.error('Failed to delete purchase:', error);
    }
  };

  const isDateInRange = (value: string) => {
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) return false;
    const start = new Date(dateRangeStart);
    const end = new Date(dateRangeEnd);
    const normalizedStart = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);
    const normalizedEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);
    return parsedDate >= normalizedStart && parsedDate <= normalizedEnd;
  };

  const applyDatePreset = (preset: 'Today' | 'This Week' | 'This Month' | 'Last Month' | 'Custom Range') => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    const startOfWeek = new Date(today);
    const day = startOfWeek.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    startOfWeek.setDate(today.getDate() + diff);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);

    setDatePreset(preset);
    if (preset === 'Today') {
      setDateRangeStart(startOfToday.toISOString().split('T')[0]);
      setDateRangeEnd(endOfToday.toISOString().split('T')[0]);
    } else if (preset === 'This Week') {
      setDateRangeStart(startOfWeek.toISOString().split('T')[0]);
      setDateRangeEnd(endOfWeek.toISOString().split('T')[0]);
    } else if (preset === 'This Month') {
      setDateRangeStart(startOfMonth.toISOString().split('T')[0]);
      setDateRangeEnd(endOfMonth.toISOString().split('T')[0]);
    } else if (preset === 'Last Month') {
      setDateRangeStart(startOfLastMonth.toISOString().split('T')[0]);
      setDateRangeEnd(endOfLastMonth.toISOString().split('T')[0]);
    } else {
      setShowCustomRange(true);
    }
    setShowCustomRange(preset === 'Custom Range');
  };

  const exportFilteredReport = () => {
    const rows = filteredPurchases.map(purchase => {
      const paid = purchase.payments.reduce((sum, payment) => sum + payment.paidAmount, 0);
      const remaining = getRemainingBalance(purchase.billAmount, purchase.payments);
      return [
        purchase.vendorName,
        purchase.invoiceNumber,
        purchase.department,
        purchase.description,
        purchase.billAmount,
        paid,
        remaining,
        purchase.status,
        purchase.duePaymentDate,
      ].join(',');
    });
    const csv = ['vendor,invoice,department,description,bill_amount,paid_amount,due_amount,status,due_date', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'credit-purchase-report.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredPurchases = purchases.filter(p => {
    const matchesSearch = p.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'All' || p.status === filterStatus;
    const matchesDate = !dateRangeStart || !dateRangeEnd ? true : isDateInRange(p.date) || isDateInRange(p.duePaymentDate);
    return matchesSearch && matchesStatus && matchesDate;
  });

  const groupedPurchases = (
    Object.values(
      filteredPurchases.reduce<Record<string, { vendorName: string; purchases: CreditPurchase[] }>>(
        (acc, purchase) => {
          const key = purchase.vendorName.trim().toLowerCase();
          if (!acc[key]) {
            acc[key] = {
              vendorName: purchase.vendorName,
              purchases: [],
            };
          }
          acc[key].purchases.push(purchase);
          return acc;
        },
        {}
      ) as Record<string, { vendorName: string; purchases: CreditPurchase[] }>
    ) as Array<{ vendorName: string; purchases: CreditPurchase[] }>
  ).sort((a, b) => {
    const aUrgent = a.purchases.some(purchase => isOverdue(purchase.duePaymentDate) && purchase.status !== 'Paid');
    const bUrgent = b.purchases.some(purchase => isOverdue(purchase.duePaymentDate) && purchase.status !== 'Paid');
    if (sortByUrgency && (aUrgent !== bUrgent)) {
      return aUrgent ? -1 : 1;
    }
    return a.vendorName.localeCompare(b.vendorName);
  });

  const stats = calculateCreditStats(filteredPurchases);
  const liabilityBreakdown = (Object.entries(
    filteredPurchases.reduce<Record<string, number>>((acc, purchase) => {
      acc[purchase.department] = (acc[purchase.department] || 0) + purchase.billAmount;
      return acc;
    }, {})
  ) as [string, number][]).map(([department, total]) => ({ department, total }))
    .sort((a, b) => b.total - a.total);

  const vendorDirectoryEntries = Array.from(new Set(purchases.map(purchase => purchase.vendorName).filter(Boolean)))
    .filter((vendorName): vendorName is string => typeof vendorName === 'string' && vendorName.toLowerCase().includes(vendorDirectorySearch.toLowerCase()))
    .map(vendorName => {
      const vendorPurchases = purchases.filter(purchase => purchase.vendorName === vendorName);
      const totalInvoiced = vendorPurchases.reduce((sum, purchase) => sum + purchase.billAmount, 0);
      const totalPaid = vendorPurchases.reduce((sum, purchase) => sum + purchase.payments.reduce((paymentSum, payment) => paymentSum + payment.paidAmount, 0), 0);
      const balanceDue = totalInvoiced - totalPaid;
      const lastPaymentDate = vendorPurchases
        .flatMap(purchase => purchase.payments.map(payment => payment.paymentDate))
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;
      return {
        vendorName,
        contactInfo: 'Contact not on file',
        totalInvoiced,
        totalPaid,
        balanceDue,
        lastPaymentDate,
        purchases: vendorPurchases,
      };
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Credit Purchase Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor balances, prioritize overdue liabilities, and act fast on vendor payments.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowVendorLedger(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700"
          >
            <TrendingUp className="w-5 h-5" />
            Vendor Ledger
          </button>
          <button
            onClick={exportFilteredReport}
            className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900"
          >
            <Download className="w-5 h-5" />
            Export Report
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Total Purchase" value={formatCurrency(stats.totalPurchase)} color="blue" />
          <StatCard label="Total Paid" value={formatCurrency(stats.totalPaid)} color="green" />
          <StatCard label="Total Due" value={formatCurrency(stats.totalDue)} color="red" />
          <StatCard label="Overdue Payments" value={stats.overduePayments.length.toString()} color="yellow" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Liability Mix</p>
              <h3 className="text-sm font-semibold text-slate-900">By Department</h3>
            </div>
            <div className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Live</div>
          </div>
          <div className="h-44 w-full">
            {liabilityBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={liabilityBreakdown} dataKey="total" nameKey="department" innerRadius={44} outerRadius={74} paddingAngle={2} stroke="#fff" strokeWidth={3}>
                    {liabilityBreakdown.map((entry, index) => (
                      <Cell key={entry.department} fill={['#00a86b', '#0f766e', '#64748b', '#4f46e5', '#f59e0b', '#cbd5e1'][index % 6]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">No liabilities in this range.</div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {(['Today', 'This Week', 'This Month', 'Last Month', 'Custom Range'] as const).map(preset => (
              <button
                key={preset}
                onClick={() => applyDatePreset(preset)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${datePreset === preset ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {preset}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-600">
              <input type="checkbox" checked={sortByUrgency} onChange={() => setSortByUrgency(!sortByUrgency)} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
              Sort by urgency
            </label>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-600">
              <CalendarDays className="h-4 w-4 text-slate-400" />
              <span>{datePreset}</span>
            </div>
          </div>
        </div>
        {showCustomRange && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:flex-row md:items-end">
            <label className="flex flex-col text-sm text-slate-600">
              <span className="mb-1 font-medium">Start</span>
              <input type="date" value={dateRangeStart} onChange={(e) => setDateRangeStart(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2" />
            </label>
            <label className="flex flex-col text-sm text-slate-600">
              <span className="mb-1 font-medium">End</span>
              <input type="date" value={dateRangeEnd} onChange={(e) => setDateRangeEnd(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2" />
            </label>
            <button onClick={() => setShowCustomRange(false)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">Apply</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.35fr] gap-6">
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by vendor name, invoice, or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="All">All Status</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Paid">Paid</option>
            </select>
          </div>

          <div className="space-y-3">
            {groupedPurchases.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-gray-500">No purchases found for this view.</p>
              </div>
            ) : (
              groupedPurchases.map(group => (
                <VendorGroupCard
                  key={group.vendorName}
                  group={group}
                  onAddPayment={(purchase) => {
                    setSelectedPurchase(purchase);
                    setShowPaymentForm(true);
                  }}
                  onPrintSlip={(p) => setVoucherPurchase(p)}
                  onDelete={(id) => setConfirmDialog({ isOpen: true, id })}
                />
              ))
            )}
          </div>
        </div>

        <aside className="xl:sticky xl:top-4 h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Directory</p>
              <h3 className="text-lg font-semibold text-slate-900">Permanent Vendors</h3>
            </div>
            <div className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Quick access</div>
          </div>
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search vendors"
              value={vendorDirectorySearch}
              onChange={(e) => setVendorDirectorySearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="mt-4 space-y-2">
            {vendorDirectoryEntries.length > 0 ? vendorDirectoryEntries.map(entry => (
              <button
                key={entry.vendorName}
                onClick={() => {
                  setSelectedVendorSummary(entry);
                  setShowVendorSummaryModal(true);
                }}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left transition hover:border-emerald-300 hover:bg-emerald-50"
              >
                <span className="text-sm font-medium text-slate-800">{entry.vendorName}</span>
                <span className="text-xs text-slate-500">{formatCurrency(entry.balanceDue)}</span>
              </button>
            )) : <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500">No matching vendors.</div>}
          </div>
        </aside>
      </div>

      {showAddForm && (
        <AddPurchaseForm
          vendorOptions={vendorOptions}
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

      {showVendorLedger && (
        <VendorLedgerModal stats={stats} onClose={() => setShowVendorLedger(false)} />
      )}

      {showVendorSummaryModal && selectedVendorSummary && (
        <VendorSummaryModal
          vendor={selectedVendorSummary}
          onClose={() => {
            setShowVendorSummaryModal(false);
            setSelectedVendorSummary(null);
          }}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Delete Purchase"
        message="Are you sure you want to delete this purchase entry? This action cannot be undone."
        confirmText="Delete"
        isDangerous
        onConfirm={() => handleDelete(confirmDialog.id)}
        onCancel={() => setConfirmDialog({ isOpen: false, id: '' })}
      />

      {voucherPurchase && (
        <CreditPurchaseVoucherModal
          purchase={voucherPurchase}
          onClose={() => setVoucherPurchase(null)}
        />
      )}
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

interface VendorGroupCardProps {
  group: {
    vendorName: string;
    purchases: CreditPurchase[];
  };
  onAddPayment: (purchase: CreditPurchase) => void;
  onPrintSlip: (purchase: CreditPurchase) => void;
  onDelete: (id: string) => void;
  key?: React.Key;
}

function VendorGroupCard({ group, onAddPayment, onPrintSlip, onDelete }: VendorGroupCardProps) {
  const statusColors = {
    Unpaid: 'bg-red-100 text-red-800',
    'Partially Paid': 'bg-yellow-100 text-yellow-800',
    Paid: 'bg-green-100 text-green-800',
  };

  const totalBill = group.purchases.reduce((sum, purchase) => sum + purchase.billAmount, 0);
  const totalDue = group.purchases.reduce((sum, purchase) => {
    const paid = purchase.payments.reduce((paymentSum, payment) => paymentSum + payment.paidAmount, 0);
    return sum + getRemainingBalance(purchase.billAmount, purchase.payments);
  }, 0);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{group.vendorName}</h3>
            <p className="text-sm text-gray-500">{group.purchases.length} invoice{group.purchases.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
            <div className="rounded-lg bg-white px-3 py-2 border border-gray-200">
              <p className="text-xs text-gray-500">Total Bill</p>
              <p className="font-semibold text-gray-900">{formatCurrency(totalBill)}</p>
            </div>
            <div className="rounded-lg bg-white px-3 py-2 border border-gray-200">
              <p className="text-xs text-gray-500">Total Due</p>
              <p className="font-semibold text-red-700">{formatCurrency(totalDue)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-white">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Due Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {group.purchases.map(purchase => {
              const paid = purchase.payments.reduce((sum, payment) => sum + payment.paidAmount, 0);
              const remaining = getRemainingBalance(purchase.billAmount, purchase.payments);
              const isPurchaseOverdue = isOverdue(purchase.duePaymentDate) && purchase.status !== 'Paid';

              return (
                <tr key={purchase.id} className={isPurchaseOverdue ? 'bg-red-50' : 'bg-white'}>
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-gray-900">{purchase.invoiceNumber}</div>
                    <div className="text-xs text-gray-500">{purchase.department}</div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="text-sm text-gray-900">{purchase.description}</div>
                    {purchase.notes && (
                      <div className="text-xs text-gray-500 mt-1">{purchase.notes}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-sm">
                    <div className="font-semibold text-gray-900">{formatCurrency(purchase.billAmount)}</div>
                    <div className="text-xs text-green-700">Paid: {formatCurrency(paid)}</div>
                    <div className="text-xs text-red-700">Due: {formatCurrency(remaining)}</div>
                  </td>
                  <td className="px-4 py-3 align-top text-sm text-gray-900">
                    {formatDate(purchase.duePaymentDate)}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusColors[purchase.status]}`}>
                      {purchase.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onPrintSlip(purchase)}
                        className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded text-sm font-medium flex items-center gap-1"
                      >
                        <Printer size={14} />
                        Print Slip
                      </button>
                      {purchase.status !== 'Paid' && (
                        <button
                          onClick={() => onAddPayment(purchase)}
                          className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm font-medium"
                        >
                          Add Payment
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(purchase.id)}
                        className="px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface AddPurchaseFormProps {
  vendorOptions: string[];
  onSubmit: (data: any) => Promise<boolean>;
  onClose: () => void;
}

function createEmptyPurchaseFormData() {
  return {
    date: new Date().toISOString().split('T')[0],
    vendorName: '',
    description: '',
    billAmount: '',
    duePaymentDate: '',
    invoiceNumber: '',
    department: DEPARTMENTS[0],
    notes: '',
  };
}

function AddPurchaseForm({ vendorOptions, onSubmit, onClose }: AddPurchaseFormProps) {
  const [formData, setFormData] = useState(createEmptyPurchaseFormData);
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitNotice(null);
    setIsSaving(true);
    try {
      const success = await onSubmit({
        ...formData,
        billAmount: parseFloat(formData.billAmount),
        createdBy: 'user',
      });

      if (success) {
        setFormData(createEmptyPurchaseFormData());
        setSubmitNotice('Credit purchase saved successfully. You can add another invoice immediately.');
      } else {
        setSubmitNotice('Unable to save the purchase right now. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white">
          <h2 className="text-2xl font-bold text-gray-900">Add Credit Purchase</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {submitNotice && (
            <div className={`rounded-lg border px-3 py-2 text-sm ${submitNotice.includes('successfully') ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
              {submitNotice}
            </div>
          )}
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
                list="vendor-suggestions"
                value={formData.vendorName}
                onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Type or select vendor"
              />
              <datalist id="vendor-suggestions">
                {vendorOptions.map(option => (
                  <option key={option} value={option} />
                ))}
              </datalist>
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
              Close
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : 'Save Purchase'}
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
                  {Object.entries(stats.vendorSummary).map(([vendor, rawData]) => {
                    const data = rawData as { purchase: number; paid: number; due: number };
                    return (
                      <tr key={vendor} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{vendor}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(data.purchase)}</td>
                        <td className="px-4 py-3 text-right text-green-700 font-medium">{formatCurrency(data.paid)}</td>
                        <td className="px-4 py-3 text-right text-red-700 font-medium">{formatCurrency(data.due)}</td>
                        <td className="px-4 py-3 text-center text-gray-900 font-medium">
                          {Math.round((data.paid / data.purchase) * 100)}%
                        </td>
                      </tr>
                    );
                  })}
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

interface VendorSummaryModalProps {
  vendor: {
    vendorName: string;
    contactInfo: string;
    totalInvoiced: number;
    totalPaid: number;
    balanceDue: number;
    lastPaymentDate: string | null;
    purchases: CreditPurchase[];
  };
  onClose: () => void;
}

function VendorSummaryModal({ vendor, onClose }: VendorSummaryModalProps) {
  const preparedBy = typeof window !== 'undefined' ? (window.localStorage.getItem('preparedBy') || 'System User') : 'System User';
  const generatedAt = new Date();

  const statementRows = vendor.purchases
    .map(purchase => {
      const paid = purchase.payments.reduce((sum, payment) => sum + payment.paidAmount, 0);
      const balance = Math.max(0, purchase.billAmount - paid);
      return { ...purchase, paid, balance };
    })
    .filter(entry => entry.balance > 0 || entry.status !== 'Paid')
    .sort((a, b) => new Date(a.duePaymentDate).getTime() - new Date(b.duePaymentDate).getTime());

  const totalBillAmount = statementRows.reduce((sum, entry) => sum + entry.billAmount, 0);
  const totalPaidAmount = statementRows.reduce((sum, entry) => sum + entry.paid, 0);
  const netDueAmount = totalBillAmount - totalPaidAmount;

  const buildPrintHtml = () => {
    const rowsHtml = statementRows.map(entry => `
      <tr>
        <td style="padding:10px;border:1px solid #333;font-weight:700;">${entry.invoiceNumber}</td>
        <td style="padding:10px;border:1px solid #333;">${entry.department}${entry.notes ? ` • ${entry.notes}` : ''}</td>
        <td style="padding:10px;border:1px solid #333;">${entry.description}</td>
        <td style="padding:10px;border:1px solid #333;">${formatDate(entry.date)}</td>
        <td style="padding:10px;border:1px solid #333;text-align:right;">${formatCurrency(entry.billAmount)}</td>
        <td style="padding:10px;border:1px solid #333;text-align:right;">${formatCurrency(entry.paid)}</td>
        <td style="padding:10px;border:1px solid #333;text-align:right;">${formatCurrency(entry.balance)}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Vendor Statement - ${vendor.vendorName}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; padding: 0; }
          .page { width: 100%; max-width: 210mm; margin: 0 auto; padding: 15mm; box-sizing: border-box; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
          .brand { display: flex; align-items: center; gap: 12px; }
          .brand-logo { width: 60px; height: auto; }
          .title { text-transform: uppercase; font-size: 16px; letter-spacing: 0.1em; margin: 0; }
          .subtitle { margin: 4px 0 0; font-size: 11px; color: #555; }
          .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 18px 0; }
          .summary-card { border: 1px solid #ccc; padding: 12px 14px; border-radius: 8px; background: #f8f9fb; }
          .summary-card strong { display: block; margin-bottom: 5px; font-size: 10px; color: #555; letter-spacing: 0.08em; text-transform: uppercase; }
          .summary-card span { display: block; font-size: 15px; font-weight: 700; color: #111; }
          .totals { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
          .totals .total-card { border: 1px solid #ccc; border-radius: 10px; padding: 12px; background: #fff; }
          .total-card .label { display: block; font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
          .total-card .value { font-size: 18px; font-weight: 700; color: #111; }
          .total-card.net-due .value { color: #c81d25; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #333; padding: 10px; vertical-align: top; }
          th { background: #f0f1f3; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #333; }
          td { color: #222; }
          .signature-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; margin-top: 24px; }
          .signature-block { min-height: 70px; border-top: 1px dashed #333; padding-top: 8px; font-size: 11px; color: #333; text-transform: uppercase; letter-spacing: 0.08em; }
          .signature-label { font-weight: 700; margin-bottom: 6px; display: block; }
          .footer-note { margin-top: 16px; font-size: 10px; color: #555; }
          .page-break { page-break-after: always; }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <div class="brand">
              <img class="brand-logo" src="${logoUrl}" alt="CD PATH Logo" />
              <div>
                <p class="title">CD PATH & HOSPITAL</p>
                <p class="subtitle">Vendor Due Statement / Statement of Account</p>
              </div>
            </div>
            <div style="text-align:right;font-size:12px;color:#333;">
              <div><strong>Generated:</strong> ${generatedAt.toLocaleDateString('en-BD')}</div>
              <div><strong>Print Time:</strong> ${generatedAt.toLocaleTimeString('en-BD')}</div>
            </div>
          </div>

          <div class="summary-grid">
            <div class="summary-card"><strong>Vendor</strong><span>${vendor.vendorName}</span></div>
            <div class="summary-card"><strong>Contact</strong><span>${vendor.contactInfo}</span></div>
            <div class="summary-card"><strong>Invoices Count</strong><span>${statementRows.length}</span></div>
            <div class="summary-card"><strong>Last Payment</strong><span>${vendor.lastPaymentDate ? formatDate(vendor.lastPaymentDate) : 'N/A'}</span></div>
          </div>

          <div class="totals">
            <div class="total-card"><span class="label">Total Bill Amount</span><span class="value">${formatCurrency(totalBillAmount)}</span></div>
            <div class="total-card"><span class="label">Total Paid Amount</span><span class="value">${formatCurrency(totalPaidAmount)}</span></div>
            <div class="total-card net-due"><span class="label">Net Due Amount</span><span class="value">${formatCurrency(netDueAmount)}</span></div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Department / Notes</th>
                <th>Description</th>
                <th>Invoice Date</th>
                <th style="text-align:right;">Invoice Amount</th>
                <th style="text-align:right;">Paid Amount</th>
                <th style="text-align:right;">Balance Due</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="signature-grid">
            <div class="signature-block"><span class="signature-label">Prepared By</span>${preparedBy}</div>
            <div class="signature-block"><span class="signature-label">Authorized Signature</span></div>
            <div class="signature-block"><span class="signature-label">Vendor Signature</span></div>
          </div>

          <p class="footer-note">System-generated statement. This document is intended for payment follow-up, reconciliation, and record keeping.</p>
        </div>
      </body>
      </html>
    `;
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      return;
    }

    printWindow.document.open();
    printWindow.document.write(buildPrintHtml());
    printWindow.document.close();
    printWindow.focus();

    const printOnLoad = () => {
      printWindow.removeEventListener('afterprint', printOnLoad);
      printWindow.print();
      printWindow.close();
    };

    printWindow.addEventListener('afterprint', printOnLoad);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="vendor-statement-print-root w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-6 py-4 print:hidden">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{vendor.vendorName} Statement</h2>
            <p className="text-sm text-slate-500">Print-ready vendor due summary for reconciliation and payment follow-up.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <Printer size={16} />
              Print Statement
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Close
            </button>
          </div>
        </div>

        <div id="printable-vendor-summary" className="vendor-statement-print-sheet bg-white p-6 sm:p-8 text-slate-900">
          <div className="border-b-2 border-slate-800 pb-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={logoUrl}
                  alt="CD PATH Logo"
                  className="h-14 w-14 object-contain"
                />
                <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-900">CD PATH & HOSPITAL</h1>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">Vendor Due Statement / Statement of Account</p>
                  <p className="text-xs text-slate-500">Procurement & Accounts Department</p>
                </div>
              </div>
              <div className="text-sm text-slate-600">
                <p><span className="font-semibold">Generated:</span> {generatedAt.toLocaleDateString('en-BD')}</p>
                <p><span className="font-semibold">Print Time:</span> {generatedAt.toLocaleTimeString('en-BD')}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Vendor</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{vendor.vendorName}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Contact</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{vendor.contactInfo}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Invoices Count</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{statementRows.length}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Last Payment</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{vendor.lastPaymentDate ? formatDate(vendor.lastPaymentDate) : 'N/A'}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Total Bill Amount</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(totalBillAmount)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Total Paid Amount</p>
              <p className="mt-1 text-lg font-bold text-emerald-700">{formatCurrency(totalPaidAmount)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Net Due Amount</p>
              <p className="mt-1 text-lg font-bold text-red-700">{formatCurrency(netDueAmount)}</p>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-100 text-left text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-600">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-3">Invoice No.</th>
                  <th className="border-b border-slate-200 px-3 py-3">Department / Notes</th>
                  <th className="border-b border-slate-200 px-3 py-3">Description</th>
                  <th className="border-b border-slate-200 px-3 py-3">Invoice Date</th>
                  <th className="border-b border-slate-200 px-3 py-3 text-right">Invoice Amount</th>
                  <th className="border-b border-slate-200 px-3 py-3 text-right">Paid Amount</th>
                  <th className="border-b border-slate-200 px-3 py-3 text-right">Balance Due</th>
                </tr>
              </thead>
              <tbody>
                {statementRows.length > 0 ? statementRows.map(entry => (
                  <tr key={entry.id} className="border-b border-slate-200 last:border-0 bg-white">
                    <td className="px-3 py-3 font-semibold text-slate-900">{entry.invoiceNumber}</td>
                    <td className="px-3 py-3 text-slate-700">{entry.department}{entry.notes ? ` • ${entry.notes}` : ''}</td>
                    <td className="px-3 py-3 text-slate-700">{entry.description}</td>
                    <td className="px-3 py-3 text-slate-700">{formatDate(entry.date)}</td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-900">{formatCurrency(entry.billAmount)}</td>
                    <td className="px-3 py-3 text-right font-semibold text-emerald-700">{formatCurrency(entry.paid)}</td>
                    <td className="px-3 py-3 text-right font-semibold text-red-700">{formatCurrency(entry.balance)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-slate-500">No outstanding invoices for this vendor.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-8 grid gap-6 border-t border-slate-200 pt-6 md:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Prepared By</p>
              <p className="mt-2 border-b border-slate-300 pb-2 text-sm text-slate-700">{preparedBy}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Authorized Signature</p>
              <p className="mt-2 border-b border-slate-300 pb-2 text-sm text-slate-700">_____________________</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Vendor Signature</p>
              <p className="mt-2 border-b border-slate-300 pb-2 text-sm text-slate-700">_____________________</p>
            </div>
          </div>

          <p className="mt-6 text-xs text-slate-500">System-generated statement. This document is intended for payment follow-up, reconciliation, and record keeping.</p>
        </div>
      </div>
    </div>
  );
}

interface CreditPurchaseVoucherModalProps {
  purchase: CreditPurchase;
  onClose: () => void;
}

function CreditPurchaseVoucherModal({ purchase, onClose }: CreditPurchaseVoucherModalProps) {
  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const voucherId = `CPV-${purchase.id.slice(-6).toUpperCase()}`;
  const totalPaid = purchase.payments.reduce((sum, p) => sum + p.paidAmount, 0);
  const remainingDue = Math.max(0, purchase.billAmount - totalPaid);

  return (
    <div className="voucher-print-root fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto print:p-0 print:static print:bg-transparent">
      <div
        id="printable-credit-voucher"
        className="voucher-print-sheet bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-8 border border-slate-200 printable-voucher relative print:shadow-none print:border-none print:w-full print:max-w-full"
      >
        {/* Top Control Bar - Hidden during print */}
        <div className="flex items-center justify-between border-b pb-4 mb-6 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-bold text-gray-900">Credit Purchase Voucher / Slip</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm"
            >
              <Printer size={16} />
              Print Credit Slip
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
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <img
                src={logoUrl}
                alt="CD PATH Logo"
                className="h-14 w-14 object-contain"
              />
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">CD PATH & HOSPITAL</h1>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Procurement & Accounts Department</p>
                <p className="text-[11px] text-slate-400">CD Path Road, Hospital Square</p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block bg-purple-100 text-purple-800 font-extrabold text-xs px-3 py-1 rounded-md border border-purple-200 mb-1">
                CREDIT PURCHASE VOUCHER
              </span>
              <p className="text-xs font-mono text-slate-600">Voucher ID: <strong className="text-slate-900">{voucherId}</strong></p>
              <p className="text-xs text-slate-500">Bill Date: {formatDate(purchase.date)}</p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4 border border-slate-300 rounded-xl p-4 bg-slate-50 text-sm">
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold">Vendor / Supplier Name</p>
              <p className="text-base font-bold text-slate-900">{purchase.vendorName}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold">Hospital Department</p>
              <p className="text-base font-bold text-slate-900">{purchase.department}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold">Due Date / Payment Terms</p>
              <p className="font-semibold text-slate-800">{formatDate(purchase.duePaymentDate)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold">Current Payment Status</p>
              <p className="font-bold text-purple-700">{purchase.status}</p>
            </div>
          </div>

          {/* Item Description */}
          <div className="border border-slate-300 rounded-xl p-4 text-sm">
            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Item Description / Particulars</p>
            <p className="font-medium text-slate-800 whitespace-pre-wrap">{purchase.description}</p>
            {purchase.notes && (
              <p className="text-xs text-slate-500 mt-2 italic">Notes: {purchase.notes}</p>
            )}
          </div>

          {/* Breakdown Table */}
          <div className="border border-slate-300 rounded-xl overflow-hidden text-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b">
                <tr>
                  <th className="px-4 py-2.5">Total Bill Amount</th>
                  <th className="px-4 py-2.5 text-right">Total Paid</th>
                  <th className="px-4 py-2.5 text-right">Remaining Balance Due</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-3 font-bold text-slate-900">{formatCurrency(purchase.billAmount)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-700">{formatCurrency(totalPaid)}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-700">{formatCurrency(remainingDue)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Amount In Words */}
          <div className="bg-slate-900 text-white rounded-xl p-4">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Bill Amount (In Words)</p>
            <p className="text-sm font-semibold text-amber-400 mt-0.5 italic">{numberToWords(purchase.billAmount)}</p>
          </div>

          {/* Signature Block */}
          <div className="pt-16 grid grid-cols-3 gap-8 text-center text-xs font-semibold text-slate-700">
            <div>
              <div className="border-t-2 border-slate-800 pt-2">
                <p className="font-bold text-slate-900">Authorized Receiver</p>
                <p className="text-[10px] text-slate-500">CD PATH Staff Signature</p>
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
                <p className="font-bold text-slate-900">Vendor / Supplier Signature</p>
                <p className="text-[10px] text-slate-500">Signature & Official Stamp</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


