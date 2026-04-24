

# Plano: Gerar SQL de Bootstrap dos 20 Usuários (auth.users)

## Objetivo

Resolver o erro `profiles_id_fkey` no novo ambiente Supabase, populando a tabela `auth.users` **antes** de rodar o dump principal de 23 mil linhas.

## Abordagem

Vou consultar o banco atual via `psql` direto na tabela `auth.users` (que normalmente não é exposta nas tools de leitura padrão, mas é acessível via conexão direta com o `SUPABASE_DB_URL`) e extrair os 20 usuários com **todos os campos vitais de autenticação** preservados:

| Campo | Origem | Observação |
|---|---|---|
| `id` | `auth.users.id` | UUID original (mesmo do `profiles.id`) |
| `instance_id` | `auth.users.instance_id` | Normalmente `00000000-0000-0000-0000-000000000000` |
| `aud` | `auth.users.aud` | Tipicamente `authenticated` |
| `role` | `auth.users.role` | Tipicamente `authenticated` |
| `email` | `auth.users.email` | Email original |
| `encrypted_password` | `auth.users.encrypted_password` | **Hash bcrypt original** — preserva senha sem reset |
| `email_confirmed_at` | `auth.users.email_confirmed_at` | Mantém status de confirmação |
| `raw_app_meta_data` | `auth.users.raw_app_meta_data` | Provider info (ex: `{"provider":"email"}`) |
| `raw_user_meta_data` | `auth.users.raw_user_meta_data` | Metadata customizada (ex: `nome`) |
| `created_at` | `auth.users.created_at` | Data original |
| `updated_at` | `auth.users.updated_at` | Data original |

## Garantias

- **Senhas preservadas**: Como o `encrypted_password` é o hash bcrypt original, os 20 usuários (7 admins + 13 gerentes) continuarão fazendo login com as mesmas credenciais sem precisar resetar.
- **Email confirmado**: O campo `email_confirmed_at` será mantido, então não haverá necessidade de re-verificar emails.
- **UUIDs idênticos**: Os IDs serão exatamente os mesmos do dump principal, garantindo que o FK `profiles_id_fkey` resolva corretamente quando o dump rodar em seguida.
- **Uso de `ON CONFLICT (id) DO NOTHING`**: Para idempotência — caso algum usuário já exista no destino, o script não falha.

## Entrega

- Arquivo único: `/mnt/documents/auth_users_bootstrap.sql`
- Tamanho esperado: pequeno (~20 linhas de INSERT, < 50KB)
- Bloco SQL formatado para copiar/colar direto no SQL Editor do Supabase de destino
- Wrapper `BEGIN; ... COMMIT;` para execução atômica

## Ordem de execução no destino (recomendada)

```text
1º) auth_users_bootstrap.sql      ← este novo arquivo (20 INSERTs em auth.users)
2º) meta_simples_dump_v2.sql      ← dump principal (23.244 INSERTs)
```

## Observação técnica importante

O `encrypted_password` é um hash bcrypt — **não** é a senha em texto. O Supabase Auth valida logins comparando o hash, portanto migrar o hash preserva totalmente a capacidade de login. Nenhum usuário precisará trocar senha.

Caso algum usuário no banco atual tenha `encrypted_password` NULL (login só por OAuth, por exemplo), o script tratará isso como NULL no destino — mas pelo histórico do projeto (login email/senha + username), é esperado que todos os 20 tenham hash válido. Vou validar isso na extração.

