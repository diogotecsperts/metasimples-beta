import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type AuditAction = "create" | "update" | "delete";
export type AuditEntity = "loja" | "gerente" | "meta" | "admin" | "lancamento" | "meta_ajuste";

export type AuditLogParams = {
  userId: string;
  userNome: string;
  userRole: "admin" | "gerente";
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  entityName?: string;
  details?: Json;
};

export async function registrarAuditLog({
  userId,
  userNome,
  userRole,
  action,
  entity,
  entityId,
  entityName,
  details = {},
}: AuditLogParams): Promise<void> {
  try {
    const { error } = await supabase.from("audit_logs").insert([{
      user_id: userId,
      user_nome: userNome,
      user_role: userRole,
      action,
      entity,
      entity_id: entityId,
      entity_name: entityName,
      details,
    }]);

    if (error) {
      console.error("Erro ao registrar log de auditoria:", error);
    }
  } catch (err) {
    console.error("Erro ao registrar log de auditoria:", err);
  }
}

export const ACTION_LABELS: Record<AuditAction, string> = {
  create: "Criou",
  update: "Editou",
  delete: "Excluiu",
};

export const ENTITY_LABELS: Record<AuditEntity, string> = {
  loja: "Loja",
  gerente: "Gerente",
  meta: "Meta",
  admin: "Administrador",
  lancamento: "Lançamento",
  meta_ajuste: "Ajuste de Meta Diária",
};
