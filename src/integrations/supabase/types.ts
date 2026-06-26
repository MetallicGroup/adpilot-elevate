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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ad_accounts: {
        Row: {
          access_token: string | null
          advertiser_id: string
          advertiser_name: string | null
          created_at: string
          id: string
          is_active: boolean
          token_expires_at: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          advertiser_id: string
          advertiser_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          token_expires_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          advertiser_id?: string
          advertiser_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          token_expires_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_insights: {
        Row: {
          action: string | null
          campaign_id: string | null
          generated_at: string
          id: string
          insight_text: string
          user_id: string
        }
        Insert: {
          action?: string | null
          campaign_id?: string | null
          generated_at?: string
          id?: string
          insight_text: string
          user_id: string
        }
        Update: {
          action?: string | null
          campaign_id?: string | null
          generated_at?: string
          id?: string
          insight_text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      broadcasts: {
        Row: {
          body: string
          channel: string
          created_at: string
          created_by: string | null
          details: Json | null
          id: string
          segment: string
          status: string
          total_failed: number
          total_recipients: number
          total_sent: number
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          created_by?: string | null
          details?: Json | null
          id?: string
          segment?: string
          status?: string
          total_failed?: number
          total_recipients?: number
          total_sent?: number
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          details?: Json | null
          id?: string
          segment?: string
          status?: string
          total_failed?: number
          total_recipients?: number
          total_sent?: number
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          ad_account_id: string | null
          budget: number
          budget_mode: string
          created_at: string
          creative: Json
          end_date: string | null
          id: string
          last_anomaly_check_at: string | null
          last_periodic_update_at: string | null
          lead_form: Json | null
          meta_ad_id: string | null
          meta_adset_id: string | null
          meta_campaign_id: string | null
          meta_lead_form_id: string | null
          name: string
          objective: string
          platform: string
          start_date: string | null
          status: string
          targeting: Json
          tiktok_ad_id: string | null
          tiktok_adgroup_id: string | null
          tiktok_campaign_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ad_account_id?: string | null
          budget?: number
          budget_mode?: string
          created_at?: string
          creative?: Json
          end_date?: string | null
          id?: string
          last_anomaly_check_at?: string | null
          last_periodic_update_at?: string | null
          lead_form?: Json | null
          meta_ad_id?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          meta_lead_form_id?: string | null
          name: string
          objective?: string
          platform?: string
          start_date?: string | null
          status?: string
          targeting?: Json
          tiktok_ad_id?: string | null
          tiktok_adgroup_id?: string | null
          tiktok_campaign_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ad_account_id?: string | null
          budget?: number
          budget_mode?: string
          created_at?: string
          creative?: Json
          end_date?: string | null
          id?: string
          last_anomaly_check_at?: string | null
          last_periodic_update_at?: string | null
          lead_form?: Json | null
          meta_ad_id?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          meta_lead_form_id?: string | null
          name?: string
          objective?: string
          platform?: string
          start_date?: string | null
          status?: string
          targeting?: Json
          tiktok_ad_id?: string | null
          tiktok_adgroup_id?: string | null
          tiktok_campaign_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          assignee: string | null
          campaign_id: string | null
          created_at: string
          email: string | null
          external_ad_id: string | null
          external_campaign_id: string | null
          external_form_id: string | null
          external_lead_id: string | null
          full_name: string | null
          id: string
          message: string | null
          notes: string | null
          phone: string | null
          platform: string
          raw: Json
          source_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assignee?: string | null
          campaign_id?: string | null
          created_at?: string
          email?: string | null
          external_ad_id?: string | null
          external_campaign_id?: string | null
          external_form_id?: string | null
          external_lead_id?: string | null
          full_name?: string | null
          id?: string
          message?: string | null
          notes?: string | null
          phone?: string | null
          platform: string
          raw?: Json
          source_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assignee?: string | null
          campaign_id?: string | null
          created_at?: string
          email?: string | null
          external_ad_id?: string | null
          external_campaign_id?: string | null
          external_form_id?: string | null
          external_lead_id?: string | null
          full_name?: string | null
          id?: string
          message?: string | null
          notes?: string | null
          phone?: string | null
          platform?: string
          raw?: Json
          source_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ad_accounts: {
        Row: {
          account_name: string | null
          ad_account_id: string
          connection_id: string
          created_at: string
          currency: string | null
          id: string
          is_active: boolean
          status: number | null
          timezone_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name?: string | null
          ad_account_id: string
          connection_id: string
          created_at?: string
          currency?: string | null
          id?: string
          is_active?: boolean
          status?: number | null
          timezone_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string | null
          ad_account_id?: string
          connection_id?: string
          created_at?: string
          currency?: string | null
          id?: string
          is_active?: boolean
          status?: number | null
          timezone_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_ad_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "meta_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_connections: {
        Row: {
          access_token: string | null
          created_at: string
          id: string
          is_active: boolean
          meta_user_id: string
          meta_user_name: string | null
          scopes: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          meta_user_id: string
          meta_user_name?: string | null
          scopes?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          meta_user_id?: string
          meta_user_name?: string | null
          scopes?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meta_pages: {
        Row: {
          category: string | null
          connection_id: string
          created_at: string
          id: string
          is_active: boolean
          page_access_token: string | null
          page_id: string
          page_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          connection_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          page_access_token?: string | null
          page_id: string
          page_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          connection_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          page_access_token?: string | null
          page_id?: string
          page_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_pages_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "meta_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_data: {
        Row: {
          campaign_id: string
          clicks: number
          cpl: number
          created_at: string
          ctr: number
          date: string
          id: string
          impressions: number
          leads: number
          spend: number
          user_id: string
        }
        Insert: {
          campaign_id: string
          clicks?: number
          cpl?: number
          created_at?: string
          ctr?: number
          date: string
          id?: string
          impressions?: number
          leads?: number
          spend?: number
          user_id: string
        }
        Update: {
          campaign_id?: string
          clicks?: number
          cpl?: number
          created_at?: string
          ctr?: number
          date?: string
          id?: string
          impressions?: number
          leads?: number
          spend?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_data_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          admin_notes: string | null
          created_at: string
          full_name: string | null
          id: string
          plan: string
          subscription_status: string
          suspended: boolean
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          plan?: string
          subscription_status?: string
          suspended?: boolean
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          plan?: string
          subscription_status?: string
          suspended?: boolean
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          trial_end: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          trial_end?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          trial_end?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender: string
          sent_to_whatsapp: boolean
          ticket_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender: string
          sent_to_whatsapp?: boolean
          ticket_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender?: string
          sent_to_whatsapp?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          created_at: string
          id: string
          last_message_at: string
          priority: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          priority?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_connections: {
        Row: {
          access_token: string | null
          activated_at: string | null
          activation_code: string | null
          created_at: string
          display_phone: string | null
          id: string
          last_daily_report_at: string | null
          last_message_at: string | null
          phone_number_id: string | null
          status: string
          updated_at: string
          user_id: string
          user_phone: string | null
          verify_token: string | null
          waba_id: string | null
        }
        Insert: {
          access_token?: string | null
          activated_at?: string | null
          activation_code?: string | null
          created_at?: string
          display_phone?: string | null
          id?: string
          last_daily_report_at?: string | null
          last_message_at?: string | null
          phone_number_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
          user_phone?: string | null
          verify_token?: string | null
          waba_id?: string | null
        }
        Update: {
          access_token?: string | null
          activated_at?: string | null
          activation_code?: string | null
          created_at?: string
          display_phone?: string | null
          id?: string
          last_daily_report_at?: string | null
          last_message_at?: string | null
          phone_number_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          user_phone?: string | null
          verify_token?: string | null
          waba_id?: string | null
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          connection_id: string | null
          created_at: string
          direction: string
          id: string
          media_mime: string | null
          media_path: string | null
          meta: Json | null
          msg_type: string
          text: string | null
          tool_calls: Json | null
          user_id: string
          wa_message_id: string | null
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          direction: string
          id?: string
          media_mime?: string | null
          media_path?: string | null
          meta?: Json | null
          msg_type?: string
          text?: string | null
          tool_calls?: Json | null
          user_id: string
          wa_message_id?: string | null
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          media_mime?: string | null
          media_path?: string | null
          meta?: Json | null
          msg_type?: string
          text?: string | null
          tool_calls?: Json | null
          user_id?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
