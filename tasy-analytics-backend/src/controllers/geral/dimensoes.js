const { FONTES, ESTABELECIMENTO, ehComposta } = require('./fontes');
const { metaIndicador, INDICADORES } = require('./indicadores');
const { extrairFontesSql, extrairCamposSql } = require('../../utils/extrairFontes');

// ═══════════════════════════════════════════════════════════════════
// PAINEL GERAL — DIMENSÕES
// ═══════════════════════════════════════════════════════════════════
// Cada dimensão é só um rótulo + joins sobre uma fonte. Não há query
// escrita aqui: construirQuery() em consulta.js monta o SQL.
//
//   fonte      chave em FONTES — define os indicadores disponíveis
//   label      expressão SQL do rótulo (também usada no GROUP BY,
//              no drill-down e no filtro por item)
//   joins      joins exigidos pelo rótulo (os das métricas ficam na fonte)
//   filtro     recorte extra (ex.: só cirurgias) — começa com AND
//   anoInteiro dimensão de evolução: ignora o mês do filtro
//   ordemLabel ordena pelo rótulo em vez do indicador (séries temporais)
//   topSql     corta o top N no banco (cardinalidade alta)

// ── Joins reaproveitados ──────────────────────────────────────────
  // ods.procedimento tem chave composta (cd_procedimento, ie_origem_proced):
  // 26.464 linhas para 21.940 códigos distintos. Juntar só por
  // cd_procedimento MULTIPLICA as linhas de produção e infla os valores
  // (medido em 2025: R$ 110,0 mi em vez de R$ 93,7 mi, +17,4%).
  // As duas colunas são obrigatórias neste join.
const J = {
  convenioPP: 'LEFT JOIN ods.convenio c ON pp.cd_convenio = c.cd_convenio',
  setorPP: 'LEFT JOIN ods.setor_atendimento se ON pp.cd_setor_atendimento = se.cd_setor_atendimento',
  medicoPP: 'LEFT JOIN ods.pessoa_fisica pf ON pp.cd_medico = pf.cd_pessoa_fisica',
  procPP: 'LEFT JOIN ods.procedimento p ON pp.cd_procedimento = p.cd_procedimento AND pp.ie_origem_proced = p.ie_origem_proced',
  medicoAP: 'LEFT JOIN ods.pessoa_fisica pfm ON pfm.cd_pessoa_fisica = ap.cd_medico_resp',
  setorAPU: 'LEFT JOIN ods.setor_atendimento seu ON seu.cd_setor_atendimento = apu.cd_setor_atendimento',
  setorMAP: 'LEFT JOIN ods.setor_atendimento sem ON sem.cd_setor_atendimento = map.cd_setor_atendimento',
  materialMAP: 'LEFT JOIN ods.material mm ON mm.cd_material = map.cd_material',
  convenioMAP: 'LEFT JOIN ods.convenio cm2 ON cm2.cd_convenio = map.cd_convenio',
  fornecedorNF: 'LEFT JOIN ods.pessoa_juridica pj ON pj.cd_cgc = nf.cd_cgc_emitente',
  convenioCVR: 'LEFT JOIN ods.convenio ccv ON ccv.cd_convenio = cvr.cd_convenio',
  setorMOS: 'LEFT JOIN ods.setor_atendimento sos ON sos.cd_setor_atendimento = mos.cd_setor_atendimento',
  localMOS: 'LEFT JOIN ods.man_localizacao ml ON ml.nr_sequencia = mos.nr_seq_localizacao',
  equipMOS: 'LEFT JOIN ods.man_equipamento me ON me.nr_sequencia = mos.nr_seq_equipamento',

  // Convênio/plano do atendimento. ods.atendimento_paciente NÃO guarda
  // convênio — ele vive em atend_categoria_convenio, que é o histórico de
  // vigência do plano naquele atendimento. Medido: 845.897 linhas para
  // 845.464 atendimentos (máx. 6 por atendimento), ou seja 0,05% de
  // duplicação — aceitável para um LEFT JOIN direto, e o alternativa
  // (DISTINCT ON por atendimento) custaria uma varredura extra.
  catConvAP: `LEFT JOIN ods.atend_categoria_convenio acc ON acc.nr_atendimento = ap.nr_atendimento
      LEFT JOIN ods.convenio cac ON cac.cd_convenio = acc.cd_convenio`,
  catPlanoAP: `LEFT JOIN ods.atend_categoria_convenio acc2 ON acc2.nr_atendimento = ap.nr_atendimento
      LEFT JOIN ods.categoria_convenio ccc ON ccc.cd_convenio = acc2.cd_convenio
        AND ccc.cd_categoria = acc2.cd_categoria`,
  medicoVincPP: 'LEFT JOIN ods.medico md ON md.cd_pessoa_fisica = pp.cd_medico',
  materialCM: 'LEFT JOIN ods.material m ON cm.cd_material = m.cd_material',

  // Retorno de convênio: o item não tem convênio nem data de referência
  // próprios — os dois vêm do cabeçalho do retorno.
  retornoCRI: 'LEFT JOIN ods.convenio_retorno crr ON crr.nr_sequencia = cri.nr_seq_retorno',
  convenioCRI: `LEFT JOIN ods.convenio_retorno crr ON crr.nr_sequencia = cri.nr_seq_retorno
      LEFT JOIN ods.convenio ccr ON ccr.cd_convenio = crr.cd_convenio`,

  convenioPC: 'LEFT JOIN ods.convenio cpv ON cpv.cd_convenio = pc.cd_convenio',
  setorPC: 'LEFT JOIN ods.setor_atendimento spc ON spc.cd_setor_atendimento = pc.cd_setor_atendimento',

  // AIH/APAC: procedimento tem chave composta — as duas colunas são
  // obrigatórias, igual em procedimento_paciente (ver nota acima).
  procSA: `LEFT JOIN ods.procedimento psa ON psa.cd_procedimento = sa.cd_procedimento_real
      AND psa.ie_origem_proced = sa.ie_origem_proc_real`,
  medicoSA: 'LEFT JOIN ods.pessoa_fisica pfa ON pfa.cd_pessoa_fisica = sa.cd_medico_responsavel',
  procSAP: `LEFT JOIN ods.procedimento pps ON pps.cd_procedimento = sap.cd_procedimento
      AND pps.ie_origem_proced = sap.ie_origem_proced`,
  procSLP: `LEFT JOIN ods.procedimento pls ON pls.cd_procedimento = slp.cd_procedimento_solic
      AND pls.ie_origem_proced = slp.ie_origem_proced`,

  setorCPP: 'LEFT JOIN ods.setor_atendimento scp ON scp.cd_setor_atendimento = cpp.cd_setor_atendimento',
  medicoCPP: 'LEFT JOIN ods.pessoa_fisica pcp ON pcp.cd_pessoa_fisica = cpp.cd_medico',
  procIntCPP: 'LEFT JOIN ods.proc_interno pic ON pic.nr_sequencia = cpp.nr_seq_proc_interno',
  setorCDI: 'LEFT JOIN ods.setor_atendimento sdi ON sdi.cd_setor_atendimento = cdi.cd_setor_atendimento',
  medicoCDI: 'LEFT JOIN ods.pessoa_fisica pdi ON pdi.cd_pessoa_fisica = cdi.cd_medico',
  materialCDI: 'LEFT JOIN ods.material mdi ON mdi.cd_material = cdi.cd_material',
  setorPM: 'LEFT JOIN ods.setor_atendimento spm ON spm.cd_setor_atendimento = pm.cd_setor_atendimento',
  medicoPM: 'LEFT JOIN ods.pessoa_fisica ppm ON ppm.cd_pessoa_fisica = pm.cd_prescritor'
};

const FILTRO_CIRURGICO = `AND pp.ie_tiss_tipo_guia = '7'`;
const FILTRO_FISIO = `AND p.ds_procedimento ILIKE '%fisio%'`;

// ── Rótulos derivados de códigos sem tabela de domínio no ODS ─────
// O ODS não replica as tabelas de domínio do Tasy, então estes nomes
// foram INFERIDOS do próprio dado (volume + duração média em 2025):
//   1 = 89h de média e ligado às clínicas de internação
//   3 = 6,9h, quase tudo na clínica do PS
//   7 = 34,7h, concentrado numa clínica de apoio diagnóstico
//   8 = 12,4h, o maior volume, perfil ambulatorial
// O código fica visível no rótulo de propósito: se a direção
// identificar outro significado, é só corrigir o CASE aqui.
const LABEL_TIPO_ATENDIMENTO = `CASE ap.ie_tipo_atendimento
    WHEN 1 THEN 'Internação (1)'
    WHEN 3 THEN 'Pronto Socorro (3)'
    WHEN 7 THEN 'Exames (7)'
    WHEN 8 THEN 'Ambulatório / Consulta (8)'
    WHEN 88 THEN 'Permanência longa (88)'
    ELSE 'Tipo ' || COALESCE(CAST(ap.ie_tipo_atendimento AS TEXT), 'não informado')
  END`;

// ie_carater_inter_sus segue a tabela do SUS (01 eletivo, 02 urgência).
const LABEL_CARATER = `CASE ap.ie_carater_inter_sus
    WHEN '01' THEN 'Eletivo'
    WHEN '02' THEN 'Urgência / Emergência'
    ELSE 'Não Informado'
  END`;

const LABEL_DESFECHO = `CASE
    WHEN ap.dt_alta IS NULL THEN 'Em andamento'
    WHEN ma.ie_obito = 'S' THEN 'Óbito'
    WHEN ma.ie_transferencia = 'S' THEN 'Transferência'
    WHEN ma.ie_evasao = 'S' THEN 'Evasão'
    WHEN ma.cd_motivo_alta IS NULL THEN 'Alta sem motivo registrado'
    ELSE 'Alta'
  END`;

