// Gerado manualmente a partir das migrations em supabase/migrations.
// Regerar com: npm run types (supabase gen types typescript --linked)
//
// IMPORTANTE: o formato precisa seguir o contrato do postgrest-js
// (Tables/Views com `Relationships`, e a chave `Functions` no schema).
// Sem isso o client tipado resolve toda tabela como `never`.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type TransactionType = 'income' | 'expense';
export type AccountKind = 'checking' | 'savings' | 'cash' | 'investment';
export type SettlementKind = 'account' | 'card';
export type PaymentMethod = 'debit' | 'pix' | 'cash' | 'transfer' | 'boleto' | 'credit';
export type StatementCycle = {
  id: string;
  user_id: string;
  card_id: string;
  statement_month: string;
  period_start: string;
  closing_date: string;
  due_date: string;
  merged_into: string | null;
  is_adjusted: boolean;
};
export type StatementAdjustmentHistory = {
  id: string;
  user_id: string;
  card_id: string;
  operation: string;
  reason: string;
  before_state: Json;
  after_state: Json;
  created_at: string;
};
export type AccountBalanceHistoryKind =
  | 'account_created'
  | 'opening_balance_updated'
  | 'transaction_created'
  | 'transaction_updated'
  | 'transaction_deleted'
  | 'transaction_moved_out'
  | 'transaction_moved_in';

