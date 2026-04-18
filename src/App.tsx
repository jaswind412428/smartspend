import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, 
  List, 
  PieChart as PieChartIcon, 
  Settings as SettingsIcon, 
  Plus, 
  Trash2, 
  Download,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  PlusCircle,
  TrendingUp,
  TrendingDown,
  Wallet,
  Target,
  Moon,
  Sun
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  isWithinInterval,
  parseISO,
  eachDayOfInterval,
  isSameDay,
  subMonths,
  addMonths,
  startOfDay,
  endOfDay,
  startOfYear,
  endOfYear
} from 'date-fns';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AppData, Transaction, Category, Budget, TransactionType, Saving, BudgetGroup, GroupBudget } from './types';

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLORS = ['#8DA399', '#C5A059', '#D6CFC7', '#A3AD91', '#B5A694', '#9E8E81', '#7D8C82', '#B8A08C'];

const DEFAULT_GROUPS: BudgetGroup[] = [
  { id: 'g1', name: '伙食費' },
  { id: 'g2', name: '娛樂費' },
  { id: 'g3', name: '日常用品' },
];

const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: '早餐', icon: '🍳', type: 'expense', groupId: 'g1' },
  { id: '2', name: '午餐', icon: '🍱', type: 'expense', groupId: 'g1' },
  { id: '3', name: '晚餐', icon: '🍲', type: 'expense', groupId: 'g1' },
  { id: '4', name: '飲料', icon: '🥤', type: 'expense', groupId: 'g1' },
  { id: '5', name: '點心', icon: '🍰', type: 'expense', groupId: 'g1' },
  { id: '6', name: '交通', icon: '🚌', type: 'expense', groupId: 'g3' },
  { id: '7', name: '醫療', icon: '🏥', type: 'expense', groupId: 'g3' },
  { id: '8', name: '娛樂', icon: '🎬', type: 'expense', groupId: 'g2' },
  { id: '9', name: '數位', icon: '📱', type: 'expense', groupId: 'g2' },
  { id: '10', name: '電信', icon: '📶', type: 'expense' },
  { id: '11', name: '保養品/化妝品', icon: '💄', type: 'expense', groupId: 'g2' },
  { id: '12', name: '日用品', icon: '🧻', type: 'expense', groupId: 'g3' },
  { id: '13', name: '牙套', icon: '🦷', type: 'expense' },
  { id: '14', name: '禮品', icon: '🎁', type: 'expense' },
  { id: '15', name: '衣服', icon: '👕', type: 'expense', groupId: 'g2' },
  { id: '16', name: '房租', icon: '🏠', type: 'expense' },
  { id: '17', name: '其他', icon: '📦', type: 'expense', groupId: 'g2' },
  { id: '101', name: '薪水', icon: '💰', type: 'income' },
  { id: '102', name: '獎金', icon: '🎁', type: 'income' },
  { id: '103', name: '投資', icon: '📈', type: 'income' },
  { id: '201', name: '儲蓄', icon: '🏦', type: 'saving' },
];

const INITIAL_DATA: AppData = {
  transactions: [],
  categories: DEFAULT_CATEGORIES,
  budgetGroups: DEFAULT_GROUPS,
  categoryBudgets: {},
  groupBudgets: {},
  savings: [],
  savingsGoals: {},
  monthlyBudgets: {},
  lastDoubleModeRatio: 50,
};

