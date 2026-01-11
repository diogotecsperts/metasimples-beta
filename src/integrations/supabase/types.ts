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
      audit_alert_settings: {
        Row: {
          acoes_monitoradas: string[]
          ativo: boolean
          created_at: string
          emails: string[]
          id: string
          updated_at: string
        }
        Insert: {
          acoes_monitoradas?: string[]
          ativo?: boolean
          created_at?: string
          emails?: string[]
          id?: string
          updated_at?: string
        }
        Update: {
          acoes_monitoradas?: string[]
          ativo?: boolean
          created_at?: string
          emails?: string[]
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      changelog_items: {
        Row: {
          categoria: string
          created_at: string
          created_by: string
          descricao: string
          id: string
          published_at: string | null
          scheduled_at: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          categoria: string
          created_at?: string
          created_by: string
          descricao: string
          id?: string
          published_at?: string | null
          scheduled_at?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          categoria?: string
          created_at?: string
          created_by?: string
          descricao?: string
          id?: string
          published_at?: string | null
          scheduled_at?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      changelog_read_status: {
        Row: {
          id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          last_read_at?: string
          user_id?: string
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
      metas_diarias_ajustes: {
        Row: {
          created_at: string
          created_by: string
          data: string
          id: string
          loja_id: string
          meta_ajustada: number
          meta_mensal_id: string
          meta_original: number
          motivo: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          data: string
          id?: string
          loja_id: string
          meta_ajustada: number
          meta_mensal_id: string
          meta_original: number
          motivo?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          data?: string
          id?: string
          loja_id?: string
          meta_ajustada?: number
          meta_mensal_id?: string
          meta_original?: number
          motivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "metas_diarias_ajustes_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_diarias_ajustes_meta_mensal_id_fkey"
            columns: ["meta_mensal_id"]
            isOneToOne: false
            referencedRelation: "metas_mensais"
            referencedColumns: ["id"]
          },
        ]
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
          horarios_manuais: string[] | null
          id: string
          modo: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          emails?: string[]
          horarios_ativos?: string[]
          horarios_manuais?: string[] | null
          id?: string
          modo?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          emails?: string[]
          horarios_ativos?: string[]
          horarios_manuais?: string[] | null
          id?: string
          modo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sendpulse_contacts: {
        Row: {
          created_at: string | null
          id: string
          opt_in_at: string | null
          sendpulse_contact_id: string | null
          status: string | null
          telefone: string
          tentativas_envio: number | null
          tentativas_falha_consecutivas: number | null
          ultimo_bloqueio_at: string | null
          ultimo_envio_sucesso_at: string | null
          updated_at: string | null
          user_id: string
          user_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          opt_in_at?: string | null
          sendpulse_contact_id?: string | null
          status?: string | null
          telefone: string
          tentativas_envio?: number | null
          tentativas_falha_consecutivas?: number | null
          ultimo_bloqueio_at?: string | null
          ultimo_envio_sucesso_at?: string | null
          updated_at?: string | null
          user_id: string
          user_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          opt_in_at?: string | null
          sendpulse_contact_id?: string | null
          status?: string | null
          telefone?: string
          tentativas_envio?: number | null
          tentativas_falha_consecutivas?: number | null
          ultimo_bloqueio_at?: string | null
          ultimo_envio_sucesso_at?: string | null
          updated_at?: string | null
          user_id?: string
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sendpulse_contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      whatsapp_cobranca_log: {
        Row: {
          confirmacao_manual: boolean | null
          confirmado_manual_em: string | null
          contact_id_usado: string | null
          data: string
          enviado_em: string
          erro_detalhes: string | null
          gerente_id: string
          horario_lancamento: string
          id: string
          loja_id: string
          metodo_envio: string | null
          minutos_atraso: number
          nivel_cobranca: number
          sendpulse_message_id: string | null
          sendpulse_response: string | null
          sendpulse_status: number | null
          status: string
          status_entrega: string | null
          telefone_usado: string | null
          template_usado: string
          webhook_payload: string | null
          webhook_recebido_em: string | null
        }
        Insert: {
          confirmacao_manual?: boolean | null
          confirmado_manual_em?: string | null
          contact_id_usado?: string | null
          data: string
          enviado_em?: string
          erro_detalhes?: string | null
          gerente_id: string
          horario_lancamento: string
          id?: string
          loja_id: string
          metodo_envio?: string | null
          minutos_atraso: number
          nivel_cobranca: number
          sendpulse_message_id?: string | null
          sendpulse_response?: string | null
          sendpulse_status?: number | null
          status?: string
          status_entrega?: string | null
          telefone_usado?: string | null
          template_usado: string
          webhook_payload?: string | null
          webhook_recebido_em?: string | null
        }
        Update: {
          confirmacao_manual?: boolean | null
          confirmado_manual_em?: string | null
          contact_id_usado?: string | null
          data?: string
          enviado_em?: string
          erro_detalhes?: string | null
          gerente_id?: string
          horario_lancamento?: string
          id?: string
          loja_id?: string
          metodo_envio?: string | null
          minutos_atraso?: number
          nivel_cobranca?: number
          sendpulse_message_id?: string | null
          sendpulse_response?: string | null
          sendpulse_status?: number | null
          status?: string
          status_entrega?: string | null
          telefone_usado?: string | null
          template_usado?: string
          webhook_payload?: string | null
          webhook_recebido_em?: string | null
        }
        Relationships: []
      }
      whatsapp_cobranca_settings: {
        Row: {
          ativo: boolean
          created_at: string
          gerentes_ativos: string[]
          horarios_monitorados: string[]
          id: string
          intervalos_cobranca: string[]
          tolerancia_minutos: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          gerentes_ativos?: string[]
          horarios_monitorados?: string[]
          id?: string
          intervalos_cobranca?: string[]
          tolerancia_minutos?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          gerentes_ativos?: string[]
          horarios_monitorados?: string[]
          id?: string
          intervalos_cobranca?: string[]
          tolerancia_minutos?: number
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_report_log: {
        Row: {
          admin_id: string
          admin_nome: string
          admin_telefone: string
          confirmacao_manual: boolean | null
          confirmado_manual_em: string | null
          contact_id_usado: string | null
          data: string
          enviado_em: string
          erro_detalhes: string | null
          horario_envio: string
          id: string
          is_test: boolean
          metodo_envio: string | null
          sendpulse_message_id: string | null
          sendpulse_response: string | null
          sendpulse_status: number | null
          status: string
          status_entrega: string | null
          telefone_usado: string | null
          template_usado: string
          webhook_payload: string | null
          webhook_recebido_em: string | null
        }
        Insert: {
          admin_id: string
          admin_nome: string
          admin_telefone: string
          confirmacao_manual?: boolean | null
          confirmado_manual_em?: string | null
          contact_id_usado?: string | null
          data?: string
          enviado_em?: string
          erro_detalhes?: string | null
          horario_envio: string
          id?: string
          is_test?: boolean
          metodo_envio?: string | null
          sendpulse_message_id?: string | null
          sendpulse_response?: string | null
          sendpulse_status?: number | null
          status?: string
          status_entrega?: string | null
          telefone_usado?: string | null
          template_usado?: string
          webhook_payload?: string | null
          webhook_recebido_em?: string | null
        }
        Update: {
          admin_id?: string
          admin_nome?: string
          admin_telefone?: string
          confirmacao_manual?: boolean | null
          confirmado_manual_em?: string | null
          contact_id_usado?: string | null
          data?: string
          enviado_em?: string
          erro_detalhes?: string | null
          horario_envio?: string
          id?: string
          is_test?: boolean
          metodo_envio?: string | null
          sendpulse_message_id?: string | null
          sendpulse_response?: string | null
          sendpulse_status?: number | null
          status?: string
          status_entrega?: string | null
          telefone_usado?: string | null
          template_usado?: string
          webhook_payload?: string | null
          webhook_recebido_em?: string | null
        }
        Relationships: []
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
