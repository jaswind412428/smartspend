export type TransactionType = 'income' | 'expense' | 'saving';

export interface Category {
  id: string;
  name: string;
  icon: string;
  type: TransactionType;
  isCustom?: boolean;
  groupId?: string; // Reference to a BudgetGroup
}

export interface BudgetGroup {
  id: string;
  name: string;
}

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  date: string;
  note: string;
  isDoubleMode?: boolean;
  splitMode?: 'equal' | 'proportional';
  myRatio?: number;
}

export interface Budget {
  categoryId: string;
  amount: number;
}

export interface GroupBudget {
  groupId: string;
  amount: number;
}

export interface Saving {
  id: string;
  amount: number;
  date: string;
  note: string;
}

export interface AppData {
  transactions: Transaction[];
  categories: Category[];
  budgetGroups: BudgetGroup[];
  categoryBudgets: Record<string, Budget[]>;
  groupBudgets: Record<string, GroupBudget[]>;
  savings: Saving[];
  savingsGoals: Record<string, number>;
  monthlyBudgets: Record<string, number>;
  lastDoubleModeRatio?: number;
}
