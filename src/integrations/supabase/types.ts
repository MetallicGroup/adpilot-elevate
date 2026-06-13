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
      campaigns: {
        Row: {
          ad_account_id: string | null
          budget: number
          budget_mode: string
          created_at: string
          creative: Json
          end_date: string | null
          id: string
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
          created_at: string
          full_name: string | null
          id: string
          plan: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          plan?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          plan?: string
          updated_at?: string
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
      [_ in never]: never
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
    Enums: {},
  },
} as const