const LABEL_FAIXA_ETARIA = `CASE
    WHEN pfp.dt_nascimento IS NULL THEN 'Não Informado'
    WHEN AGE(ap.dt_entrada, pfp.dt_nascimento) < INTERVAL '1 year'   THEN 'Menor de 1 ano'
    WHEN AGE(ap.dt_entrada, pfp.dt_nascimento) < INTERVAL '12 years' THEN '1 a 11 anos'
    WHEN AGE(ap.dt_entrada, pfp.dt_nascimento) < INTERVAL '18 years' THEN '12 a 17 anos'
    WHEN AGE(ap.dt_entrada, pfp.dt_nascimento) < INTERVAL '30 years' THEN '18 a 29 anos'
    WHEN AGE(ap.dt_entrada, pfp.dt_nascimento) < INTERVAL '45 years' THEN '30 a 44 anos'
    WHEN AGE(ap.dt_entrada, pfp.dt_nascimento) < INTERVAL '60 years' THEN '45 a 59 anos'
    WHEN AGE(ap.dt_entrada, pfp.dt_nascimento) < INTERVAL '75 years' THEN '60 a 74 anos'
    ELSE '75 anos ou mais'
  END`;

// Dimensões categóricas cuja ordem natural não é alfabética nem por
// valor: a leitura só faz sentido na sequência abaixo.
const ORDEM_FAIXA_ETARIA = ['Menor de 1 ano', '1 a 11 anos', '12 a 17 anos', '18 a 29 anos',
  '30 a 44 anos', '45 a 59 anos', '60 a 74 anos', '75 anos ou mais', 'Não Informado'];
const ORDEM_PRIORIDADE = ['Alta', 'Média', 'Baixa', 'Não Informada'];
const ORDEM_STATUS_OS = ['Pendente', 'Em execução', 'Encerrada'];

const LABEL_SEXO = `CASE pfp.ie_sexo
    WHEN 'F' THEN 'Feminino' WHEN 'M' THEN 'Masculino' ELSE 'Não Informado' END`;

const LABEL_STATUS_OS = `CASE mos.ie_status_ordem
    WHEN '1' THEN 'Pendente' WHEN '2' THEN 'Em execução' WHEN '3' THEN 'Encerrada'
    ELSE 'Status ' || COALESCE(mos.ie_status_ordem, 'não informado') END`;

const LABEL_PRIORIDADE_OS = `CASE mos.ie_prioridade
    WHEN 'A' THEN 'Alta' WHEN 'M' THEN 'Média' WHEN 'B' THEN 'Baixa'
    ELSE 'Não Informada' END`;

const LABEL_TIPO_NOTA = `CASE nf.ie_tipo_nota
    WHEN 'EN' THEN 'Entrada' WHEN 'ST' THEN 'Saída / Transferência'
    WHEN 'SE' THEN 'Serviço' WHEN 'SF' THEN 'Saída de Fatura' WHEN 'NC' THEN 'Nota de Crédito'
    ELSE COALESCE(nf.ie_tipo_nota, 'Não Informado') END`;

// ── Rótulos das tabelas de domínio do SUS ─────────────────────────
// O ODS não replica nenhuma tabela de domínio, então estes CASE seguem
// as tabelas oficiais do SUS (ie_clinica, especialidade da AIH,
// complexidade, tipo de financiamento). O código fica visível no rótulo
// de propósito: se a direção identificar outro significado, corrige-se
// o CASE aqui — mesmo padrão de LABEL_TIPO_ATENDIMENTO.
const LABEL_CLINICA = `CASE ap.ie_clinica
    WHEN 1 THEN 'Médica (1)'
    WHEN 2 THEN 'Cirúrgica (2)'
    WHEN 3 THEN 'Obstétrica (3)'
    WHEN 4 THEN 'Pediátrica (4)'
    WHEN 5 THEN 'Psiquiátrica (5)'
    WHEN 6 THEN 'Pneumologia sanitária (6)'
    WHEN 7 THEN 'Reabilitação (7)'
    WHEN 8 THEN 'Hospital-dia (8)'
    WHEN 9 THEN 'Crônicos (9)'
    ELSE 'Clínica ' || COALESCE(CAST(ap.ie_clinica AS TEXT), 'não informada')
  END`;

const LABEL_TIPO_CONVENIO = `CASE ap.ie_tipo_convenio
    WHEN 1 THEN 'Particular (1)'
    WHEN 2 THEN 'Convênio / Plano de Saúde (2)'
    WHEN 3 THEN 'SUS (3)'
    ELSE 'Tipo ' || COALESCE(CAST(ap.ie_tipo_convenio AS TEXT), 'não informado')
  END`;

const LABEL_PROCEDENCIA = `'Procedência ' || COALESCE(CAST(ap.cd_procedencia AS TEXT), 'não informada')`;

const COMPLEXIDADE = (coluna) => `CASE ${coluna}
    WHEN 'AC' THEN 'Alta Complexidade'
    WHEN 'MC' THEN 'Média Complexidade'
    WHEN 'AB' THEN 'Atenção Básica'
    WHEN 'N'  THEN 'Não se aplica'
    ELSE COALESCE(${coluna}, 'Não Informado')
  END`;

const FINANCIAMENTO = (coluna) => `CASE ${coluna}
    WHEN '01' THEN 'Atenção Básica (PAB)'
    WHEN '02' THEN 'Assistência Farmacêutica'
    WHEN '04' THEN 'FAEC'
    WHEN '05' THEN 'Incentivo MAC'
    WHEN '06' THEN 'Média e Alta Complexidade (MAC)'
    WHEN '07' THEN 'Vigilância em Saúde'
    ELSE 'Financiamento ' || COALESCE(${coluna}, 'não informado')
  END`;

const LABEL_ESPEC_AIH = `CASE sa.cd_especialidade_aih
    WHEN 1 THEN 'Cirurgia (1)'
    WHEN 2 THEN 'Obstetrícia (2)'
    WHEN 3 THEN 'Clínica Médica (3)'
    WHEN 4 THEN 'Crônicos (4)'
    WHEN 5 THEN 'Psiquiatria (5)'
    WHEN 6 THEN 'Pneumologia sanitária (6)'
    WHEN 7 THEN 'Pediatria (7)'
    WHEN 8 THEN 'Reabilitação (8)'
    WHEN 9 THEN 'Hospital-dia (9)'
    ELSE 'Especialidade ' || COALESCE(CAST(sa.cd_especialidade_aih AS TEXT), 'não informada')
  END`;

const CARATER_SUS = (coluna) => `CASE ${coluna}
    WHEN '01' THEN 'Eletivo' WHEN '02' THEN 'Urgência / Emergência'
    WHEN '1' THEN 'Eletivo'  WHEN '2' THEN 'Urgência / Emergência'
    ELSE 'Não Informado'
  END`;

const LABEL_TIPO_APAC = `CASE CAST(sap.ie_tipo_apac AS TEXT)
    WHEN '1' THEN 'Inicial (1)' WHEN '2' THEN 'Continuidade (2)' WHEN '3' THEN 'Única (3)'
    ELSE 'Tipo ' || COALESCE(CAST(sap.ie_tipo_apac AS TEXT), 'não informado')
  END`;

// ── Capítulo da CID-10 ────────────────────────────────────────────
// A CID chega só como código (o ODS não replica a tabela de doenças).
// Listar 1.407 códigos não é leitura de direção — agrupar nos 21
// capítulos da CID-10 é. O código completo continua disponível na
// dimensão "CID (código)" ao lado.
const CAPITULO_CID = (coluna) => {
  const c = `UPPER(TRIM(${coluna}))`;
  const n = `SUBSTRING(${c}, 2, 2)`;
  return `CASE
    WHEN ${coluna} IS NULL OR TRIM(${coluna}) = '' THEN 'Não Informado'
    WHEN LEFT(${c}, 1) IN ('A','B') THEN 'I · Infecciosas e parasitárias'
    WHEN LEFT(${c}, 1) = 'C' THEN 'II · Neoplasias'
    WHEN LEFT(${c}, 1) = 'D' AND ${n} ~ '^[0-9]{2}$' AND ${n}::int <= 48 THEN 'II · Neoplasias'
    WHEN LEFT(${c}, 1) = 'D' THEN 'III · Sangue e imunidade'
    WHEN LEFT(${c}, 1) = 'E' THEN 'IV · Endócrinas, nutricionais e metabólicas'
    WHEN LEFT(${c}, 1) = 'F' THEN 'V · Transtornos mentais e comportamentais'
    WHEN LEFT(${c}, 1) = 'G' THEN 'VI · Sistema nervoso'
    WHEN LEFT(${c}, 1) = 'H' AND ${n} ~ '^[0-9]{2}$' AND ${n}::int <= 59 THEN 'VII · Olho e anexos'
    WHEN LEFT(${c}, 1) = 'H' THEN 'VIII · Ouvido e apófise mastoide'
    WHEN LEFT(${c}, 1) = 'I' THEN 'IX · Aparelho circulatório'
    WHEN LEFT(${c}, 1) = 'J' THEN 'X · Aparelho respiratório'
    WHEN LEFT(${c}, 1) = 'K' THEN 'XI · Aparelho digestivo'
    WHEN LEFT(${c}, 1) = 'L' THEN 'XII · Pele e tecido subcutâneo'
    WHEN LEFT(${c}, 1) = 'M' THEN 'XIII · Osteomuscular e conjuntivo'
    WHEN LEFT(${c}, 1) = 'N' THEN 'XIV · Aparelho genitourinário'
    WHEN LEFT(${c}, 1) = 'O' THEN 'XV · Gravidez, parto e puerpério'
    WHEN LEFT(${c}, 1) = 'P' THEN 'XVI · Período perinatal'
    WHEN LEFT(${c}, 1) = 'Q' THEN 'XVII · Malformações congênitas'
    WHEN LEFT(${c}, 1) = 'R' THEN 'XVIII · Sintomas e achados anormais'
    WHEN LEFT(${c}, 1) IN ('S','T') THEN 'XIX · Lesões e envenenamentos'
    WHEN LEFT(${c}, 1) IN ('V','W','X','Y') THEN 'XX · Causas externas'
    WHEN LEFT(${c}, 1) = 'Z' THEN 'XXI · Contato com serviços de saúde'
    ELSE 'Outros (' || LEFT(${c}, 1) || ')'
  END`;
};

