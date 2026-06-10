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
          name: string
          objective: string
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
          name: string
          objective?: string
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
          name?: string
          objective?: string
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
      meta_oauth_states: {
        Row: {
          state: string
          user_id: string
          expires_at: string
          created_at: string
        }
        Insert: {
          state: string
          user_id: string
          expires_at: string
          created_at?: string
        }
        Update: {
          state?: string
          user_id?: string
          expires_at?: string
          created_at?: string
        }
        Relationships: []
      }
      meta_connections: {
        Row: {
          id: string
          user_id: string
          provider: string
          meta_user_id: string | null
          meta_user_name: string | null
          access_token: string | null
          token_expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          provider?: string
          meta_user_id?: string | null
          meta_user_name?: string | null
          access_token?: string | null
          token_expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          provider?: string
          meta_user_id?: string | null
          meta_user_name?: string | null
          access_token?: string | null
          token_expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      meta_ad_accounts: {
        Row: {
          id: string
          user_id: string
          connection_id: string
          ad_account_id: string
          account_name: string | null
          currency: string | null
          timezone: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          connection_id: string
          ad_account_id: string
          account_name?: string | null
          currency?: string | null
          timezone?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          connection_id?: string
          ad_account_id?: string
          account_name?: string | null
          currency?: string | null
          timezone?: string | null
          status?: string
          created_at?: string
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
      meta_campaigns: {
        Row: {
          id: string
          user_id: string
          ad_account_id: string
          meta_campaign_id: string | null
          meta_adset_id: string | null
          meta_ad_id: string | null
          meta_form_id: string | null
          page_id: string | null
          campaign_name: string
          objective: string
          daily_budget: number
          status: string
          business_details: Json
          creative: Json
          targeting: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          ad_account_id: string
          meta_campaign_id?: string | null
          meta_adset_id?: string | null
          meta_ad_id?: string | null
          meta_form_id?: string | null
          page_id?: string | null
          campaign_name: string
          objective?: string
          daily_budget?: number
          status?: string
          business_details?: Json
          creative?: Json
          targeting?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          ad_account_id?: string
          meta_campaign_id?: string | null
          meta_adset_id?: string | null
          meta_ad_id?: string | null
          meta_form_id?: string | null
          page_id?: string | null
          campaign_name?: string
          objective?: string
          daily_budget?: number
          status?: string
          business_details?: Json
          creative?: Json
          targeting?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_campaigns_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_leads: {
        Row: {
          id: string
          user_id: string
          campaign_id: string | null
          platform_lead_id: string
          name: string | null
          email: string | null
          phone: string | null
          raw_payload: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          campaign_id?: string | null
          platform_lead_id: string
          name?: string | null
          email?: string | null
          phone?: string | null
          raw_payload?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          campaign_id?: string | null
          platform_lead_id?: string
          name?: string | null
          email?: string | null
          phone?: string | null
          raw_payload?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "meta_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_performance: {
        Row: {
          id: string
          user_id: string
          campaign_id: string
          date: string
          spend: number
          impressions: number
          clicks: number
          ctr: number
          cpc: number
          leads: number
          cpl: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          campaign_id: string
          date: string
          spend?: number
          impressions?: number
          clicks?: number
          ctr?: number
          cpc?: number
          leads?: number
          cpl?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          campaign_id?: string
          date?: string
          spend?: number
          impressions?: number
          clicks?: number
          ctr?: number
          cpc?: number
          leads?: number
          cpl?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_performance_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "meta_campaigns"
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
