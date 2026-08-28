// Gerado manualmente a partir das migrations em supabase/migrations.
// Regerar com: npm run types (supabase gen types typescript --linked)

export type TransactionType = 'income' | 'expense';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          currency: string;
          locale: string;
          monthly_goal: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          currency?: string;
          locale?: string;
          monthly_goal?: number | null;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          kind: TransactionType;
          budget: number;
          is_archived: boolean;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: string;
          kind?: TransactionType;
          budget?: number;
          is_archived?: boolean;
          position?: number;
        };
        Update: Partial<Database['public']['Tables']['categories']['Insert']>;
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          category_id: string | null;
          type: TransactionType;
          description: string;
          amount: number;
          date: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id?: string | null;
          type: TransactionType;
          description: string;
          amount: number;
          date?: string;
          notes?: string | null;
        };
        Update: Partial<Database['public']['Tables']['transactions']['Insert']>;
      };
      budgets: {
        Row: {
          id: string;
          user_id: string;
          category_id: string;
          month: string;
          amount: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id: string;
          month: string;
          amount?: number;
        };
        Update: Partial<Database['public']['Tables']['budgets']['Insert']>;
      };
    };
    Views: {
      monthly_flow: {
        Row: {
          user_id: string;
          month: string;
          income: number;
          expense: number;
          balance: number;
        };
      };
      category_month_spending: {
        Row: {
          user_id: string;
          category_id: string;
          name: string;
          color: string;
          month: string;
          spent: number;
          budget: number;
          pct_used: number | null;
        };
      };
    };
    Enums: { transaction_type: TransactionType };
  };
}

export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type MonthlyFlow = Database['public']['Views']['monthly_flow']['Row'];
export type CategorySpending = Database['public']['Views']['category_month_spending']['Row'];

export type TransactionWithCategory = Transaction & {
  category: Pick<Category, 'id' | 'name' | 'color'> | null;
};