// ── Rótulos de faturamento / guia ────────────────────────────────
const TIPO_GUIA = (coluna) => `CASE ${coluna}
    WHEN 'I' THEN 'Internação (I)'
    WHEN 'C' THEN 'Consulta (C)'
    WHEN 'E' THEN 'SP/SADT — exames e terapias (E)'
    WHEN 'A' THEN 'Honorário / Anexo (A)'
    ELSE 'Sem tipo informado'
  END`;

const LABEL_SITUACAO_GUIA = `CASE cpg.ie_situacao_guia
    WHEN 'E' THEN 'Emitida' WHEN 'P' THEN 'Pendente'
    ELSE 'Situação ' || COALESCE(cpg.ie_situacao_guia, 'não informada')
  END`;

// ie_status_protocolo, ie_tipo_apac e os ie_* dos laudos SUS são NUMERIC
// no ODS (não texto): sem o CAST explícito o COALESCE do ELSE estoura com
// "invalid input syntax for type numeric".
const LABEL_STATUS_PROTOCOLO = `CASE CAST(pc.ie_status_protocolo AS TEXT)
    WHEN '1' THEN 'Em digitação (1)' WHEN '2' THEN 'Fechado (2)' WHEN '3' THEN 'Enviado (3)'
    ELSE 'Status ' || COALESCE(CAST(pc.ie_status_protocolo AS TEXT), 'não informado')
  END`;

const LABEL_GLOSA_RETORNO = `CASE cri.ie_glosa
    WHEN 'S' THEN 'Com glosa' WHEN 'N' THEN 'Sem glosa'
    ELSE 'Não Informado'
  END`;

// ── Rótulos de produção / material / setor ───────────────────────
const LABEL_CARATER_CIRURGIA = `CASE pp.ie_carater_cirurgia
    WHEN 'E' THEN 'Eletiva' WHEN 'U' THEN 'Urgência'
    ELSE COALESCE('Caráter ' || pp.ie_carater_cirurgia, 'Não Informado')
  END`;

const LABEL_ALTA_COMPLEX_PROC = `CASE p.ie_alta_complexidade
    WHEN 'S' THEN 'Alta complexidade' WHEN 'N' THEN 'Não é alta complexidade'
    ELSE 'Não Informado'
  END`;

const LABEL_CURVA_ABC = (coluna) => `CASE ${coluna}
    WHEN 'S' THEN 'Curva ABC — controlado' WHEN 'N' THEN 'Fora da curva ABC'
    ELSE 'Não Informado'
  END`;

const LABEL_TIPO_MATERIAL = (coluna) => `CASE CAST(${coluna} AS TEXT)
    WHEN '1' THEN 'Medicamento (1)'
    WHEN '2' THEN 'Material (2)'
    WHEN '3' THEN 'Órtese / Prótese (3)'
    WHEN '4' THEN 'Diversos (4)'
    WHEN '5' THEN 'Nutrição (5)'
    WHEN '6' THEN 'Serviço (6)'
    WHEN '7' THEN 'Hemocomponente (7)'
    ELSE 'Tipo ' || COALESCE(CAST(${coluna} AS TEXT), 'não informado')
  END`;

const LABEL_PERFIL_UNIDADE = `CASE
    WHEN seu.ie_setor_neonatal = 'S'  THEN 'Neonatal'
    WHEN seu.ie_semi_intensiva = 'S'  THEN 'Semi-intensiva'
    WHEN seu.ie_setor_hemodialise = 'S' THEN 'Hemodiálise'
    WHEN seu.ie_trat_oncologico = 'S' THEN 'Oncologia'
    WHEN seu.ie_ocup_hospitalar = 'S' THEN 'Internação (leito hospitalar)'
    ELSE 'Apoio / Ambulatorial'
  END`;

const LABEL_LEITO = `COALESCE(NULLIF(TRIM(CAST(apu.cd_unidade_basica AS TEXT)), ''), '?') ||
    CASE WHEN NULLIF(TRIM(CAST(apu.cd_unidade_compl AS TEXT)), '') IS NULL THEN ''
         ELSE '-' || TRIM(CAST(apu.cd_unidade_compl AS TEXT)) END`;

const LABEL_VINCULO_MEDICO = `CASE
    WHEN md.cd_pessoa_fisica IS NULL THEN 'Sem cadastro de médico'
    WHEN md.ie_corpo_clinico = 'S' THEN 'Corpo clínico · vínculo ' || COALESCE(CAST(md.ie_vinculo_medico AS TEXT), '?')
    ELSE 'Fora do corpo clínico · vínculo ' || COALESCE(CAST(md.ie_vinculo_medico AS TEXT), '?')
  END`;

const ESPECIALIDADE = (coluna) => `'Especialidade ' || COALESCE(CAST(${coluna} AS TEXT), 'não informada')`;

const LABEL_TIPO_DIETA = `CASE cdi.ie_tipo_dieta
    WHEN 'O' THEN 'Oral' WHEN 'E' THEN 'Enteral' WHEN 'P' THEN 'Parenteral'
    WHEN 'J' THEN 'Jejum' WHEN 'S' THEN 'Suplemento' WHEN 'L' THEN 'Leite materno'
    ELSE 'Tipo ' || COALESCE(cdi.ie_tipo_dieta, 'não informado')
  END`;

const SIM_NAO = (coluna, sim, nao) => `CASE ${coluna}
    WHEN 'S' THEN '${sim}' ELSE '${nao}' END`;

// ═══════════════════════════════════════════════════════════════════
// ÁREAS — o primeiro nível de navegação (as abas do painel)
// ═══════════════════════════════════════════════════════════════════
// Com 20 grupos e ~140 dimensões, um accordion único deixa de ser
// navegável: a direção não sabe o nome da dimensão que quer, sabe o
// ASSUNTO. Cada área agrupa os seus grupos, os seus cartões de KPI
// (`area` em BLOCOS, no geralController) e as suas séries de evolução.
// A área 'resultado' é a única que usa fontes compostas.
const AREAS = [
  { id: 'geral', nome: 'Visão Geral', icone: '▣', cor: '#4a3aa7',
    descricao: 'O hospital em um retrato: os números que abrem a reunião' },
  { id: 'financeiro', nome: 'Financeiro', icone: '$', cor: '#2a78d6',
    descricao: 'Faturamento, glosa, retorno do convênio, caixa e contabilidade' },
  { id: 'assistencial', nome: 'Assistencial', icone: '◉', cor: '#0d9488',
    descricao: 'Atendimentos, ocupação, produção, cirurgia e diagnósticos' },
  { id: 'sus', nome: 'SUS', icone: '✚', cor: '#1baf7a',
    descricao: 'AIH, APAC, laudos e repasse médico do SUS' },
  { id: 'suprimentos', nome: 'Suprimentos & Custos', icone: '⛬', cor: '#991b1b',
    descricao: 'Material consumido, farmácia, exames pedidos, dietas e compras' },
  { id: 'apoio', nome: 'Apoio & Infra', icone: '⚙', cor: '#d97706',
    descricao: 'Manutenção e ordens de serviço' },
  { id: 'resultado', nome: 'Resultado', icone: '∆', cor: '#eb6834',
    descricao: 'Indicadores que cruzam duas fontes: margem, conversão em caixa e custo por internação' }
];

