export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      chat_rooms: {
        Row: {
          created_at: string
          deleted_for: string[]
          id: string
          participant_ids: string[]
          product_id: string | null
        }
        Insert: {
          created_at?: string
          deleted_for?: string[]
          id?: string
          participant_ids: string[]
          product_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_for?: string[]
          id?: string
          participant_ids?: string[]
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_rooms_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reporter_id: string
          reviewed_at: string | null
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      live_chat_messages: {
        Row: {
          created_at: string | null
          id: string
          is_host: boolean | null
          message: string
          msg_type: string | null
          session_id: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_host?: boolean | null
          message: string
          msg_type?: string | null
          session_id?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_host?: boolean | null
          message?: string
          msg_type?: string | null
          session_id?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_pinned_products: {
        Row: {
          display_price: number | null
          id: string
          pinned_at: string | null
          product_id: string | null
          session_id: string | null
          units_sold: number | null
          unpinned_at: string | null
        }
        Insert: {
          display_price?: number | null
          id?: string
          pinned_at?: string | null
          product_id?: string | null
          session_id?: string | null
          units_sold?: number | null
          unpinned_at?: string | null
        }
        Update: {
          display_price?: number | null
          id?: string
          pinned_at?: string | null
          product_id?: string | null
          session_id?: string | null
          units_sold?: number | null
          unpinned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_pinned_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_pinned_products_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_sessions: {
        Row: {
          agora_channel: string | null
          agora_token: string | null
          category: string | null
          created_at: string | null
          current_viewers: number | null
          description: string | null
          ended_at: string | null
          id: string
          max_viewers: number
          pass_price_egp: number
          pass_tier: string
          peak_viewers: number | null
          scheduled_at: string | null
          seller_id: string
          started_at: string | null
          status: string | null
          thumbnail_url: string | null
          title: string
          title_ar: string | null
          total_sales_egp: number | null
          wallet_charge_id: string | null
        }
        Insert: {
          agora_channel?: string | null
          agora_token?: string | null
          category?: string | null
          created_at?: string | null
          current_viewers?: number | null
          description?: string | null
          ended_at?: string | null
          id?: string
          max_viewers: number
          pass_price_egp: number
          pass_tier: string
          peak_viewers?: number | null
          scheduled_at?: string | null
          seller_id: string
          started_at?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title: string
          title_ar?: string | null
          total_sales_egp?: number | null
          wallet_charge_id?: string | null
        }
        Update: {
          agora_channel?: string | null
          agora_token?: string | null
          category?: string | null
          created_at?: string | null
          current_viewers?: number | null
          description?: string | null
          ended_at?: string | null
          id?: string
          max_viewers?: number
          pass_price_egp?: number
          pass_tier?: string
          peak_viewers?: number | null
          scheduled_at?: string | null
          seller_id?: string
          started_at?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title?: string
          title_ar?: string | null
          total_sales_egp?: number | null
          wallet_charge_id?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          room_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          room_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          room_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          payload: Json
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          payload?: Json
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          payload?: Json
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          order_id: string
          payload: Json | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          order_id: string
          payload?: Json | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          order_id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount: number | null
          buyer_id: string
          created_at: string | null
          delivered_at: string | null
          handover_method: string | null
          handover_pin_encrypted: string | null
          handover_pin_hash: string | null
          id: string
          notes: string | null
          payment_id: string | null
          paymob_transaction_id: number | null
          product_id: string
          product_snapshot: Json | null
          seller_id: string
          shipped_at: string | null
          shipping_address: Json | null
          status: string
          tracking_number: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          buyer_id: string
          created_at?: string | null
          delivered_at?: string | null
          handover_method?: string | null
          handover_pin_encrypted?: string | null
          handover_pin_hash?: string | null
          id?: string
          notes?: string | null
          payment_id?: string | null
          paymob_transaction_id?: number | null
          product_id: string
          product_snapshot?: Json | null
          seller_id: string
          shipped_at?: string | null
          shipping_address?: Json | null
          status?: string
          tracking_number?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          buyer_id?: string
          created_at?: string | null
          delivered_at?: string | null
          handover_method?: string | null
          handover_pin_encrypted?: string | null
          handover_pin_hash?: string | null
          id?: string
          notes?: string | null
          payment_id?: string | null
          paymob_transaction_id?: number | null
          product_id?: string
          product_snapshot?: Json | null
          seller_id?: string
          shipped_at?: string | null
          shipping_address?: Json | null
          status?: string
          tracking_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          buyer_id: string
          completed_at: string | null
          created_at: string | null
          currency: string
          id: string
          metadata: Json | null
          payment_method_id: string | null
          product_id: string
          seller_id: string
          status: string
          stripe_customer_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          buyer_id: string
          completed_at?: string | null
          created_at?: string | null
          currency?: string
          id: string
          metadata?: Json | null
          payment_method_id?: string | null
          product_id: string
          seller_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          buyer_id?: string
          completed_at?: string | null
          created_at?: string | null
          currency?: string
          id?: string
          metadata?: Json | null
          payment_method_id?: string | null
          product_id?: string
          seller_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      paymob_payment_attempts: {
        Row: {
          amount_cents: number | null
          created_at: string
          currency: string | null
          error_message: string | null
          id: string
          merchant_order_id: string
          order_id: string | null
          outcome: string
          payload: Json | null
          paymob_transaction_id: number | null
          resolved_at: string | null
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string
          currency?: string | null
          error_message?: string | null
          id?: string
          merchant_order_id: string
          order_id?: string | null
          outcome: string
          payload?: Json | null
          paymob_transaction_id?: number | null
          resolved_at?: string | null
        }
        Update: {
          amount_cents?: number | null
          created_at?: string
          currency?: string | null
          error_message?: string | null
          id?: string
          merchant_order_id?: string
          order_id?: string | null
          outcome?: string
          payload?: Json | null
          paymob_transaction_id?: number | null
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paymob_payment_attempts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_methods: {
        Row: {
          account_holder_name: string
          account_identifier: string
          created_at: string | null
          id: string
          is_default: boolean | null
          is_verified: boolean | null
          type: string
          user_id: string | null
        }
        Insert: {
          account_holder_name: string
          account_identifier: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          is_verified?: boolean | null
          type: string
          user_id?: string | null
        }
        Update: {
          account_holder_name?: string
          account_identifier?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          is_verified?: boolean | null
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payout_requests: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          metadata: Json | null
          payout_method_id: string | null
          reference_id: string | null
          status: string
          updated_at: string | null
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          metadata?: Json | null
          payout_method_id?: string | null
          reference_id?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          metadata?: Json | null
          payout_method_id?: string | null
          reference_id?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_requests_payout_method_id_fkey"
            columns: ["payout_method_id"]
            isOneToOne: false
            referencedRelation: "payout_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_requests_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "user_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          condition: string | null
          created_at: string | null
          description: string
          id: string
          images: string[] | null
          is_promoted: boolean | null
          is_promoted_on_sale: boolean | null
          price: number
          promoted_ad_rate: number | null
          promoted_until: string | null
          promotion_tier: string | null
          seller_id: string | null
          status: string | null
          stock: number
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          category: string
          condition?: string | null
          created_at?: string | null
          description: string
          id?: string
          images?: string[] | null
          is_promoted?: boolean | null
          is_promoted_on_sale?: boolean | null
          price: number
          promoted_ad_rate?: number | null
          promoted_until?: string | null
          promotion_tier?: string | null
          seller_id?: string | null
          status?: string | null
          stock?: number
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          category?: string
          condition?: string | null
          created_at?: string | null
          description?: string
          id?: string
          images?: string[] | null
          is_promoted?: boolean | null
          is_promoted_on_sale?: boolean | null
          price?: number
          promoted_ad_rate?: number | null
          promoted_until?: string | null
          promotion_tier?: string | null
          seller_id?: string | null
          status?: string | null
          stock?: number
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          edited_at: string | null
          id: string
          order_id: string
          product_id: string | null
          rating: number
          reviewer_id: string
          seller_id: string
          seller_responded_at: string | null
          seller_response: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          edited_at?: string | null
          id?: string
          order_id: string
          product_id?: string | null
          rating: number
          reviewer_id: string
          seller_id: string
          seller_responded_at?: string | null
          seller_response?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          edited_at?: string | null
          id?: string
          order_id?: string
          product_id?: string | null
          rating?: number
          reviewer_id?: string
          seller_id?: string
          seller_responded_at?: string | null
          seller_response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_verification_requests: {
        Row: {
          created_at: string
          full_name: string
          id: string
          national_id_back_url: string
          national_id_front_url: string
          national_id_number: string
          requested_tier: number
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          national_id_back_url: string
          national_id_front_url: string
          national_id_number: string
          requested_tier: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          national_id_back_url?: string
          national_id_front_url?: string
          national_id_number?: string
          requested_tier?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_admin: boolean
          is_verified_seller: boolean | null
          national_id_back_url: string | null
          national_id_front_url: string | null
          national_id_number: string | null
          phone: string | null
          rating_avg: number | null
          rating_count: number
          tier: number | null
          tier_verified_at: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_admin?: boolean
          is_verified_seller?: boolean | null
          national_id_back_url?: string | null
          national_id_front_url?: string | null
          national_id_number?: string | null
          phone?: string | null
          rating_avg?: number | null
          rating_count?: number
          tier?: number | null
          tier_verified_at?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean
          is_verified_seller?: boolean | null
          national_id_back_url?: string | null
          national_id_front_url?: string | null
          national_id_number?: string | null
          phone?: string | null
          rating_avg?: number | null
          rating_count?: number
          tier?: number | null
          tier_verified_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_wallets: {
        Row: {
          available_balance: number | null
          currency: string | null
          express_payout_enabled: boolean | null
          id: string
          payout_schedule: string | null
          pending_balance: number | null
          updated_at: string | null
          use_spendable_funds: boolean | null
          user_id: string | null
        }
        Insert: {
          available_balance?: number | null
          currency?: string | null
          express_payout_enabled?: boolean | null
          id?: string
          payout_schedule?: string | null
          pending_balance?: number | null
          updated_at?: string | null
          use_spendable_funds?: boolean | null
          user_id?: string | null
        }
        Update: {
          available_balance?: number | null
          currency?: string | null
          express_payout_enabled?: boolean | null
          id?: string
          payout_schedule?: string | null
          pending_balance?: number | null
          updated_at?: string | null
          use_spendable_funds?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      wallet_topups: {
        Row: {
          amount: number
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          merchant_order_id: string
          paid_at: string | null
          paymob_order_id: string | null
          paymob_transaction_id: number | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          merchant_order_id: string
          paid_at?: string | null
          paymob_order_id?: string | null
          paymob_transaction_id?: number | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          merchant_order_id?: string
          paid_at?: string | null
          paymob_order_id?: string | null
          paymob_transaction_id?: number | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string | null
          delta_available: number | null
          delta_pending: number | null
          description: string | null
          fee_amount: number | null
          id: string
          order_fk: string | null
          order_id: string | null
          paymob_transaction_id: number | null
          payout_fk: string | null
          reference_id_text: string | null
          status: string | null
          topup_fk: string | null
          type: string
          wallet_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          delta_available?: number | null
          delta_pending?: number | null
          description?: string | null
          fee_amount?: number | null
          id?: string
          order_fk?: string | null
          order_id?: string | null
          paymob_transaction_id?: number | null
          payout_fk?: string | null
          reference_id_text?: string | null
          status?: string | null
          topup_fk?: string | null
          type: string
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          delta_available?: number | null
          delta_pending?: number | null
          description?: string | null
          fee_amount?: number | null
          id?: string
          order_fk?: string | null
          order_id?: string | null
          paymob_transaction_id?: number | null
          payout_fk?: string | null
          reference_id_text?: string | null
          status?: string | null
          topup_fk?: string | null
          type?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_order_fk_fkey"
            columns: ["order_fk"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_payout_fk_fkey"
            columns: ["payout_fk"]
            isOneToOne: false
            referencedRelation: "payout_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_topup_fk_fkey"
            columns: ["topup_fk"]
            isOneToOne: false
            referencedRelation: "wallet_topups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "user_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlists: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string | null
          is_verified_seller: boolean | null
          rating_avg: number | null
          rating_count: number | null
          tier: number | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
          is_verified_seller?: boolean | null
          rating_avg?: number | null
          rating_count?: number | null
          tier?: number | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
          is_verified_seller?: boolean | null
          rating_avg?: number | null
          rating_count?: number | null
          tier?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_resolve_dispute: {
        Args: {
          p_admin_id: string
          p_notes?: string
          p_order_id: string
          p_resolution: string
        }
        Returns: Json
      }
      admin_review_seller_verification: {
        Args: {
          p_admin_id: string
          p_decision: string
          p_notes?: string
          p_request_id: string
        }
        Returns: Json
      }
      block_user: { Args: { p_user_id: string }; Returns: undefined }
      book_live_session: {
        Args: {
          p_category: string
          p_description: string
          p_scheduled_at: string
          p_seller_id: string
          p_thumbnail_url: string
          p_tier: string
          p_title: string
          p_title_ar: string
        }
        Returns: Json
      }
      cancel_abandoned_orders: { Args: never; Returns: undefined }
      cancel_and_restore_order: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      checkout_with_wallet: {
        Args: { p_order_id: string; p_user_id: string }
        Returns: Json
      }
      cleanup_old_notifications: { Args: never; Returns: undefined }
      create_marketplace_order: {
        Args: {
          p_buyer_id: string
          p_handover_method: string
          p_handover_pin_encrypted: string
          p_handover_pin_hash: string
          p_live_session_id?: string
          p_product_id: string
          p_shipping_address: Json
        }
        Returns: string
      }
      create_notification: {
        Args: {
          p_link?: string
          p_payload?: Json
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      delete_my_account: { Args: never; Returns: undefined }
      edit_review: {
        Args: { p_comment?: string; p_rating: number; p_review_id: string }
        Returns: undefined
      }
      expire_promoted_products: { Args: never; Returns: undefined }
      hide_chat_room_for_user: {
        Args: { p_room_id: string }
        Returns: undefined
      }
      increment_product_view: {
        Args: { p_product_id: string }
        Returns: undefined
      }
      live_passes_are_free: { Args: never; Returns: boolean }
      mark_all_notifications_read: { Args: never; Returns: undefined }
      mark_notifications_read: { Args: { p_ids: string[] }; Returns: undefined }
      process_paymob_order_payment: {
        Args: {
          p_amount_cents: number
          p_currency: string
          p_merchant_order_id: string
          p_paymob_tx_id: number
        }
        Returns: Json
      }
      process_paymob_topup: {
        Args: {
          p_amount_cents: number
          p_currency: string
          p_merchant_order_id: string
          p_paymob_tx_id: number
        }
        Returns: Json
      }
      purchase_boost: {
        Args: { p_package_id: string; p_product_id: string; p_user_id: string }
        Returns: Json
      }
      release_escrow: {
        Args: { p_order_id: string; p_user_id: string }
        Returns: Json
      }
      report_content: {
        Args: { p_reason: string; p_target_id: string; p_target_type: string }
        Returns: string
      }
      request_wallet_payout: {
        Args: {
          p_amount: number
          p_payout_method_id: string
          p_user_id: string
        }
        Returns: Json
      }
      respond_to_review: {
        Args: { p_response: string; p_review_id: string }
        Returns: undefined
      }
      submit_review: {
        Args: { p_comment?: string; p_order_id: string; p_rating: number }
        Returns: string
      }
      unblock_user: { Args: { p_user_id: string }; Returns: undefined }
      update_my_profile: {
        Args: { p_avatar_url?: string; p_full_name?: string; p_phone?: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
