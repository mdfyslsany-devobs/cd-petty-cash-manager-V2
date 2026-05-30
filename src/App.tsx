import * as React from 'react';
import { useState, useEffect, Component, type ErrorInfo, type ReactNode } from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  History, 
  FileSpreadsheet, 
  Hospital,
  TrendingUp,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Filter,
  Download,
  Trash2,
  ExternalLink,
  ChevronRight,
  LogOut,
  LogIn,
  AlertCircle,
  Printer
} from 'lucide-react';
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
  Pie
} from 'recharts';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, isSameDay, startOfYear, endOfYear, isSameMonth, isSameYear } from 'date-fns';
import { DEPARTMENTS, DEFAULT_CATEGORIES, type Expense, type Department, type Category, type CashIn } from './types';
import { ProcurementAdvancesPage } from './ProcurementAdvances';
import { StaffLoanTrackerPage } from './StaffLoanTracker';
import { CreditPurchaseTrackerPage } from './CreditPurchaseTracker';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  auth, 
  db, 
  loginWithEmailPassword, 
  logout, 
  handleFirestoreError, 
  OperationType 
} from './firebase';
import { 
  onAuthStateChanged, 
  type User 
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  query, 
  orderBy 
} from 'firebase/firestore';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


export default function App() {
  return (
    <PettyCashApp />
  );
}

