import React, { useState, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  PieChart, 
  Pie, 
  AreaChart, 
  Area,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PieChart as PieChartIcon, 
  BarChart3, 
  Calendar, 
  Award, 
  Building2, 
  Tag, 
  ArrowUpRight, 
  FileText,
  Printer,
  Sparkles
} from 'lucide-react';
import { format, parseISO, isSameMonth, isSameYear, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { DEPARTMENTS, type Expense, type CashIn, type Department, type Category } from './types';

interface AnalyticsDashboardProps {
  expenses: Expense[];
  cashIn: CashIn[];
  categories: Category[];
}

export function AnalyticsDashboard({ expenses, cashIn, categories }: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<'this_month' | 'last_month' | 'this_year' | 'all'>('this_month');
  const [selectedDept, setSelectedDept] = useState<Department | 'All'>('All');

  // Filter expenses based on selected time range and department
  const filteredExpenses = useMemo(() => {
    const now = new Date();
    return expenses.filter(expense => {
      const expDate = parseISO(expense.date);
      let matchesTime = true;

      if (timeRange === 'this_month') {
        matchesTime = isSameMonth(expDate, now) && isSameYear(expDate, now);
      } else if (timeRange === 'last_month') {
        const lastMonth = subMonths(now, 1);
        matchesTime = isSameMonth(expDate, lastMonth) && isSameYear(expDate, lastMonth);
      } else if (timeRange === 'this_year') {
        matchesTime = isSameYear(expDate, now);
      }

      const matchesDept = selectedDept === 'All' || expense.department === selectedDept;
      return matchesTime && matchesDept;
    });
  }, [expenses, timeRange, selectedDept]);

  // Metrics
  const totalSpent = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [filteredExpenses]);

  const totalFundDeposited = useMemo(() => {
    return cashIn.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  }, [cashIn]);

  const totalAllTimeSpent = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [expenses]);

  const netBalance = totalFundDeposited - totalAllTimeSpent;

  // Largest Expense
  const largestExpense = useMemo(() => {
    if (filteredExpenses.length === 0) return null;
    return [...filteredExpenses].sort((a, b) => b.amount - a.amount)[0];
  }, [filteredExpenses]);

  // Department Breakdown Data
  const deptChartData = useMemo(() => {
    return DEPARTMENTS.map(dept => {
      const amount = filteredExpenses
        .filter(e => e.department === dept)
        .reduce((sum, e) => sum + e.amount, 0);
      return {
        department: dept,
        amount,
        count: filteredExpenses.filter(e => e.department === dept).length
      };
    }).filter(d => d.amount > 0).sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses]);

  // Top Department
  const topDepartment = deptChartData[0] || null;

  // Category Breakdown Data
  const categoryChartData = useMemo(() => {
    const map = new Map<string, number>();
    filteredExpenses.forEach(e => {
      const current = map.get(e.category) || 0;
      map.set(e.category, current + e.amount);
    });

    const items = Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    items.sort((a, b) => b.value - a.value);
    
    if (items.length <= 6) return items;
    const top5 = items.slice(0, 5);
    const othersValue = items.slice(5).reduce((sum, item) => sum + item.value, 0);
    return [...top5, { name: 'Others', value: othersValue }];
  }, [filteredExpenses]);

  // Top Category
  const topCategory = categoryChartData[0] || null;

  // Monthly Trend Data (Last 12 Months)
  const monthlyTrendData = useMemo(() => {
    const monthsMap: { [key: string]: number } = {};
    const now = new Date();
    
    // Build last 6 months list
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const label = format(monthDate, 'MMM yyyy');
      monthsMap[label] = 0;
    }

    expenses.forEach(e => {
      const expDate = parseISO(e.date);
      const label = format(expDate, 'MMM yyyy');
      if (monthsMap[label] !== undefined) {
        monthsMap[label] += Number(e.amount) || 0;
      }
    });

    return Object.entries(monthsMap).map(([month, amount]) => ({ month, amount }));
  }, [expenses]);

  // Department Details Table Data
  const deptTableData = useMemo(() => {
    return DEPARTMENTS.map(dept => {
      const deptExpenses = filteredExpenses.filter(e => e.department === dept);
      const total = deptExpenses.reduce((sum, e) => sum + e.amount, 0);
      const count = deptExpenses.length;
      const avg = count > 0 ? total / count : 0;
      const percentage = totalSpent > 0 ? (total / totalSpent) * 100 : 0;

      return {
        department: dept,
        total,
        count,
        avg,
        percentage
      };
    }).filter(d => d.total > 0).sort((a, b) => b.total - a.total);
  }, [filteredExpenses, totalSpent]);

  // Colors Palette
  const COLORS = ['#0f766e', '#14b8a6', '#0284c7', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#64748b'];

  const handlePrintReport = () => {
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return (
    <div className="space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm print:hidden">
        <div>
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-widest mb-1">
            <Sparkles size={16} />
            <span>Executive Analytics & Intelligence</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Financial Reports & Insights</h2>
          <p className="text-slate-500 text-sm">Deep-dive analysis of petty cash expenditures across hospital departments.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Time Range Selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setTimeRange('this_month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                timeRange === 'this_month' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setTimeRange('last_month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                timeRange === 'last_month' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last Month
            </button>
            <button
              onClick={() => setTimeRange('this_year')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                timeRange === 'this_year' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              This Year
            </button>
            <button
              onClick={() => setTimeRange('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                timeRange === 'all' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Time
            </button>
          </div>

          {/* Department Filter */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value as Department | 'All')}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
          >
            <option value="All">All Departments</option>
            {DEPARTMENTS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Print Button */}
          <button
            onClick={handlePrintReport}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <Printer size={16} />
            Print Report
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Period Spend */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <DollarSign size={80} />
          </div>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Period Expense Total</p>
          <h3 className="text-3xl font-extrabold tracking-tight mb-1">৳{totalSpent.toLocaleString()}</h3>
          <p className="text-slate-400 text-xs flex items-center gap-1 mt-3">
            <FileText size={14} className="text-emerald-400" />
            <span>{filteredExpenses.length} transaction entries</span>
          </p>
        </div>

        {/* Card 2: Net Available Fund */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Remaining Vault Cash</p>
            <div className={`p-2 rounded-xl ${netBalance >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
              <TrendingUp size={18} />
            </div>
          </div>
          <h3 className={`text-3xl font-extrabold tracking-tight mb-1 ${netBalance >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
            ৳{netBalance.toLocaleString()}
          </h3>
          <p className="text-slate-500 text-xs mt-3">
            Total Fund Injected: <span className="font-bold text-slate-700">৳{totalFundDeposited.toLocaleString()}</span>
          </p>
        </div>

        {/* Card 3: Top Department */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Top Spending Dept</p>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Building2 size={18} />
            </div>
          </div>
          <h3 className="text-xl font-bold text-slate-900 truncate mb-1">
            {topDepartment ? topDepartment.department : 'N/A'}
          </h3>
          <p className="text-slate-500 text-xs mt-3">
            Spend: <span className="font-bold text-blue-600">৳{topDepartment ? topDepartment.amount.toLocaleString() : 0}</span>
          </p>
        </div>

        {/* Card 4: Top Category */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Top Expense Category</p>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Tag size={18} />
            </div>
          </div>
          <h3 className="text-xl font-bold text-slate-900 truncate mb-1">
            {topCategory ? topCategory.name : 'N/A'}
          </h3>
          <p className="text-slate-500 text-xs mt-3">
            Spend: <span className="font-bold text-amber-600">৳{topCategory ? topCategory.value.toLocaleString() : 0}</span>
          </p>
        </div>
      </div>

      {/* Visual Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Monthly Trend Line Chart */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Monthly Expenditure Growth</h3>
              <p className="text-xs text-slate-500">Trailing 6-month petty cash spending trend</p>
            </div>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `৳${val / 1000}k`} />
                <Tooltip 
                  formatter={(value: any) => [`৳${Number(value).toLocaleString()}`, 'Total Spent']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#fff' }}
                />
                <Area type="monotone" dataKey="amount" stroke="#059669" strokeWidth={3} fillOpacity={1} fill="url(#colorAmount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Category Breakdown Donut Chart */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Category Wise Distribution</h3>
              <p className="text-xs text-slate-500">Proportion of funds allocated by expense type</p>
            </div>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <PieChartIcon size={20} />
            </div>
          </div>
          <div className="h-72 w-full flex items-center justify-center">
            {categoryChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => [`৳${Number(value).toLocaleString()}`, 'Spent']}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#fff' }}
                  />
                  <Legend 
                    layout="horizontal" 
                    verticalAlign="bottom" 
                    align="center"
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-400 text-sm">No expenses recorded for selected criteria.</p>
            )}
          </div>
        </div>
      </div>

      {/* Department Breakdown Bar Chart */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Department Expense Comparison</h3>
            <p className="text-xs text-slate-500">Total petty cash utilization by hospital departments</p>
          </div>
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
            <BarChart3 size={20} />
          </div>
        </div>

        <div className="h-80 w-full">
          {deptChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptChartData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="department" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} angle={-25} textAnchor="end" />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `৳${val / 1000}k`} />
                <Tooltip 
                  formatter={(value: any) => [`৳${Number(value).toLocaleString()}`, 'Amount Spent']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#fff' }}
                />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                  {deptChartData.map((entry, index) => (
                    <Cell key={`bar-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">
              No department data available.
            </div>
          )}
        </div>
      </div>

      {/* Department Analytics Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Departmental Breakdown Table</h3>
            <p className="text-xs text-slate-500">Detailed metric comparison per department</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4 text-center">Transactions</th>
                <th className="px-6 py-4 text-right">Total Spent</th>
                <th className="px-6 py-4 text-right">Avg / Transaction</th>
                <th className="px-6 py-4 text-right">% of Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deptTableData.map((row) => (
                <tr key={row.department} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900 flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                    {row.department}
                  </td>
                  <td className="px-6 py-4 text-center text-slate-600 font-semibold">{row.count}</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">৳{row.total.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-slate-600 font-medium">৳{Math.round(row.avg).toLocaleString()}</td>
                  <td className="px-6 py-4 text-right font-bold text-emerald-600">{row.percentage.toFixed(1)}%</td>
                </tr>
              ))}
              {deptTableData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400 italic">
                    No data recorded for this view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