// --- Main App Component ---
export default function App() {
  const [data, setData] = useState<AppData>(() => {
    const saved = localStorage.getItem('smart_spend_data');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.savings) parsed.savings = [];
      if (!parsed.budgetGroups) parsed.budgetGroups = DEFAULT_GROUPS;
      if (!parsed.groupBudgets) parsed.groupBudgets = {};
      
      const currentMonth = format(new Date(), 'yyyy-MM');
      
      if (!parsed.monthlyBudgets) {
        parsed.monthlyBudgets = {};
        if (parsed.monthlyBudget !== undefined) {
          parsed.monthlyBudgets[currentMonth] = parsed.monthlyBudget;
          delete parsed.monthlyBudget;
        }
      }

      if (!parsed.savingsGoals) {
        parsed.savingsGoals = {};
        if (parsed.savingsGoal !== undefined) {
          parsed.savingsGoals[currentMonth] = parsed.savingsGoal;
          delete parsed.savingsGoal;
        }
      }

      if (!parsed.categoryBudgets) {
        parsed.categoryBudgets = {};
        if (parsed.budgets !== undefined) {
          parsed.categoryBudgets[currentMonth] = parsed.budgets;
          delete parsed.budgets;
        }
      }

      return parsed;
    }
    return INITIAL_DATA;
  });

  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'stats' | 'savings' | 'settings'>('dashboard');
  const [isAdding, setIsAdding] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [deletingSavingId, setDeletingSavingId] = useState<string | null>(null);
  const [isAddingSaving, setIsAddingSaving] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  useEffect(() => {
    localStorage.setItem('smart_spend_data', JSON.stringify(data));
  }, [data]);

  const addTransaction = (t: Omit<Transaction, 'id'>) => {
    const newTransaction = { ...t, id: crypto.randomUUID() };
    setData(prev => ({
      ...prev,
      transactions: [newTransaction, ...prev.transactions],
      lastDoubleModeRatio: t.isDoubleMode && t.splitMode === 'proportional' ? (t.myRatio ? t.myRatio * 100 : prev.lastDoubleModeRatio) : prev.lastDoubleModeRatio,
    }));
    setIsAdding(false);
  };

  const deleteTransaction = (id: string) => {
    setData(prev => ({
      ...prev,
      transactions: prev.transactions.filter(t => t.id !== id),
    }));
    setDeletingTransactionId(null);
  };

  const updateTransaction = (id: string, t: Omit<Transaction, 'id'>) => {
    setData(prev => ({
      ...prev,
      transactions: prev.transactions.map(item => item.id === id ? { ...t, id } : item),
      lastDoubleModeRatio: t.isDoubleMode && t.splitMode === 'proportional' ? (t.myRatio ? t.myRatio * 100 : prev.lastDoubleModeRatio) : prev.lastDoubleModeRatio,
    }));
    setEditingTransaction(null);
  };

  const addCategory = (category: Omit<Category, 'id'>) => {
    const newCategory = { ...category, id: crypto.randomUUID(), isCustom: true };
    setData(prev => ({
      ...prev,
      categories: [...prev.categories, newCategory],
    }));
  };

  const deleteCategory = (id: string) => {
    setData(prev => {
      const newCategoryBudgets = { ...prev.categoryBudgets };
      Object.keys(newCategoryBudgets).forEach(month => {
        newCategoryBudgets[month] = newCategoryBudgets[month].filter(b => b.categoryId !== id);
      });
      return {
        ...prev,
        categories: prev.categories.filter(c => c.id !== id),
        categoryBudgets: newCategoryBudgets,
      };
    });
    setDeletingCategoryId(null);
  };

  const updateCategory = (id: string, updates: Partial<Category>) => {
    setData(prev => ({
      ...prev,
      categories: prev.categories.map(c => c.id === id ? { ...c, ...updates } : c),
    }));
  };

  const addSaving = (s: Omit<Saving, 'id'>) => {
    const newSaving = { ...s, id: crypto.randomUUID() };
    setData(prev => ({
      ...prev,
      savings: [newSaving, ...prev.savings],
    }));
    setIsAddingSaving(false);
  };

  const deleteSaving = (id: string) => {
    setData(prev => ({
      ...prev,
      savings: prev.savings.filter(s => s.id !== id),
    }));
    setDeletingSavingId(null);
  };

  const updateBudget = (categoryId: string, amount: number) => {
    const monthKey = format(selectedMonth, 'yyyy-MM');
    setData(prev => {
      const currentBudgets = prev.categoryBudgets[monthKey] || [];
      const existing = currentBudgets.find(b => b.categoryId === categoryId);
      let newBudgets;
      if (existing) {
        newBudgets = currentBudgets.map(b => b.categoryId === categoryId ? { ...b, amount } : b);
      } else {
        newBudgets = [...currentBudgets, { categoryId, amount }];
      }
      return {
        ...prev,
        categoryBudgets: {
          ...prev.categoryBudgets,
          [monthKey]: newBudgets
        }
      };
    });
  };

  const updateGroupBudget = (groupId: string, amount: number) => {
    const monthKey = format(selectedMonth, 'yyyy-MM');
    setData(prev => {
      const currentBudgets = prev.groupBudgets[monthKey] || [];
      const exists = currentBudgets.find(b => b.groupId === groupId);
      let newBudgets;
      if (exists) {
        newBudgets = currentBudgets.map(b => b.groupId === groupId ? { ...b, amount } : b);
      } else {
        newBudgets = [...currentBudgets, { groupId, amount }];
      }
      return {
        ...prev,
        groupBudgets: {
          ...prev.groupBudgets,
          [monthKey]: newBudgets
        }
      };
    });
  };

  const addBudgetGroup = (name: string) => {
    setData(prev => ({
      ...prev,
      budgetGroups: [...prev.budgetGroups, { id: `g-${Date.now()}`, name }]
    }));
  };

  const updateBudgetGroup = (id: string, name: string) => {
    setData(prev => ({
      ...prev,
      budgetGroups: prev.budgetGroups.map(g => g.id === id ? { ...g, name } : g)
    }));
  };

  const deleteBudgetGroup = (id: string) => {
    setData(prev => ({
      ...prev,
      budgetGroups: prev.budgetGroups.filter(g => g.id !== id),
      categories: prev.categories.map(c => c.groupId === id ? { ...c, groupId: undefined } : c)
    }));
  };

  return (
    <div className={cn(
      "min-h-screen font-sans selection:bg-[#8DA399]/20 flex flex-col items-center transition-colors duration-500",
      theme === 'light' ? "bg-[#FDFCFB] text-[#2D3436]" : "bg-[#1A1A1A] text-gray-100"
    )}>
      {/* Mobile Container */}
      <div className={cn(
        "w-full max-w-md min-h-screen shadow-xl relative flex flex-col pb-24 overflow-hidden transition-colors duration-500",
        theme === 'light' ? "bg-white" : "bg-[#2D2D2D]"
      )}>
        
        {/* Header */}
        <header className={cn(
          "px-6 pt-8 pb-4 backdrop-blur-md z-30 transition-colors duration-500",
          theme === 'light' ? "bg-white/80" : "bg-[#2D2D2D]/80"
        )}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h1 className={cn(
                "text-2xl font-black tracking-tight transition-colors",
                theme === 'light' ? "text-[#2D3436]" : "text-white"
              )}>
                {activeTab === 'dashboard' && 'SmartSpend'}
                {activeTab === 'transactions' && '交易列表'}
                {activeTab === 'stats' && '數據分析'}
                {activeTab === 'savings' && '儲蓄進度'}
                {activeTab === 'settings' && '設定與管理'}
              </h1>
              <button 
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className={cn(
                  "p-2 rounded-xl transition-all active:scale-95",
                  theme === 'light' ? "bg-gray-100 text-gray-500" : "bg-gray-800 text-yellow-400"
                )}
              >
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
            </div>
            {activeTab !== 'transactions' && activeTab !== 'stats' && (
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-2xl border transition-colors",
                theme === 'light' ? "bg-gray-50 border-gray-100" : "bg-gray-800 border-gray-700"
              )}>
                <button onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))} className="p-1 hover:bg-white rounded-lg transition-colors">
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-bold min-w-[70px] text-center">{format(selectedMonth, 'yyyy/MM')}</span>
                <button onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))} className="p-1 hover:bg-white rounded-lg transition-colors">
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-6 overflow-y-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Dashboard 
                  data={data} 
                  selectedMonth={selectedMonth} 
                  theme={theme}
                  onUpdateMonthlyBudget={(budget) => {
                    const monthKey = format(selectedMonth, 'yyyy-MM');
                    setData(prev => ({
                      ...prev,
                      monthlyBudgets: {
                        ...prev.monthlyBudgets,
                        [monthKey]: budget
                      }
                    }));
                  }}
                  onEditTransaction={setEditingTransaction}
                />
              </motion.div>
            )}
            {activeTab === 'transactions' && (
              <motion.div key="transactions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <TransactionList data={data} theme={theme} onDelete={setDeletingTransactionId} onEdit={setEditingTransaction} />
              </motion.div>
            )}
            {activeTab === 'stats' && (
              <motion.div key="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Statistics data={data} theme={theme} />
              </motion.div>
            )}
            {activeTab === 'savings' && (
              <motion.div key="savings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <SavingsView data={data} selectedMonth={selectedMonth} theme={theme} onAddSaving={() => setIsAddingSaving(true)} onDeleteSaving={setDeletingSavingId} />
              </motion.div>
            )}
            {activeTab === 'settings' && (
              <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <SettingsView 
                  data={data} 
                  selectedMonth={selectedMonth}
                  theme={theme}
                  onAddCategory={addCategory} 
                  onDeleteCategory={(id) => setDeletingCategoryId(id)}
                  onUpdateBudget={updateBudget}
                  onUpdateGroupBudget={updateGroupBudget}
                  onUpdateCategory={updateCategory}
                  onAddGroup={addBudgetGroup}
                  onUpdateGroup={updateBudgetGroup}
                  onDeleteGroup={deleteBudgetGroup}
                  onUpdateSavingsGoal={(goal) => {
                    const monthKey = format(selectedMonth, 'yyyy-MM');
                    setData(prev => ({
                      ...prev,
                      savingsGoals: {
                        ...prev.savingsGoals,
                        [monthKey]: goal
                      }
                    }));
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Bottom Navigation */}
        <nav className={cn(
          "fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md backdrop-blur-lg border-t px-6 py-3 flex justify-around items-center z-40 transition-colors",
          theme === 'light' ? "bg-white/90 border-gray-100" : "bg-gray-900/90 border-gray-800"
        )}>
          <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={22} />} label="首頁" theme={theme} />
          <NavButton active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} icon={<List size={22} />} label="明細" theme={theme} />
          
          {/* FAB */}
          <div className="relative -top-8">
            <button 
              onClick={() => setIsAdding(true)}
              className="w-16 h-16 bg-[#8DA399] text-white rounded-full flex items-center justify-center shadow-[0_8px_20px_rgba(141,163,153,0.4)] hover:scale-110 active:scale-95 transition-all"
            >
              <Plus size={32} strokeWidth={3} />
            </button>
          </div>

          <NavButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} icon={<PieChartIcon size={22} />} label="統計" theme={theme} />
          <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<SettingsIcon size={22} />} label="設定" theme={theme} />
        </nav>

        {/* Add/Edit Transaction Modal */}
        <AnimatePresence>
          {(isAdding || editingTransaction) && (
            <AddTransactionModal 
              onClose={() => {
                setIsAdding(false);
                setEditingTransaction(null);
              }} 
              onAdd={editingTransaction ? (t) => updateTransaction(editingTransaction.id, t) : addTransaction} 
              categories={data.categories}
              lastRatio={data.lastDoubleModeRatio}
              initialData={editingTransaction || undefined}
              theme={theme}
            />
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {deletingTransactionId && (
            <ConfirmModal 
              title="刪除交易 🗑️"
              message="確定要刪除這筆交易記錄嗎？此動作無法復原。"
              onConfirm={() => deleteTransaction(deletingTransactionId)}
              onCancel={() => setDeletingTransactionId(null)}
              theme={theme}
            />
          )}
          {deletingCategoryId && (
            <ConfirmModal 
              title="刪除分類 🏷️"
              message="確定要刪除這個分類嗎？相關的預算設定也會被移除。"
              onConfirm={() => deleteCategory(deletingCategoryId)}
              onCancel={() => setDeletingCategoryId(null)}
              theme={theme}
            />
          )}
          {deletingSavingId && (
            <ConfirmModal 
              title="刪除儲蓄 🏦"
              message="確定要刪除這筆儲蓄記錄嗎？"
              onConfirm={() => deleteSaving(deletingSavingId)}
              onCancel={() => setDeletingSavingId(null)}
              theme={theme}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// --- Sub-components ---

function NavButton({ active, onClick, icon, label, theme }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, theme: 'light' | 'dark' }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-all duration-300",
        active ? "text-[#8DA399] scale-110" : "text-gray-400"
      )}
    >
      {icon}
      <span className="text-[10px] font-bold tracking-wider">{label}</span>
      {active && <motion.div layoutId="nav-dot" className="w-1 h-1 bg-[#8DA399] rounded-full mt-0.5" />}
    </button>
  );
}