// ═══════════════════════════════════════════════════════════════════
// GRUPOS — ordem e identidade visual dentro de cada área
// ═══════════════════════════════════════════════════════════════════
const GRUPOS = [
  // ── Financeiro ──
  { nome: 'Financeiro', area: 'financeiro', icone: '$', cor: '#2a78d6', descricao: 'Faturamento, glosa e recebimento por convênio' },
  { nome: 'Retorno do Convênio', area: 'financeiro', icone: '⇋', cor: '#0284c7', descricao: 'Demonstrativo de pagamento: o que o convênio pagou de fato' },
  { nome: 'Glosas', area: 'financeiro', icone: '!', cor: '#e34948', descricao: 'Glosa item a item: motivo, setor e prescritor' },
  { nome: 'Recebimentos', area: 'financeiro', icone: '↓', cor: '#1baf7a', descricao: 'Entrada de caixa dos convênios' },
  { nome: 'Contas', area: 'financeiro', icone: '▦', cor: '#0284c7', descricao: 'Contas faturadas e dias faturados' },
  { nome: 'Guias', area: 'financeiro', icone: '▧', cor: '#4a3aa7', descricao: 'Guias por tipo e situação' },
  { nome: 'Protocolos', area: 'financeiro', icone: '⇥', cor: '#d97706', descricao: 'Envio ao convênio, prazo e vencimento' },
  { nome: 'Contabilidade', area: 'financeiro', icone: '∑', cor: '#6b7488', descricao: 'Lotes contábeis: débito, crédito e saldo' },

  // ── Assistencial ──
  { nome: 'Atendimentos', area: 'assistencial', icone: '◉', cor: '#4a3aa7', descricao: 'Volume, desfecho, óbito, convênio e perfil dos pacientes' },
  { nome: 'Ocupação', area: 'assistencial', icone: '▤', cor: '#0d9488', descricao: 'Passagens por unidade, leito, giro e permanência' },
  { nome: 'Produção', area: 'assistencial', icone: '▲', cor: '#eb6834', descricao: 'Procedimentos realizados, grupo, especialidade e repasse' },
  { nome: 'Centro Cirúrgico', area: 'assistencial', icone: '✚', cor: '#b3275f', descricao: 'Cirurgias, cirurgiões, porte e caráter' },
  { nome: 'Fisioterapia', area: 'assistencial', icone: '≈', cor: '#8b5cf6', descricao: 'Atendimentos de fisioterapia' },
  { nome: 'Diagnósticos', area: 'assistencial', icone: '⌖', cor: '#0284c7', descricao: 'Laudos e perfil de CID da casa' },

  // ── SUS ──
  { nome: 'SUS · AIH', area: 'sus', icone: '✚', cor: '#1baf7a', descricao: 'Internação SUS: valor, permanência, desfecho e CID' },
  { nome: 'SUS · APAC', area: 'sus', icone: '◍', cor: '#0d9488', descricao: 'Alta complexidade ambulatorial: oncologia, diálise, bariátrica' },
  { nome: 'SUS · Laudos', area: 'sus', icone: '✎', cor: '#4a3aa7', descricao: 'Laudos e autorizações solicitadas ao gestor' },
  { nome: 'Repasse Médico', area: 'sus', icone: '⇢', cor: '#eda100', descricao: 'Repasse por AIH: médico, procedimento e convênio' },

  // ── Suprimentos & Custos ──
  { nome: 'Custo Assistencial', area: 'suprimentos', icone: '◆', cor: '#991b1b', descricao: 'Material consumido no atendimento, por classe e curva ABC' },
  { nome: 'Farmácia', area: 'suprimentos', icone: '℞', cor: '#eda100', descricao: 'Prescrição de materiais e medicamentos (CPOE)' },
  { nome: 'Exames Pedidos', area: 'suprimentos', icone: '⌕', cor: '#2a78d6', descricao: 'Demanda de exames e procedimentos prescritos' },
  { nome: 'Prescrição Médica', area: 'suprimentos', icone: '✑', cor: '#8b5cf6', descricao: 'Prescrições da base legado: volume, suspensão e urgência' },
  { nome: 'Nutrição', area: 'suprimentos', icone: '◔', cor: '#0d9488', descricao: 'Dietas prescritas, enterais e suspensões' },
  { nome: 'Compras', area: 'suprimentos', icone: '⛬', cor: '#6b7488', descricao: 'Notas fiscais e fornecedores' },

  // ── Apoio & Infra ──
  { nome: 'Manutenção', area: 'apoio', icone: '⚙', cor: '#d97706', descricao: 'Ordens de serviço e tempo de atendimento' },

  // ── Resultado (fontes cruzadas) ──
  { nome: 'Resultado', area: 'resultado', icone: '∆', cor: '#eb6834', descricao: 'Margem, conversão em caixa, custo por internação e produção faturada' }
];

