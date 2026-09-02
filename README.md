# TASY Analytics

Painéis de indicadores hospitalares com dados reais do TASY (PostgreSQL). **Acesso restrito a supervisão e direção** — usuário comum não entra no sistema.

## Como Rodar

```bash
cd tasy-analytics-backend
npm install
npm run dev
```

Acesse: **http://localhost:3000/login.html**

Detalhes de variáveis de ambiente, login de teste e restrições conhecidas: **[docs/SETUP.md](docs/SETUP.md)**.

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | estrutura de pastas, backend por módulo, frontend Angular único |
| [docs/API.md](docs/API.md) | contrato de request/response de cada rota, formatos de erro |
| [docs/SEGURANCA.md](docs/SEGURANCA.md) | autenticação (JWT), RBAC por perfil, escopo de dados por linha |
| [docs/SETUP.md](docs/SETUP.md) | variáveis de ambiente, como rodar, login de teste, restrições conhecidas |

## Dashboards

| Dashboard        | Dados                        | Dimensões                                         |
|------------------|------------------------------|----------------------------------------------------|
| Financeiro       | glosas_protocolos            | Convênio, Estabelecimento, Setor, Tipo, Protocolo, Mês |
| Enfermagem       | etapa + glosas_por_item      | Convênio, Estabelecimento, Motivo, Mês              |
| Médico           | procedimento_paciente        | Convênio, Setor, Médico, Procedimento, Mês          |
| Farmácia         | cpoe_material + material     | Material, Setor, Antibiótico, Mês                   |
| Centro Cirúrgico | procedimento_paciente (guia 7) | Procedimento, Convênio, Setor, Médico, Porte, Mês  |
| Fisioterapia     | procedimento_paciente (fisio) | Procedimento, Convênio, Setor, Profissional, Mês    |
| **Geral (Direção)** | 28 fontes do ODS           | 157 cortes em 26 grupos, 7 áreas, 148 indicadores  |

## Painel Geral (Direção)

`dashboard-geral.html` é exclusivo de quem está em `PERFIS_DIRECAO`/`USUARIOS_DIRECAO` (`config/supervisao.js`). É o único painel que cruza **todas** as fontes do ODS, inclusive as que nenhum painel de área usava.

**Fontes (23 simples + 5 compostas)**, sobre 25 tabelas do `ods.*`:

| Área | Fontes |
|---|---|
| Financeiro | protocolos de glosa, glosa item a item, **retorno do convênio** (`convenio_retorno_item` — o demonstrativo de pagamento), recebimentos em caixa, contas do paciente, **guias** (`conta_paciente_guia`), **protocolos ao convênio** (`protocolo_convenio`), **contabilidade** (`lote_contabil`) |
| Assistencial | atendimentos e desfechos, ocupação de unidades, produção médica, **laudos e CID** (`laudo_por_atendimento`) |
| SUS | **AIH de internação** (`sus_aih_unif`), **APAC ambulatorial** (`sus_apac_unif`), **laudos e autorizações** (`sus_laudo_paciente`), **repasse de honorário** (`v_aih_repasse_medico`) |
| Suprimentos & Custos | custo assistencial de material, farmácia CPOE, **exames pedidos** (`cpoe_procedimento`), **prescrição médica** (`prescr_medica`), **nutrição/dietas** (`cpoe_dieta`), compras/notas fiscais |
| Apoio & Infra | manutenção (`man_ordem_servico`) |
| Resultado | 5 cruzamentos de duas fontes: margem assistencial, faturado × caixa, produção × conta, custo por internação e custo por dia-leito |

**Na tela:**

- **Abas de área** — Visão Geral, Financeiro, Assistencial, SUS, Suprimentos & Custos, Apoio & Infra e Resultado. Cada aba carrega só os seus cartões de KPI e a grade **"Ver por…"** com os cortes daquele assunto. `1…9` troca de aba.
- **Visão Geral** — resumo executivo com os 8 cartões estratégicos (cada um pedido em paralelo e pintado assim que chega, com variação contra o período anterior), evolução mensal consolidada e os seus atalhos favoritos.
- **Busca global (`Ctrl+K`)** — acha pelo nome do **indicador** ou do corte, em todas as áreas, sem acento e sem depender da ordem das palavras ("glosa convenio", "custo internacao"). São ~1.160 combinações indicador × corte.
- **Evolução mensal consolidada** — faturado, glosado, recebido em caixa, pago pelo convênio, produção, valor SUS, repasse médico, compras, atendimentos, internações, AIH e óbitos no mesmo eixo, com séries ligáveis/desligáveis.
- **Explorador** — 158 cortes. Os indicadores mudam conforme a fonte do corte. Gráfico (barras, colunas, linha, rosca), tabela com todos os indicadores, ordenação por coluna, busca, colunas visíveis, metas, anomalias (2σ), participação %, totais exatos e drill-down mensal por item.
- **Ferramentas** — comparação de período, presets, tema claro/escuro/automático, visões salvas, link compartilhável, favoritos, densidade, exportação CSV/Excel/PNG, cópia para Excel, impressão e atalhos de teclado (`?`).

O que só existe neste painel: todo o bloco **SUS** (AIH, APAC, laudos, repasse e CID por capítulo), o **retorno real do convênio** item a item, **movimento contábil**, **guias**, **convênio e plano por atendimento**, **clínica**, **especialidade**, **grupo/tipo de procedimento**, **classe e curva ABC de material**, **leito e perfil da unidade**, **exames pedidos**, **dietas** — e os indicadores que cruzam duas fontes (margem assistencial, % do faturado que entrou em caixa, custo por internação e por dia-leito).

## Stack

- **Backend**: Node.js + Express + pg (PostgreSQL)
- **Frontend**: AngularJS 1.8.2 + Chart.js 4.4.9, sem build step
- **Banco**: PostgreSQL (schema `ods.*`, somente leitura)
- **Auth**: JWT com bypass em `DEV_MODE` (ver [docs/SEGURANCA.md](docs/SEGURANCA.md))