// --- Dashboard ---
function Dashboard({ data, selectedMonth, onUpdateMonthlyBudget, onEditTransaction, theme }: { data: AppData, selectedMonth: Date, onUpdateMonthlyBudget: (budget: number) => void, onEditTransaction: (t: Transaction) => void, theme: 'light' | 'dark' }) {
  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  
  const monthKey = format(selectedMonth, 'yyyy-MM');
  const currentMonthlyBudget = data.monthlyBudgets[monthKey] || 0;
  const [tempBudget, setTempBudget] = useState(currentMonthlyBudget.toString());

  useEffect(() => {
    setTempBudget(currentMonthlyBudget.toString());
  }, [currentMonthlyBudget]);

  const monthTransactions = useMemo(() => {
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);
    return data.transactions.filter(t => isWithinInterval(parseISO(t.date), { start, end }));
  }, [data.transactions, selectedMonth]);

  const dailyTransactions = useMemo(() => {
    return data.transactions.filter(t => t.date.startsWith(filterDate));
  }, [data.transactions, filterDate]);

  const totalBudget = currentMonthlyBudget;
  const expense = monthTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalJointExpense = monthTransactions
    .filter(t => t.type === 'expense' && t.isDoubleMode)
    .reduce((s, t) => s + t.amount, 0);
  
  const isBudgetWarning = totalBudget > 0 && expense > totalBudget && expense <= totalBudget * 1.2;
  const isBudgetCritical = totalBudget > 0 && expense > totalBudget * 1.2;

  const budgetPercentage = totalBudget > 0 ? (expense / totalBudget) * 100 : 0;
  const remainingBudget = Math.max(totalBudget - expense, 0);
  const remainingPercentage = totalBudget > 0 ? (remainingBudget / totalBudget) * 100 : 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 pb-10"
    >
      {/* Summary Card */}
      <motion.div 
        className={cn(
          "p-6 rounded-[2.5rem] text-white shadow-lg relative overflow-hidden transition-colors duration-500",
          isBudgetCritical ? "bg-[#EF4444]" : isBudgetWarning ? "bg-[#C5A059]" : "bg-gradient-to-br from-[#8DA399] to-[#A3AD91]"
        )}
      >
        <div className="relative z-10 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div 
              className="cursor-pointer group"
              onClick={() => {
                setTempBudget(currentMonthlyBudget.toString());
                setIsEditingBudget(true);
              }}
            >
              <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest flex items-center gap-1">
                總預算 <PlusCircle size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
              <div className="flex items-center gap-1">
                <Wallet size={14} className="text-green-100" />
                <p className="text-lg font-bold">${totalBudget.toLocaleString()}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest">總支出</p>
              <div className="flex items-center gap-1">
                <TrendingDown size={14} className="text-red-200" />
                <p className="text-lg font-bold">${expense.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Integrated Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-tighter opacity-80">
              <span>預算執行度</span>
              <span>{budgetPercentage.toFixed(0)}% 已使用</span>
            </div>
            <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                className="h-full bg-white rounded-full transition-all duration-1000"
              />
            </div>
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                {isBudgetCritical && <p className="text-[9px] font-black text-red-100 animate-pulse">⚠️ 預算嚴重超支！</p>}
                {isBudgetWarning && <p className="text-[9px] font-black text-orange-100">💡 預算已超支，請留意</p>}
              </div>
              <span className="text-[9px] font-black opacity-80">剩餘: ${remainingBudget.toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
      </motion.div>

      {/* Budget Edit Modal Overlay */}
      <AnimatePresence>
        {isEditingBudget && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative transition-colors",
                theme === 'light' ? "bg-white" : "bg-gray-900"
              )}
            >
              <button onClick={() => setIsEditingBudget(false)} className="absolute top-6 right-6 p-2 text-gray-300 hover:text-gray-500">
                <X size={24} />
              </button>
              <h2 className={cn(
                "text-xl font-black mb-6 transition-colors",
                theme === 'light' ? "text-gray-700" : "text-white"
              )}>設定每月總預算 💰</h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">本月預算金額</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-gray-300">$</span>
                    <input 
                      autoFocus
                      type="number" 
                      value={tempBudget}
                      onChange={(e) => setTempBudget(e.target.value)}
                      className={cn(
                        "w-full border-none rounded-2xl text-2xl font-black p-4 pl-10 outline-none focus:ring-4 transition-all",
                        theme === 'light' ? "bg-gray-50 focus:ring-[#8DA399]/10 text-gray-700" : "bg-gray-800 focus:ring-[#8DA399]/20 text-white"
                      )}
                    />
                  </div>
                </div>
                <button 
                  onClick={() => {
                    onUpdateMonthlyBudget(Number(tempBudget));
                    setIsEditingBudget(false);
                  }}
                  className="w-full bg-[#8DA399] text-white p-4 rounded-2xl font-black shadow-lg shadow-[#8DA399]/30 active:scale-95 transition-transform"
                >
                  確認更新
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Joint Mode Summary */}
      <div className={cn(
        "p-5 rounded-[2rem] border flex justify-between items-center shadow-sm transition-colors",
        theme === 'light' ? "bg-[#C5A059]/5 border-[#C5A059]/10" : "bg-[#C5A059]/10 border-[#C5A059]/20"
      )}>
        <div>
          <p className={cn(
            "text-[10px] font-bold uppercase tracking-widest transition-colors",
            theme === 'light' ? "text-[#C5A059]/60" : "text-[#C5A059]/80"
          )}>本月雙人模式總計</p>
        </div>
        <p className="text-xl font-black text-[#C5A059]">${totalJointExpense.toLocaleString()}</p>
      </div>
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-black text-sm text-gray-500 uppercase tracking-widest">預算執行度</h3>
          <span className={cn(
            "text-[10px] font-bold px-2 py-1 rounded-full transition-colors",
            theme === 'light' ? "text-[#8DA399] bg-[#8DA399]/10" : "text-[#8DA399] bg-[#8DA399]/20"
          )}>
            {data.groupBudgets[monthKey]?.length || 0} 個大類預算
          </span>
        </div>
        
        {(data.groupBudgets[monthKey]?.length || 0) > 0 ? (
          <div className="grid grid-cols-1 gap-2">
            {/* Group Budgets */}
            {data.groupBudgets[monthKey]?.map(budget => {
              const group = data.budgetGroups.find(g => g.id === budget.groupId);
              const groupCategories = data.categories.filter(c => c.groupId === budget.groupId);
              const spent = monthTransactions
                .filter(t => groupCategories.some(c => c.id === t.categoryId))
                .reduce((s, t) => s + t.amount, 0);
              
              const spentPercent = Math.min((spent / budget.amount) * 100, 100);
              const remaining = Math.max(budget.amount - spent, 0);
              const remainingPercent = budget.amount > 0 ? (remaining / budget.amount) * 100 : 0;
              const isOverBudget = spent > budget.amount;

              return (
                <div key={budget.groupId} className={cn(
                  "p-3 rounded-2xl border shadow-sm transition-colors",
                  theme === 'light' ? "bg-white border-gray-100" : "bg-gray-800 border-gray-700"
                )}>
                  <div className="flex justify-between items-center mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-xs font-black transition-colors",
                        theme === 'light' ? "text-gray-700" : "text-white"
                      )}>{group?.name}</span>
                    </div>
                    <div className="text-right">
                      <span className={cn(
                        "text-[10px] font-bold transition-colors",
                        isOverBudget ? "text-red-400" : (theme === 'light' ? "text-gray-400" : "text-gray-500")
                      )}>
                        {isOverBudget ? `超支 $${(spent - budget.amount).toLocaleString()}` : `剩餘 $${remaining.toLocaleString()}`}
                      </span>
                    </div>
                  </div>
                  <div className={cn(
                    "w-full h-2 rounded-full overflow-hidden transition-colors",
                    theme === 'light' ? "bg-gray-50" : "bg-gray-900"
                  )}>
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${spentPercent}%` }}
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        isOverBudget ? "bg-red-400" : spentPercent > 90 ? "bg-[#C5A059]" : "bg-[#8DA399]"
                      )}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px] font-bold text-gray-300">預算: ${budget.amount.toLocaleString()}</span>
                    <span className={cn(
                      "text-[9px] font-bold",
                      isOverBudget ? "text-red-400" : "text-gray-400"
                    )}>{spentPercent.toFixed(0)}% 已使用</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={cn(
            "text-center py-6 rounded-[1.5rem] border border-dashed transition-colors",
            theme === 'light' ? "bg-gray-50 border-gray-200" : "bg-gray-800 border-gray-700"
          )}>
            <p className="text-[10px] text-gray-400">尚未設定大類預算 🌿</p>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-black text-sm text-gray-500 uppercase tracking-widest">當日活動 🕒</h3>
          <input 
            type="date" 
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className={cn(
              "text-[10px] font-bold px-2 py-1 rounded-full border-none outline-none transition-colors",
              theme === 'light' ? "text-[#8DA399] bg-[#8DA399]/10" : "text-[#8DA399] bg-[#8DA399]/20"
            )}
          />
        </div>
        <div className="space-y-3">
          {dailyTransactions.map(t => (
            <div key={t.id} onClick={() => onEditTransaction(t)} className="cursor-pointer active:scale-[0.98] transition-transform">
              <TransactionItem transaction={t} category={data.categories.find(c => c.id === t.categoryId)} budgetGroups={data.budgetGroups} theme={theme} />
            </div>
          ))}
          {dailyTransactions.length === 0 && (
            <p className="text-center text-xs text-gray-300 py-4">該日期尚無交易記錄 🍃</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// --- Savings Jar Component ---
function SavingsJar({ total, goal, theme }: { total: number, goal: number, theme: 'light' | 'dark' }) {
  const percentage = goal > 0 ? Math.min((total / goal) * 100, 100) : 0;
  const [leaves, setLeaves] = useState<{ id: number, left: number, top: number, rotate: number, delay: number }[]>([]);
  const [fallingLeaves, setFallingLeaves] = useState<{ id: number, left: number }[]>([]);
  const prevTotal = useRef(total);

  useEffect(() => {
    // Initial leaves density based on percentage
    const leafCount = Math.floor(percentage * 0.5); // Adjust density
    const newLeaves = Array.from({ length: leafCount }).map((_, i) => ({
      id: i,
      left: Math.random() * 80 + 10,
      top: Math.random() * (percentage * 0.8) + (100 - percentage),
      rotate: Math.random() * 360,
      delay: Math.random() * 2
    }));
    setLeaves(newLeaves);
  }, [percentage]);

  useEffect(() => {
    if (total > prevTotal.current) {
      // Trigger falling leaf animation
      const newFalling = { id: Date.now(), left: Math.random() * 60 + 20 };
      setFallingLeaves(prev => [...prev, newFalling]);
      setTimeout(() => {
        setFallingLeaves(prev => prev.filter(l => l.id !== newFalling.id));
      }, 3000);
    }
    prevTotal.current = total;
  }, [total]);

  return (
    <div className="relative w-56 h-72 mx-auto mt-8">
      {/* Jar Body */}
      <div className={cn(
        "absolute inset-0 border-[6px] rounded-b-[4rem] rounded-t-2xl overflow-hidden backdrop-blur-[4px] shadow-[inset_0_4px_20px_rgba(0,0,0,0.05),0_10px_30px_rgba(0,0,0,0.05)] z-10 transition-colors",
        theme === 'light' ? "border-gray-200/80 bg-white/40" : "border-gray-700/80 bg-gray-800/40"
      )}>
        {/* Jar Neck Decoration */}
        <div className={cn(
          "absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-6 border-x-[6px] border-b-[6px] rounded-b-2xl transition-colors",
          theme === 'light' ? "border-gray-200/80 bg-white/20" : "border-gray-700/80 bg-gray-800/20"
        )} />
        
        {/* Filling Level */}
        <motion.div 
          initial={{ height: 0 }}
          animate={{ height: `${percentage}%` }}
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#C5A059]/30 to-[#C5A059]/10 transition-all duration-1000 ease-out"
        />

        {/* Static Leaves in Jar */}
        {leaves.map(leaf => (
          <motion.span 
            key={leaf.id}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1, top: `${leaf.top}%` }}
            className="absolute text-2xl pointer-events-none drop-shadow-sm"
            style={{ left: `${leaf.left}%`, transform: `rotate(${leaf.rotate}deg)` }}
          >
            🍁
          </motion.span>
        ))}

        {/* Falling Leaves */}
        <AnimatePresence>
          {fallingLeaves.map(leaf => (
            <motion.span 
              key={leaf.id}
              initial={{ top: -40, opacity: 0, rotate: 0 }}
              animate={{ top: '90%', opacity: 1, rotate: 720 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.5, ease: "linear" }}
              className="absolute text-3xl pointer-events-none z-20 drop-shadow-md"
              style={{ left: `${leaf.left}%` }}
            >
              🍁
            </motion.span>
          ))}
        </AnimatePresence>

        {/* Empty State Hint */}
        {percentage === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300/50 p-8 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest">空空的儲蓄瓶</p>
            <p className="text-[8px] font-bold mt-1">存入第一筆錢來收集楓葉吧！</p>
          </div>
        )}
      </div>

      {/* Jar Reflection/Glass Effect */}
      <div className="absolute top-10 left-4 w-4 h-32 bg-white/20 rounded-full blur-md z-20 pointer-events-none" />

      {/* Goal Progress Text */}
      <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-full text-center">
        <div className={cn(
          "inline-block px-4 py-1.5 rounded-full shadow-sm border transition-colors",
          theme === 'light' ? "bg-white border-gray-50" : "bg-gray-800 border-gray-700"
        )}>
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">
            進度 <span className="text-[#C5A059]">{percentage.toFixed(1)}%</span>
          </p>
          <p className="text-[8px] font-bold text-gray-300 mt-0.5">目標: ${goal.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

// --- Savings View ---
function SavingsView({ data, selectedMonth, onAddSaving, onDeleteSaving, theme }: { data: AppData, selectedMonth: Date, onAddSaving: () => void, onDeleteSaving: (id: string) => void, theme: 'light' | 'dark' }) {
  const totalSavings = useMemo(() => data.savings.reduce((s, t) => s + t.amount, 0), [data.savings]);
  const monthKey = format(selectedMonth, 'yyyy-MM');
  const currentSavingsGoal = data.savingsGoals[monthKey] || 0;

  const savingCategory = data.categories.find(c => c.type === 'saving');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-12 pb-12"
    >
      <div className="pt-4">
        <h3 className={cn(
          "text-center text-xl transition-colors",
          theme === 'light' ? "text-gray-600" : "text-gray-400"
        )}>我的儲蓄瓶 🍁</h3>
        <SavingsJar total={totalSavings} goal={currentSavingsGoal} theme={theme} />
      </div>

      {/* Total Savings Card */}
      <div className="bg-[#8DA399] p-8 rounded-[2.5rem] text-white shadow-lg relative overflow-hidden text-center">
        <div className="relative z-10">
          <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest mb-2">累積存款總額</p>
          <p className="text-4xl font-black">${totalSavings.toLocaleString()}</p>
        </div>
        <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
      </div>

      <div className="flex justify-between items-center px-1">
        <h3 className="font-black text-sm text-gray-500 uppercase tracking-widest">存款記錄 🏦</h3>
        <button 
          onClick={onAddSaving}
          className={cn(
            "text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors",
            theme === 'light' ? "text-[#8DA399] bg-[#8DA399]/10" : "text-[#8DA399] bg-[#8DA399]/20"
          )}
        >
          <Plus size={12} /> 新增存款
        </button>
      </div>

      <div className="space-y-3">
        {data.savings.map(s => (
          <div key={s.id} className={cn(
            "p-4 rounded-3xl flex items-center justify-between shadow-sm border group relative transition-colors",
            theme === 'light' ? "bg-white border-gray-50" : "bg-gray-800 border-gray-700"
          )}>
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition-colors",
                theme === 'light' ? "bg-[#8DA399]/10 text-[#8DA399]" : "bg-[#8DA399]/20 text-[#8DA399]"
              )}>
                {savingCategory?.icon || '💰'}
              </div>
              <div>
                <p className={cn(
                  "text-sm font-black transition-colors",
                  theme === 'light' ? "text-[#2D3436]" : "text-white"
                )}>{s.note || '存款'}</p>
                <p className="text-[10px] font-bold text-gray-400">{format(parseISO(s.date), 'yyyy/MM/dd')}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-[#8DA399]">
                +${s.amount.toLocaleString()}
              </p>
            </div>
            <button 
              onClick={() => onDeleteSaving(s.id)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        {data.savings.length === 0 && (
          <div className={cn(
            "text-center py-10 rounded-[2rem] border border-dashed transition-colors",
            theme === 'light' ? "bg-gray-50 border-gray-200" : "bg-gray-800 border-gray-700"
          )}>
            <p className="text-xs text-gray-300">目前尚無存款記錄，開始存錢吧！ 🌱</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function AddSavingModal({ onClose, onAdd, theme }: { onClose: () => void, onAdd: (s: Omit<Saving, 'id'>) => void, theme: 'light' | 'dark' }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) return;
    onAdd({
      amount: Number(amount),
      note,
      date: new Date(date).toISOString(),
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className={cn(
          "w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative transition-colors",
          theme === 'light' ? "bg-white" : "bg-gray-900"
        )}
      >
        <button onClick={onClose} className="absolute top-6 right-6 p-2 text-gray-300 hover:text-gray-500">
          <X size={24} />
        </button>

        <h2 className={cn(
          "text-xl font-black mb-6 transition-colors",
          theme === 'light' ? "text-gray-700" : "text-white"
        )}>新增存款</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">金額</label>
            <input 
              autoFocus
              type="number" 
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={cn(
                "w-full border-none rounded-2xl text-2xl font-black p-4 outline-none focus:ring-4 transition-all",
                theme === 'light' ? "bg-gray-50 focus:ring-[#8DA399]/10 text-gray-700" : "bg-gray-800 focus:ring-[#8DA399]/20 text-white"
              )}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">日期</label>
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={cn(
                "w-full border-none rounded-2xl text-xs font-bold p-4 outline-none transition-colors",
                theme === 'light' ? "bg-gray-50 text-gray-700" : "bg-gray-800 text-white"
              )}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">備註</label>
            <input 
              type="text" 
              placeholder="存錢目的..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={cn(
                "w-full border-none rounded-2xl text-xs font-bold p-4 outline-none transition-colors",
                theme === 'light' ? "bg-gray-50 text-gray-700" : "bg-gray-800 text-white"
              )}
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-[#8DA399] text-white p-4 rounded-2xl font-black shadow-lg shadow-[#8DA399]/30 active:scale-95 transition-transform"
          >
            確認存入
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

// --- Transaction List ---
function TransactionList({ data, onDelete, onEdit, theme }: { data: AppData, onDelete: (id: string) => void, onEdit: (t: Transaction) => void, theme: 'light' | 'dark' }) {
  const [period, setPeriod] = useState<'day' | 'month' | 'year'>('month');
  const [filterType, setFilterType] = useState<'all' | TransactionType>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedYear, setSelectedYear] = useState(format(new Date(), 'yyyy'));

  const filteredTransactions = useMemo(() => {
    let start, end;
    if (period === 'day') {
      start = startOfDay(parseISO(selectedDay));
      end = endOfDay(parseISO(selectedDay));
    } else if (period === 'month') {
      start = startOfMonth(parseISO(`${selectedMonth}-01`));
      end = endOfMonth(parseISO(`${selectedMonth}-01`));
    } else {
      start = startOfYear(parseISO(`${selectedYear}-01-01`));
      end = endOfYear(parseISO(`${selectedYear}-01-01`));
    }

    return data.transactions.filter(t => {
      const dateMatch = isWithinInterval(parseISO(t.date), { start, end });
      const typeMatch = filterType === 'all' || t.type === filterType;
      const categoryMatch = filterCategory === 'all' || t.categoryId === filterCategory;
      
      let groupMatch = true;
      if (filterGroup !== 'all') {
        const category = data.categories.find(c => c.id === t.categoryId);
        groupMatch = category?.groupId === filterGroup;
      }
      
      return dateMatch && typeMatch && categoryMatch && groupMatch;
    });
  }, [data.transactions, data.categories, period, filterType, filterCategory, filterGroup, selectedDay, selectedMonth, selectedYear]);

  const totalAmount = useMemo(() => {
    return filteredTransactions.reduce((sum, t) => {
      if (t.type === 'income') return sum + t.amount;
      if (t.type === 'expense') return sum - t.amount;
      return sum;
    }, 0);
  }, [filteredTransactions]);

  const expenseTotal = useMemo(() => {
    return filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTransactions]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Filters */}
      <div className={cn(
        "flex flex-col gap-3 p-4 rounded-3xl border shadow-sm transition-colors",
        theme === 'light' ? "bg-white border-gray-100" : "bg-gray-800 border-gray-700"
      )}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-gray-400">
            <Filter size={14} />
            <span className="text-[10px] font-bold uppercase tracking-widest">篩選</span>
          </div>
          <div className={cn(
            "p-0.5 rounded-lg transition-colors",
            theme === 'light' ? "bg-gray-100" : "bg-gray-900"
          )}>
            <button 
              onClick={() => setPeriod('day')}
              className={cn(
                "px-3 py-1 text-[10px] font-bold rounded-md transition-all", 
                period === 'day' 
                  ? (theme === 'light' ? "bg-white text-[#8DA399] shadow-sm" : "bg-gray-700 text-[#8DA399] shadow-sm") 
                  : "text-gray-400"
              )}
            >日</button>
            <button 
              onClick={() => setPeriod('month')}
              className={cn(
                "px-3 py-1 text-[10px] font-bold rounded-md transition-all", 
                period === 'month' 
                  ? (theme === 'light' ? "bg-white text-[#8DA399] shadow-sm" : "bg-gray-700 text-[#8DA399] shadow-sm") 
                  : "text-gray-400"
              )}
            >月</button>
            <button 
              onClick={() => setPeriod('year')}
              className={cn(
                "px-3 py-1 text-[10px] font-bold rounded-md transition-all", 
                period === 'year' 
                  ? (theme === 'light' ? "bg-white text-[#8DA399] shadow-sm" : "bg-gray-700 text-[#8DA399] shadow-sm") 
                  : "text-gray-400"
              )}
            >年</button>
          </div>
        </div>

        {period === 'day' && (
          <div className="relative">
            <input 
              type="date" 
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className={cn(
                "w-full border-none rounded-xl text-xs font-bold p-3 outline-none appearance-none transition-colors",
                theme === 'light' ? "bg-gray-50 text-gray-700" : "bg-gray-900 text-white"
              )}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-300 text-[10px] font-bold">
              {format(parseISO(selectedDay), 'yyyy/MM/dd')}
            </div>
          </div>
        )}
        {period === 'month' && (
          <div className="relative">
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-xl text-xs font-bold p-3 outline-none appearance-none opacity-0 absolute inset-0 z-10 cursor-pointer"
            />
            <div className={cn(
              "w-full border-none rounded-xl text-xs font-bold p-3 flex justify-between items-center transition-colors",
              theme === 'light' ? "bg-gray-50" : "bg-gray-900"
            )}>
              <span className={cn(
                "transition-colors",
                theme === 'light' ? "text-gray-600" : "text-gray-300"
              )}>{format(parseISO(`${selectedMonth}-01`), 'yyyy/MM')}</span>
              <ChevronRight size={14} className="text-gray-300 rotate-90" />
            </div>
          </div>
        )}
        {period === 'year' && (
          <div className="relative">
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className={cn(
                "w-full border-none rounded-xl text-xs font-bold p-3 outline-none appearance-none cursor-pointer transition-colors",
                theme === 'light' ? "bg-gray-50 text-gray-700" : "bg-gray-900 text-white"
              )}
            >
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                <option key={year} value={year.toString()}>{year}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-300">
              <ChevronRight size={14} className="rotate-90" />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value as any)}
            className={cn(
              "border-none rounded-xl text-xs font-bold p-2 outline-none transition-colors",
              theme === 'light' ? "bg-gray-50 text-gray-700" : "bg-gray-900 text-white"
            )}
          >
            <option value="all">所有類型</option>
            <option value="expense">支出</option>
            <option value="income">收入</option>
            <option value="saving">儲蓄</option>
          </select>
          <select 
            value={filterGroup} 
            onChange={(e) => setFilterGroup(e.target.value)}
            className={cn(
              "border-none rounded-xl text-xs font-bold p-2 outline-none transition-colors",
              theme === 'light' ? "bg-gray-50 text-gray-700" : "bg-gray-900 text-white"
            )}
          >
            <option value="all">所有大類</option>
            {data.budgetGroups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <select 
            value={filterCategory} 
            onChange={(e) => setFilterCategory(e.target.value)}
            className={cn(
              "border-none rounded-xl text-xs font-bold p-2 outline-none transition-colors col-span-2",
              theme === 'light' ? "bg-gray-50 text-gray-700" : "bg-gray-900 text-white"
            )}
          >
            <option value="all">所有小分類</option>
            {data.categories
              .filter(c => (filterType === 'all' || c.type === filterType) && (filterGroup === 'all' || c.groupId === filterGroup))
              .map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
          </select>
        </div>

        {/* Total Display */}
        <div className={cn(
          "p-3 rounded-2xl flex justify-between items-center transition-colors",
          theme === 'light' ? "bg-[#8DA399]/5" : "bg-[#8DA399]/10"
        )}>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">篩選總額</span>
          <div className="text-right">
            <p className={cn(
              "text-sm font-black",
              totalAmount >= 0 ? "text-[#8DA399]" : "text-[#C5A059]"
            )}>
              {totalAmount >= 0 ? '+' : ''}${totalAmount.toLocaleString()}
            </p>
            {expenseTotal > 0 && (
              <p className="text-[9px] font-bold text-gray-400">支出總計: ${expenseTotal.toLocaleString()}</p>
            )}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filteredTransactions.map(t => (
          <div key={t.id} className="group relative">
            <div onClick={() => onEdit(t)} className="cursor-pointer active:scale-[0.98] transition-transform">
              <TransactionItem 
                transaction={t} 
                category={data.categories.find(c => c.id === t.categoryId)} 
                budgetGroups={data.budgetGroups}
                className="pl-12"
                theme={theme}
              />
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onDelete(t.id);
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-gray-200 hover:text-red-400 transition-all duration-300 z-20"
              title="刪除交易"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {filteredTransactions.length === 0 && (
          <div className="text-center py-20">
            <p className="text-sm text-gray-300">找不到符合條件的交易 🔍</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// --- Statistics ---
function Statistics({ data, theme }: { data: AppData, theme: 'light' | 'dark' }) {
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  const { filteredTransactions, filteredSavings } = useMemo(() => {
    let start, end;
    if (period === 'month') {
      start = startOfMonth(parseISO(`${selectedMonth}-01`));
      end = endOfMonth(parseISO(`${selectedMonth}-01`));
    } else {
      start = startOfYear(parseISO(`${selectedYear}-01-01`));
      end = endOfYear(parseISO(`${selectedYear}-01-01`));
    }
    return {
      filteredTransactions: data.transactions.filter(t => isWithinInterval(parseISO(t.date), { start, end })),
      filteredSavings: data.savings.filter(s => isWithinInterval(parseISO(s.date), { start, end }))
    };
  }, [data.transactions, data.savings, period, selectedMonth, selectedYear]);

  const summary = useMemo(() => {
    const res = filteredTransactions.reduce((acc, t) => {
      acc[t.type] = (acc[t.type] || 0) + t.amount;
      return acc;
    }, { expense: 0, income: 0, saving: 0 } as Record<TransactionType, number>);
    
    // Add savings from the separate savings array
    res.saving += filteredSavings.reduce((s, t) => s + t.amount, 0);
    
    return res;
  }, [filteredTransactions, filteredSavings]);

  const getBreakdown = (type: TransactionType) => {
    const map: Record<string, number> = {};
    filteredTransactions.filter(t => t.type === type).forEach(t => {
      map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
    });
    return Object.entries(map).map(([id, value]) => ({
      name: data.categories.find(c => c.id === id)?.name || (type === 'saving' ? '儲蓄' : '其他'),
      value
    })).sort((a, b) => b.value - a.value);
  };

  const breakdown = useMemo(() => getBreakdown('expense'), [filteredTransactions, data.categories]);
  
  const savingsBreakdown = useMemo(() => {
    if (period === 'year') {
      const map: Record<string, number> = {};
      
      // From transactions
      filteredTransactions.filter(t => t.type === 'saving').forEach(t => {
        const month = format(parseISO(t.date), 'MM月');
        map[month] = (map[month] || 0) + t.amount;
      });
      
      // From separate savings array
      filteredSavings.forEach(s => {
        const month = format(parseISO(s.date), 'MM月');
        map[month] = (map[month] || 0) + s.amount;
      });

      return Object.entries(map).map(([month, value]) => ({
        name: month,
        value
      })).sort((a, b) => parseInt(a.name) - parseInt(b.name));
    }
    
    // For month view, we can still use category breakdown but include both sources
    const map: Record<string, number> = {};
    filteredTransactions.filter(t => t.type === 'saving').forEach(t => {
      const catName = data.categories.find(c => c.id === t.categoryId)?.name || '儲蓄';
      map[catName] = (map[catName] || 0) + t.amount;
    });
    
    const savingTotal = filteredSavings.reduce((s, t) => s + t.amount, 0);
    if (savingTotal > 0) {
      map['儲蓄紀錄'] = (map['儲蓄紀錄'] || 0) + savingTotal;
    }

    return Object.entries(map).map(([name, value]) => ({
      name,
      value
    })).sort((a, b) => b.value - a.value);
  }, [filteredTransactions, filteredSavings, period, data.categories]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="space-y-6 pb-10"
    >
      {/* Period Toggle & Selectors */}
      <div className={cn(
        "space-y-3 p-4 rounded-3xl border shadow-sm transition-colors",
        theme === 'light' ? "bg-white border-gray-100" : "bg-gray-800 border-gray-700"
      )}>
        <div className={cn(
          "flex p-1 rounded-2xl transition-colors",
          theme === 'light' ? "bg-gray-100" : "bg-gray-900"
        )}>
          <button 
            onClick={() => setPeriod('month')}
            className={cn(
              "flex-1 py-2 rounded-xl text-xs font-bold transition-all", 
              period === 'month' 
                ? (theme === 'light' ? "bg-white text-[#8DA399] shadow-sm" : "bg-gray-700 text-white shadow-sm") 
                : "text-gray-400"
            )}
          >本月</button>
          <button 
            onClick={() => setPeriod('year')}
            className={cn(
              "flex-1 py-2 rounded-xl text-xs font-bold transition-all", 
              period === 'year' 
                ? (theme === 'light' ? "bg-white text-[#8DA399] shadow-sm" : "bg-gray-700 text-white shadow-sm") 
                : "text-gray-400"
            )}
          >全年</button>
        </div>

        {period === 'month' && (
          <div className="relative">
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full bg-transparent border-none rounded-xl text-xs font-bold p-3 outline-none appearance-none opacity-0 absolute inset-0 z-10 cursor-pointer"
            />
            <div className={cn(
              "w-full border-none rounded-xl text-xs font-bold p-3 flex justify-between items-center transition-colors",
              theme === 'light' ? "bg-gray-50" : "bg-gray-900"
            )}>
              <span className={theme === 'light' ? "text-gray-600" : "text-gray-300"}>
                {format(parseISO(`${selectedMonth}-01`), 'yyyy/MM')}
              </span>
              <ChevronRight size={14} className="text-gray-300 rotate-90" />
            </div>
          </div>
        )}

        {period === 'year' && (
          <div className="relative">
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className={cn(
                "w-full border-none rounded-xl text-xs font-bold p-3 outline-none appearance-none cursor-pointer transition-colors",
                theme === 'light' ? "bg-gray-50 text-gray-600" : "bg-gray-900 text-gray-300"
              )}
            >
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                <option key={year} value={year.toString()}>{year}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-300">
              <ChevronRight size={14} className="rotate-90" />
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className={cn(
          "p-4 rounded-3xl border shadow-sm text-center transition-colors",
          theme === 'light' ? "bg-white border-gray-100" : "bg-gray-800 border-gray-700"
        )}>
          <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">總收入</p>
          <p className="text-sm font-black text-[#8DA399]">${summary.income.toLocaleString()}</p>
        </div>
        <div className={cn(
          "p-4 rounded-3xl border shadow-sm text-center transition-colors",
          theme === 'light' ? "bg-white border-gray-100" : "bg-gray-800 border-gray-700"
        )}>
          <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">總支出</p>
          <p className="text-sm font-black text-[#C5A059]">${summary.expense.toLocaleString()}</p>
        </div>
        <div className={cn(
          "p-4 rounded-3xl border shadow-sm text-center transition-colors",
          theme === 'light' ? "bg-white border-gray-100" : "bg-gray-800 border-gray-700"
        )}>
          <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">總儲蓄</p>
          <p className="text-sm font-black text-[#8DA399]">${summary.saving.toLocaleString()}</p>
        </div>
      </div>

      {/* Chart Section */}
      <div className={cn(
        "p-6 rounded-[2.5rem] border shadow-sm transition-colors",
        theme === 'light' ? "bg-white border-gray-100" : "bg-gray-800 border-gray-700"
      )}>
        <h4 className="text-sm font-black text-gray-500 mb-6 text-center uppercase tracking-widest">
          {period === 'month' ? '本月' : '全年'}支出佔比
        </h4>
        <div className="h-64 w-full">
          {breakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={breakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                >
                  {breakdown.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    backgroundColor: theme === 'light' ? '#fff' : '#1f2937',
                    color: theme === 'light' ? '#374151' : '#f3f4f6'
                  }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-300 text-sm">暫無支出數據</div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-y-2 mt-4">
          {breakdown.slice(0, 6).map((item, index) => (
            <div key={item.name} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
              <span className={cn(
                "text-[10px] font-bold truncate",
                theme === 'light' ? "text-gray-500" : "text-gray-400"
              )}>{item.name}</span>
              <span className="text-[10px] font-black text-gray-400">${item.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Savings Breakdown */}
      {summary.saving > 0 && (
        <div className={cn(
          "p-6 rounded-[2.5rem] border shadow-sm transition-colors",
          theme === 'light' ? "bg-white border-gray-100" : "bg-gray-800 border-gray-700"
        )}>
          <h4 className="text-sm font-black text-gray-500 mb-4 uppercase tracking-widest">儲蓄明細</h4>
          <div className="space-y-3">
            {savingsBreakdown.map(item => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#8DA399]" />
                  <span className={cn(
                    "text-xs font-bold",
                    theme === 'light' ? "text-gray-600" : "text-gray-300"
                  )}>{item.name}</span>
                </div>
                <span className="text-xs font-black text-gray-400">${item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// --- Settings ---
function SettingsView({ 
  data, 
  selectedMonth, 
  onAddCategory, 
  onDeleteCategory, 
  onUpdateBudget, 
  onUpdateGroupBudget,
  onUpdateCategory, 
  onUpdateSavingsGoal, 
  onAddGroup,
  onUpdateGroup,
  onDeleteGroup,
  theme 
}: { 
  data: AppData, 
  selectedMonth: Date, 
  onAddCategory: (c: Omit<Category, 'id'>) => void, 
  onDeleteCategory: (id: string) => void, 
  onUpdateBudget: (id: string, amount: number) => void, 
  onUpdateGroupBudget: (id: string, amount: number) => void,
  onUpdateCategory: (id: string, updates: Partial<Category>) => void, 
  onUpdateSavingsGoal: (goal: number) => void, 
  onAddGroup: (name: string) => void,
  onUpdateGroup: (id: string, name: string) => void,
  onDeleteGroup: (id: string) => void,
  theme: 'light' | 'dark' 
}) {
  const [isAddingCat, setIsAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('✨');
  const [newCatType, setNewCatType] = useState<TransactionType>('expense');

  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatEmoji, setEditCatEmoji] = useState('');
  const [editCatGroupId, setEditCatGroupId] = useState<string | undefined>(undefined);

  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');

  const monthKey = format(selectedMonth, 'yyyy-MM');
  const currentSavingsGoal = data.savingsGoals[monthKey] || 0;
  const currentCategoryBudgets = data.categoryBudgets[monthKey] || [];
  const currentGroupBudgets = data.groupBudgets[monthKey] || [];

  const exportCSV = () => {
    const headers = ['日期', '類型', '分類', '金額', '備註'];
    const rows = data.transactions.map(t => [
      format(parseISO(t.date), 'yyyy-MM-dd'),
      t.type === 'income' ? '收入' : '支出',
      data.categories.find(c => c.id === t.categoryId)?.name || '未知',
      t.amount,
      t.note
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `SmartSpend_Export_${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 pb-10"
    >
      {/* Category Management */}
      <div className={cn(
        "p-6 rounded-[2.5rem] border shadow-sm transition-colors space-y-4",
        theme === 'light' ? "bg-white border-gray-100" : "bg-gray-800 border-gray-700"
      )}>
        <div className="flex justify-between items-center">
          <h4 className="text-sm font-black text-gray-500 uppercase tracking-widest">分類管理</h4>
          <button 
            onClick={() => setIsAddingCat(true)} 
            className={cn(
              "p-1.5 rounded-full transition-colors",
              theme === 'light' ? "bg-[#8DA399]/10 text-[#8DA399]" : "bg-[#8DA399]/20 text-[#8DA399]"
            )}
          >
            <PlusCircle size={20} />
          </button>
        </div>
        
        <div className="grid grid-cols-4 gap-3">
          {data.categories.map(c => (
            <div key={c.id} className="flex flex-col items-center gap-1 group relative">
              <button 
                onClick={() => {
                  setEditingCatId(c.id);
                  setEditCatName(c.name);
                  setEditCatEmoji(c.icon);
                  setEditCatGroupId(c.groupId);
                }}
                className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm relative overflow-hidden transition-all active:scale-95",
                  theme === 'light' ? "bg-gray-50 hover:bg-gray-100" : "bg-gray-900 hover:bg-gray-700"
                )}
                title="點擊修改分類"
              >
                {c.icon}
              </button>
              <span className={cn(
                "text-[10px] font-bold truncate w-full text-center",
                theme === 'light' ? "text-gray-400" : "text-gray-500"
              )}>{c.name}</span>
              <button 
                onClick={() => onDeleteCategory(c.id)}
                className="absolute -top-1 -right-1 bg-[#C5A059] text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>

        {editingCatId && (
          <div className={cn(
            "p-4 rounded-3xl space-y-3 border transition-colors",
            theme === 'light' ? "bg-[#8DA399]/5 border-[#8DA399]/10" : "bg-[#8DA399]/10 border-[#8DA399]/20"
          )}>
            <p className="text-[10px] font-black text-[#8DA399] uppercase tracking-widest">修改分類</p>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="圖示" 
                value={editCatEmoji}
                onChange={(e) => setEditCatEmoji(e.target.value)}
                className={cn(
                  "w-12 border-none rounded-xl text-center text-lg font-bold p-3 outline-none transition-colors",
                  theme === 'light' ? "bg-white" : "bg-gray-900"
                )}
              />
              <input 
                type="text" 
                placeholder="分類名稱" 
                value={editCatName}
                onChange={(e) => setEditCatName(e.target.value)}
                className={cn(
                  "flex-1 border-none rounded-xl text-sm font-bold p-3 outline-none transition-colors",
                  theme === 'light' ? "bg-white text-[#2D3436]" : "bg-gray-900 text-white"
                )}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">歸屬預算大類</label>
              <select 
                value={editCatGroupId || ''} 
                onChange={(e) => setEditCatGroupId(e.target.value || undefined)}
                className={cn(
                  "w-full border-none rounded-xl text-xs font-bold p-3 outline-none transition-colors",
                  theme === 'light' ? "bg-white text-gray-700" : "bg-gray-900 text-white"
                )}
              >
                <option value="">未歸類</option>
                {data.budgetGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditingCatId(null)} className="flex-1 py-2 text-xs font-bold text-gray-400">取消</button>
              <button 
                onClick={() => {
                  if (editCatName) {
                    onUpdateCategory(editingCatId, { name: editCatName, icon: editCatEmoji, groupId: editCatGroupId });
                    setEditingCatId(null);
                  }
                }}
                className="flex-1 py-2 bg-[#8DA399] text-white rounded-xl text-xs font-bold"
              >儲存</button>
            </div>
          </div>
        )}

        {isAddingCat && (
          <div className={cn(
            "p-4 rounded-3xl space-y-3 transition-colors",
            theme === 'light' ? "bg-gray-50" : "bg-gray-900"
          )}>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="圖示" 
                value={newCatEmoji}
                onChange={(e) => setNewCatEmoji(e.target.value)}
                className={cn(
                  "w-12 border-none rounded-xl text-center text-lg font-bold p-3 outline-none transition-colors",
                  theme === 'light' ? "bg-white" : "bg-gray-800"
                )}
              />
              <input 
                type="text" 
                placeholder="分類名稱" 
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className={cn(
                  "flex-1 border-none rounded-xl text-sm font-bold p-3 outline-none transition-colors",
                  theme === 'light' ? "bg-white text-[#2D3436]" : "bg-gray-800 text-white"
                )}
              />
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setNewCatType('expense')}
                className={cn("flex-1 py-2 rounded-xl text-xs font-bold", newCatType === 'expense' ? "bg-[#C5A059] text-white" : "bg-white text-gray-400")}
              >支出</button>
              <button 
                onClick={() => setNewCatType('income')}
                className={cn("flex-1 py-2 rounded-xl text-xs font-bold", newCatType === 'income' ? "bg-[#8DA399] text-white" : "bg-white text-gray-400")}
              >收入</button>
              <button 
                onClick={() => setNewCatType('saving')}
                className={cn("flex-1 py-2 rounded-xl text-xs font-bold", newCatType === 'saving' ? "bg-[#8DA399] text-white" : "bg-white text-gray-400")}
              >儲蓄</button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setIsAddingCat(false)} className="flex-1 py-2 text-xs font-bold text-gray-400">取消</button>
              <button 
                onClick={() => {
                  if (newCatName) {
                    onAddCategory({ name: newCatName, type: newCatType, icon: newCatEmoji });
                    setNewCatName('');
                    setNewCatEmoji('✨');
                    setIsAddingCat(false);
                  }
                }}
                className="flex-1 py-2 bg-[#8DA399] text-white rounded-xl text-xs font-bold"
              >新增</button>
            </div>
          </div>
        )}
      </div>

      {/* Budget Group & Settings Management */}
      <div className={cn(
        "p-6 rounded-[2.5rem] border shadow-sm transition-colors space-y-4",
        theme === 'light' ? "bg-white border-gray-100" : "bg-gray-800 border-gray-700"
      )}>
        <div className="flex justify-between items-center">
          <h4 className="text-sm font-black text-gray-500 uppercase tracking-widest">預算大類與設定 ({format(selectedMonth, 'MM月')})</h4>
          <button 
            onClick={() => setIsAddingGroup(true)} 
            className={cn(
              "p-1.5 rounded-full transition-colors",
              theme === 'light' ? "bg-[#8DA399]/10 text-[#8DA399]" : "bg-[#8DA399]/20 text-[#8DA399]"
            )}
          >
            <PlusCircle size={20} />
          </button>
        </div>
        
        <div className="space-y-3">
          {data.budgetGroups.map(g => {
            const budget = currentGroupBudgets.find(b => b.groupId === g.id);
            return (
              <div key={g.id} className={cn(
                "p-4 rounded-3xl border flex flex-col gap-3 transition-colors",
                theme === 'light' ? "bg-gray-50 border-gray-100" : "bg-gray-900 border-gray-800"
              )}>
                <div className="flex items-center justify-between">
                  {editingGroupId === g.id ? (
                    <div className="flex-1 flex gap-2">
                      <input 
                        autoFocus
                        value={editGroupName}
                        onChange={(e) => setEditGroupName(e.target.value)}
                        className={cn(
                          "flex-1 bg-transparent border-none outline-none text-sm font-bold",
                          theme === 'light' ? "text-gray-700" : "text-white"
                        )}
                      />
                      <div className="flex gap-1">
                        <button onClick={() => {
                          if (editGroupName) {
                            onUpdateGroup(g.id, editGroupName);
                            setEditingGroupId(null);
                          }
                        }} className="text-[#8DA399] font-bold text-xs">儲存</button>
                        <button onClick={() => setEditingGroupId(null)} className="text-gray-400 font-bold text-xs">取消</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className={cn(
                        "text-sm font-bold",
                        theme === 'light' ? "text-gray-700" : "text-white"
                      )}>{g.name}</span>
                      <div className="flex gap-2">
                        <button onClick={() => {
                          setEditingGroupId(g.id);
                          setEditGroupName(g.name);
                        }} className="text-gray-400 hover:text-[#8DA399] transition-colors">
                          <PlusCircle size={16} className="rotate-45" />
                        </button>
                        <button onClick={() => onDeleteGroup(g.id)} className="text-gray-400 hover:text-[#C5A059] transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">預算:</label>
                  <input 
                    type="number" 
                    placeholder="設定金額"
                    value={budget?.amount || ''}
                    onChange={(e) => onUpdateGroupBudget(g.id, Number(e.target.value))}
                    className={cn(
                      "flex-1 border-none rounded-xl text-xs font-bold p-2 text-right outline-none transition-colors",
                      theme === 'light' ? "bg-white text-[#2D3436]" : "bg-gray-800 text-white"
                    )}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {isAddingGroup && (
          <div className={cn(
            "p-4 rounded-3xl space-y-3 border transition-colors",
            theme === 'light' ? "bg-gray-50 border-gray-100" : "bg-gray-900 border-gray-800"
          )}>
            <input 
              autoFocus
              placeholder="大類名稱..."
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className={cn(
                "w-full border-none rounded-xl text-sm font-bold p-3 outline-none transition-colors",
                theme === 'light' ? "bg-white text-gray-700" : "bg-gray-800 text-white"
              )}
            />
            <div className="flex gap-2">
              <button onClick={() => setIsAddingGroup(false)} className="flex-1 py-2 text-xs font-bold text-gray-400">取消</button>
              <button 
                onClick={() => {
                  if (newGroupName) {
                    onAddGroup(newGroupName);
                    setNewGroupName('');
                    setIsAddingGroup(false);
                  }
                }}
                className="flex-1 py-2 bg-[#8DA399] text-white rounded-xl text-xs font-bold"
              >新增</button>
            </div>
          </div>
        )}
      </div>

      {/* Export */}
      <button 
        onClick={exportCSV}
        className={cn(
          "w-full p-5 rounded-[2rem] flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all",
          theme === 'light' ? "bg-[#4A4238] text-white" : "bg-gray-700 text-white"
        )}
      >
        <Download size={20} />
        <span className="font-bold">匯出交易明細 (CSV)</span>
      </button>
    </motion.div>
  );
}

// --- Shared Components ---

function ConfirmModal({ title, message, onConfirm, onCancel, theme }: { title: string, message: string, onConfirm: () => void, onCancel: () => void, theme: 'light' | 'dark' }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className={cn(
          "w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl text-center transition-colors",
          theme === 'light' ? "bg-white" : "bg-gray-800"
        )}
      >
        <h3 className={cn(
          "text-xl font-black mb-4 transition-colors",
          theme === 'light' ? "text-gray-700" : "text-white"
        )}>{title}</h3>
        <p className="text-sm text-gray-400 font-bold mb-8 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button 
            onClick={onCancel}
            className={cn(
              "flex-1 py-4 rounded-2xl text-sm font-bold transition-colors",
              theme === 'light' ? "text-gray-400 bg-gray-50 hover:bg-gray-100" : "text-gray-300 bg-gray-700 hover:bg-gray-600"
            )}
          >
            取消
          </button>
          <button 
            onClick={onConfirm}
            className="flex-1 py-4 rounded-2xl text-sm font-bold text-white bg-[#C28E7D] shadow-lg shadow-[#C28E7D]/30 active:scale-95 transition-transform"
          >
            確定刪除
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function TransactionItem({ transaction, category, budgetGroups, className, theme }: { transaction: Transaction, category?: Category, budgetGroups: BudgetGroup[], className?: string, theme: 'light' | 'dark' }) {
  const isIncome = transaction.type === 'income';
  const isSaving = transaction.type === 'saving';
  
  const groupName = category?.groupId ? budgetGroups.find(g => g.id === category.groupId)?.name : null;
  
  const bgGradient = isIncome 
    ? (theme === 'light' ? "bg-gradient-to-br from-[#8DA399]/5 to-[#8DA399]/10" : "bg-gradient-to-br from-[#8DA399]/10 to-[#8DA399]/20")
    : isSaving 
      ? (theme === 'light' ? "bg-gradient-to-br from-[#8DA399]/10 to-[#8DA399]/20" : "bg-gradient-to-br from-[#8DA399]/20 to-[#8DA399]/30")
      : (theme === 'light' ? "bg-gradient-to-br from-[#C5A059]/5 to-[#C5A059]/10" : "bg-gradient-to-br from-[#C5A059]/10 to-[#C5A059]/20");

  return (
    <div className={cn(
      "p-4 rounded-3xl flex items-center justify-between shadow-sm border transition-all", 
      theme === 'light' ? "border-gray-50" : "border-gray-800",
      bgGradient, 
      className
    )}>
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner relative transition-colors",
          theme === 'light' ? "bg-white/80" : "bg-gray-800/80"
        )}>
          {category?.icon || (isSaving ? '🏦' : isIncome ? '💰' : '❓')}
          {transaction.isDoubleMode && (
            <div className={cn(
              "absolute -top-1 -right-1 w-4 h-4 bg-[#C5A059] rounded-full flex items-center justify-center border-2 transition-colors",
              theme === 'light' ? "border-white" : "border-gray-800"
            )}>
              <div className="w-1.5 h-1.5 bg-white rounded-full" />
            </div>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className={cn(
              "text-sm font-black transition-colors",
              theme === 'light' ? "text-[#2D3436]" : "text-white"
            )}>{category?.name || (isSaving ? '儲蓄' : isIncome ? '收入' : '未知')}</p>
            {groupName && (
              <span className={cn(
                "text-[8px] font-bold px-1.5 py-0.5 rounded-full transition-colors",
                theme === 'light' ? "bg-gray-100 text-gray-500" : "bg-gray-700 text-gray-400"
              )}>{groupName}</span>
            )}
            {transaction.isDoubleMode && (
              <span className="text-[8px] font-bold bg-[#C5A059]/10 text-[#C5A059] px-1.5 py-0.5 rounded-full">雙人模式</span>
            )}
          </div>
          <p className="text-[10px] font-bold text-gray-400">{format(parseISO(transaction.date), 'yyyy/MM/dd')}</p>
        </div>
      </div>
      <div className="text-right">
        <p className={cn("text-lg font-black", isIncome ? "text-[#8DA399]" : isSaving ? "text-[#8DA399]" : "text-[#C5A059]")}>
          {isIncome ? '+' : isSaving ? '🏦' : '-'}${transaction.amount.toLocaleString()}
        </p>
        {transaction.isDoubleMode && (
          <p className="text-[9px] font-bold text-gray-400">
            我的份: ${(transaction.amount * (transaction.myRatio || 0.5)).toLocaleString()}
          </p>
        )}
        {transaction.note && <p className="text-[10px] font-bold text-gray-400 truncate max-w-[100px]">{transaction.note}</p>}
      </div>
    </div>
  );
}

function AddTransactionModal({ onClose, onAdd, categories, lastRatio, initialData, theme }: { 
  onClose: () => void, 
  onAdd: (t: Omit<Transaction, 'id'>) => void, 
  categories: Category[],
  lastRatio?: number,
  initialData?: Transaction,
  theme: 'light' | 'dark'
}) {
  const [type, setType] = useState<TransactionType>(initialData?.type || 'expense');
  const [amount, setAmount] = useState(initialData?.amount.toString() || '');
  const [categoryId, setCategoryId] = useState(initialData?.categoryId || categories.find(c => c.type === (initialData?.type || 'expense'))?.id || '');
  const [note, setNote] = useState(initialData?.note || '');
  const [date, setDate] = useState(initialData ? format(parseISO(initialData.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
  const [isDoubleMode, setIsDoubleMode] = useState(initialData?.isDoubleMode || false);
  const [myRatio, setMyRatio] = useState(initialData?.myRatio ? initialData.myRatio * 100 : (lastRatio || 50)); // percentage

  const filteredCategories = categories.filter(c => c.type === type);

  // Falling particles logic
  const particles = useMemo(() => {
    return Array.from({ length: 8 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: Math.random() * 5,
      duration: 6 + Math.random() * 6,
      size: 12 + Math.random() * 12,
    }));
  }, []);

  const MapleLeafIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-orange-400/60">
      <path d="M12 2L10 6L6 5L8 9L4 10L8 12L5 16L10 15L12 22L14 15L19 16L16 12L20 10L16 9L18 5L14 6L12 2Z" />
    </svg>
  );

  const SnowflakeIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-blue-100/60">
      <g transform="translate(12 12)">
        {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
          <g transform={`rotate(${angle})`} key={angle}>
            <line x1="0" y1="1.5" x2="0" y2="-10" />
            <path d="M-2 -6L0 -8L2 -6" />
            <path d="M-1.5 -3L0 -4.5L1.5 -3" />
          </g>
        ))}
      </g>
    </svg>
  );

  const getNotePlaceholder = () => {
    const category = categories.find(c => c.id === categoryId);
    if (category?.name === '娛樂') return '例如：看電影、表演...';
    if (category?.name === '數位') return '例如：電子書、遊戲...';
    if (type === 'saving') return '存錢目的...';
    return '備註...';
  };

  useEffect(() => {
    setCategoryId(filteredCategories[0]?.id || '');
  }, [type]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) return;
    onAdd({
      amount: Number(amount),
      type,
      categoryId,
      note,
      date: new Date(date).toISOString(),
      isDoubleMode,
      splitMode: 'proportional',
      myRatio: isDoubleMode ? myRatio / 100 : undefined,
    });
  };

  const setEqualSplit = () => setMyRatio(50);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end justify-center p-0"
    >
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className={cn(
          "w-full max-w-md rounded-t-[3rem] p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar transition-colors duration-500",
          theme === 'light' ? "bg-white" : "bg-[#2D2D2D]"
        )}
      >
        <button onClick={onClose} className="absolute top-6 right-6 p-2 text-gray-300 hover:text-gray-500 z-20">
          <X size={24} />
        </button>

        {/* Falling Particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-t-[3rem]">
          {particles.map(p => (
            <motion.div
              key={p.id}
              initial={{ y: -50, x: 0, opacity: 0 }}
              animate={{ 
                y: ['0vh', '100vh'],
                x: [0, Math.random() * 50 - 25, 0],
                opacity: [0, 1, 1, 0],
                rotate: [0, 360]
              }}
              transition={{ 
                duration: p.duration, 
                repeat: Infinity, 
                delay: p.delay,
                ease: "linear"
              }}
              style={{ 
                left: p.left, 
                width: p.size,
                height: p.size,
                position: 'absolute',
                zIndex: 5
              }}
            >
              {theme === 'light' ? <MapleLeafIcon /> : <SnowflakeIcon />}
            </motion.div>
          ))}
        </div>

        <h2 className={cn(
          "text-xl font-black mb-6 z-10 relative transition-colors",
          theme === 'light' ? "text-gray-700" : "text-white"
        )}>{initialData ? '修改交易' : '新增交易'}</h2>

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          {/* Type Switcher */}
          <div className={cn(
            "flex p-1 rounded-2xl transition-colors",
            theme === 'light' ? "bg-gray-50" : "bg-gray-800"
          )}>
            <button 
              type="button"
              onClick={() => setType('expense')}
              className={cn(
                "flex-1 py-3 rounded-xl text-sm font-bold transition-all", 
                type === 'expense' 
                  ? (theme === 'light' ? "bg-white text-[#C5A059] shadow-sm" : "bg-gray-700 text-[#C5A059] shadow-sm") 
                  : "text-gray-400"
              )}
            >支出</button>
            <button 
              type="button"
              onClick={() => setType('income')}
              className={cn(
                "flex-1 py-3 rounded-xl text-sm font-bold transition-all", 
                type === 'income' 
                  ? (theme === 'light' ? "bg-white text-[#8DA399] shadow-sm" : "bg-gray-700 text-[#8DA399] shadow-sm") 
                  : "text-gray-400"
              )}
            >收入</button>
            <button 
              type="button"
              onClick={() => setType('saving')}
              className={cn(
                "flex-1 py-3 rounded-xl text-sm font-bold transition-all", 
                type === 'saving' 
                  ? (theme === 'light' ? "bg-white text-[#8DA399] shadow-sm" : "bg-gray-700 text-[#8DA399] shadow-sm") 
                  : "text-gray-400"
              )}
            >儲蓄</button>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">金額</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-gray-300">$</span>
              <input 
                autoFocus
                type="number" 
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={cn(
                  "w-full border-none rounded-3xl text-3xl font-black p-6 pl-10 outline-none focus:ring-4 transition-all",
                  theme === 'light' 
                    ? "bg-gray-50 focus:ring-[#8DA399]/10 text-gray-700" 
                    : "bg-gray-800 focus:ring-[#8DA399]/20 text-white"
                )}
              />
            </div>
          </div>

          {/* Double Mode Toggle */}
          {type === 'expense' && (
            <div className={cn(
              "p-4 rounded-3xl space-y-4 transition-colors",
              theme === 'light' ? "bg-[#C5A059]/5" : "bg-[#C5A059]/10"
            )}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-[#C5A059] transition-colors",
                    theme === 'light' ? "bg-white" : "bg-gray-800"
                  )}>
                    <PlusCircle size={18} />
                  </div>
                  <span className="text-xs font-black text-[#C5A059]">雙人模式</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsDoubleMode(!isDoubleMode)}
                  className={cn(
                    "w-12 h-6 rounded-full transition-all relative",
                    isDoubleMode ? "bg-[#C5A059]" : (theme === 'light' ? "bg-gray-200" : "bg-gray-700")
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                    isDoubleMode ? "left-7" : "left-1"
                  )} />
                </button>
              </div>

              {isDoubleMode && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className={cn(
                    "space-y-4 pt-2 border-t transition-colors",
                    theme === 'light' ? "border-[#C5A059]/10" : "border-[#C5A059]/20"
                  )}
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-[#C5A059] uppercase tracking-widest">分攤比例</span>
                        <span className="text-[9px] text-gray-400 font-bold">我的: {myRatio}% / 伴侶: {100 - myRatio}%</span>
                      </div>
                      <button 
                        type="button"
                        onClick={setEqualSplit}
                        className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold transition-all",
                          myRatio === 50 ? "bg-[#C5A059] text-white" : "bg-[#C5A059]/10 text-[#C5A059]"
                        )}
                      >
                        50% 平分
                      </button>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={myRatio}
                      onChange={(e) => setMyRatio(Number(e.target.value))}
                      className={cn(
                        "w-full accent-[#C5A059] h-1.5 rounded-lg appearance-none cursor-pointer transition-colors",
                        theme === 'light' ? "bg-gray-100" : "bg-gray-700"
                      )}
                    />
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Category Grid */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">分類</label>
            <div className={cn(
              "grid grid-cols-6 gap-1.5 max-h-40 overflow-y-auto p-2 no-scrollbar rounded-3xl border transition-colors",
              theme === 'light' ? "bg-gray-50/50 border-gray-100" : "bg-gray-800/50 border-gray-700"
            )}>
              {filteredCategories.map(c => (
                <button 
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 p-1.5 rounded-xl transition-all",
                    categoryId === c.id 
                      ? (theme === 'light' ? "bg-white text-[#8DA399] scale-105 shadow-sm ring-1 ring-[#8DA399]/10" : "bg-gray-700 text-[#8DA399] scale-105 shadow-sm ring-1 ring-[#8DA399]/20") 
                      : "text-gray-400 hover:bg-white/30"
                  )}
                >
                  <span className="text-base">{c.icon}</span>
                  <span className="text-[8px] font-bold truncate w-full text-center">{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date & Note */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">日期</label>
              <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={cn(
                  "w-full border-none rounded-2xl text-xs font-bold p-4 outline-none transition-colors",
                  theme === 'light' ? "bg-gray-50 text-gray-700" : "bg-gray-800 text-white"
                )}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">備註</label>
              <input 
                type="text" 
                placeholder={getNotePlaceholder()}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={cn(
                  "w-full border-none rounded-2xl text-xs font-bold p-4 outline-none transition-colors",
                  theme === 'light' ? "bg-gray-50 text-gray-700" : "bg-gray-800 text-white"
                )}
              />
            </div>
          </div>

          {/* Submit */}
          <button 
            type="submit"
            disabled={!amount}
            className="w-full bg-[#8DA399] text-white p-5 rounded-[2rem] font-black shadow-lg hover:bg-[#7A8E85] active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
          >
            {initialData ? '更新記帳 ✨' : '完成記帳 ✨'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