const DIMENSOES = {
  // ── Financeiro (protocolos de glosa) ──────────────────────────
  fin_convenio:          { nome: 'Convênio', grupo: 'Financeiro', fonte: 'glosa_protocolo', label: `COALESCE(gp.ds_convenio, 'Não Informado')` },
  fin_estabelecimento:   { nome: 'Estabelecimento', grupo: 'Financeiro', fonte: 'glosa_protocolo', label: `COALESCE(gp.ds_estabelecimento, 'Não Informado')` },
  fin_tipo_convenio:     { nome: 'Tipo de Convênio', grupo: 'Financeiro', fonte: 'glosa_protocolo', label: `COALESCE(gp.ds_tipo_convenio, 'Não Informado')` },
  fin_tipo_protocolo:    { nome: 'Tipo de Protocolo', grupo: 'Financeiro', fonte: 'glosa_protocolo', label: `COALESCE(gp.ds_tipo_protocolo, 'Não Informado')` },
  fin_mes:               { nome: 'Evolução Mensal', grupo: 'Financeiro', fonte: 'glosa_protocolo', label: `gp.ano_ref || '-' || gp.mes_ref`, anoInteiro: true, ordemLabel: true },

  // ── Recebimentos (caixa) ──────────────────────────────────────
  receb_convenio:        { nome: 'Convênio', grupo: 'Recebimentos', fonte: 'recebimento', label: `COALESCE(ccv.ds_convenio, 'Não Informado')`, joins: J.convenioCVR },
  receb_estabelecimento: { nome: 'Estabelecimento', grupo: 'Recebimentos', fonte: 'recebimento', label: ESTABELECIMENTO('cvr.cd_estabelecimento') },
  receb_mes:             { nome: 'Evolução Mensal', grupo: 'Recebimentos', fonte: 'recebimento', label: `TO_CHAR(cvr.dt_recebimento, 'YYYY-MM')`, anoInteiro: true, ordemLabel: true },

  // ── Glosas (item a item) ──────────────────────────────────────
  glosa_motivo:          { nome: 'Motivo da Glosa', grupo: 'Glosas', fonte: 'glosa_item', label: `COALESCE(gi.ds_motivo_glosa, 'Não Informado')`, topSql: 300 },
  glosa_setor:           { nome: 'Setor', grupo: 'Glosas', fonte: 'glosa_item', label: `COALESCE(gi.ds_setor_atendimento, 'Sem Setor')` },
  glosa_prescritor:      { nome: 'Prescritor', grupo: 'Glosas', fonte: 'glosa_item', label: `COALESCE(pfg.nm_pessoa_fisica, 'Não Informado')`, joins: 'LEFT JOIN ods.pessoa_fisica pfg ON pfg.cd_pessoa_fisica = gi.cd_medico_prescritor', topSql: 300 },
  glosa_mes:             { nome: 'Evolução Mensal', grupo: 'Glosas', fonte: 'glosa_item', label: `gi.ano_ref || '-' || gi.mes_ref`, anoInteiro: true, ordemLabel: true },

  // ── Atendimentos e desfechos ──────────────────────────────────
  atend_tipo:            { nome: 'Tipo de Atendimento', grupo: 'Atendimentos', fonte: 'atendimento', label: LABEL_TIPO_ATENDIMENTO },
  atend_convenio:        { nome: 'Convênio', grupo: 'Atendimentos', fonte: 'atendimento', label: `COALESCE(cac.ds_convenio, 'Não Informado')`, joins: J.catConvAP },
  atend_plano:           { nome: 'Plano / Categoria', grupo: 'Atendimentos', fonte: 'atendimento', label: `COALESCE(ccc.ds_categoria, 'Não Informado')`, joins: J.catPlanoAP },
  atend_tipo_convenio:   { nome: 'Origem do Pagamento', grupo: 'Atendimentos', fonte: 'atendimento', label: LABEL_TIPO_CONVENIO },
  atend_clinica:         { nome: 'Clínica', grupo: 'Atendimentos', fonte: 'atendimento', label: LABEL_CLINICA },
  atend_procedencia:     { nome: 'Procedência', grupo: 'Atendimentos', fonte: 'atendimento', label: LABEL_PROCEDENCIA },
  atend_carater:         { nome: 'Caráter (Eletivo/Urgência)', grupo: 'Atendimentos', fonte: 'atendimento', label: LABEL_CARATER },
  atend_desfecho:        { nome: 'Desfecho', grupo: 'Atendimentos', fonte: 'atendimento', label: LABEL_DESFECHO },
  atend_motivo_alta:     { nome: 'Motivo da Alta', grupo: 'Atendimentos', fonte: 'atendimento', label: `COALESCE(ma.ds_motivo_alta, 'Sem alta registrada')`, topSql: 100 },
  atend_faixa_etaria:    { nome: 'Faixa Etária', grupo: 'Atendimentos', fonte: 'atendimento', label: LABEL_FAIXA_ETARIA, ordemFixa: ORDEM_FAIXA_ETARIA },
  atend_sexo:            { nome: 'Sexo', grupo: 'Atendimentos', fonte: 'atendimento', label: LABEL_SEXO },
  atend_medico:          { nome: 'Médico Responsável', grupo: 'Atendimentos', fonte: 'atendimento', label: `COALESCE(pfm.nm_pessoa_fisica, 'Não Informado')`, joins: J.medicoAP, topSql: 300 },
  atend_estabelecimento: { nome: 'Estabelecimento', grupo: 'Atendimentos', fonte: 'atendimento', label: ESTABELECIMENTO('ap.cd_estabelecimento') },
  atend_mes:             { nome: 'Evolução Mensal', grupo: 'Atendimentos', fonte: 'atendimento', label: `TO_CHAR(ap.dt_entrada, 'YYYY-MM')`, anoInteiro: true, ordemLabel: true },

  // ── Ocupação por unidade ──────────────────────────────────────
  ocup_setor:            { nome: 'Setor / Unidade', grupo: 'Ocupação', fonte: 'unidade', label: `COALESCE(seu.ds_setor_atendimento, 'Não Informado')`, joins: J.setorAPU },
  ocup_perfil:           { nome: 'Perfil da Unidade', grupo: 'Ocupação', fonte: 'unidade', label: LABEL_PERFIL_UNIDADE, joins: J.setorAPU },
  ocup_leito:            { nome: 'Leito', grupo: 'Ocupação', fonte: 'unidade', label: LABEL_LEITO, topSql: 300 },
  ocup_acomodacao:       { nome: 'Tipo de Acomodação', grupo: 'Ocupação', fonte: 'unidade', label: `'Acomodação ' || COALESCE(CAST(apu.cd_tipo_acomodacao AS TEXT), 'não informada')` },
  ocup_mes:              { nome: 'Evolução Mensal', grupo: 'Ocupação', fonte: 'unidade', label: `TO_CHAR(apu.dt_entrada_unidade, 'YYYY-MM')`, anoInteiro: true, ordemLabel: true },

  // ── Produção médica ───────────────────────────────────────────
  prod_convenio:         { nome: 'Convênio', grupo: 'Produção', fonte: 'producao', label: `COALESCE(c.ds_convenio, 'Não Informado')`, joins: J.convenioPP },
  prod_setor:            { nome: 'Setor', grupo: 'Produção', fonte: 'producao', label: `COALESCE(se.ds_setor_atendimento, 'Não Informado')`, joins: J.setorPP },
  prod_medico:           { nome: 'Médico Executor', grupo: 'Produção', fonte: 'producao', label: `COALESCE(pf.nm_pessoa_fisica, 'Não Informado')`, joins: J.medicoPP, topSql: 300 },
  prod_vinculo:          { nome: 'Vínculo do Médico', grupo: 'Produção', fonte: 'producao', label: LABEL_VINCULO_MEDICO, joins: J.medicoVincPP },
  prod_procedimento:     { nome: 'Procedimento', grupo: 'Produção', fonte: 'producao', label: `COALESCE(p.ds_procedimento, 'Não Informado')`, joins: J.procPP, topSql: 300 },
  // Grupo e tipo de procedimento são a leitura executiva do que hoje só
  // existe como lista de 21.940 códigos: 795 grupos e 57 tipos.
  prod_grupo_proc:       { nome: 'Grupo de Procedimento', grupo: 'Produção', fonte: 'producao', label: `'Grupo ' || COALESCE(CAST(p.cd_grupo_proc AS TEXT), 'não informado')`, joins: J.procPP, topSql: 300 },
  prod_tipo_proc:        { nome: 'Tipo de Procedimento', grupo: 'Produção', fonte: 'producao', label: `'Tipo ' || COALESCE(CAST(p.cd_tipo_procedimento AS TEXT), 'não informado')`, joins: J.procPP },
  prod_alta_complex:     { nome: 'Alta Complexidade', grupo: 'Produção', fonte: 'producao', label: LABEL_ALTA_COMPLEX_PROC, joins: J.procPP },
  prod_especialidade:    { nome: 'Especialidade', grupo: 'Produção', fonte: 'producao', label: ESPECIALIDADE('pp.cd_especialidade'), topSql: 300 },
  prod_complexidade:     { nome: 'Complexidade', grupo: 'Produção', fonte: 'producao', label: COMPLEXIDADE('pp.ie_complexidade') },
  prod_financiamento:    { nome: 'Financiamento', grupo: 'Produção', fonte: 'producao', label: FINANCIAMENTO('pp.ie_tipo_financiamento') },
  prod_mes:              { nome: 'Evolução Mensal', grupo: 'Produção', fonte: 'producao', label: `TO_CHAR(pp.dt_procedimento, 'YYYY-MM')`, anoInteiro: true, ordemLabel: true },

  // ── Centro cirúrgico ──────────────────────────────────────────
  cir_procedimento:      { nome: 'Cirurgia', grupo: 'Centro Cirúrgico', fonte: 'producao', filtro: FILTRO_CIRURGICO, label: `COALESCE(p.ds_procedimento, 'Não Informado')`, joins: J.procPP, topSql: 300 },
  cir_medico:            { nome: 'Cirurgião', grupo: 'Centro Cirúrgico', fonte: 'producao', filtro: FILTRO_CIRURGICO, label: `COALESCE(pf.nm_pessoa_fisica, 'Não Informado')`, joins: J.medicoPP, topSql: 300 },
  cir_convenio:          { nome: 'Convênio', grupo: 'Centro Cirúrgico', fonte: 'producao', filtro: FILTRO_CIRURGICO, label: `COALESCE(c.ds_convenio, 'Não Informado')`, joins: J.convenioPP },
  cir_setor:             { nome: 'Setor', grupo: 'Centro Cirúrgico', fonte: 'producao', filtro: FILTRO_CIRURGICO, label: `COALESCE(se.ds_setor_atendimento, 'Não Informado')`, joins: J.setorPP },
  cir_porte:             { nome: 'Porte Cirúrgico', grupo: 'Centro Cirúrgico', fonte: 'producao', filtro: FILTRO_CIRURGICO, label: `COALESCE(p.ie_porte_cirurgia, 'Não Informado')`, joins: J.procPP },
  cir_carater:           { nome: 'Caráter da Cirurgia', grupo: 'Centro Cirúrgico', fonte: 'producao', filtro: FILTRO_CIRURGICO, label: LABEL_CARATER_CIRURGIA },
  cir_especialidade:     { nome: 'Especialidade', grupo: 'Centro Cirúrgico', fonte: 'producao', filtro: FILTRO_CIRURGICO, label: ESPECIALIDADE('pp.cd_especialidade'), topSql: 300 },
  cir_mes:               { nome: 'Evolução Mensal', grupo: 'Centro Cirúrgico', fonte: 'producao', filtro: FILTRO_CIRURGICO, label: `TO_CHAR(pp.dt_procedimento, 'YYYY-MM')`, anoInteiro: true, ordemLabel: true },

  // ── Fisioterapia ──────────────────────────────────────────────
  fisio_procedimento:    { nome: 'Procedimento', grupo: 'Fisioterapia', fonte: 'producao', filtro: FILTRO_FISIO, label: `COALESCE(p.ds_procedimento, 'Não Informado')`, joins: J.procPP },
  fisio_profissional:    { nome: 'Profissional', grupo: 'Fisioterapia', fonte: 'producao', filtro: FILTRO_FISIO, label: `COALESCE(pf.nm_pessoa_fisica, 'Não Informado')`, joins: J.procPP + ' ' + J.medicoPP, topSql: 300 },
  fisio_setor:           { nome: 'Setor', grupo: 'Fisioterapia', fonte: 'producao', filtro: FILTRO_FISIO, label: `COALESCE(se.ds_setor_atendimento, 'Não Informado')`, joins: J.procPP + ' ' + J.setorPP },
  fisio_convenio:        { nome: 'Convênio', grupo: 'Fisioterapia', fonte: 'producao', filtro: FILTRO_FISIO, label: `COALESCE(c.ds_convenio, 'Não Informado')`, joins: J.procPP + ' ' + J.convenioPP },
  fisio_mes:             { nome: 'Evolução Mensal', grupo: 'Fisioterapia', fonte: 'producao', filtro: FILTRO_FISIO, label: `TO_CHAR(pp.dt_procedimento, 'YYYY-MM')`, joins: J.procPP, anoInteiro: true, ordemLabel: true },

  // ── Contas ────────────────────────────────────────────────────
  conta_convenio:        { nome: 'Convênio', grupo: 'Contas', fonte: 'conta', label: `COALESCE(cc.ds_convenio, 'Não Informado')`, joins: 'LEFT JOIN ods.convenio cc ON cp.cd_convenio_parametro = cc.cd_convenio' },
  conta_estabelecimento: { nome: 'Estabelecimento', grupo: 'Contas', fonte: 'conta', label: ESTABELECIMENTO('cp.cd_estabelecimento') },
  conta_mes:             { nome: 'Evolução Mensal', grupo: 'Contas', fonte: 'conta', label: `TO_CHAR(cp.dt_mesano_referencia, 'YYYY-MM')`, anoInteiro: true, ordemLabel: true },

  // ── Farmácia ──────────────────────────────────────────────────
  farm_material:         { nome: 'Material / Medicamento', grupo: 'Farmácia', fonte: 'farmacia', label: `COALESCE(m.ds_material, 'Material ' || CAST(cm.cd_material AS TEXT))`, joins: 'LEFT JOIN ods.material m ON cm.cd_material = m.cd_material', topSql: 300 },
  farm_setor:            { nome: 'Setor', grupo: 'Farmácia', fonte: 'farmacia', label: `COALESCE(sef.ds_setor_atendimento, 'Não Informado')`, joins: 'LEFT JOIN ods.setor_atendimento sef ON cm.cd_setor_atendimento = sef.cd_setor_atendimento' },
  farm_prescritor:       { nome: 'Prescritor', grupo: 'Farmácia', fonte: 'farmacia', label: `COALESCE(pff.nm_pessoa_fisica, 'Não Informado')`, joins: 'LEFT JOIN ods.pessoa_fisica pff ON pff.cd_pessoa_fisica = cm.cd_medico', topSql: 300 },
  farm_antibiotico:      { nome: 'Antibióticos', grupo: 'Farmácia', fonte: 'farmacia', label: `CASE WHEN cm.ie_antibiotico = 'S' THEN 'Antibiótico' ELSE 'Não Antibiótico' END` },
  farm_tipo_material:    { nome: 'Tipo de Item', grupo: 'Farmácia', fonte: 'farmacia', label: LABEL_TIPO_MATERIAL('m.ie_tipo_material'), joins: J.materialCM },
  farm_alto_risco:       { nome: 'Alta Vigilância', grupo: 'Farmácia', fonte: 'farmacia', label: SIM_NAO('m.ie_alta_vigilancia', 'Alta vigilância', 'Uso comum'), joins: J.materialCM },
  farm_mes:              { nome: 'Evolução Mensal', grupo: 'Farmácia', fonte: 'farmacia', label: `TO_CHAR(cm.dt_liberacao, 'YYYY-MM')`, anoInteiro: true, ordemLabel: true },

  // ── Custo assistencial ────────────────────────────────────────
  custo_setor:           { nome: 'Setor', grupo: 'Custo Assistencial', fonte: 'custo_material', label: `COALESCE(sem.ds_setor_atendimento, 'Não Informado')`, joins: J.setorMAP },
  custo_material:        { nome: 'Material / Medicamento', grupo: 'Custo Assistencial', fonte: 'custo_material', label: `COALESCE(mm.ds_material, 'Material ' || CAST(map.cd_material AS TEXT))`, joins: J.materialMAP, topSql: 300 },
  custo_classe:          { nome: 'Classe de Material', grupo: 'Custo Assistencial', fonte: 'custo_material', label: `'Classe ' || COALESCE(CAST(mm.cd_classe_material AS TEXT), 'não informada')`, joins: J.materialMAP, topSql: 300 },
  custo_tipo_material:   { nome: 'Tipo de Item', grupo: 'Custo Assistencial', fonte: 'custo_material', label: LABEL_TIPO_MATERIAL('mm.ie_tipo_material'), joins: J.materialMAP },
  custo_curva_abc:       { nome: 'Curva ABC', grupo: 'Custo Assistencial', fonte: 'custo_material', label: LABEL_CURVA_ABC('mm.ie_curva_abc'), joins: J.materialMAP },
  custo_padronizado:     { nome: 'Padronização', grupo: 'Custo Assistencial', fonte: 'custo_material', label: SIM_NAO('mm.ie_padronizado', 'Padronizado', 'Fora do padrão'), joins: J.materialMAP },
  custo_convenio:        { nome: 'Convênio', grupo: 'Custo Assistencial', fonte: 'custo_material', label: `COALESCE(cm2.ds_convenio, 'Não Informado')`, joins: J.convenioMAP },
  custo_mes:             { nome: 'Evolução Mensal', grupo: 'Custo Assistencial', fonte: 'custo_material', label: `TO_CHAR(map.dt_atendimento, 'YYYY-MM')`, anoInteiro: true, ordemLabel: true },

  // ── Compras ───────────────────────────────────────────────────
  compra_fornecedor:     { nome: 'Fornecedor', grupo: 'Compras', fonte: 'compras', label: `COALESCE(pj.ds_razao_social, 'CNPJ ' || COALESCE(nf.cd_cgc_emitente, 'não informado'))`, joins: J.fornecedorNF, topSql: 300 },
  compra_tipo:           { nome: 'Tipo de Nota', grupo: 'Compras', fonte: 'compras', label: LABEL_TIPO_NOTA },
  compra_estabelecimento:{ nome: 'Estabelecimento', grupo: 'Compras', fonte: 'compras', label: ESTABELECIMENTO('nf.cd_estabelecimento') },
  compra_mes:            { nome: 'Evolução Mensal', grupo: 'Compras', fonte: 'compras', label: `TO_CHAR(nf.dt_emissao, 'YYYY-MM')`, anoInteiro: true, ordemLabel: true },

  // ── Manutenção ────────────────────────────────────────────────
  manut_setor:           { nome: 'Setor Solicitante', grupo: 'Manutenção', fonte: 'manutencao', label: `COALESCE(sos.ds_setor_atendimento, 'Não Informado')`, joins: J.setorMOS },
  manut_status:          { nome: 'Status', grupo: 'Manutenção', fonte: 'manutencao', label: LABEL_STATUS_OS, ordemFixa: ORDEM_STATUS_OS },
  manut_prioridade:      { nome: 'Prioridade', grupo: 'Manutenção', fonte: 'manutencao', label: LABEL_PRIORIDADE_OS, ordemFixa: ORDEM_PRIORIDADE },
  manut_localizacao:     { nome: 'Localização', grupo: 'Manutenção', fonte: 'manutencao', label: `COALESCE(ml.ds_localizacao, 'Não Informada')`, joins: J.localMOS, topSql: 300 },
  manut_mes:             { nome: 'Evolução Mensal', grupo: 'Manutenção', fonte: 'manutencao', label: `TO_CHAR(mos.dt_ordem_servico, 'YYYY-MM')`, anoInteiro: true, ordemLabel: true },

  // ── Retorno do convênio (demonstrativo de pagamento) ──────────
  ret_convenio:          { nome: 'Convênio', grupo: 'Retorno do Convênio', fonte: 'retorno_item', label: `COALESCE(ccr.ds_convenio, 'Não Informado')`, joins: J.convenioCRI },
  ret_glosa:             { nome: 'Com / Sem Glosa', grupo: 'Retorno do Convênio', fonte: 'retorno_item', label: LABEL_GLOSA_RETORNO },
  ret_motivo:            { nome: 'Motivo da Glosa', grupo: 'Retorno do Convênio', fonte: 'retorno_item', label: `'Motivo ' || COALESCE(CAST(cri.cd_motivo_glosa AS TEXT), 'não informado')`, topSql: 300 },
  ret_status:            { nome: 'Status do Retorno', grupo: 'Retorno do Convênio', fonte: 'retorno_item', label: `'Status ' || COALESCE(CAST(crr.ie_status_retorno AS TEXT), 'não informado')`, joins: J.retornoCRI },
  ret_analisada:         { nome: 'Analisado pela Auditoria', grupo: 'Retorno do Convênio', fonte: 'retorno_item', label: SIM_NAO('cri.ie_analisada', 'Analisado', 'Pendente de análise') },
  ret_mes:               { nome: 'Evolução Mensal', grupo: 'Retorno do Convênio', fonte: 'retorno_item', label: `TO_CHAR(cri.dt_pagamento, 'YYYY-MM')`, anoInteiro: true, ordemLabel: true },

  // ── Guias de faturamento ──────────────────────────────────────
  guia_tipo:             { nome: 'Tipo de Guia', grupo: 'Guias', fonte: 'guia', label: TIPO_GUIA('cpg.ie_tipo_guia') },
  guia_situacao:         { nome: 'Situação', grupo: 'Guias', fonte: 'guia', label: LABEL_SITUACAO_GUIA },
  guia_mes:              { nome: 'Evolução Mensal', grupo: 'Guias', fonte: 'guia', label: `TO_CHAR(cpg.dt_acerto_conta, 'YYYY-MM')`, anoInteiro: true, ordemLabel: true },

  // ── Protocolos enviados ao convênio ───────────────────────────
  prot_convenio:         { nome: 'Convênio', grupo: 'Protocolos', fonte: 'protocolo', label: `COALESCE(cpv.ds_convenio, 'Não Informado')`, joins: J.convenioPC },
  prot_status:           { nome: 'Status', grupo: 'Protocolos', fonte: 'protocolo', label: LABEL_STATUS_PROTOCOLO },
  prot_tipo:             { nome: 'Tipo de Protocolo', grupo: 'Protocolos', fonte: 'protocolo', label: `'Tipo ' || COALESCE(CAST(pc.ie_tipo_protocolo AS TEXT), 'não informado')` },
  prot_setor:            { nome: 'Setor', grupo: 'Protocolos', fonte: 'protocolo', label: `COALESCE(spc.ds_setor_atendimento, 'Sem Setor')`, joins: J.setorPC },
  prot_estabelecimento:  { nome: 'Estabelecimento', grupo: 'Protocolos', fonte: 'protocolo', label: ESTABELECIMENTO('pc.cd_estabelecimento') },
  prot_mes:              { nome: 'Evolução Mensal', grupo: 'Protocolos', fonte: 'protocolo', label: `TO_CHAR(pc.dt_mesano_referencia, 'YYYY-MM')`, anoInteiro: true, ordemLabel: true },

  // ── Contabilidade ─────────────────────────────────────────────
  ctb_tipo:              { nome: 'Tipo de Lote', grupo: 'Contabilidade', fonte: 'contabil', label: `'Lote tipo ' || COALESCE(CAST(lc.cd_tipo_lote_contabil AS TEXT), 'não informado')` },
  ctb_estabelecimento:   { nome: 'Estabelecimento', grupo: 'Contabilidade', fonte: 'contabil', label: ESTABELECIMENTO('lc.cd_estabelecimento') },
  ctb_situacao:          { nome: 'Situação', grupo: 'Contabilidade', fonte: 'contabil', label: `'Situação ' || COALESCE(lc.ie_situacao, 'não informada')` },
  ctb_mes:               { nome: 'Evolução Mensal', grupo: 'Contabilidade', fonte: 'contabil', label: `TO_CHAR(lc.dt_referencia, 'YYYY-MM')`, anoInteiro: true, ordemLabel: true },

  // ── Diagnósticos (laudos por atendimento) ─────────────────────
  diag_capitulo:         { nome: 'Capítulo da CID-10', grupo: 'Diagnósticos', fonte: 'laudo', label: CAPITULO_CID('lpa.cd_cid_principal_laudo') },
  diag_cid:              { nome: 'CID (código)', grupo: 'Diagnósticos', fonte: 'laudo', label: `COALESCE(NULLIF(TRIM(lpa.cd_cid_principal_laudo), ''), 'Não Informado')`, topSql: 300 },
  diag_mes:              { nome: 'Evolução Mensal', grupo: 'Diagnósticos', fonte: 'laudo', label: `TO_CHAR(lpa.dt_emissao_laudo, 'YYYY-MM')`, anoInteiro: true, ordemLabel: true },

  // ── SUS · AIH ─────────────────────────────────────────────────
  aih_especialidade:     { nome: 'Especialidade da AIH', grupo: 'SUS · AIH', fonte: 'sus_aih', label: LABEL_ESPEC_AIH },
  aih_complexidade:      { nome: 'Complexidade', grupo: 'SUS · AIH', fonte: 'sus_aih', label: COMPLEXIDADE('sa.ie_complexidade') },
  aih_financiamento:     { nome: 'Financiamento', grupo: 'SUS · AIH', fonte: 'sus_aih', label: FINANCIAMENTO('sa.ie_tipo_financiamento') },
  aih_carater:           { nome: 'Caráter da Internação', grupo: 'SUS · AIH', fonte: 'sus_aih', label: CARATER_SUS('sa.cd_carater_internacao') },
  aih_capitulo:          { nome: 'Capítulo da CID-10', grupo: 'SUS · AIH', fonte: 'sus_aih', label: CAPITULO_CID('sa.cd_cid_principal') },
  aih_cid:               { nome: 'CID Principal (código)', grupo: 'SUS · AIH', fonte: 'sus_aih', label: `COALESCE(NULLIF(TRIM(sa.cd_cid_principal), ''), 'Não Informado')`, topSql: 300 },
  aih_procedimento:      { nome: 'Procedimento Realizado', grupo: 'SUS · AIH', fonte: 'sus_aih', label: `COALESCE(psa.ds_procedimento, 'Não Informado')`, joins: J.procSA, topSql: 300 },
  aih_medico:            { nome: 'Médico Responsável', grupo: 'SUS · AIH', fonte: 'sus_aih', label: `COALESCE(pfa.nm_pessoa_fisica, 'Não Informado')`, joins: J.medicoSA, topSql: 300 },
  aih_motivo_cobranca:   { nome: 'Motivo da Cobrança', grupo: 'SUS · AIH', fonte: 'sus_aih', label: `'Motivo ' || COALESCE(CAST(sa.cd_motivo_cobranca AS TEXT), 'não informado')` },
  aih_estabelecimento:   { nome: 'Estabelecimento', grupo: 'SUS · AIH', fonte: 'sus_aih', label: ESTABELECIMENTO('sa.cd_estabelecimento') },
  aih_mes:               { nome: 'Evolução Mensal', grupo: 'SUS · AIH', fonte: 'sus_aih', label: `TO_CHAR(sa.dt_emissao, 'YYYY-MM')`, anoInteiro: true, ordemLabel: true },

  // ── SUS · APAC ────────────────────────────────────────────────
  apac_tipo:             { nome: 'Tipo de APAC', grupo: 'SUS · APAC', fonte: 'sus_apac', label: LABEL_TIPO_APAC },
  apac_procedimento:     { nome: 'Procedimento', grupo: 'SUS · APAC', fonte: 'sus_apac', label: `COALESCE(pps.ds_procedimento, 'Não Informado')`, joins: J.procSAP, topSql: 300 },
  apac_capitulo:         { nome: 'Capítulo da CID-10', grupo: 'SUS · APAC', fonte: 'sus_apac', label: CAPITULO_CID('sap.cd_cid_principal') },
  apac_cid:              { nome: 'CID Principal (código)', grupo: 'SUS · APAC', fonte: 'sus_apac', label: `COALESCE(NULLIF(TRIM(sap.cd_cid_principal), ''), 'Não Informado')`, topSql: 300 },
  apac_finalidade:       { nome: 'Finalidade', grupo: 'SUS · APAC', fonte: 'sus_apac', label: `'Finalidade ' || COALESCE(sap.ie_finalidade, 'não informada')` },
  apac_estabelecimento:  { nome: 'Estabelecimento', grupo: 'SUS · APAC', fonte: 'sus_apac', label: ESTABELECIMENTO('sap.cd_estabelecimento') },
  apac_mes:              { nome: 'Evolução Mensal', grupo: 'SUS · APAC', fonte: 'sus_apac', label: `TO_CHAR(sap.dt_competencia, 'YYYY-MM')`, anoInteiro: true, ordemLabel: true },

  // ── SUS · Laudos e autorizações ───────────────────────────────
  slaudo_tipo:           { nome: 'Tipo de Laudo', grupo: 'SUS · Laudos', fonte: 'sus_laudo', label: `'Tipo ' || COALESCE(CAST(slp.ie_tipo_laudo_sus AS TEXT), 'não informado')` },
  slaudo_status:         { nome: 'Status do Processo', grupo: 'SUS · Laudos', fonte: 'sus_laudo', label: `'Status ' || COALESCE(CAST(slp.ie_status_processo AS TEXT), 'não informado')` },
  slaudo_clinica:        { nome: 'Clínica', grupo: 'SUS · Laudos', fonte: 'sus_laudo', label: `'Clínica ' || COALESCE(CAST(slp.ie_clinica AS TEXT), 'não informada')` },
  slaudo_procedimento:   { nome: 'Procedimento Solicitado', grupo: 'SUS · Laudos', fonte: 'sus_laudo', label: `COALESCE(pls.ds_procedimento, 'Não Informado')`, joins: J.procSLP, topSql: 300 },
  slaudo_capitulo:       { nome: 'Capítulo da CID-10', grupo: 'SUS · Laudos', fonte: 'sus_laudo', label: CAPITULO_CID('slp.cd_cid_principal') },
  slaudo_carater:        { nome: 'Caráter', grupo: 'SUS · Laudos', fonte: 'sus_laudo', label: CARATER_SUS('slp.ie_carater_inter_sus') },
  slaudo_mes:            { nome: 'Evolução Mensal', grupo: 'SUS · Laudos', fonte: 'sus_laudo', label: `TO_CHAR(slp.dt_emissao, 'YYYY-MM')`, anoInteiro: true, ordemLabel: true },

  // ── Repasse de honorário em AIH ───────────────────────────────
  // Sem corte por médico: ver a nota em geral/fontes.js (o executor vem
  // preenchido em 0,8% das linhas e o valor está nas linhas sem ele).
  rep_procedimento:      { nome: 'Procedimento', grupo: 'Repasse Médico', fonte: 'repasse_medico', label: `COALESCE(NULLIF(TRIM(vrm.ds_procedimento), ''), 'Não Informado')`, topSql: 300 },
  rep_convenio:          { nome: 'Convênio', grupo: 'Repasse Médico', fonte: 'repasse_medico', label: `COALESCE(vrm.ds_convenio, 'Não Informado')` },
  rep_complexidade:      { nome: 'Complexidade', grupo: 'Repasse Médico', fonte: 'repasse_medico', label: COMPLEXIDADE('vrm.mc_ac') },
  rep_mes:               { nome: 'Evolução Mensal', grupo: 'Repasse Médico', fonte: 'repasse_medico', label: `TO_CHAR(vrm.dt_mesano_referencia, 'YYYY-MM')`, anoInteiro: true, ordemLabel: true },

  // ── Exames e procedimentos pedidos (CPOE) ─────────────────────
  exame_proc:            { nome: 'Exame / Procedimento', grupo: 'Exames Pedidos', fonte: 'cpoe_proc', label: `COALESCE(pic.ds_proc_exame, 'Não Informado')`, joins: J.procIntCPP, topSql: 300 },
  exame_setor:           { nome: 'Setor Solicitante', grupo: 'Exames Pedidos', fonte: 'cpoe_proc', label: `COALESCE(scp.ds_setor_atendimento, 'Não Informado')`, joins: J.setorCPP },
  exame_prescritor:      { nome: 'Prescritor', grupo: 'Exames Pedidos', fonte: 'cpoe_proc', label: `COALESCE(pcp.nm_pessoa_fisica, 'Não Informado')`, joins: J.medicoCPP, topSql: 300 },
  exame_mes:             { nome: 'Evolução Mensal', grupo: 'Exames Pedidos', fonte: 'cpoe_proc', label: `TO_CHAR(cpp.dt_liberacao, 'YYYY-MM')`, anoInteiro: true, ordemLabel: true },

  // ── Prescrição médica (base legado) ───────────────────────────
  presc_setor:           { nome: 'Setor', grupo: 'Prescrição Médica', fonte: 'prescricao', label: `COALESCE(spm.ds_setor_atendimento, 'Não Informado')`, joins: J.setorPM },
  presc_prescritor:      { nome: 'Prescritor', grupo: 'Prescrição Médica', fonte: 'prescricao', label: `COALESCE(ppm.nm_pessoa_fisica, 'Não Informado')`, joins: J.medicoPM, topSql: 300 },
  // Sem corte por urgência: ie_emergencia nunca vale 'S' nesta base (ver a
  // nota na fonte). O corte devolveria uma única linha, "Rotina".
  presc_estabelecimento: { nome: 'Estabelecimento', grupo: 'Prescrição Médica', fonte: 'prescricao', label: ESTABELECIMENTO('pm.cd_estabelecimento') },
  presc_mes:             { nome: 'Evolução Mensal', grupo: 'Prescrição Médica', fonte: 'prescricao', label: `TO_CHAR(pm.dt_prescricao, 'YYYY-MM')`, anoInteiro: true, ordemLabel: true },

  // ── Nutrição ──────────────────────────────────────────────────
  dieta_tipo:            { nome: 'Tipo de Dieta', grupo: 'Nutrição', fonte: 'dieta', label: LABEL_TIPO_DIETA },
  dieta_setor:           { nome: 'Setor', grupo: 'Nutrição', fonte: 'dieta', label: `COALESCE(sdi.ds_setor_atendimento, 'Não Informado')`, joins: J.setorCDI },
  dieta_prescritor:      { nome: 'Prescritor', grupo: 'Nutrição', fonte: 'dieta', label: `COALESCE(pdi.nm_pessoa_fisica, 'Não Informado')`, joins: J.medicoCDI, topSql: 300 },
  dieta_item:            { nome: 'Item / Fórmula', grupo: 'Nutrição', fonte: 'dieta', label: `COALESCE(mdi.ds_material, 'Sem item vinculado')`, joins: J.materialCDI, topSql: 300 },
  dieta_mes:             { nome: 'Evolução Mensal', grupo: 'Nutrição', fonte: 'dieta', label: `TO_CHAR(cdi.dt_liberacao, 'YYYY-MM')`, anoInteiro: true, ordemLabel: true },

  // ── Resultado (dimensões compostas) ───────────────────────────
  // Aqui cada dimensão declara UM rótulo POR PARTE, com o alias da
  // tabela daquele lado — é o rótulo que casa as duas metades. Só
  // entram cortes em que os dois lados falam do mesmo universo:
  // convênio e setor saem de ods.convenio / ods.setor_atendimento nos
  // dois, e mês é sempre 'YYYY-MM'.
  res_convenio: {
    nome: 'Margem por Convênio', grupo: 'Resultado', fonte: 'resultado',
    partes: {
      producao: { label: `COALESCE(c.ds_convenio, 'Não Informado')`, joins: J.convenioPP },
      custo_material: { label: `COALESCE(cm2.ds_convenio, 'Não Informado')`, joins: J.convenioMAP }
    }
  },
  res_setor: {
    nome: 'Margem por Setor', grupo: 'Resultado', fonte: 'resultado',
    partes: {
      producao: { label: `COALESCE(se.ds_setor_atendimento, 'Não Informado')`, joins: J.setorPP },
      custo_material: { label: `COALESCE(sem.ds_setor_atendimento, 'Não Informado')`, joins: J.setorMAP }
    }
  },
  res_mes: {
    nome: 'Margem — Evolução Mensal', grupo: 'Resultado', fonte: 'resultado',
    anoInteiro: true, ordemLabel: true,
    partes: {
      producao: { label: `TO_CHAR(pp.dt_procedimento, 'YYYY-MM')` },
      custo_material: { label: `TO_CHAR(map.dt_atendimento, 'YYYY-MM')` }
    }
  },
  caixa_convenio: {
    nome: 'Faturado × Caixa por Convênio', grupo: 'Resultado', fonte: 'caixa_vs_fatura',
    partes: {
      glosa_protocolo: { label: `COALESCE(gp.ds_convenio, 'Não Informado')` },
      recebimento: { label: `COALESCE(ccv.ds_convenio, 'Não Informado')`, joins: J.convenioCVR }
    }
  },
  caixa_mes: {
    nome: 'Faturado × Caixa — Evolução Mensal', grupo: 'Resultado', fonte: 'caixa_vs_fatura',
    anoInteiro: true, ordemLabel: true,
    partes: {
      glosa_protocolo: { label: `gp.ano_ref || '-' || gp.mes_ref` },
      recebimento: { label: `TO_CHAR(cvr.dt_recebimento, 'YYYY-MM')` }
    }
  },
  ci_mes: {
    nome: 'Custo por Internação — Mensal', grupo: 'Resultado', fonte: 'custo_internacao',
    anoInteiro: true, ordemLabel: true,
    partes: {
      atendimento: { label: `TO_CHAR(ap.dt_entrada, 'YYYY-MM')` },
      custo_material: { label: `TO_CHAR(map.dt_atendimento, 'YYYY-MM')` }
    }
  },
  co_setor: {
    nome: 'Custo por Dia-Leito por Setor', grupo: 'Resultado', fonte: 'custo_ocupacao',
    partes: {
      unidade: { label: `COALESCE(seu.ds_setor_atendimento, 'Não Informado')`, joins: J.setorAPU },
      custo_material: { label: `COALESCE(sem.ds_setor_atendimento, 'Não Informado')`, joins: J.setorMAP }
    }
  },
  co_mes: {
    nome: 'Custo por Dia-Leito — Mensal', grupo: 'Resultado', fonte: 'custo_ocupacao',
    anoInteiro: true, ordemLabel: true,
    partes: {
      unidade: { label: `TO_CHAR(apu.dt_entrada_unidade, 'YYYY-MM')` },
      custo_material: { label: `TO_CHAR(map.dt_atendimento, 'YYYY-MM')` }
    }
  },
  pvc_convenio: {
    nome: 'Produção × Conta por Convênio', grupo: 'Resultado', fonte: 'producao_vs_conta',
    partes: {
      producao: { label: `COALESCE(c.ds_convenio, 'Não Informado')`, joins: J.convenioPP },
      conta: { label: `COALESCE(cc.ds_convenio, 'Não Informado')`, joins: 'LEFT JOIN ods.convenio cc ON cp.cd_convenio_parametro = cc.cd_convenio' }
    }
  },
  pvc_mes: {
    nome: 'Produção × Conta — Evolução Mensal', grupo: 'Resultado', fonte: 'producao_vs_conta',
    anoInteiro: true, ordemLabel: true,
    partes: {
      producao: { label: `TO_CHAR(pp.dt_procedimento, 'YYYY-MM')` },
      conta: { label: `TO_CHAR(cp.dt_mesano_referencia, 'YYYY-MM')` }
    }
  }
};

