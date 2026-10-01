# Saborya CRM

CRM comercial da Saborya (indústria de alimentos congelados) para **estruturar o departamento comercial**: vendedores externos registram tudo pelo celular e a gestão acompanha a operação em tempo real.

> O CRM responde: *o que meu vendedor está fazendo? quem ele visitou? com quem falou? quais clientes estão perto de comprar? quanto existe no pipeline? quanto já vendeu? quais clientes estão esquecidos? qual é a próxima ação?*

## Funcionalidades

| Área | O que faz |
|---|---|
| **Clientes** | Cadastro completo (CNPJ validado, tipo, segmento, endereço), temperatura 🔵 Frio · 🟡 Interessado · 🟠 Quente · 🟢 Cliente · 🔴 Perdido com histórico permanente, faturamento e volume acumulados, página do cliente com abas (compradores, oportunidades, linha do tempo, visitas, pedidos, produtos comprados, histórico) |
| **Compradores** | Vários por cliente, com WhatsApp, cargo, melhor horário; botões de WhatsApp / ligar / mapa |
| **Pipeline** | Kanban com 9 etapas (arrastar no desktop, abas por etapa no celular), histórico automático de etapa e tempo em cada uma |
| **Visitas** | Registro em 3 passos no celular, resultado com toque, produtos apresentados, geolocalização opcional; cria follow-up, oportunidade e já leva ao pedido quando houver venda |
| **Atividades** | Ligação, WhatsApp, e-mail, reunião, follow-up, pós-venda; linha do tempo por cliente |
| **Tarefas** | Atrasadas · Hoje · Próximos 7 dias · Futuras, com prioridade e ações rápidas |
| **Pedidos** | Itens com quantidade × preço, desconto e total automáticos; orçamento → pedido → faturado → em entrega → entregue |
| **Faturamento** | Gerado automaticamente ao faturar; filtros por período, vendedor, cliente, produto, categoria, cidade e UF; estorno ao cancelar |
| **Dashboards** | Gestor: faturamento, volume, pedidos, clientes ativos/novos, oportunidades, gráficos de 12 meses, funil, por produto, por vendedor, feed de atividades em tempo real. Vendedor: "Bom dia, [nome]", agenda de hoje, follow-ups, pipeline, últimas vendas, clientes sem contato |
| **Análises** | Saúde do funil (conversão, ciclo, tempo médio por etapa, oportunidades paradas), volume por produto/categoria/cliente/vendedor, desempenho individual (sem ranking) |
| **Alertas** | Clientes sem contato, oportunidades quentes sem próxima atividade, tarefas atrasadas, clientes sem recompra, oportunidades paradas (prazos configuráveis) |
| **Gestão** | Equipe (criar/bloquear usuários, transferir carteira), produtos com margem, auditoria completa campo a campo, busca global, exportação CSV (abre no Excel) |
| **Mobile / PWA** | Navegação inferior com botão **+**, instalável na tela inicial, botões grandes, sem tabelas largas no celular |

### Perfis e segurança
- **Gestor (admin)**: vê e edita toda a operação, fatura pedidos, gerencia equipe, produtos e configurações.
- **Vendedor**: vê apenas a própria carteira (clientes, compradores, oportunidades, visitas, tarefas, pedidos e vendas). Não fatura pedidos nem transfere clientes.
- Regras garantidas **no banco** (Row Level Security + triggers), não só na tela. O primeiro usuário criado vira gestor automaticamente.
- Nada importante é apagado: arquivamento lógico (`deleted_at`) e histórico/auditoria imutáveis.

## Stack

Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind CSS 4 · componentes próprios sobre Radix UI · Supabase (PostgreSQL, Auth, Realtime, RLS) · Recharts · dnd-kit · Zod · Vitest. Pronto para Vercel.

