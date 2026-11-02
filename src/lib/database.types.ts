export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          display_name: string | null
          role: 'admin' | 'cashier'
          approval_status: 'pending' | 'approved' | 'rejected'
          email_confirmed_at: string | null
          requested_at: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          display_name?: string | null
          role?: 'admin' | 'cashier'
          approval_status?: 'pending' | 'approved' | 'rejected'
          email_confirmed_at?: string | null
          requested_at?: string | null
          created_at?: string
        }
        Update: {
          email?: string
          display_name?: string | null
          role?: 'admin' | 'cashier'
          approval_status?: 'pending' | 'approved' | 'rejected'
          email_confirmed_at?: string | null
          requested_at?: string | null
        }
        Relationships: []
      }
      sales_summaries: {
        Row: {
          sunday_date: string
          ids_printed: number
          mtn_amount: number
          airtel_amount: number
          expenses: number
          cash_deposited: number
          recorded_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          sunday_date: string
          ids_printed?: number
          mtn_amount?: number
          airtel_amount?: number
          expenses?: number
          cash_deposited?: number
          recorded_by: string
        }
        Update: {
          ids_printed?: number
          mtn_amount?: number
          airtel_amount?: number
          expenses?: number
          cash_deposited?: number
        }
        Relationships: [
          {
            foreignKeyName: 'sales_summaries_recorded_by_fkey'
            columns: ['recorded_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      review_cashier_request: {
        Args: { target_user_id: string; decision: 'approved' | 'rejected' }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
