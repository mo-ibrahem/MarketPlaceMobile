export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string
          title: string
          description: string
          price: number
          category: string
          condition: string
          images: string[]
          seller_id: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description: string
          price: number
          category: string
          condition: string
          images: string[]
          seller_id: string
          status: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          price?: number
          category?: string
          condition?: string
          images?: string[]
          seller_id?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          product_id: string
          buyer_id: string
          seller_id: string
          amount: number
          currency: string
          status: string
          stripe_payment_intent_id: string
          created_at: string
          completed_at?: string
          metadata?: any
        }
        Insert: {
          id?: string
          product_id: string
          buyer_id: string
          seller_id: string
          amount: number
          currency: string
          status: string
          stripe_payment_intent_id: string
          created_at?: string
          completed_at?: string
          metadata?: any
        }
        Update: {
          id?: string
          product_id?: string
          buyer_id?: string
          seller_id?: string
          amount?: number
          currency?: string
          status?: string
          stripe_payment_intent_id?: string
          created_at?: string
          completed_at?: string
          metadata?: any
        }
      }
      orders: {
        Row: {
          id: string
          payment_id: string
          product_id: string
          buyer_id: string
          seller_id: string
          status: string
          shipping_address?: any
          tracking_number?: string
          notes?: string
          created_at: string
          shipped_at?: string
          delivered_at?: string
        }
        Insert: {
          id?: string
          payment_id: string
          product_id: string
          buyer_id: string
          seller_id: string
          status: string
          shipping_address?: any
          tracking_number?: string
          notes?: string
          created_at?: string
          shipped_at?: string
          delivered_at?: string
        }
        Update: {
          id?: string
          payment_id?: string
          product_id?: string
          buyer_id?: string
          seller_id?: string
          status?: string
          shipping_address?: any
          tracking_number?: string
          notes?: string
          created_at?: string
          shipped_at?: string
          delivered_at?: string
        }
      }
      user_wallets: {
        Row: {
          id: string
          user_id: string
          pending_balance: number
          available_balance: number
          currency: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          pending_balance?: number
          available_balance?: number
          currency?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          pending_balance?: number
          available_balance?: number
          currency?: string
          updated_at?: string
        }
      }
      wallet_transactions: {
        Row: {
          id: string
          wallet_id?: string
          order_id?: string
          type: string
          amount: number
          fee_amount: number
          status: string
          description?: string
          created_at: string
        }
        Insert: {
          id?: string
          wallet_id?: string
          order_id?: string
          type: string
          amount: number
          fee_amount?: number
          status?: string
          description?: string
          created_at?: string
        }
        Update: {
          id?: string
          wallet_id?: string
          order_id?: string
          type?: string
          amount?: number
          fee_amount?: number
          status?: string
          description?: string
          created_at?: string
        }
      }
      payout_methods: {
        Row: {
          id: string
          user_id: string
          type: string
          account_identifier: string
          account_holder_name: string
          is_default: boolean
          is_verified: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          account_identifier: string
          account_holder_name: string
          is_default?: boolean
          is_verified?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          account_identifier?: string
          account_holder_name?: string
          is_default?: boolean
          is_verified?: boolean
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
} 