function indicadoresDaDimensao(dim) {
  return FONTES[dim.fonte].indicadores.map(metaIndicador);
}

const GRUPO_POR_NOME = {};
GRUPOS.forEach(function (g) { GRUPO_POR_NOME[g.nome] = g; });

// Tabelas e campos de origem funcionam igual para fonte simples e
// composta — a composta soma o que as duas partes usam. Delegado a
// consulta.js para não duplicar a regra em dois lugares.
function origemDaDimensao(dim) {
  const fonte = FONTES[dim.fonte];
  if (!ehComposta(fonte)) {
    return {
      tabelas: extrairFontesSql(fonte.from + ' ' + (fonte.joinsBase || '') + ' ' + (dim.joins || '')),
      campos: extrairCamposSql(fonte.metricas),
      filtro: (fonte.where + ' ' + (dim.filtro || '')).replace(/\s+/g, ' ').trim()
    };
  }
  const tabelas = [];
  const campos = {};
  const filtros = [];
  fonte.partes.forEach(function (parte) {
    const f = FONTES[parte.fonte];
    const cfg = (dim.partes && dim.partes[parte.fonte]) || {};
    extrairFontesSql(f.from + ' ' + (f.joinsBase || '') + ' ' + (cfg.joins || ''))
      .forEach(function (t) { if (tabelas.indexOf(t) === -1) tabelas.push(t); });
    const c = extrairCamposSql(f.metricas);
    Object.keys(c).forEach(function (k) { campos[k] = c[k]; });
    filtros.push((f.where + ' ' + (cfg.filtro || '')).replace(/\s+/g, ' ').trim());
  });
  return { tabelas: tabelas, campos: campos, filtro: filtros.join('  ·  ') };
}