```
src/
  app/(auth)/        login e recuperação de senha
  app/(app)/         telas autenticadas (dashboard, clientes, pipeline, visitas…)
  app/actions/       Server Actions (validação Zod + Supabase com RLS)
  app/api/export/    exportação CSV
  components/        ui/ (base), crm/ (domínio), charts/, dashboard/, layout/
  lib/               supabase/, auth, validação, formatação, períodos
supabase/
  migrations/        schema, regras, RLS, relatórios, dados de referência, demo
  setup.sql          todas as migrations em um arquivo (gerado)
  tests/db.test.mjs  testes do banco em PostgreSQL real
scripts/             dados demo e bundle do SQL
```

## Instalação

### 1. Supabase
1. Crie um projeto em [supabase.com](https://supabase.com) (região São Paulo).
2. **Banco**: em *SQL Editor → New query*, cole o conteúdo de `supabase/setup.sql` e clique em *Run*.
   - Alternativa com CLI: `npx supabase init && npx supabase link --project-ref SEU_REF && npx supabase db push`.
3. **Autenticação** (*Authentication → Sign In / Providers*):
   - Email habilitado; **desative "Allow new users to sign up"** (usuários são criados pela gestão).
   - *URL Configuration*: Site URL = endereço do app (ex. `https://crm.saborya.com.br`) e adicione `https://SEU-APP/auth/callback` em Redirect URLs.
4. **Primeiro gestor**: *Authentication → Users → Add user* (com e-mail e senha, marque *Auto Confirm*). O primeiro usuário vira gestor. Os demais são criados dentro do CRM em **Equipe**.
5. Copie em *Project Settings → API*: URL, chave publishable/anon e a chave secret/service role.

### 2. Rodar localmente
```bash
npm install
cp .env.example .env.local   # preencha com os dados do Supabase
npm run dev                  # http://localhost:3000
```

### 3. Deploy na Vercel
1. Importe o repositório `comercialsaborya/saborya-crm` na Vercel.
2. Configure as variáveis de ambiente de `.env.example` (a `SUPABASE_SERVICE_ROLE_KEY` **sem** o prefixo `NEXT_PUBLIC_`).
3. Deploy. Atualize a Site URL/Redirect URL no Supabase com o domínio final.

### 4. Dados de demonstração (opcional)
```bash
npm run demo:seed     # 3 vendedores demo, 8 clientes (5 redes), 12 compradores, 20 oportunidades,
                      # 20 visitas, 30+ atividades, 15 pedidos, tarefas — tudo marcado como [DEMO]
npm run demo:remove   # remove todos os dados e usuários demo, preservando os dados reais
```

### 5. Ajustes iniciais
- **Produtos**: os 12 produtos já vêm cadastrados com **preços e custos de referência** — ajuste em *Produtos*.
- **Configurações**: prazos dos alertas (sem contato, oportunidade parada, recompra) e cor da marca.

## Testes e qualidade
```bash
npm test            # testes unitários (validação, cálculos, períodos, CSV, feed)
npm run test:db     # 36 testes do banco em PostgreSQL real: RLS, faturamento, histórico, demo
npm run typecheck
npm run lint
npm run build
```

## Regras de negócio (resumo)
- **Visita** → cria atividade na linha do tempo, atualiza último contato/visita do cliente, promove a temperatura (interessado/quente), avança a oportunidade e cria follow-up.
- **Pedido realizado** com oportunidade → oportunidade vai para *Pedido*.
- **Faturar** (só gestor) → cria registro de faturamento, oportunidade vira *Venda realizada*, cliente vira 🟢 Cliente, vendedor é notificado.
- **Cancelar pedido faturado** → faturamento estornado (aparece como "Estornado").
- Itens não podem ser alterados após faturar. Número do pedido sequencial a partir de 1001.

## Preparado para o futuro
`organizations` isola dados por empresa/unidade; `external_id` em clientes, produtos e pedidos para ERP/NF; `notifications` pronta para push; geolocalização das visitas para roteirização; etapas do pipeline em tabela (configuráveis); funções SQL de relatório reutilizáveis para metas, previsão de vendas e IA.
