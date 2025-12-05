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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity: string
          entity_id: string | null
          entity_name: string | null
          id: string
          user_id: string
          user_nome: string
          user_role: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity: string
          entity_id?: string | null
          entity_name?: string | null
          id?: string
          user_id: string
          user_nome: string
          user_role: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity?: string
          entity_id?: string | null
          entity_name?: string | null
          id?: string
          user_id?: string
          user_nome?: string
          user_role?: string
        }
        Relationships: []
      }
      lancamentos_diarios: {
        Row: {
          created_at: string
          data: string
          horario: Database["public"]["Enums"]["horario_lancamento"] | null
          id: string
          loja_id: string
          updated_at: string
          valor_acumulado: number
        }
        Insert: {
          created_at?: string
          data: string
          horario?: Database["public"]["Enums"]["horario_lancamento"] | null
          id?: string
          loja_id: string
          updated_at?: string
          valor_acumulado: number
        }
        Update: {
          created_at?: string
          data?: string
          horario?: Database["public"]["Enums"]["horario_lancamento"] | null
          id?: string
          loja_id?: string
          updated_at?: string
          valor_acumulado?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_diarios_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      lojas: {
        Row: {
          created_at: string
          id: string
          nome: string
          possui_fechamento_tardio: boolean
          tipo_operacional: Database["public"]["Enums"]["tipo_operacional"]
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          possui_fechamento_tardio?: boolean
          tipo_operacional?: Database["public"]["Enums"]["tipo_operacional"]
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          possui_fechamento_tardio?: boolean
          tipo_operacional?: Database["public"]["Enums"]["tipo_operacional"]
        }
        Relationships: []
      }
      metas_mensais: {
        Row: {
          ano: number
          created_at: string
          id: string
          loja_id: string
          mes: number
          meta_diaria_calculada: number
          meta_mensal: number
          updated_at: string
        }
        Insert: {
          ano: number
          created_at?: string
          id?: string
          loja_id: string
          mes: number
          meta_diaria_calculada: number
          meta_mensal: number
          updated_at?: string
        }
        Update: {
          ano?: number
          created_at?: string
          id?: string
          loja_id?: string
          mes?: number
          meta_diaria_calculada?: number
          meta_mensal?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "metas_mensais_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          loja_id: string | null
          nome: string
          telefone: string | null
          username: string | null
        }
        Insert: {
          created_at?: string
          id: string
          loja_id?: string | null
          nome: string
          telefone?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          loja_id?: string | null
          nome?: string
          telefone?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      report_settings: {
        Row: {
          ativo: boolean
          created_at: string
          emails: string[]
          horarios_ativos: string[]
          id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          emails?: string[]
          horarios_ativos?: string[]
          id?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          emails?: string[]
          horarios_ativos?: string[]
          id?: string
          updated_at?: string
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
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_report_settings: {
        Row: {
          ativo: boolean
          created_at: string
          gerentes_ativos: string[]
          horarios_ativos: string[]
          id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          gerentes_ativos?: string[]
          horarios_ativos?: string[]
          id?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          gerentes_ativos?: string[]
          horarios_ativos?: string[]
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "gerente"
      horario_lancamento: "10:00" | "14:00" | "16:00" | "19:00" | "23:00"
      tipo_operacional: "A" | "B"
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
      app_role: ["admin", "gerente"],
      horario_lancamento: ["10:00", "14:00", "16:00", "19:00", "23:00"],
      tipo_operacional: ["A", "B"],
    },
  },
} as const
