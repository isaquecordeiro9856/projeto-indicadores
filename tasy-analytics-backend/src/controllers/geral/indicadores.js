// ═══════════════════════════════════════════════════════════════════
// PAINEL GERAL — catálogo de indicadores e formatação
// ═══════════════════════════════════════════════════════════════════
// tipo   : moeda | inteiro | decimal | percentual | dias | horas
// melhor : 'maior' (crescer é bom) | 'menor' (crescer é ruim) | 'neutro'
//
// Um indicador só existe aqui uma vez, mesmo que várias fontes o
// calculem — é o que garante nome, cor e formatação iguais no painel
// inteiro (KPI, chip, gráfico, tabela e CSV).
const INDICADORES = {
  // ── Financeiro / glosas ──────────────────────────────────────
  valor_faturado:      { nome: 'Valor Faturado',          tipo: 'moeda',      cor: '#2a78d6', melhor: 'maior' },
  valor_recebido:      { nome: 'Valor Recebido',          tipo: 'moeda',      cor: '#1baf7a', melhor: 'maior' },
  valor_a_receber:     { nome: 'Valor a Receber',         tipo: 'moeda',      cor: '#0284c7', melhor: 'menor' },
  valor_glosado:       { nome: 'Valor Glosado',           tipo: 'moeda',      cor: '#e34948', melhor: 'menor' },
  valor_glosa_aceita:  { nome: 'Glosa Aceita',            tipo: 'moeda',      cor: '#991b1b', melhor: 'menor' },
  valor_reapresentado: { nome: 'Reapresentado',           tipo: 'moeda',      cor: '#d97706', melhor: 'maior' },
  valor_adicional:     { nome: 'Valor Adicional',         tipo: 'moeda',      cor: '#4a3aa7', melhor: 'maior' },
  valor_retorno:       { nome: 'Valor Retorno',           tipo: 'moeda',      cor: '#0d9488', melhor: 'maior' },
  qtd_protocolos:      { nome: 'Protocolos',              tipo: 'inteiro',    cor: '#6b7488', melhor: 'neutro' },
  pct_recebido:        { nome: '% Recebido',              tipo: 'percentual', cor: '#1baf7a', melhor: 'maior' },
  pct_glosado:         { nome: '% Glosado',               tipo: 'percentual', cor: '#e34948', melhor: 'menor' },
  pct_glosa_aceita:    { nome: '% Glosa Aceita',          tipo: 'percentual', cor: '#991b1b', melhor: 'menor' },
  pct_adicional:       { nome: '% Adicional',             tipo: 'percentual', cor: '#4a3aa7', melhor: 'maior' },
  ticket_protocolo:    { nome: 'Ticket Médio Protocolo',  tipo: 'moeda',      cor: '#eda100', melhor: 'maior' },

  // ── Glosa item a item ────────────────────────────────────────
  valor_item:          { nome: 'Valor dos Itens',         tipo: 'moeda',      cor: '#2a78d6', melhor: 'maior' },
  qtd_atend_glosa:     { nome: 'Atendimentos c/ Glosa',   tipo: 'inteiro',    cor: '#eb6834', melhor: 'menor' },
  glosa_por_atend:     { nome: 'Glosa por Atendimento',   tipo: 'moeda',      cor: '#e34948', melhor: 'menor' },

  // ── Produção médica ──────────────────────────────────────────
  qtd_atendimentos:    { nome: 'Atendimentos',            tipo: 'inteiro',    cor: '#2a78d6', melhor: 'maior' },
  qtd_procedimentos:   { nome: 'Procedimentos',           tipo: 'inteiro',    cor: '#eb6834', melhor: 'maior' },
  valor_produzido:     { nome: 'Valor Produzido',         tipo: 'moeda',      cor: '#1baf7a', melhor: 'maior' },
  valor_medico:        { nome: 'Repasse ao Profissional', tipo: 'moeda',      cor: '#eda100', melhor: 'neutro' },
  ticket_atendimento:  { nome: 'Ticket Médio Atend.',     tipo: 'moeda',      cor: '#4a3aa7', melhor: 'maior' },
  valor_medio_proc:    { nome: 'Valor Médio Proced.',     tipo: 'moeda',      cor: '#0d9488', melhor: 'maior' },
  proc_por_atend:      { nome: 'Proced. por Atend.',      tipo: 'decimal',    cor: '#8b5cf6', melhor: 'neutro' },
  pct_repasse:         { nome: '% Repasse',               tipo: 'percentual', cor: '#eda100', melhor: 'menor' },

  // ── Contas / faturamento ─────────────────────────────────────
  qtd_contas:          { nome: 'Contas',                  tipo: 'inteiro',    cor: '#2a78d6', melhor: 'maior' },
  dias_permanencia:    { nome: 'Dias Faturados',          tipo: 'inteiro',    cor: '#eb6834', melhor: 'neutro' },
  media_permanencia:   { nome: 'Média de Dias por Conta', tipo: 'decimal',    cor: '#4a3aa7', melhor: 'menor' },
  valor_contas:        { nome: 'Valor das Contas',        tipo: 'moeda',      cor: '#1baf7a', melhor: 'maior' },
  ticket_conta:        { nome: 'Ticket Médio Conta',      tipo: 'moeda',      cor: '#eda100', melhor: 'maior' },

  // ── Farmácia / prescrição ────────────────────────────────────
  qtd_prescricoes:     { nome: 'Itens Prescritos',        tipo: 'inteiro',    cor: '#2a78d6', melhor: 'neutro' },
  qtd_pacientes:       { nome: 'Pacientes',               tipo: 'inteiro',    cor: '#eb6834', melhor: 'maior' },
  qtd_materiais:       { nome: 'Materiais Distintos',     tipo: 'inteiro',    cor: '#1baf7a', melhor: 'neutro' },
  itens_por_paciente:  { nome: 'Itens por Paciente',      tipo: 'decimal',    cor: '#4a3aa7', melhor: 'menor' },

  // ── Atendimentos e desfechos ─────────────────────────────────
  qtd_internacoes:     { nome: 'Internações',             tipo: 'inteiro',    cor: '#4a3aa7', melhor: 'neutro' },
  qtd_altas:           { nome: 'Altas',                   tipo: 'inteiro',    cor: '#1baf7a', melhor: 'neutro' },
  qtd_obitos:          { nome: 'Óbitos',                  tipo: 'inteiro',    cor: '#e34948', melhor: 'menor' },
  taxa_obito:          { nome: 'Taxa de Óbito',           tipo: 'percentual', cor: '#e34948', melhor: 'menor' },
  qtd_urgencia:        { nome: 'Urgências',               tipo: 'inteiro',    cor: '#eb6834', melhor: 'neutro' },
  taxa_urgencia:       { nome: '% Urgência',              tipo: 'percentual', cor: '#eb6834', melhor: 'neutro' },
  permanencia_media:   { nome: 'Tempo Médio de Estadia',  tipo: 'dias',       cor: '#8b5cf6', melhor: 'menor' },
  permanencia_intern:  { nome: 'Permanência (Internação)', tipo: 'dias',      cor: '#4a3aa7', melhor: 'menor' },
  idade_media:         { nome: 'Idade Média',             tipo: 'decimal',    cor: '#6b7488', melhor: 'neutro' },
  atend_por_paciente:  { nome: 'Atend. por Paciente',     tipo: 'decimal',    cor: '#0d9488', melhor: 'menor' },

  // ── Ocupação / leitos ────────────────────────────────────────
  qtd_passagens:       { nome: 'Passagens pela Unidade',  tipo: 'inteiro',    cor: '#2a78d6', melhor: 'neutro' },
  dias_ocupacao:       { nome: 'Dias de Ocupação',        tipo: 'decimal',    cor: '#1baf7a', melhor: 'neutro' },
  permanencia_unidade: { nome: 'Permanência na Unidade',  tipo: 'dias',       cor: '#4a3aa7', melhor: 'menor' },
  qtd_em_aberto:       { nome: 'Passagens em Aberto',     tipo: 'inteiro',    cor: '#eda100', melhor: 'menor' },

  // ── Custo assistencial (materiais consumidos) ────────────────
  valor_material:      { nome: 'Custo de Material',       tipo: 'moeda',      cor: '#e34948', melhor: 'menor' },
  qtd_itens_material:  { nome: 'Itens Consumidos',        tipo: 'inteiro',    cor: '#2a78d6', melhor: 'neutro' },
  qtd_unidades:        { nome: 'Unidades Consumidas',     tipo: 'decimal',    cor: '#eb6834', melhor: 'neutro' },
  custo_por_atend:     { nome: 'Custo por Atendimento',   tipo: 'moeda',      cor: '#4a3aa7', melhor: 'menor' },
  custo_medio_item:    { nome: 'Custo Médio do Item',     tipo: 'moeda',      cor: '#eda100', melhor: 'menor' },

  // ── Compras / notas fiscais ──────────────────────────────────
  valor_compras:       { nome: 'Valor das Compras',       tipo: 'moeda',      cor: '#e34948', melhor: 'menor' },
  valor_mercadoria:    { nome: 'Valor da Mercadoria',     tipo: 'moeda',      cor: '#2a78d6', melhor: 'neutro' },
  valor_frete:         { nome: 'Frete',                   tipo: 'moeda',      cor: '#eda100', melhor: 'menor' },
  valor_descontos:     { nome: 'Descontos Obtidos',       tipo: 'moeda',      cor: '#1baf7a', melhor: 'maior' },
  valor_ipi:           { nome: 'IPI',                     tipo: 'moeda',      cor: '#8b5cf6', melhor: 'neutro' },
  qtd_notas:           { nome: 'Notas Fiscais',           tipo: 'inteiro',    cor: '#6b7488', melhor: 'neutro' },
  ticket_nota:         { nome: 'Valor Médio da Nota',     tipo: 'moeda',      cor: '#4a3aa7', melhor: 'neutro' },

  // ── Recebimentos (caixa) ─────────────────────────────────────
  valor_recebimento:   { nome: 'Recebido em Caixa',       tipo: 'moeda',      cor: '#1baf7a', melhor: 'maior' },
  qtd_recebimentos:    { nome: 'Recebimentos',            tipo: 'inteiro',    cor: '#6b7488', melhor: 'neutro' },
  despesa_bancaria:    { nome: 'Despesa Bancária',        tipo: 'moeda',      cor: '#e34948', melhor: 'menor' },
  ticket_recebimento:  { nome: 'Valor Médio Recebido',    tipo: 'moeda',      cor: '#4a3aa7', melhor: 'maior' },

  // ── Manutenção / ordens de serviço ───────────────────────────
  qtd_os:              { nome: 'Ordens de Serviço',       tipo: 'inteiro',    cor: '#2a78d6', melhor: 'neutro' },
  qtd_os_concluidas:   { nome: 'OS Concluídas',           tipo: 'inteiro',    cor: '#1baf7a', melhor: 'maior' },
  qtd_os_abertas:      { nome: 'OS em Aberto',            tipo: 'inteiro',    cor: '#eda100', melhor: 'menor' },
  taxa_conclusao_os:   { nome: '% Concluídas',            tipo: 'percentual', cor: '#1baf7a', melhor: 'maior' },
  tempo_medio_os:      { nome: 'Tempo Médio de Conclusão', tipo: 'horas',     cor: '#e34948', melhor: 'menor' },

  // ── Retorno de convênio (demonstrativo de pagamento) ─────────
  // O protocolo diz o que foi cobrado; o retorno diz o que o convênio
  // de fato pagou, glosou e pagou a menor, item por item.
  valor_pago_retorno:  { nome: 'Pago pelo Convênio',      tipo: 'moeda',      cor: '#1baf7a', melhor: 'maior' },
  valor_amenor:        { nome: 'Pago a Menor',            tipo: 'moeda',      cor: '#e34948', melhor: 'menor' },
  valor_guia_retorno:  { nome: 'Valor das Guias',         tipo: 'moeda',      cor: '#2a78d6', melhor: 'maior' },
  qtd_itens_retorno:   { nome: 'Itens do Retorno',        tipo: 'inteiro',    cor: '#6b7488', melhor: 'neutro' },
  qtd_contas_retorno:  { nome: 'Contas no Retorno',       tipo: 'inteiro',    cor: '#0284c7', melhor: 'neutro' },
  pct_glosa_retorno:   { nome: '% Glosa no Retorno',      tipo: 'percentual', cor: '#e34948', melhor: 'menor' },
  ticket_item_retorno: { nome: 'Valor Médio do Item',     tipo: 'moeda',      cor: '#4a3aa7', melhor: 'maior' },

  // ── Repasse médico (AIH) ─────────────────────────────────────
  valor_repasse_aih:   { nome: 'Repasse Médico (AIH)',    tipo: 'moeda',      cor: '#eda100', melhor: 'neutro' },
  qtd_itens_repasse:   { nome: 'Itens de Repasse',        tipo: 'inteiro',    cor: '#6b7488', melhor: 'neutro' },
  qtd_aih_repasse:     { nome: 'AIH com Repasse',         tipo: 'inteiro',    cor: '#2a78d6', melhor: 'neutro' },
  repasse_medio_item:  { nome: 'Repasse Médio do Item',   tipo: 'moeda',      cor: '#4a3aa7', melhor: 'neutro' },
  repasse_por_aih:     { nome: 'Repasse por AIH',         tipo: 'moeda',      cor: '#8b5cf6', melhor: 'neutro' },

  // ── Guias de faturamento ─────────────────────────────────────
  qtd_guias:           { nome: 'Guias',                   tipo: 'inteiro',    cor: '#2a78d6', melhor: 'neutro' },
  valor_guias:         { nome: 'Valor das Guias',         tipo: 'moeda',      cor: '#1baf7a', melhor: 'maior' },
  valor_guia_convenio: { nome: 'Parte do Convênio',       tipo: 'moeda',      cor: '#0284c7', melhor: 'maior' },
  ticket_guia:         { nome: 'Valor Médio da Guia',     tipo: 'moeda',      cor: '#eda100', melhor: 'maior' },
  qtd_contas_guia:     { nome: 'Contas com Guia',         tipo: 'inteiro',    cor: '#6b7488', melhor: 'neutro' },
  guias_por_conta:     { nome: 'Guias por Conta',         tipo: 'decimal',    cor: '#4a3aa7', melhor: 'menor' },

  // ── Contabilidade (lotes contábeis) ──────────────────────────
  valor_debito:        { nome: 'Débito',                  tipo: 'moeda',      cor: '#e34948', melhor: 'neutro' },
  valor_credito:       { nome: 'Crédito',                 tipo: 'moeda',      cor: '#1baf7a', melhor: 'neutro' },
  saldo_contabil:      { nome: 'Saldo (Créd. − Déb.)',    tipo: 'moeda',      cor: '#4a3aa7', melhor: 'neutro' },
  qtd_lotes:           { nome: 'Lotes Contábeis',         tipo: 'inteiro',    cor: '#6b7488', melhor: 'neutro' },

  // ── Protocolos enviados ao convênio ──────────────────────────
  qtd_protocolos_conv: { nome: 'Protocolos',              tipo: 'inteiro',    cor: '#2a78d6', melhor: 'neutro' },
  qtd_prot_fechados:   { nome: 'Protocolos Fechados',     tipo: 'inteiro',    cor: '#1baf7a', melhor: 'maior' },
  pct_prot_fechado:    { nome: '% Fechado',               tipo: 'percentual', cor: '#1baf7a', melhor: 'maior' },
  qtd_prot_abertos:    { nome: 'Ainda em Aberto',         tipo: 'inteiro',    cor: '#eda100', melhor: 'menor' },
  qtd_prot_vencidos:   { nome: 'Vencidos em Aberto',      tipo: 'inteiro',    cor: '#e34948', melhor: 'menor' },
  qtd_prot_com_venc:   { nome: 'Com Vencimento Definido', tipo: 'inteiro',    cor: '#6b7488', melhor: 'neutro' },

  // ── SUS · AIH (internação) ───────────────────────────────────
  qtd_aih:             { nome: 'AIH Emitidas',            tipo: 'inteiro',    cor: '#2a78d6', melhor: 'neutro' },
  valor_aih:           { nome: 'Valor SUS (Serv. Prof.)', tipo: 'moeda',      cor: '#1baf7a', melhor: 'maior' },
  ticket_aih:          { nome: 'Valor Médio da AIH',      tipo: 'moeda',      cor: '#eda100', melhor: 'maior' },
  dias_perm_sus:       { nome: 'Dias de Permanência',     tipo: 'inteiro',    cor: '#eb6834', melhor: 'neutro' },
  perm_media_aih:      { nome: 'Permanência Média',       tipo: 'dias',       cor: '#4a3aa7', melhor: 'menor' },
  qtd_aih_com_perm:    { nome: 'AIH c/ Permanência Inf.', tipo: 'inteiro',    cor: '#6b7488', melhor: 'neutro' },
  qtd_obitos_sus:      { nome: 'Óbitos',                  tipo: 'inteiro',    cor: '#e34948', melhor: 'menor' },
  taxa_obito_sus:      { nome: 'Taxa de Óbito',           tipo: 'percentual', cor: '#e34948', melhor: 'menor' },
  qtd_altas_sus:       { nome: 'Altas',                   tipo: 'inteiro',    cor: '#1baf7a', melhor: 'neutro' },
  qtd_transf_sus:      { nome: 'Transferências',          tipo: 'inteiro',    cor: '#d97706', melhor: 'menor' },
  qtd_nasc_vivos:      { nome: 'Nascidos Vivos',          tipo: 'inteiro',    cor: '#0d9488', melhor: 'neutro' },
  qtd_nasc_mortos:     { nome: 'Nascidos Mortos',         tipo: 'inteiro',    cor: '#991b1b', melhor: 'menor' },
  qtd_longa_perm:      { nome: 'Longa Permanência',       tipo: 'inteiro',    cor: '#8b5cf6', melhor: 'menor' },
  qtd_atend_aih:       { nome: 'Atendimentos com AIH',    tipo: 'inteiro',    cor: '#0284c7', melhor: 'neutro' },

  // ── SUS · APAC (ambulatorial de alta complexidade) ───────────
  qtd_apac:            { nome: 'APAC',                    tipo: 'inteiro',    cor: '#2a78d6', melhor: 'neutro' },
  qtd_atend_apac:      { nome: 'Pacientes em APAC',       tipo: 'inteiro',    cor: '#0d9488', melhor: 'neutro' },
  qtd_proc_apac:       { nome: 'Procedimentos Distintos', tipo: 'inteiro',    cor: '#eb6834', melhor: 'neutro' },
  meses_autorizados:   { nome: 'Meses Autorizados',       tipo: 'inteiro',    cor: '#4a3aa7', melhor: 'neutro' },
  apac_por_paciente:   { nome: 'APAC por Paciente',       tipo: 'decimal',    cor: '#8b5cf6', melhor: 'neutro' },

  // ── SUS · Laudos e autorizações ──────────────────────────────
  qtd_laudos_sus:      { nome: 'Laudos SUS',              tipo: 'inteiro',    cor: '#2a78d6', melhor: 'neutro' },
  qtd_proc_solic:      { nome: 'Procedimentos Solicitados', tipo: 'inteiro',  cor: '#eb6834', melhor: 'neutro' },
  qtd_atend_laudo:     { nome: 'Atendimentos com Laudo',  tipo: 'inteiro',    cor: '#0284c7', melhor: 'neutro' },
  proc_por_laudo:      { nome: 'Procedimentos por Laudo', tipo: 'decimal',    cor: '#4a3aa7', melhor: 'neutro' },
  qtd_laudos:          { nome: 'Laudos Emitidos',         tipo: 'inteiro',    cor: '#1baf7a', melhor: 'neutro' },
  laudos_por_atend:    { nome: 'Laudos por Atendimento',  tipo: 'decimal',    cor: '#8b5cf6', melhor: 'neutro' },

  // ── Exames e procedimentos prescritos (CPOE) ─────────────────
  qtd_exames_presc:    { nome: 'Exames Prescritos',       tipo: 'inteiro',    cor: '#2a78d6', melhor: 'neutro' },
  qtd_unid_exame:      { nome: 'Quantidade Solicitada',   tipo: 'decimal',    cor: '#eb6834', melhor: 'neutro' },
  qtd_atend_exame:     { nome: 'Pacientes',               tipo: 'inteiro',    cor: '#0d9488', melhor: 'neutro' },
  qtd_exames_susp:     { nome: 'Exames Suspensos',        tipo: 'inteiro',    cor: '#e34948', melhor: 'menor' },
  taxa_susp_exame:     { nome: '% Suspenso',              tipo: 'percentual', cor: '#e34948', melhor: 'menor' },
  exames_por_atend:    { nome: 'Exames por Paciente',     tipo: 'decimal',    cor: '#4a3aa7', melhor: 'menor' },

  // ── Nutrição (dietas prescritas) ─────────────────────────────
  qtd_dietas:          { nome: 'Dietas Prescritas',       tipo: 'inteiro',    cor: '#2a78d6', melhor: 'neutro' },
  qtd_atend_dieta:     { nome: 'Pacientes em Dieta',      tipo: 'inteiro',    cor: '#0d9488', melhor: 'neutro' },
  qtd_dieta_enteral:   { nome: 'Dietas Enterais',         tipo: 'inteiro',    cor: '#8b5cf6', melhor: 'neutro' },
  qtd_dietas_susp:     { nome: 'Dietas Suspensas',        tipo: 'inteiro',    cor: '#e34948', melhor: 'menor' },
  taxa_susp_dieta:     { nome: '% Suspensa',              tipo: 'percentual', cor: '#e34948', melhor: 'menor' },
  dietas_por_atend:    { nome: 'Dietas por Paciente',     tipo: 'decimal',    cor: '#4a3aa7', melhor: 'menor' },

  // ── Prescrição médica (base legado) ──────────────────────────
  qtd_presc_med:       { nome: 'Prescrições',             tipo: 'inteiro',    cor: '#2a78d6', melhor: 'neutro' },
  qtd_atend_presc:     { nome: 'Pacientes Prescritos',    tipo: 'inteiro',    cor: '#0d9488', melhor: 'neutro' },
  qtd_presc_susp:      { nome: 'Prescrições Suspensas',   tipo: 'inteiro',    cor: '#e34948', melhor: 'menor' },
  taxa_susp_presc:     { nome: '% Suspensa',              tipo: 'percentual', cor: '#e34948', melhor: 'menor' },
  qtd_prescritores:    { nome: 'Prescritores',            tipo: 'inteiro',    cor: '#6b7488', melhor: 'neutro' },
  presc_por_atend:     { nome: 'Prescrições por Paciente', tipo: 'decimal',   cor: '#4a3aa7', melhor: 'menor' },

  // ── Indicadores que cruzam duas fontes ───────────────────────
  // Só existem em dimensões compostas (ver FONTES_COMPOSTAS): cada lado
  // é consultado na sua própria tabela e as linhas são casadas pelo
  // rótulo. Ver a nota em geral/fontes.js sobre o que isso permite e não
  // permite concluir.
  margem_assistencial: { nome: 'Margem Assistencial',     tipo: 'moeda',      cor: '#1baf7a', melhor: 'maior' },
  pct_margem_assist:   { nome: '% Margem',                tipo: 'percentual', cor: '#1baf7a', melhor: 'maior' },
  custo_sobre_prod:    { nome: 'Custo / Produção',        tipo: 'percentual', cor: '#e34948', melhor: 'menor' },
  pct_conversao_caixa: { nome: '% Faturado que Entrou',   tipo: 'percentual', cor: '#1baf7a', melhor: 'maior' },
  glosa_sobre_caixa:   { nome: 'Glosa / Caixa',           tipo: 'percentual', cor: '#e34948', melhor: 'menor' },
  custo_por_intern:    { nome: 'Custo por Internação',    tipo: 'moeda',      cor: '#991b1b', melhor: 'menor' },
  custo_por_dia:       { nome: 'Custo por Dia-Paciente',  tipo: 'moeda',      cor: '#e34948', melhor: 'menor' },
  pct_prod_faturada:   { nome: '% Produção Faturada',     tipo: 'percentual', cor: '#0284c7', melhor: 'maior' }
};