function PettyCashApp() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'accounts_officer' | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cashIn, setCashIn] = useState<CashIn[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'daily' | 'entry' | 'add-cash' | 'history' | 'sheets' | 'settings' | 'procurement' | 'loans' | 'credits'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState<Department | 'All'>('All');
  const [historyFilter, setHistoryFilter] = useState<{
    type: 'all' | 'daily' | 'monthly' | 'yearly';
    date: string;
  }>({
    type: 'all',
    date: format(new Date(), 'yyyy-MM-dd')
  });
  const [showHistoryPrintPreview, setShowHistoryPrintPreview] = useState(false);
  const [reportFilter, setReportFilter] = useState<{
    type: 'daily' | 'monthly' | 'yearly';
    date: string;
  }>({
    type: 'daily',
    date: format(new Date(), 'yyyy-MM-dd')
  });
  const [editingCashIn, setEditingCashIn] = useState<CashIn | null>(null);

  const handlePrint = () => {
    // Small delay to ensure all content is fully rendered
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const filteredHistoryExpenses = expenses.filter(e => {
    const matchesSearch = e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         e.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = filterDept === 'All' || e.department === filterDept;
    const expenseDate = parseISO(e.date);
    let matchesDate = true;

    if (historyFilter.type === 'daily') {
      matchesDate = isSameDay(expenseDate, parseISO(historyFilter.date));
    } else if (historyFilter.type === 'monthly') {
      const filterDate = parseISO(historyFilter.date);
      matchesDate = isSameMonth(expenseDate, filterDate);
    } else if (historyFilter.type === 'yearly') {
      const filterDate = parseISO(historyFilter.date);
      matchesDate = isSameYear(expenseDate, filterDate);
    }

    return matchesSearch && matchesDept && matchesDate;
  });

  const historyPeriodLabel = historyFilter.type === 'daily'
    ? format(parseISO(historyFilter.date), 'MMMM dd, yyyy')
    : historyFilter.type === 'monthly'
      ? format(parseISO(historyFilter.date), 'MMMM yyyy')
      : historyFilter.type === 'yearly'
        ? format(parseISO(historyFilter.date), 'yyyy')
        : 'All Time';

  const historyTotalAmount = filteredHistoryExpenses.reduce((sum, e) => sum + e.amount, 0);

  const historyDepartmentTotals = DEPARTMENTS.map(dept => ({
    department: dept,
    amount: filteredHistoryExpenses
      .filter(expense => expense.department === dept)
      .reduce((sum, expense) => sum + expense.amount, 0)
  }));

  const selectedDepartmentTotal = filterDept === 'All'
    ? null
    : historyDepartmentTotals.find(item => item.department === filterDept)?.amount ?? 0;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);

      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        let role: 'admin' | 'accounts_officer' = 'accounts_officer';

        if (!userDoc.exists()) {
          await setDoc(userDocRef, {
            email: currentUser.email,
            displayName: currentUser.displayName,
            role: role,
            createdAt: Date.now()
          });
        } else {
          const storedRole = userDoc.data().role;
          role = storedRole === 'admin' || storedRole === 'accounts_officer' ? storedRole : 'accounts_officer';
        }
        setUserRole(role);
      } else {
        setUserRole(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Load expenses from local backend and keep category/cashIn in Firestore
  useEffect(() => {
    if (!user || !isAuthReady) {
      setExpenses([]);
      setCashIn([]);
      setCategories(DEFAULT_CATEGORIES);
      return;
    }

    const qCashIn = query(collection(db, 'cashIn'), orderBy('createdAt', 'desc'));
    const unsubCashIn = onSnapshot(qCashIn, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashIn));
      setCashIn(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'cashIn'));

    const qCategories = query(collection(db, 'categories'), orderBy('createdAt', 'asc'));
    const unsubCategories = onSnapshot(qCategories, (snapshot) => {
      const data = snapshot.docs.map(doc => (doc.data().name as string));
      if (data.length > 0) {
        setCategories(data);
      } else {
        setCategories(DEFAULT_CATEGORIES);
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'categories'));

    // Primary expense source is local backend (expenses.json)
    fetchExpenses();

    return () => {
      unsubCashIn();
      unsubCategories();
    };
  }, [user, isAuthReady]);

  const fetchExpenses = async () => {
    try {
      const response = await fetch('/api/expenses');
      if (!response.ok) {
        throw new Error(`Failed to load expenses: ${response.status} ${response.statusText}`);
      }
      const data = (await response.json()) as Expense[];
      if (!Array.isArray(data)) {
        console.warn('API /api/expenses returned non-array data', data);
        setExpenses([]);
        return;
      }
      // Cast each item to Expense and keep sorted.
      const normalized = data.map((item) => ({
        ...item,
        amount: Number(item.amount),
        createdAt: Number(item.createdAt)
      } as Expense));
      normalized.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
      setExpenses(normalized);
    } catch (error) {
      console.error('Failed to fetch expenses:', error);
      setExpenses([]);
    }
  };

  const addExpense = async (expense: Omit<Expense, 'id' | 'createdAt' | 'createdBy'>) => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...expense,
          createdBy: user.uid
        }),
      });

      if (response.ok) {
        await fetchExpenses();
        setActiveTab('history');
      } else {
        throw new Error('Failed to save expense via local API');
      }
    } catch (error) {
      console.error('Error saving expense:', error);

      try {
        const docRef = await addDoc(collection(db, 'expenses'), {
          ...expense,
          createdAt: Date.now(),
          createdBy: user.uid
        });

        if (docRef.id) {
          await fetchExpenses();
          setActiveTab('history');
        }
      } catch (fsError) {
        handleFirestoreError(fsError, OperationType.CREATE, 'expenses');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const addCash = async (entry: Omit<CashIn, 'id' | 'createdAt' | 'createdBy'>) => {
    if (!user) return;
    try {
      if (editingCashIn) {
        await setDoc(doc(db, 'cashIn', editingCashIn.id), {
          ...entry,
          createdAt: editingCashIn.createdAt,
          createdBy: editingCashIn.createdBy,
          updatedAt: Date.now()
        });
        setEditingCashIn(null);
      } else {
        await addDoc(collection(db, 'cashIn'), {
          ...entry,
          createdAt: Date.now(),
          createdBy: user.uid
        });
      }
      setActiveTab('dashboard');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'cashIn');
    }
  };

  const deleteCashIn = async (id: string) => {
    if (!user) return;
    if (confirm('Are you sure you want to delete this fund entry?')) {
      try {
        await deleteDoc(doc(db, 'cashIn', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `cashIn/${id}`);
      }
    }
  };

  const deleteExpense = async (id: string) => {
    if (!user) return;
    if (confirm('Are you sure you want to delete this entry?')) {
      try {
        await deleteDoc(doc(db, 'expenses', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `expenses/${id}`);
      }
    }
  };

  const addCategory = async (name: string) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'categories'), {
        name,
        createdAt: Date.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'categories');
    }
  };

  const deleteCategory = async (name: string) => {
    if (!user) return;
    try {
      const snap = await getDocs(collection(db, 'categories'));
      const target = snap.docs.find(d => d.data().name === name);
      if (target) {
        await deleteDoc(doc(db, 'categories', target.id));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'categories');
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-emerald-600 rounded-xl"></div>
          <p className="text-slate-400 text-sm font-medium">Initializing Hospital System...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoginError('');
      setIsLoggingIn(true);
      
      try {
        if (!email.trim() || !password.trim()) {
          setLoginError('Please enter both email and password');
          setIsLoggingIn(false);
          return;
        }
        await loginWithEmailPassword(email, password);
        setEmail('');
        setPassword('');
      } catch (error: any) {
        setLoginError(error.message || 'Login failed. Please try again.');
      } finally {
        setIsLoggingIn(false);
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <img src="https://www.cdpathhospital.com/assets/logo.png" alt="CD PATH & HOSPITAL logo" className="mx-auto h-16 mb-3" />
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">CD PATH & HOSPITAL</h1>
            <p className="text-slate-500 mt-2">Petty Cash Management System</p>
          </div>
          
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl">
            <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">Staff Login</h2>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  disabled={isLoggingIn}
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  disabled={isLoggingIn}
                />
              </div>

              {loginError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertCircle size={18} className="text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs font-medium text-red-700">{loginError}</p>
                </div>
              )}
              
              <button 
                type="submit"
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white py-3.5 rounded-2xl font-semibold transition-all active:scale-[0.98]"
              >
                <LogIn size={20} />
                {isLoggingIn ? 'Logging in...' : 'Login'}
              </button>
            </form>

            <p className="text-[10px] text-slate-400 text-center mt-6 uppercase tracking-widest font-bold">
              Authorized Personnel Only
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Calculations
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalCashIn = cashIn.reduce((sum, c) => sum + c.amount, 0);
  const remainingCash = totalCashIn - totalSpent;

  const today = new Date();
  const todayExpenses = expenses.filter(e => isSameDay(parseISO(e.date), today));
  const todayTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);

  const deptData = DEPARTMENTS.map(dept => ({
    name: dept,
    value: expenses.filter(e => e.department === dept).reduce((sum, e) => sum + e.amount, 0)
  })).filter(d => d.value > 0);

  const categoryData = categories.map(cat => ({
    name: cat,
    value: expenses.filter(e => e.category === cat).reduce((sum, e) => sum + e.amount, 0)
  })).filter(c => c.value > 0);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-200 z-50 hidden md:flex flex-col">
        <div className="p-6 border-bottom border-slate-100">
          <div className="flex items-center gap-3 mb-1">
            <img src="https://www.cdpathhospital.com/assets/logo.png" alt="CD PATH & HOSPITAL logo" className="w-8 h-8 rounded-lg object-cover" />
            <h1 className="font-bold text-lg tracking-tight">CD PATH & HOSPITAL</h1>
          </div>
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Petty Cash System</p>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <NavItem 
            icon={<TrendingUp size={20} />} 
            label="Daily Report" 
            active={activeTab === 'daily'} 
            onClick={() => setActiveTab('daily')} 
          />
          <NavItem 
            icon={<PlusCircle size={20} />} 
            label="New Expense" 
            active={activeTab === 'entry'} 
            onClick={() => setActiveTab('entry')} 
          />
          <NavItem 
            icon={<Wallet size={20} />} 
            label="Add Cash" 
            active={activeTab === 'add-cash'} 
            onClick={() => setActiveTab('add-cash')} 
          />
          <NavItem 
            icon={<History size={20} />} 
            label="Expense History" 
            active={activeTab === 'history'} 
            onClick={() => setActiveTab('history')} 
          />
          <div className="pt-4 pb-2 px-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Resources</p>
          </div>
            <NavItem 
              icon={<FileSpreadsheet size={20} />} 
              label="Google Sheets Guide" 
              active={activeTab === 'sheets'} 
              onClick={() => setActiveTab('sheets')} 
            />
            <NavItem 
              icon={<Filter size={20} />} 
              label="Manage Categories" 
              active={activeTab === 'settings'} 
              onClick={() => setActiveTab('settings')} 
            />
          <div className="pt-4 pb-2 px-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Account Head</p>
          </div>
            <NavItem 
              icon={<TrendingUp size={20} />} 
              label="Procurement Advance" 
              active={activeTab === 'procurement'} 
              onClick={() => setActiveTab('procurement')} 
            />
            <NavItem 
              icon={<Wallet size={20} />} 
              label="Staff Loan Tracker" 
              active={activeTab === 'loans'} 
              onClick={() => setActiveTab('loans')} 
            />
            <NavItem 
              icon={<FileSpreadsheet size={20} />} 
              label="Credit Purchase" 
              active={activeTab === 'credits'} 
              onClick={() => setActiveTab('credits')} 
            />
        </nav>

        <div className="p-6 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-4 px-2">
            <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} className="w-8 h-8 rounded-full border border-slate-200" alt="User" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{user.displayName}</p>
              <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold transition-all"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="md:ml-64 p-4 md:p-8">
        <header className="print:hidden flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {activeTab === 'dashboard' && 'Financial Overview'}
              {activeTab === 'daily' && 'Daily Petty Cash Dashboard'}
              {activeTab === 'entry' && 'Record Expense'}
              {activeTab === 'add-cash' && 'Add Petty Cash'}
              {activeTab === 'history' && 'Transaction History'}
              {activeTab === 'sheets' && 'Google Sheets Integration'}
              {activeTab === 'settings' && 'Category Management'}
              {activeTab === 'procurement' && 'Procurement Advance Tracking'}
              {activeTab === 'loans' && 'Staff Loan Tracker'}
              {activeTab === 'credits' && 'Credit Purchase Tracker'}
            </h2>
            <p className="text-slate-500 text-sm">
              {format(new Date(), 'EEEE, MMMM do, yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setActiveTab('entry')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 shadow-sm"
            >
              <PlusCircle size={18} />
              Quick Entry
            </button>
          </div>
        </header>

        <div className="space-y-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                  label="Total Cash In" 
                  value={`৳${totalCashIn.toLocaleString()}`} 
                  icon={<ArrowUpRight className="text-blue-600" />}
                  trend="Total Fund"
                />
                <StatCard 
                  label="Total Spent" 
                  value={`৳${totalSpent.toLocaleString()}`} 
                  icon={<ArrowDownRight className="text-red-600" />}
                  trend="All Time"
                />
                <StatCard 
                  label="Remaining Balance" 
                  value={`৳${remainingCash.toLocaleString()}`} 
                  icon={<Wallet className="text-emerald-600" />}
                  trend="Available Cash"
                  highlight={remainingCash < 1000}
                />
                <StatCard 
                  label="Today's Expense" 
                  value={`৳${todayTotal.toLocaleString()}`} 
                  icon={<TrendingUp className="text-purple-600" />}
                  trend={format(today, 'MMM dd')}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                    Spending by Department
                  </h3>
                  <div className="h-[300px] w-full">
                    {deptData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={deptData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {deptData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyState message="No data to display yet." />
                    )}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-800 mb-6">Category Breakdown</h3>
                  <div className="h-[300px] w-full flex items-center justify-center">
                    {categoryData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {categoryData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyState message="No data to display yet." />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {categoryData.map((cat, i) => (
                      <div key={cat.name} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-[10px] text-slate-500 truncate">{cat.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'daily' && (
            <DailyDashboard 
              expenses={expenses} 
              cashIn={cashIn}
              reportFilter={reportFilter}
              setReportFilter={setReportFilter}
            />
          )}

          {activeTab === 'entry' && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                <ExpenseForm 
                  onSubmit={addExpense} 
                  categories={categories} 
                  onAddCategory={addCategory}
                  isSyncing={isSyncing}
                />
              </div>
            </div>
          )}

          {activeTab === 'add-cash' && (
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Wallet size={20} className="text-blue-600" />
                  {editingCashIn ? 'Edit Fund Entry' : 'Add Petty Cash Fund'}
                </h3>
                <CashInForm 
                  onSubmit={addCash} 
                  initialData={editingCashIn || undefined} 
                  onCancel={editingCashIn ? () => setEditingCashIn(null) : undefined}
                />
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800">Fund History</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Source</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Amount</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cashIn.map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {format(parseISO(entry.date), 'MMM dd, yyyy')}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-900 font-medium">
                            {entry.source}
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-blue-600 text-right">
                            ৳{entry.amount.toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => setEditingCashIn(entry)}
                                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <PlusCircle size={16} className="rotate-45" />
                              </button>
                              <button 
                                onClick={() => deleteCashIn(entry.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4 print:hidden">
              <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search expenses..." 
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <Filter size={18} className="text-slate-400" />
                  <select 
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none"
                    value={historyFilter.type}
                    onChange={(e) => setHistoryFilter({ ...historyFilter, type: e.target.value as any })}
                  >
                    <option value="all">All Time</option>
                    <option value="daily">Daily</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                  
                  {historyFilter.type !== 'all' && (
                    <input 
                      type={historyFilter.type === 'daily' ? 'date' : historyFilter.type === 'monthly' ? 'month' : 'number'}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none"
                      value={historyFilter.type === 'yearly' ? historyFilter.date.split('-')[0] : historyFilter.date}
                      onChange={(e) => {
                        let newDate = e.target.value;
                        if (historyFilter.type === 'yearly') {
                          newDate = `${e.target.value}-01-01`;
                        } else if (historyFilter.type === 'monthly') {
                          newDate = `${e.target.value}-01`;
                        }
                        setHistoryFilter({ ...historyFilter, date: newDate });
                      }}
                      placeholder={historyFilter.type === 'yearly' ? 'Year (e.g. 2025)' : ''}
                    />
                  )}

                  <select 
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none"
                    value={filterDept}
                    onChange={(e) => setFilterDept(e.target.value as any)}
                  >
                    <option value="All">All Departments</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <button 
                  onClick={() => setShowHistoryPrintPreview(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-all print:hidden"
                >
                  <Printer size={18} />
                  Print Preview
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Department</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Amount</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredHistoryExpenses.map((expense) => (
                        <tr key={expense.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                            {format(parseISO(expense.date), 'MMM dd, yyyy')}
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase">
                              {expense.department}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {expense.category}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-900 max-w-xs truncate">
                            {expense.description}
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-900 text-right">
                            ৳{expense.amount.toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {expense.receiptUrl && (
                                <a 
                                  href={expense.receiptUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="View Receipt"
                                >
                                  <ExternalLink size={16} />
                                </a>
                              )}
                              <button 
                                onClick={() => deleteExpense(expense.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredHistoryExpenses.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                            No transactions found for this selection.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="hidden print:block mt-8 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                <div className="mb-8 text-center border-b border-slate-300 pb-6">
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Transaction History Report</h2>
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-slate-800">{historyPeriodLabel}</p>
                    <p className="text-sm text-slate-600">{filterDept === 'All' ? 'All Departments' : `Department: ${filterDept}`}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-sm text-slate-700">
                  <div className="border border-slate-300 rounded-xl p-4">
                    <p className="font-semibold mb-2">Filtered Records</p>
                    <p>{filteredHistoryExpenses.length}</p>
                  </div>
                  <div className="border border-slate-300 rounded-xl p-4">
                    <p className="font-semibold mb-2">Total Amount</p>
                    <p>৳{historyTotalAmount.toLocaleString()}</p>
                  </div>
                  <div className="border border-slate-300 rounded-xl p-4">
                    <p className="font-semibold mb-2">Printed On</p>
                    <p>{format(new Date(), 'MMMM dd, yyyy')}</p>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 mb-6 text-sm text-slate-700">
                  <h4 className="mb-3 text-sm font-semibold text-slate-900">Department-wise Summary</h4>
                  {filterDept === 'All' ? (
                    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-100 text-left text-xs uppercase tracking-widest text-slate-500">
                            <th className="border-b border-slate-200 px-4 py-3">Department</th>
                            <th className="border-b border-slate-200 px-4 py-3 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historyDepartmentTotals.map(item => (
                            <tr key={item.department} className="border-b border-slate-200 last:border-0 bg-white">
                              <td className="px-4 py-3 text-slate-800">{item.department}</td>
                              <td className="px-4 py-3 text-right font-semibold text-slate-900">৳{item.amount.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">{filterDept}</p>
                      <p className="mt-2 text-2xl font-bold text-slate-900">৳{selectedDepartmentTotal?.toLocaleString()}</p>
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse border border-slate-300">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-slate-300 px-4 py-3 text-xs font-bold uppercase">Date</th>
                        <th className="border border-slate-300 px-4 py-3 text-xs font-bold uppercase">Department</th>
                        <th className="border border-slate-300 px-4 py-3 text-xs font-bold uppercase">Category</th>
                        <th className="border border-slate-300 px-4 py-3 text-xs font-bold uppercase">Description</th>
                        <th className="border border-slate-300 px-4 py-3 text-xs font-bold uppercase text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistoryExpenses.map(expense => (
                        <tr key={expense.id} className="hover:bg-slate-50">
                          <td className="border border-slate-300 px-4 py-3 text-xs">{format(parseISO(expense.date), 'MMM dd, yyyy')}</td>
                          <td className="border border-slate-300 px-4 py-3 text-xs">{expense.department}</td>
                          <td className="border border-slate-300 px-4 py-3 text-xs">{expense.category}</td>
                          <td className="border border-slate-300 px-4 py-3 text-xs">{expense.description}</td>
                          <td className="border border-slate-300 px-4 py-3 text-xs text-right">৳{expense.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col md:flex-row gap-6">
                  <div className="flex-1 text-center">
                    <div className="w-full border-b border-slate-900 mb-2"></div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-600">Prepared By</p>
                  </div>
                  <div className="flex-1 text-center">
                    <div className="w-full border-b border-slate-900 mb-2"></div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-600">Verified By</p>
                  </div>
                  <div className="flex-1 text-center">
                    <div className="w-full border-b border-slate-900 mb-2"></div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-600">Approved By</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showHistoryPrintPreview && (
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/70 p-4 print:hidden print-modal">
              <div className="w-full max-w-6xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl print:rounded-none print:border-0 print:shadow-none print:p-0 print:w-screen">
                <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50 p-5 md:flex-row md:items-center md:justify-between print-modal-header print:hidden">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">Print Preview</p>
                    <h3 className="text-xl font-bold text-slate-900">Transaction History Report</h3>
                    <p className="text-sm text-slate-600">{historyPeriodLabel} • {filterDept === 'All' ? 'All Departments' : filterDept}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handlePrint}
                      className="print-print-btn inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 print:hidden"
                    >
                      <Printer size={16} />
                      Print Now
                    </button>
                    <button
                      onClick={() => setShowHistoryPrintPreview(false)}
                      className="print-close-btn inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 print:hidden"
                    >
                      Close Preview
                    </button>
                  </div>
                </div>
                <div className="space-y-6 p-6 print:p-0 print:m-0">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3 text-sm text-slate-700 print:gap-2">
                    <div className="rounded-2xl border border-slate-200 p-4 print:border print:border-slate-400 print:p-3 print:bg-slate-100">
                      <p className="font-semibold text-slate-900">Filtered Records</p>
                      <p className="mt-2 text-2xl font-bold text-slate-900">{filteredHistoryExpenses.length}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4 print:border print:border-slate-400 print:p-3 print:bg-slate-100">
                      <p className="font-semibold text-slate-900">Total Amount</p>
                      <p className="mt-2 text-2xl font-bold text-slate-900">৳{historyTotalAmount.toLocaleString()}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4 print:border print:border-slate-400 print:p-3">
                      <p className="font-semibold text-slate-900">Preview Date</p>
                      <p className="mt-2 text-base text-slate-600">{format(new Date(), 'MMMM dd, yyyy')}</p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 mb-6 text-sm text-slate-700 print:rounded-none print:border-0 print:bg-white print:p-0 print:mb-4">
                    <h4 className="mb-3 text-sm font-semibold text-slate-900">Department-wise Summary</h4>
                    {filterDept === 'All' ? (
                      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
                        <table className="w-full border-collapse text-sm">
                          <thead>
                            <tr className="bg-slate-100 text-left text-xs uppercase tracking-widest text-slate-500">
                              <th className="border-b border-slate-200 px-4 py-3">Department</th>
                              <th className="border-b border-slate-200 px-4 py-3 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historyDepartmentTotals.map(item => (
                              <tr key={item.department} className="border-b border-slate-200 last:border-0 bg-white">
                                <td className="px-4 py-3 text-slate-800">{item.department}</td>
                                <td className="px-4 py-3 text-right font-semibold text-slate-900">৳{item.amount.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-sm font-semibold text-slate-900">{filterDept}</p>
                        <p className="mt-2 text-2xl font-bold text-slate-900">৳{selectedDepartmentTotal?.toLocaleString()}</p>
                      </div>
                    )}
                  </div>

                  <div className="overflow-x-auto rounded-3xl border border-slate-200 print:rounded-none print:border-0">
                    <table className="w-full border-collapse text-sm print:w-full">
                      <thead>
                        <tr className="bg-slate-100 text-left text-xs uppercase tracking-widest text-slate-500 print:bg-slate-200">
                          <th className="border-b border-slate-200 px-4 py-3 print:border print:border-slate-400">Date</th>
                          <th className="border-b border-slate-200 px-4 py-3 print:border print:border-slate-400">Department</th>
                          <th className="border-b border-slate-200 px-4 py-3 print:border print:border-slate-400">Category</th>
                          <th className="border-b border-slate-200 px-4 py-3 print:border print:border-slate-400">Description</th>
                          <th className="border-b border-slate-200 px-4 py-3 text-right print:border print:border-slate-400">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHistoryExpenses.map(expense => (
                          <tr key={expense.id} className="border-b border-slate-200 last:border-0 bg-white hover:bg-slate-50 print:border print:border-slate-400">
                            <td className="px-4 py-3 text-slate-800 print:border print:border-slate-400">{format(parseISO(expense.date), 'MMM dd, yyyy')}</td>
                            <td className="px-4 py-3 text-slate-800 print:border print:border-slate-400">{expense.department}</td>
                            <td className="px-4 py-3 text-slate-800 print:border print:border-slate-400">{expense.category}</td>
                            <td className="px-4 py-3 text-slate-800 print:border print:border-slate-400">{expense.description}</td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900 print:border print:border-slate-400">৳{expense.amount.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3 print:gap-3 print:mt-6">
                    <div className="rounded-2xl border border-slate-200 p-4 text-center print:border print:border-slate-400 print:rounded-none">
                      <div className="h-12 border-b border-slate-200 print:border-slate-400"></div>
                      <p className="mt-3 text-[10px] uppercase tracking-widest text-slate-500">Prepared By</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4 text-center print:border print:border-slate-400 print:rounded-none">
                      <div className="h-12 border-b border-slate-200 print:border-slate-400"></div>
                      <p className="mt-3 text-[10px] uppercase tracking-widest text-slate-500">Verified By</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4 text-center print:border print:border-slate-400 print:rounded-none">
                      <div className="h-12 border-b border-slate-200 print:border-slate-400"></div>
                      <p className="mt-3 text-[10px] uppercase tracking-widest text-slate-500">Approved By</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sheets' && <SheetsGuide />}
          
          {activeTab === 'settings' && (
            <CategorySettings 
              categories={categories} 
              onAdd={addCategory}
              onDelete={deleteCategory}
            />
          )}

          {activeTab === 'procurement' && <ProcurementAdvancesPage />}

          {activeTab === 'loans' && <StaffLoanTrackerPage />}

          {activeTab === 'credits' && <CreditPurchaseTrackerPage />}
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
        active 
          ? "bg-emerald-600 text-white shadow-md shadow-emerald-200" 
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function StatCard({ label, value, icon, trend, highlight }: { label: string, value: string, icon: React.ReactNode, trend: string, highlight?: boolean }) {
  return (
    <div className={cn(
      "bg-white p-6 rounded-2xl border border-slate-200 shadow-sm",
      highlight && "border-red-200 bg-red-50"
    )}>
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-slate-50 rounded-xl">
          {icon}
        </div>
        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
          {trend}
        </span>
      </div>
      <p className="text-slate-500 text-xs font-medium mb-1">{label}</p>
      <h4 className="text-2xl font-bold text-slate-900">{value}</h4>
    </div>
  );
}

function ExpenseForm({ onSubmit, categories, onAddCategory, isSyncing }: { 
  onSubmit: (expense: Omit<Expense, 'id' | 'createdAt' | 'createdBy'>) => void, 
  categories: Category[],
  onAddCategory: (name: string) => Promise<void>,
  isSyncing?: boolean
}) {
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    department: DEPARTMENTS[0],
    category: categories[0] || '',
    amount: '',
    description: '',
    receiptUrl: ''
  });
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.description || !formData.category) return;
    
    onSubmit({
      ...formData,
      amount: parseFloat(formData.amount),
      department: formData.department as Department,
      category: formData.category as Category
    });
  };

  const handleAddNewCategory = async () => {
    if (!newCategoryName.trim()) return;
    setIsSavingCategory(true);
    try {
      await onAddCategory(newCategoryName.trim());
      setFormData({ ...formData, category: newCategoryName.trim() });
      setNewCategoryName('');
      setIsAddingNewCategory(false);
    } catch (error) {
      console.error("Error adding category:", error);
    } finally {
      setIsSavingCategory(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date</label>
          <input 
            type="date" 
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            value={formData.date}
            onChange={e => setFormData({...formData, date: e.target.value})}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Department</label>
          <select 
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            value={formData.department}
            onChange={e => setFormData({...formData, department: e.target.value as Department})}
          >
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Category</label>
            <button 
              type="button"
              onClick={() => setIsAddingNewCategory(!isAddingNewCategory)}
              className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              {isAddingNewCategory ? 'Cancel' : '+ Add New'}
            </button>
          </div>
          
          {isAddingNewCategory ? (
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="New category name..."
                className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                autoFocus
              />
              <button 
                type="button"
                onClick={handleAddNewCategory}
                disabled={isSavingCategory || !newCategoryName.trim()}
                className="bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-50"
              >
                {isSavingCategory ? '...' : 'Save'}
              </button>
            </div>
          ) : (
            <select 
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={formData.category}
              onChange={e => setFormData({...formData, category: e.target.value})}
            >
              <option value="" disabled>Select Category</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Amount (৳)</label>
          <input 
            type="number" 
            placeholder="0.00"
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            value={formData.amount}
            onChange={e => setFormData({...formData, amount: e.target.value})}
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description / Purpose</label>
        <textarea 
          placeholder="What was this expense for?"
          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 h-24"
          value={formData.description}
          onChange={e => setFormData({...formData, description: e.target.value})}
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Digital Voucher URL (Optional)</label>
        <input 
          type="url" 
          placeholder="https://..."
          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          value={formData.receiptUrl}
          onChange={e => setFormData({...formData, receiptUrl: e.target.value})}
        />
      </div>
      <button 
        type="submit"
        disabled={isSyncing}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <PlusCircle size={20} className={cn(isSyncing && "animate-spin")} />
        {isSyncing ? 'Saving Expense...' : 'Record Transaction'}
      </button>
    </form>
  );
}

function CashInForm({ onSubmit, initialData, onCancel }: { 
  onSubmit: (entry: Omit<CashIn, 'id' | 'createdAt' | 'createdBy'>) => void,
  initialData?: CashIn,
  onCancel?: () => void
}) {
  const [formData, setFormData] = useState({
    date: initialData?.date || format(new Date(), 'yyyy-MM-dd'),
    amount: initialData?.amount.toString() || '',
    source: initialData?.source || ''
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        date: initialData.date,
        amount: initialData.amount.toString(),
        source: initialData.source
      });
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.source) return;
    
    onSubmit({
      ...formData,
      amount: parseFloat(formData.amount)
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date</label>
          <input 
            type="date" 
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            value={formData.date}
            onChange={e => setFormData({...formData, date: e.target.value})}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Amount (৳)</label>
          <input 
            type="number" 
            placeholder="0.00"
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            value={formData.amount}
            onChange={e => setFormData({...formData, amount: e.target.value})}
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Source of Funds</label>
        <input 
          type="text" 
          placeholder="e.g., Main Accounts, Bank Withdrawal"
          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          value={formData.source}
          onChange={e => setFormData({...formData, source: e.target.value})}
        />
      </div>
      <div className="flex gap-4">
        <button 
          type="submit"
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
        >
          <Wallet size={20} />
          {initialData ? 'Update Fund' : 'Add to Fund'}
        </button>
        {onCancel && (
          <button 
            type="button"
            onClick={onCancel}
            className="px-6 py-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function DailyDashboard({ expenses, cashIn, reportFilter, setReportFilter }: { 
  expenses: Expense[], 
  cashIn: CashIn[],
  reportFilter: { type: 'daily' | 'monthly' | 'yearly', date: string },
  setReportFilter: (f: { type: 'daily' | 'monthly' | 'yearly', date: string }) => void
}) {
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);

  const filteredExpenses = expenses.filter(e => {
    const eDate = parseISO(e.date);
    const filterDate = parseISO(reportFilter.date);
    if (reportFilter.type === 'daily') return isSameDay(eDate, filterDate);
    if (reportFilter.type === 'monthly') return format(eDate, 'yyyy-MM') === format(filterDate, 'yyyy-MM');
    if (reportFilter.type === 'yearly') return format(eDate, 'yyyy') === format(filterDate, 'yyyy');
    return false;
  });

  const filteredCashIn = cashIn.filter(c => {
    const cDate = parseISO(c.date);
    const filterDate = parseISO(reportFilter.date);
    if (reportFilter.type === 'daily') return isSameDay(cDate, filterDate);
    if (reportFilter.type === 'monthly') return format(cDate, 'yyyy-MM') === format(filterDate, 'yyyy-MM');
    if (reportFilter.type === 'yearly') return format(cDate, 'yyyy') === format(filterDate, 'yyyy');
    return false;
  });

  const totalFund = cashIn.reduce((sum, c) => sum + c.amount, 0);
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  const remainingBalance = totalFund - totalExpense;
  const periodExpense = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const cashInBeforeDate = cashIn
    .filter(c => parseISO(c.date) < parseISO(reportFilter.date))
    .reduce((sum, c) => sum + c.amount, 0);

  const expensesBeforeDate = expenses
    .filter(e => parseISO(e.date) < parseISO(reportFilter.date))
    .reduce((sum, e) => sum + e.amount, 0);

  const cashInToday = filteredCashIn.reduce((sum, c) => sum + c.amount, 0);

  const openingBalance = reportFilter.type === 'daily' ? cashInBeforeDate - expensesBeforeDate : totalFund;
  const closingBalance = reportFilter.type === 'daily' ? openingBalance + cashInToday - periodExpense : remainingBalance;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:p-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <select 
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none"
            value={reportFilter.type}
            onChange={(e) => setReportFilter({ ...reportFilter, type: e.target.value as any })}
          >
            <option value="daily">Daily Report</option>
            <option value="monthly">Monthly Report</option>
            <option value="yearly">Yearly Report</option>
          </select>
          <input 
            type={reportFilter.type === 'daily' ? 'date' : reportFilter.type === 'monthly' ? 'month' : 'number'}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none"
            value={reportFilter.type === 'yearly' ? reportFilter.date.substring(0, 4) : reportFilter.date}
            onChange={(e) => {
              let val = e.target.value;
              if (reportFilter.type === 'yearly') val = `${val}-01-01`;
              if (reportFilter.type === 'monthly') val = `${val}-01`;
              setReportFilter({ ...reportFilter, date: val });
            }}
            placeholder={reportFilter.type === 'yearly' ? 'YYYY' : ''}
          />
        </div>
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-all"
        >
          <Printer size={18} />
          Print Report
        </button>
      </div>

      <div className="print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
            <p className="text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-wider">Total Fund (Overall)</p>
            <h4 className="text-xl font-bold text-slate-900">৳{totalFund.toLocaleString()}</h4>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
            <p className="text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-wider">Total Expense (Overall)</p>
            <h4 className="text-xl font-bold text-red-600">৳{totalExpense.toLocaleString()}</h4>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
            <p className="text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-wider">Remaining Balance</p>
            <h4 className="text-xl font-bold text-emerald-600">৳{(reportFilter.type === 'daily' ? closingBalance : remainingBalance).toLocaleString()}</h4>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center bg-emerald-50/30">
            <p className="text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-wider">
              {reportFilter.type === 'daily' ? "Today's" : reportFilter.type === 'monthly' ? "This Month's" : "This Year's"} Expense
            </p>
            <h4 className="text-xl font-bold text-blue-600">৳{periodExpense.toLocaleString()}</h4>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
            <h4 className="font-bold text-slate-800 mb-6 border-b pb-4 flex justify-between items-center">
              <span>Department-wise Breakdown</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest">Click for details</span>
            </h4>
            <div className="space-y-3">
              {DEPARTMENTS.map(dept => {
                const amount = filteredExpenses.filter(e => e.department === dept).reduce((sum, e) => sum + e.amount, 0);
                return (
                  <button 
                    key={dept} 
                    onClick={() => setSelectedDept(selectedDept === dept ? null : dept)}
                    className={cn(
                      "w-full flex justify-between items-center p-3 rounded-xl transition-all border",
                      selectedDept === dept ? "bg-emerald-50 border-emerald-200 shadow-sm" : "bg-slate-50 border-transparent hover:border-slate-200"
                    )}
                  >
                    <span className="text-sm font-medium text-slate-700">{dept}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-900">৳{amount.toLocaleString()}</span>
                      <ChevronRight size={16} className={cn("text-slate-400 transition-transform", selectedDept === dept && "rotate-90")} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
            <h4 className="font-bold text-slate-800 mb-6 border-b pb-4">
              {selectedDept ? `${selectedDept} Details` : "Expense Purpose Summary"}
            </h4>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {(selectedDept ? filteredExpenses.filter(e => e.department === selectedDept) : filteredExpenses).length > 0 ? (
                (selectedDept ? filteredExpenses.filter(e => e.department === selectedDept) : filteredExpenses).map(e => (
                  <div key={e.id} className="flex justify-between items-start py-3 border-b border-slate-50 last:border-0">
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-900">{e.description}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">
                        {format(parseISO(e.date), 'MMM dd')} • {e.department} • {e.category}
                      </p>
                    </div>
                    <p className="font-bold text-slate-900 ml-4">৳{e.amount.toLocaleString()}</p>
                  </div>
                ))
              ) : (
                <p className="text-center text-slate-400 italic text-sm py-8">No transactions found for this selection.</p>
              )}
            </div>
          </div>
        </div>

        <div className="print:hidden bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="font-bold text-slate-800 mb-6 border-b pb-4">Period Transactions (Screen Only)</h4>
          <div className="space-y-4">
            {filteredExpenses.length > 0 ? filteredExpenses.map(e => (
              <div key={e.id} className="flex justify-between items-start py-3 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-sm font-bold text-slate-900">{e.description}</p>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">{e.department} • {e.category}</p>
                </div>
                <p className="font-bold text-slate-900">৳{e.amount.toLocaleString()}</p>
              </div>
            )) : (
              <p className="text-center text-slate-400 italic text-sm py-4">No expenses recorded for this period.</p>
            )}
          </div>
        </div>
      </div>

      {/* Print Only Section - Daily Report Format */}
      {reportFilter.type === 'daily' && (
        <div className="block print:block mt-8 daily-report-print">
          {/* Company Header */}
          <div className="flex flex-col items-center mb-5">
            <div className="flex items-center justify-center gap-4">
              <img src="https://www.cdpathhospital.com/assets/logo.png" alt="CD Path Hospital logo" className="h-16 w-16 object-contain" />
              <div className="text-left">
                <h1 className="text-2xl font-bold text-slate-900 leading-tight">CD Path & Hospital (Pvt.) Ltd.</h1>
                <p className="text-sm uppercase tracking-widest text-slate-500 font-semibold">Petty Cash System</p>
              </div>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mt-4">Daily Petty Cash Report</h2>
            <p className="text-lg text-slate-600 mt-1">
              Date: {format(parseISO(reportFilter.date), 'MMMM dd, yyyy')}
            </p>
          </div>

          {/* Department-wise Expense Summary */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-slate-800 mb-4 border-b-2 border-slate-300 pb-2">Department-wise Expense Summary</h3>
            <table className="w-full border-collapse border border-slate-400">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-400 px-4 py-3 text-left font-bold text-slate-800">Department</th>
                  <th className="border border-slate-400 px-4 py-3 text-right font-bold text-slate-800">Amount</th>
                </tr>
              </thead>
              <tbody>
                {DEPARTMENTS.map(dept => {
                  const amount = filteredExpenses.filter(e => e.department === dept).reduce((sum, e) => sum + e.amount, 0);
                  return (
                    <tr key={dept} className="hover:bg-slate-50">
                      <td className="border border-slate-400 px-4 py-3 text-slate-700">{dept}</td>
                      <td className="border border-slate-400 px-4 py-3 text-right font-semibold text-slate-900">৳{amount.toLocaleString()}</td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-200 font-bold">
                  <td className="border border-slate-400 px-4 py-3 text-slate-900">TOTAL</td>
                  <td className="border border-slate-400 px-4 py-3 text-right text-slate-900">৳{periodExpense.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Cash Summary */}
          <div className="mb-12">
            <h3 className="text-lg font-bold text-slate-800 mb-4 border-b-2 border-slate-300 pb-2">Cash Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-red-50 border border-red-300 p-6 rounded-lg text-center">
                <p className="text-sm font-semibold text-red-600 mb-2">Total Expense</p>
                <p className="text-2xl font-bold text-red-600">৳{periodExpense.toLocaleString()}</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-300 p-6 rounded-lg text-center">
                <p className="text-sm font-semibold text-emerald-600 mb-2">Remaining Petty Cash Balance</p>
                <p className="text-2xl font-bold text-emerald-600">৳{closingBalance.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Signature Section */}
          <div className="mt-20 pt-10 border-t-2 border-slate-400">
            <div className="flex justify-between">
              <div className="text-center flex-1">
                <div className="w-full border-b border-slate-900 mb-2"></div>
                <p className="text-sm font-bold uppercase text-slate-700">Prepared By</p>
              </div>
              <div className="text-center flex-1 mx-8">
                <div className="w-full border-b border-slate-900 mb-2"></div>
                <p className="text-sm font-bold uppercase text-slate-700">Verified By</p>
              </div>
              <div className="text-center flex-1">
                <div className="w-full border-b border-slate-900 mb-2"></div>
                <p className="text-sm font-bold uppercase text-slate-700">Approved By</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Only Section - Monthly/Yearly Reports (existing) */}
      {reportFilter.type !== 'daily' && (
        <div className="hidden print:block mt-8">
          <h3 className="text-xl font-bold text-center mb-8 uppercase tracking-widest underline underline-offset-8">
            Petty Cash {reportFilter.type.toUpperCase()} Report
          </h3>
          <div className="grid grid-cols-2 gap-8 mb-12">
            <div className="space-y-2">
              <div className="flex justify-between border-b border-slate-200 py-1">
                <span className="text-xs font-bold">Report Type:</span>
                <span className="text-xs">{reportFilter.type.toUpperCase()}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 py-1">
                <span className="text-xs font-bold">Period:</span>
                <span className="text-xs">
                  {reportFilter.type === 'monthly' && format(parseISO(reportFilter.date), 'MMMM yyyy')}
                  {reportFilter.type === 'yearly' && format(parseISO(reportFilter.date), 'yyyy')}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between border-b border-slate-200 py-1">
                <span className="text-xs font-bold">Total Period Expense:</span>
                <span className="text-xs font-bold">৳{periodExpense.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 py-1">
                <span className="text-xs font-bold">Remaining Balance:</span>
                <span className="text-xs font-bold">৳{remainingBalance.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <table className="w-full text-left border-collapse border border-slate-300 mb-12">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-4 py-2 text-xs font-bold">Department</th>
                <th className="border border-slate-300 px-4 py-2 text-xs font-bold text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {DEPARTMENTS.map(dept => {
                const amount = filteredExpenses.filter(e => e.department === dept).reduce((sum, e) => sum + e.amount, 0);
                return (
                  <tr key={dept}>
                    <td className="border border-slate-300 px-4 py-2 text-xs">{dept}</td>
                    <td className="border border-slate-300 px-4 py-2 text-xs text-right font-bold">৳{amount.toLocaleString()}</td>
                  </tr>
                );
              })}
              <tr className="bg-slate-50 font-bold">
                <td className="border border-slate-300 px-4 py-2 text-xs">TOTAL PERIOD EXPENSE</td>
                <td className="border border-slate-300 px-4 py-2 text-xs text-right">৳{periodExpense.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-20 pt-10 border-t border-slate-200">
            <div className="flex justify-between">
              <div className="text-center">
                <div className="w-48 border-b border-slate-900 mb-2"></div>
                <p className="text-[10px] font-bold uppercase">Prepared By</p>
              </div>
              <div className="text-center">
                <div className="w-48 border-b border-slate-900 mb-2"></div>
              </div>
              <div className="text-center">
                <div className="w-48 border-b border-slate-900 mb-2"></div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function CategorySettings({ categories, onAdd, onDelete }: { 
  categories: Category[], 
  onAdd: (cat: string) => void, 
  onDelete: (cat: string) => void 
}) {
  const [newCat, setNewCat] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCat && !categories.includes(newCat)) {
      onAdd(newCat);
      setNewCat('');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Filter size={20} className="text-emerald-600" />
          Add New Category
        </h3>
        <form onSubmit={handleAdd} className="flex gap-4">
          <input 
            type="text" 
            placeholder="e.g., Ventilation Service Fee"
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            value={newCat}
            onChange={e => setNewCat(e.target.value)}
          />
          <button 
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all"
          >
            Add
          </button>
        </form>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-6">Existing Categories</h3>
        <div className="space-y-2">
          {categories.map(cat => (
            <div key={cat} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 group">
              <span className="text-sm text-slate-700">{cat}</span>
              <button 
                onClick={() => onDelete(cat)}
                className="text-red-500 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SheetsGuide() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-xl font-bold text-slate-900 mb-4">Google Sheets Structure</h3>
        <p className="text-slate-600 mb-6">If you prefer to maintain a backup or mirror in Google Sheets, follow this structure:</p>
        
        <div className="space-y-6">
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
            <h4 className="font-bold text-slate-800 mb-3">1. Main Data Sheet (Expenses)</h4>
            <p className="text-xs text-slate-500 mb-4">Columns required:</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {['Date', 'Department', 'Category', 'Amount', 'Description', 'Receipt URL'].map(col => (
                <div key={col} className="bg-white px-3 py-2 rounded border border-slate-200 text-xs font-bold text-center">{col}</div>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
            <h4 className="font-bold text-slate-800 mb-3">2. Automated Formulas</h4>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-slate-700 mb-1">Department Summary:</p>
                <code className="block bg-slate-900 text-emerald-400 p-3 rounded text-xs overflow-x-auto">
                  =SUMIF(B:B, "Pathology", D:D)
                </code>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-700 mb-1">Monthly Summary (Pivot Table):</p>
                <p className="text-xs text-slate-500">Insert {'>'} Pivot Table {'>'} Rows: Date (Grouped by Month), Columns: Department, Values: Amount (SUM).</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-slate-400">
      <AlertCircle size={40} className="mb-2 opacity-20" />
      <p className="text-sm italic">{message}</p>
    </div>
  );
}
