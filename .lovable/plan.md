

# Plano: Corrigir Build + Gerar SQL Dump Completo

## 1. Corrigir ErrorBoundary.tsx
Substituir `process.env.NODE_ENV === "development"` por `import.meta.env.DEV` na linha 54.

## 2. Gerar SQL Dump
Executar script Python que conecta ao banco via psql e gera INSERT INTO de todas as 16 tabelas na ordem:

1. `lojas`
2. `profiles`
3. `user_roles`
4. `metas_mensais`
5. `metas_diarias_ajustes`
6. `lancamentos_diarios`
7. `report_settings`
8. `audit_alert_settings`
9. `whatsapp_report_settings`
10. `whatsapp_cobranca_settings`
11. `changelog_items`
12. `changelog_read_status`
13. `sendpulse_contacts`
14. `audit_logs`
15. `whatsapp_report_log`
16. `whatsapp_cobranca_log`

Arquivo final: `/mnt/documents/meta_simples_dump.sql`