// ═══════════════════════════════════════════════════════════════════
// DICIONÁRIO — o que cada número significa
// ═══════════════════════════════════════════════════════════════════
// Fica separado da tabela acima de propósito: aquela tabela vale por ser
// escaneável (nome, tipo, cor, direção numa linha), e a prosa a tornaria
// ilegível. Aqui: `desc` responde "o que é isso" e `formula` só existe
// para o que é DERIVADO — a fórmula está no montar() da fonte
// correspondente em geral/fontes.js, e é de lá que estes textos saem.
//
// Indicador sem verbete não quebra nada: o painel esconde a linha.
// Ao acrescentar indicador novo, acrescente o verbete junto — um número
// que a direção não sabe interpretar é pior que um número a menos.
const DESCRICOES = {
  // ── Financeiro / glosas (protocolo) ──────────────────────────
  valor_faturado: { desc: 'Total apresentado ao convênio nos protocolos do período. É o que o hospital cobrou, não o que entrou.' },
  valor_recebido: { desc: 'Parte do faturado que o convênio efetivamente liquidou no protocolo.' },
  valor_a_receber: { desc: 'O que ainda está em aberto: faturado menos o recebido e menos a glosa já aceita como perda.', formula: 'faturado − recebido − glosa aceita (mínimo zero)' },
  valor_glosado: { desc: 'Valor que o convênio recusou pagar, total ou parcialmente, ao analisar a cobrança.' },
  valor_glosa_aceita: { desc: 'Parte da glosa que o hospital aceitou como perda — não será mais recorrida.' },
  valor_reapresentado: { desc: 'Valor glosado que voltou a ser cobrado do convênio depois de recurso.' },
  valor_adicional: { desc: 'Valor pago pelo convênio acima do apresentado no protocolo.' },
  valor_retorno: { desc: 'Valor informado no demonstrativo de retorno do convênio para o protocolo.' },
  qtd_protocolos: { desc: 'Quantidade de protocolos de cobrança no período.' },
  pct_recebido: { desc: 'Quanto do que foi cobrado já entrou. É a leitura mais direta de eficácia do faturamento.', formula: 'recebido ÷ faturado × 100' },
  pct_glosado: { desc: 'Quanto do faturado o convênio recusou. Subir significa perder receita já produzida.', formula: 'glosado ÷ faturado × 100' },
  pct_glosa_aceita: { desc: 'Fatia do faturado que virou perda definitiva por glosa aceita.', formula: 'glosa aceita ÷ faturado × 100' },
  pct_adicional: { desc: 'Fatia do faturado recebida acima do cobrado.', formula: 'adicional ÷ faturado × 100' },
  ticket_protocolo: { desc: 'Valor médio cobrado por protocolo.', formula: 'faturado ÷ protocolos' },

  // ── Glosa item a item ────────────────────────────────────────
  valor_item: { desc: 'Valor dos itens cobrados, na granularidade de item da conta (não do protocolo).' },
  qtd_atend_glosa: { desc: 'Atendimentos distintos que tiveram algum item glosado. Não é somável entre grupos: o mesmo atendimento pode aparecer em mais de uma linha.' },
  glosa_por_atend: { desc: 'Glosa média por atendimento afetado.', formula: 'glosado ÷ atendimentos com glosa' },

  // ── Produção médica ──────────────────────────────────────────
  qtd_atendimentos: { desc: 'Atendimentos distintos no recorte.' },
  qtd_procedimentos: { desc: 'Procedimentos realizados e lançados na conta.' },
  valor_produzido: { desc: 'Valor dos procedimentos produzidos. É produção, não faturamento: nem tudo o que é produzido chega a ser cobrado.' },
  valor_medico: { desc: 'Parte da produção destinada ao repasse do profissional.' },
  ticket_atendimento: { desc: 'Produção média por atendimento.', formula: 'produzido ÷ atendimentos' },
  valor_medio_proc: { desc: 'Valor médio de cada procedimento produzido.', formula: 'produzido ÷ procedimentos' },
  proc_por_atend: { desc: 'Intensidade assistencial: quantos procedimentos, em média, cada atendimento consumiu.', formula: 'procedimentos ÷ atendimentos' },
  pct_repasse: { desc: 'Fatia da produção que vai para o profissional.', formula: 'repasse ÷ produzido × 100' },

  // ── Contas / faturamento ─────────────────────────────────────
  qtd_contas: { desc: 'Contas de paciente fechadas no período.' },
  dias_permanencia: { desc: 'Soma dos dias faturados nas contas — não é a permanência clínica, é a que entrou na cobrança.' },
  media_permanencia: { desc: 'Dias faturados por conta, em média.', formula: 'dias faturados ÷ contas' },
  valor_contas: { desc: 'Valor total das contas do período.' },
  ticket_conta: { desc: 'Valor médio por conta.', formula: 'valor das contas ÷ contas' },

  // ── Farmácia / prescrição ────────────────────────────────────
  qtd_prescricoes: { desc: 'Itens de medicamento e material prescritos.' },
  qtd_pacientes: { desc: 'Pacientes distintos no recorte. Não é somável entre grupos.' },
  qtd_materiais: { desc: 'Quantos materiais diferentes apareceram no recorte.' },
  itens_por_paciente: { desc: 'Média de itens prescritos por paciente.', formula: 'itens prescritos ÷ pacientes' },

  // ── Atendimentos e desfechos ─────────────────────────────────
  qtd_internacoes: { desc: 'Atendimentos do tipo internação.' },
  qtd_altas: { desc: 'Atendimentos com alta registrada no período.' },
  qtd_obitos: { desc: 'Atendimentos encerrados por óbito.' },
  taxa_obito: { desc: 'Óbitos sobre o total de saídas. Depende do registro de alta estar preenchido.', formula: 'óbitos ÷ altas × 100' },
  qtd_urgencia: { desc: 'Atendimentos classificados como urgência/emergência.' },
  taxa_urgencia: { desc: 'Fatia dos atendimentos que entrou pela urgência.', formula: 'urgências ÷ atendimentos × 100' },
  permanencia_media: { desc: 'Tempo médio entre entrada e alta, em dias.', formula: 'soma dos dias ÷ altas' },
  permanencia_intern: { desc: 'Tempo médio de estadia considerando só as internações com alta.', formula: 'dias de internação ÷ internações com alta' },
  idade_media: { desc: 'Idade média dos pacientes atendidos no recorte.' },
  atend_por_paciente: { desc: 'Quantas vezes o mesmo paciente voltou, em média. Subir pode indicar reinternação.', formula: 'atendimentos ÷ pacientes' },

  // ── Ocupação / leitos ────────────────────────────────────────
  qtd_passagens: { desc: 'Passagens de paciente pela unidade — o mesmo atendimento pode passar por várias.' },
  dias_ocupacao: { desc: 'Dias-leito ocupados, somando o tempo de cada passagem.' },
  permanencia_unidade: { desc: 'Tempo médio de permanência nas passagens já encerradas.', formula: 'dias de ocupação ÷ passagens encerradas' },
  qtd_em_aberto: { desc: 'Passagens ainda sem saída registrada — pacientes na unidade ou registro pendente.' },

  // ── Custo assistencial (materiais consumidos) ────────────────
  valor_material: { desc: 'Custo dos materiais e medicamentos efetivamente consumidos no atendimento.' },
  qtd_itens_material: { desc: 'Lançamentos de consumo de material.' },
  qtd_unidades: { desc: 'Quantidade física consumida (unidades, ampolas, frascos).' },
  custo_por_atend: { desc: 'Custo de material por atendimento.', formula: 'custo de material ÷ atendimentos' },
  custo_medio_item: { desc: 'Custo médio de cada lançamento de material.', formula: 'custo de material ÷ itens consumidos' },

  // ── Compras / notas fiscais ──────────────────────────────────
  valor_compras: { desc: 'Valor total das notas fiscais de entrada. Conta só a situação 1: a mesma nota se repete nas situações 2 e 3 e dobraria a despesa.' },
  valor_mercadoria: { desc: 'Valor das mercadorias na nota, antes de frete, impostos e descontos.' },
  valor_frete: { desc: 'Frete cobrado nas notas de entrada.' },
  valor_descontos: { desc: 'Descontos obtidos junto ao fornecedor.' },
  valor_ipi: { desc: 'IPI destacado nas notas de entrada.' },
  qtd_notas: { desc: 'Notas fiscais de entrada no período.' },
  ticket_nota: { desc: 'Valor médio por nota.', formula: 'valor das compras ÷ notas' },

  // ── Recebimentos (caixa) ─────────────────────────────────────
  valor_recebimento: { desc: 'Dinheiro que entrou em caixa no período. Diferente de "valor recebido" do protocolo, que é liquidação de cobrança.' },
  qtd_recebimentos: { desc: 'Lançamentos de recebimento.' },
  despesa_bancaria: { desc: 'Custo bancário descontado dos recebimentos.' },
  ticket_recebimento: { desc: 'Valor médio por recebimento.', formula: 'recebido em caixa ÷ recebimentos' },

  // ── Manutenção / ordens de serviço ───────────────────────────
  qtd_os: { desc: 'Ordens de serviço abertas no período.' },
  qtd_os_concluidas: { desc: 'Ordens de serviço com conclusão registrada.' },
  qtd_os_abertas: { desc: 'Ordens ainda sem conclusão.' },
  taxa_conclusao_os: { desc: 'Fatia das ordens que foi concluída.', formula: 'OS concluídas ÷ OS × 100' },
  tempo_medio_os: { desc: 'Tempo médio entre abertura e conclusão, em horas, considerando só as que têm data de fim.', formula: 'horas acumuladas ÷ OS com data de fim' },

  // ── Retorno de convênio (demonstrativo de pagamento) ─────────
  valor_pago_retorno: { desc: 'O que o convênio declarou ter pago, item a item, no demonstrativo de retorno.' },
  valor_amenor: { desc: 'Valor pago abaixo do cobrado sem ser formalmente glosado.' },
  valor_guia_retorno: { desc: 'Valor das guias que constam no retorno.' },
  qtd_itens_retorno: { desc: 'Itens presentes no demonstrativo de retorno.' },
  qtd_contas_retorno: { desc: 'Contas distintas citadas no retorno.' },
  pct_glosa_retorno: { desc: 'Glosa reconhecida pelo próprio convênio no demonstrativo.', formula: 'glosado ÷ valor das guias × 100' },
  ticket_item_retorno: { desc: 'Valor médio pago por item.', formula: 'pago pelo convênio ÷ itens do retorno' },

  // ── Repasse médico (AIH) ─────────────────────────────────────
  valor_repasse_aih: { desc: 'Valor destinado ao repasse dos profissionais nos itens de AIH.' },
  qtd_itens_repasse: { desc: 'Itens de AIH com repasse calculado.' },
  qtd_aih_repasse: { desc: 'AIH distintas que geraram repasse.' },
  repasse_medio_item: { desc: 'Repasse médio por item.', formula: 'repasse ÷ itens de repasse' },
  repasse_por_aih: { desc: 'Repasse médio por AIH.', formula: 'repasse ÷ AIH com repasse' },

  // ── Guias de faturamento ─────────────────────────────────────
  qtd_guias: { desc: 'Guias emitidas no período.' },
  valor_guias: { desc: 'Valor total das guias.' },
  valor_guia_convenio: { desc: 'Parte da guia que cabe ao convênio (o restante é coparticipação/particular).' },
  ticket_guia: { desc: 'Valor médio por guia.', formula: 'valor das guias ÷ guias' },
  qtd_contas_guia: { desc: 'Contas distintas com guia emitida.' },
  guias_por_conta: { desc: 'Quantas guias, em média, cada conta precisou. Subir costuma indicar retrabalho de faturamento.', formula: 'guias ÷ contas com guia' },

  // ── Contabilidade (lotes contábeis) ──────────────────────────
  valor_debito: { desc: 'Soma dos lançamentos a débito nos lotes contábeis.' },
  valor_credito: { desc: 'Soma dos lançamentos a crédito nos lotes contábeis.' },
  saldo_contabil: { desc: 'Diferença entre crédito e débito no recorte.', formula: 'crédito − débito' },
  qtd_lotes: { desc: 'Lotes contábeis do período.' },

  // ── Protocolos enviados ao convênio ──────────────────────────
  qtd_protocolos_conv: { desc: 'Protocolos abertos junto ao convênio.' },
  qtd_prot_fechados: { desc: 'Protocolos já encerrados.' },
  pct_prot_fechado: { desc: 'Fatia dos protocolos já encerrados.', formula: 'protocolos fechados ÷ protocolos × 100' },
  qtd_prot_abertos: { desc: 'Protocolos ainda pendentes de encerramento.' },
  qtd_prot_vencidos: { desc: 'Protocolos em aberto que já passaram do vencimento — é aqui que a receita costuma envelhecer.' },
  qtd_prot_com_venc: { desc: 'Protocolos com data de vencimento preenchida (base do cálculo de vencidos).' },

  // ── SUS · AIH (internação) ───────────────────────────────────
  qtd_aih: { desc: 'AIH (Autorização de Internação Hospitalar) emitidas no período.' },
  valor_aih: { desc: 'Valor de serviços profissionais nas AIH.' },
  ticket_aih: { desc: 'Valor médio por AIH.', formula: 'valor SUS ÷ AIH emitidas' },
  dias_perm_sus: { desc: 'Dias de permanência informados nas AIH.' },
  perm_media_aih: { desc: 'Permanência média nas AIH que têm o campo preenchido — atenção: o preenchimento é baixo nesta base.', formula: 'dias de permanência ÷ AIH com permanência informada' },
  qtd_aih_com_perm: { desc: 'AIH com permanência informada. Serve para saber sobre quantas linhas a permanência média foi calculada.' },
  qtd_obitos_sus: { desc: 'AIH encerradas por óbito.' },
  taxa_obito_sus: { desc: 'Óbitos sobre o total de saídas registradas nas AIH.', formula: 'óbitos ÷ saídas × 100' },
  qtd_altas_sus: { desc: 'AIH encerradas por alta.' },
  qtd_transf_sus: { desc: 'AIH encerradas por transferência para outro serviço.' },
  qtd_nasc_vivos: { desc: 'Nascidos vivos informados nas AIH.' },
  qtd_nasc_mortos: { desc: 'Nascidos mortos informados nas AIH.' },
  qtd_longa_perm: { desc: 'AIH sinalizadas como de longa permanência.' },
  qtd_atend_aih: { desc: 'Atendimentos distintos ligados a alguma AIH.' },

  // ── SUS · APAC ───────────────────────────────────────────────
  qtd_apac: { desc: 'APAC (autorizações de procedimento de alta complexidade) no período.' },
  qtd_atend_apac: { desc: 'Pacientes distintos com APAC.' },
  qtd_proc_apac: { desc: 'Procedimentos diferentes autorizados em APAC.' },
  meses_autorizados: { desc: 'Meses de competência cobertos pelas autorizações.' },
  apac_por_paciente: { desc: 'Média de APAC por paciente — indica tratamento continuado.', formula: 'APAC ÷ pacientes em APAC' },

  // ── SUS · Laudos e autorizações ──────────────────────────────
  qtd_laudos_sus: { desc: 'Laudos SUS registrados.' },
  qtd_proc_solic: { desc: 'Procedimentos solicitados nos laudos.' },
  qtd_atend_laudo: { desc: 'Atendimentos distintos com laudo.' },
  proc_por_laudo: { desc: 'Procedimentos por laudo, em média.', formula: 'procedimentos solicitados ÷ laudos SUS' },
  qtd_laudos: { desc: 'Laudos emitidos no recorte.' },
  laudos_por_atend: { desc: 'Laudos por atendimento, em média.', formula: 'laudos ÷ atendimentos com laudo' },

  // ── Exames e procedimentos prescritos (CPOE) ─────────────────
  qtd_exames_presc: { desc: 'Exames e procedimentos prescritos eletronicamente.' },
  qtd_unid_exame: { desc: 'Quantidade solicitada somada (um item pode pedir várias unidades).' },
  qtd_atend_exame: { desc: 'Pacientes distintos com exame prescrito.' },
  qtd_exames_susp: { desc: 'Exames prescritos e depois suspensos.' },
  taxa_susp_exame: { desc: 'Fatia dos exames prescritos que acabou suspensa.', formula: 'exames suspensos ÷ exames prescritos × 100' },
  exames_por_atend: { desc: 'Exames por paciente, em média.', formula: 'exames prescritos ÷ pacientes' },

  // ── Nutrição ─────────────────────────────────────────────────
  qtd_dietas: { desc: 'Dietas prescritas no período.' },
  qtd_atend_dieta: { desc: 'Pacientes distintos com dieta prescrita.' },
  qtd_dieta_enteral: { desc: 'Dietas por via enteral.' },
  qtd_dietas_susp: { desc: 'Dietas prescritas e depois suspensas.' },
  taxa_susp_dieta: { desc: 'Fatia das dietas que acabou suspensa.', formula: 'dietas suspensas ÷ dietas × 100' },
  dietas_por_atend: { desc: 'Dietas por paciente, em média.', formula: 'dietas ÷ pacientes em dieta' },

  // ── Prescrição médica (base legado) ──────────────────────────
  qtd_presc_med: { desc: 'Prescrições médicas registradas na base legado.' },
  qtd_atend_presc: { desc: 'Pacientes distintos com prescrição.' },
  qtd_presc_susp: { desc: 'Prescrições suspensas.' },
  taxa_susp_presc: { desc: 'Fatia das prescrições que acabou suspensa.', formula: 'prescrições suspensas ÷ prescrições × 100' },
  qtd_prescritores: { desc: 'Profissionais distintos que prescreveram.' },
  presc_por_atend: { desc: 'Prescrições por paciente, em média.', formula: 'prescrições ÷ pacientes prescritos' },

  // ── Indicadores que cruzam duas fontes ───────────────────────
  // As duas tabelas são consultadas separadamente e casadas pelo rótulo:
  // um rótulo que só existe de um lado entra com zero do outro, e os
  // períodos não são o mesmo evento. Por isso os percentuais aqui podem
  // passar de 100% — leia como ordem de grandeza, não como número exato.
  margem_assistencial: { desc: 'O que sobra da produção depois do custo de material. Não é margem contábil: não entra pessoal, estrutura nem serviço de terceiros.', formula: 'produzido − custo de material' },
  pct_margem_assist: { desc: 'Margem assistencial como fatia da produção.', formula: '(produzido − material) ÷ produzido × 100' },
  custo_sobre_prod: { desc: 'Quanto de material foi consumido por real produzido.', formula: 'custo de material ÷ produzido × 100' },
  pct_conversao_caixa: { desc: 'Quanto do que foi faturado virou dinheiro em caixa no mesmo recorte.', formula: 'recebido em caixa ÷ faturado × 100' },
  glosa_sobre_caixa: { desc: 'Tamanho da glosa em relação ao que entrou em caixa.', formula: 'glosado ÷ recebido em caixa × 100' },
  custo_por_intern: { desc: 'Custo de material por internação.', formula: 'custo de material ÷ internações' },
  custo_por_dia: { desc: 'Custo de material por dia-paciente — a leitura mais comparável entre unidades de porte diferente.', formula: 'custo de material ÷ dias (permanência ou ocupação)' },
  pct_prod_faturada: { desc: 'Quanto da produção chegou a virar conta. O que falta aqui é produção que não foi cobrada.', formula: 'valor das contas ÷ produzido × 100' }
};