export interface Database {
  public: {
    Tables: {
      statement_cycles: { Row: StatementCycle; Insert: never; Update: never; Relationships: [] };
      statement_adjustments: { Row: StatementAdjustmentHistory; Insert: never; Update: never; Relationships: [] };
      card_billing_rules: {
        Row: { id: string; user_id: string; card_id: string; effective_month: string; closing_day: number; due_day: number; created_at: string };
        Insert: never; Update: never; Relationships: [];
      };
      assistant_usage: {
        Row: { user_id: string; usage_day: string; completed: number };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      assistant_conversations: {
        Row: { id: string; user_id: string; title: string; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; title: string };
        Update: { title?: string };
        Relationships: [];
      };
      assistant_messages: {
        Row: { id: number; conversation_id: string; user_id: string; request_id: string; role: 'user' | 'assistant'; content: Json; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      assistant_executions: {
        Row: { user_id: string; request_id: string; conversation_id: string; message: string; selected_month: string; usage_day: string; status: string; lease_id: string; expires_at: string; response: Json };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          currency: string;
          locale: string;
          monthly_goal: number | null;
          monthly_spending_cap: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          currency?: string;
          locale?: string;
          monthly_goal?: number | null;
          monthly_spending_cap?: number | null;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey';
            columns: ['id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
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
          rollover_enabled: boolean;
          rollover_since: string | null;
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
          rollover_enabled?: boolean;
          rollover_since?: string | null;
        };
        Update: Partial<Database['public']['Tables']['categories']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'categories_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
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
          settlement: SettlementKind;
          account_id: string | null;
          card_id: string | null;
          payment_method: PaymentMethod | null;
          is_card_payment: boolean;
          card_payment_for: string | null;
          card_payment_month: string | null;
          statement_id: string | null;
          statement_manual: boolean;
          recurring_id: string | null;
          recurring_month: string | null;
          installment_group: string | null;
          installment_no: number | null;
          installment_total: number | null;
          is_transfer: boolean;
          transfer_group: string | null;
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
          settlement?: SettlementKind;
          account_id?: string | null;
          card_id?: string | null;
          payment_method?: PaymentMethod | null;
          is_card_payment?: boolean;
          card_payment_for?: string | null;
          card_payment_month?: string | null;
          statement_id?: string | null;
          statement_manual?: boolean;
          recurring_id?: string | null;
          recurring_month?: string | null;
          installment_group?: string | null;
          installment_no?: number | null;
          installment_total?: number | null;
          is_transfer?: boolean;
          transfer_group?: string | null;
        };
        Update: Partial<Database['public']['Tables']['transactions']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'transactions_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transactions_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transactions_card_id_fkey';
            columns: ['card_id'];
            isOneToOne: false;
            referencedRelation: 'credit_cards';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transactions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'budgets_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'budgets_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          kind: AccountKind;
          institution: string | null;
          color: string;
          opening_balance: number;
          is_archived: boolean;
          position: number;
          created_at: string;
          updated_at: string;
          balance_changed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          kind?: AccountKind;
          institution?: string | null;
          color?: string;
          opening_balance?: number;
          is_archived?: boolean;
          position?: number;
          balance_changed_at?: string;
        };
        Update: Partial<Database['public']['Tables']['accounts']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'accounts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      account_balance_history: {
        Row: {
          sequence_no: number;
          user_id: string;
          account_id: string;
          change_kind: AccountBalanceHistoryKind;
          delta: number;
          balance: number;
          description: string;
          transaction_id: string | null;
          changed_at: string;
          recorded_at: string;
        };
        Insert: {
          sequence_no?: number;
          user_id: string;
          account_id: string;
          change_kind: AccountBalanceHistoryKind;
          delta: number;
          balance: number;
          description: string;
          transaction_id?: string | null;
          changed_at: string;
          recorded_at?: string;
        };
        Update: Partial<Database['public']['Tables']['account_balance_history']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'account_balance_history_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_balance_history_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      credit_cards: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          name: string;
          brand: string | null;
          color: string;
          credit_limit: number;
          closing_day: number;
          due_day: number;
          is_archived: boolean;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          account_id: string;
          name: string;
          brand?: string | null;
          color?: string;
          credit_limit?: number;
          closing_day: number;
          due_day: number;
          is_archived?: boolean;
          position?: number;
        };
        Update: Partial<Database['public']['Tables']['credit_cards']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'credit_cards_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'credit_cards_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      tags: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: string;
        };
        Update: Partial<Database['public']['Tables']['tags']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'tags_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      transaction_tags: {
        Row: {
          transaction_id: string;
          tag_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          transaction_id: string;
          tag_id: string;
          user_id: string;
        };
        Update: Partial<Database['public']['Tables']['transaction_tags']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'transaction_tags_tag_id_fkey';
            columns: ['tag_id'];
            isOneToOne: false;
            referencedRelation: 'tags';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transaction_tags_transaction_id_fkey';
            columns: ['transaction_id'];
            isOneToOne: false;
            referencedRelation: 'transactions';
            referencedColumns: ['id'];
          },
        ];
      };
      recurring_transactions: {
        Row: {
          id: string;
          user_id: string;
          description: string;
          amount: number;
          type: TransactionType;
          day_of_month: number;
          category_id: string | null;
          settlement: SettlementKind;
          account_id: string | null;
          card_id: string | null;
          payment_method: PaymentMethod | null;
          start_month: string;
          end_month: string | null;
          is_active: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          description: string;
          amount: number;
          type: TransactionType;
          day_of_month: number;
          category_id?: string | null;
          settlement?: SettlementKind;
          account_id?: string | null;
          card_id?: string | null;
          payment_method?: PaymentMethod | null;
          start_month?: string;
          end_month?: string | null;
          is_active?: boolean;
          notes?: string | null;
        };
        Update: Partial<Database['public']['Tables']['recurring_transactions']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'recurring_transactions_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recurring_transactions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      recurring_tags: {
        Row: {
          recurring_id: string;
          tag_id: string;
          user_id: string;
        };
        Insert: {
          recurring_id: string;
          tag_id: string;
          user_id: string;
        };
        Update: Partial<Database['public']['Tables']['recurring_tags']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'recurring_tags_recurring_id_fkey';
            columns: ['recurring_id'];
            isOneToOne: false;
            referencedRelation: 'recurring_transactions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recurring_tags_tag_id_fkey';
            columns: ['tag_id'];
            isOneToOne: false;
            referencedRelation: 'tags';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [];
      };
      account_balances: {
        Row: {
          user_id: string;
          account_id: string;
          name: string;
          kind: AccountKind;
          color: string;
          opening_balance: number;
          is_archived: boolean;
          balance: number;
        };
        Relationships: [];
      };
      card_statement_items: {
        Row: {
          statement_id: string;
          user_id: string;
          card_id: string;
          statement_month: string;
          transaction_id: string;
          description: string;
          amount: number;
          date: string;
          category_id: string | null;
        };
        Relationships: [];
      };
      account_month_totals: {
        Row: {
          user_id: string;
          account_id: string;
          name: string;
          color: string;
          month: string;
          expense: number;
          income: number;
          items: number;
        };
        Relationships: [];
      };
      card_month_totals: {
        Row: {
          user_id: string;
          card_id: string;
          name: string;
          color: string;
          month: string;
          expense: number;
          items: number;
        };
        Relationships: [];
      };
      net_worth_by_month: {
        Row: {
          user_id: string;
          month: string;
          delta: number;
          net_worth: number;
        };
        Relationships: [];
      };
      tag_month_totals: {
        Row: {
          user_id: string;
          tag_id: string;
          name: string;
          color: string;
          month: string;
          expense: number;
          income: number;
          items: number;
        };
        Relationships: [];
      };
      card_statements: {
        Row: {
          statement_id: string;
          period_start: string;
          is_adjusted: boolean;
          merged_into: string | null;
          merged_into_month: string | null;
          user_id: string;
          card_id: string;
          name: string;
          color: string;
          credit_limit: number;
          closing_day: number;
          due_day: number;
          is_archived: boolean;
          statement_month: string;
          total: number;
          paid: number;
          open_amount: number;
          due_date: string;
          closing_date: string;
        };
        Relationships: [];
      };
      category_month_spending: {
        Row: {
          user_id: string;
          category_id: string;
          name: string;
          color: string;
          kind: TransactionType;
          month: string;
          spent: number;
          budget: number;
          pct_used: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      statement_adjustment: { Args: { p_change: Json; p_fingerprint?: string | null }; Returns: Json };
      ensure_statement_month: { Args: { p_month: string }; Returns: undefined };
      update_card_with_rule: { Args: { p_card: string; p_input: Json; p_effective_month?: string | null; p_fingerprint?: string | null }; Returns: undefined };
      assistant_delete: {
        Args: { p_conversation_id: string };
        Returns: string;
      };
      assistant_reserve: {
        Args: { p_conversation_id: string; p_request_id: string; p_message: string; p_selected_month: string };
        Returns: Json;
      };
      assistant_finish: {
        Args: { p_request_id: string; p_lease_id: string; p_response: Json };
        Returns: boolean;
      };
      assistant_transaction_totals: {
        Args: { p_start: string; p_end: string; p_category_id: string | null; p_account_id: string | null; p_card_id: string | null; p_tag_id: string | null; p_search: string | null };
        Returns: Json;
      };
    };
    Enums: {
      transaction_type: TransactionType;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type MonthlyFlow = Database['public']['Views']['monthly_flow']['Row'];
export type CategorySpending = Database['public']['Views']['category_month_spending']['Row'];

export type Account = Database['public']['Tables']['accounts']['Row'];
export type AccountBalanceHistory =
  Database['public']['Tables']['account_balance_history']['Row'];
export type CreditCard = Database['public']['Tables']['credit_cards']['Row'];
export type AccountBalance = Database['public']['Views']['account_balances']['Row'];
export type CardStatement = Database['public']['Views']['card_statements']['Row'];
export type CardStatementItem = Database['public']['Views']['card_statement_items']['Row'];

export type Tag = Database['public']['Tables']['tags']['Row'];
export type Recurring = Database['public']['Tables']['recurring_transactions']['Row'];

export type RecurringWithRelations = Recurring & {
  category: Pick<Category, 'id' | 'name' | 'color'> | null;
  account: Pick<Account, 'id' | 'name' | 'color'> | null;
  card: Pick<CreditCard, 'id' | 'name' | 'color'> | null;
  tags: Pick<Tag, 'id' | 'name' | 'color'>[];
};
export type TagTotals = Database['public']['Views']['tag_month_totals']['Row'];
export type AccountMonthTotals = Database['public']['Views']['account_month_totals']['Row'];
export type CardMonthTotals = Database['public']['Views']['card_month_totals']['Row'];
export type NetWorthPoint = Database['public']['Views']['net_worth_by_month']['Row'];

export type TransactionWithCategory = Transaction & {
  category: Pick<Category, 'id' | 'name' | 'color'> | null;
  account: Pick<Account, 'id' | 'name' | 'color'> | null;
  card: Pick<CreditCard, 'id' | 'name' | 'color'> | null;
  /** Embed many-to-many através de transaction_tags. */
  tags: Pick<Tag, 'id' | 'name' | 'color'>[];
};
