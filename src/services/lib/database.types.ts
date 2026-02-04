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