Object.keys(DESCRICOES).forEach(function (chave) {
  if (INDICADORES[chave]) Object.assign(INDICADORES[chave], DESCRICOES[chave]);
});

function formatarMoeda(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
}
function formatarInteiro(v) { return Math.round(v || 0).toLocaleString('pt-BR'); }
function formatarDecimal(v) {
  return (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}
function formatarPercentual(v) { return formatarDecimal(v) + '%'; }
function formatarDias(v) { return formatarDecimal(v) + ' d'; }
function formatarHoras(v) { return formatarDecimal(v) + ' h'; }

const FORMATADORES = {
  moeda: formatarMoeda,
  inteiro: formatarInteiro,
  decimal: formatarDecimal,
  percentual: formatarPercentual,
  dias: formatarDias,
  horas: formatarHoras
};

function formatarValor(chave, valor) {
  const cfg = INDICADORES[chave];
  if (!cfg) return String(valor);
  return (FORMATADORES[cfg.tipo] || formatarDecimal)(valor);
}

// NÃO acrescente `desc` aqui. metaIndicador é chamado uma vez por
// indicador POR DIMENSÃO ao montar o catálogo (~950 vezes): as descrições
// repetidas somariam mais de 100 KB a um payload que já passa de 200 KB.
// O front recebe as descrições uma única vez, no mapa plano abaixo.
function metaIndicador(chave) {
  const cfg = INDICADORES[chave];
  return { chave: chave, nome: cfg.nome, tipo: cfg.tipo, cor: cfg.cor, melhor: cfg.melhor };
}

// Mapa plano chave → verbete, publicado uma vez em GET /catalogo.
function dicionarioIndicadores() {
  const out = {};
  Object.keys(INDICADORES).forEach(function (chave) {
    const cfg = INDICADORES[chave];
    out[chave] = {
      nome: cfg.nome, tipo: cfg.tipo, melhor: cfg.melhor,
      desc: cfg.desc || '', formula: cfg.formula || ''
    };
  });
  return out;
}

module.exports = { INDICADORES, formatarValor, metaIndicador, dicionarioIndicadores };