function descreverDimensao(id) {
  const dim = DIMENSOES[id];
  const fonte = FONTES[dim.fonte];
  const grupo = GRUPO_POR_NOME[dim.grupo] || {};
  const origem = origemDaDimensao(dim);
  return {
    id: id,
    nome: dim.nome,
    grupo: dim.grupo,
    area: grupo.area || 'geral',
    evolucao: !!dim.anoInteiro,
    ordemFixa: !!dim.ordemFixa,
    pesado: !!fonte.pesado,
    composta: ehComposta(fonte),
    indicadorPadrao: fonte.indicadores[0],
    indicadores: indicadoresDaDimensao(dim),
    fontes: origem.tabelas,
    origemDados: origem
  };
}

// Catálogo consumido pelo front: é a fonte única do menu, das áreas e
// das listas de indicadores — o cliente não guarda nenhuma lista
// hardcoded.
//
// `origemDados`/`fontes` ficam FORA do catálogo de propósito: com 159
// dimensões elas dobravam o payload (449 KB contra 231 KB) e o popover
// "de onde veio isso" já recebe esses metadados na resposta de cada
// consulta, que é o único lugar onde a tela os lê. O índice da busca
// global também não vem daqui: o cliente monta a partir de `grupos`,
// que já traz dimensão × indicadores.
function resumirDimensao(id) {
  const d = descreverDimensao(id);
  delete d.origemDados;
  delete d.fontes;
  return d;
}

function montarCatalogo() {
  const porNome = {};
  GRUPOS.forEach(function (g) {
    porNome[g.nome] = {
      nome: g.nome, area: g.area, icone: g.icone, cor: g.cor,
      descricao: g.descricao, dimensoes: []
    };
  });

  Object.keys(DIMENSOES).forEach(function (id) {
    const grupo = porNome[DIMENSOES[id].grupo];
    if (!grupo) throw new Error('Grupo não declarado em GRUPOS: ' + DIMENSOES[id].grupo);
    grupo.dimensoes.push(resumirDimensao(id));
  });

  const grupos = GRUPOS.map(function (g) { return porNome[g.nome]; })
    .filter(function (g) { return g.dimensoes.length; });

  const areasComGrupos = AREAS.filter(function (a) {
    return a.id === 'geral' || grupos.some(function (g) { return g.area === a.id; });
  });

  return {
    areas: areasComGrupos,
    grupos: grupos,
    anoAtual: String(new Date().getFullYear()),
    totalDimensoes: Object.keys(DIMENSOES).length,
    totalIndicadores: Object.keys(INDICADORES).length
  };
}

module.exports = { DIMENSOES, GRUPOS, AREAS, montarCatalogo, descreverDimensao, indicadoresDaDimensao };
