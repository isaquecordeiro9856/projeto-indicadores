// ═══════════════════════════════════════════════════════════
// SUPERVISÃO E DIREÇÃO — quem tem acesso ao sistema
// ═══════════════════════════════════════════════════════════
// O TASY Analytics é restrito a SUPERVISÃO. Usuário comum (assistencial,
// operacional, administrativo sem cargo de supervisão) NÃO acessa o
// sistema: o login é recusado antes mesmo de emitir token.
//
// Níveis:
//   Direção    -> supervisor + painel geral consolidado (visão executiva)
//   Supervisor -> todos os dados de todas as dimensões dos painéis de área
//
// IMPORTANTE: o ODS replicado do Tasy NÃO tem um campo confiável de
// chefia. Levantamento feito na base de produção (1245 usuários ativos):
//   - ods.medico.ie_coordenador ....... 190 'N' + 67 nulos, nenhum 'S'
//   - ods.pessoa_fisica.cd_cargo ...... nulo em 852; sem tabela de cargos
//   - ods.usuario.cd_funcao ........... nulo em 1040 (é função de tela)
//   - ods.pessoa_fisica.ds_profissao .. nulo em 100% dos casos
//   - setor de chefia ................. só "Núcleo da Qualidade" (1 pessoa)
// Por isso a supervisão é declarada aqui, explicitamente. Para liberar
// alguém basta adicionar o login (nm_usuario) ou o perfil na lista.

// Perfis de supervisão do Tasy (cadastro de perfis — "<área> - Supervisão").
// A tabela ods.perfil não é replicada no ODS, então a descrição de cada
// código fica registrada aqui, conforme o cadastro do sistema.
const PERFIS_SUPERVISORES = [
  1848, // Admin - Auditoria (acesso total)
  2168, // Almoxarifado - Supervisão
  2247, // Faturamento SUS - Supervisão
  2234, // Financeiro - Supervisão
  2421, // Financeiro - Supervisão UN2 (Centro Oncológico)
  2271, // Fiscal - Supervisão
  2118, // Higienização - Supervisão
  1912, // Manutenção - Supervisão
  2166, // Nutrição - Supervisão
  1999, // Oncologia - Supervisão
  2199, // Patrimônio - Supervisão
  2239, // Qualidade - Supervisão
  2374, // Radioterapia - Supervisão
  2306, // Radioterapia - Supervisão
  2317, // Recepção - Consultório Supervisão
  2425, // Recepção Amb SUS - Supervisão
  2138, // Recepção Consultas - Supervisão
  2140, // Recepção Exames - Supervisão
  2142, // Recepção Internação - Supervisão
  2299, // Recepção Laboratório - Supervisão
  2144, // Recepção PA - Supervisão
  2035, // Recepção Serviços - Supervisão
  2257, // Repasse para Terceiros - Supervisão
  2243, // Retorno de Convênio - Supervisão
  2209, // Rouparia - Supervisão
  2223, // SAME - Supervisão
  2285  // Enfermagem - Supervisão CPOE
];

// Logins (ods.usuario.nm_usuario) com visão global de dados.
//
// Usar esta lista (em vez de PERFIS_SUPERVISORES) quando o usuário acumula
// mais de um perfil no Tasy e o perfil de supervisão NÃO é o cd_perfil_inicial
// dele: o ODS replicado só traz o perfil inicial (não existe tabela de
// vínculo usuário-perfil replicada), então não dá pra detectar isso pelo
// cd_perfil_inicial sozinho.
const USUARIOS_SUPERVISORES = [
  'jkreuscher' // Enfermagem - Supervisão CPOE (2285), além do perfil inicial 2286 (Técnico CPOE)
];

// Setores cujos ocupantes são supervisores por natureza da área.
const SETORES_SUPERVISORES = [];

// ═══════════════════════════════════════════════════════════
// DIREÇÃO / SUPER ADMIN
// ═══════════════════════════════════════════════════════════
// Presidência, diretoria e superintendência. Acesso a TUDO, incluindo o
// Painel Geral (dashboard-geral.html / /api/geral) — visão consolidada de
// todas as áreas em uma tela só. Direção é sempre supervisor também.
//
// Não existe perfil "Diretoria" no cadastro do Tasy: a direção é declarada
// por login aqui. Adicione o nm_usuario de cada diretor/presidente.
const PERFIS_DIRECAO = [
  1848 // Admin - Auditoria (acesso total ao sistema)
];

const USUARIOS_DIRECAO = [
  // 'presidencia',
  // 'diretoria',
];

function ehDirecao(usuario) {
  if (!usuario) return false;

  if (PERFIS_DIRECAO.includes(Number(usuario.cd_perfil_inicial))) return true;

  const login = String(usuario.nm_usuario || '').toLowerCase();
  return USUARIOS_DIRECAO.some(u => String(u).toLowerCase() === login);
}

function ehSupervisor(usuario) {
  if (!usuario) return false;

  if (ehDirecao(usuario)) return true;

  if (PERFIS_SUPERVISORES.includes(Number(usuario.cd_perfil_inicial))) return true;

  const login = String(usuario.nm_usuario || '').toLowerCase();
  if (USUARIOS_SUPERVISORES.some(u => String(u).toLowerCase() === login)) return true;

  if (SETORES_SUPERVISORES.includes(Number(usuario.cd_setor_atendimento))) return true;

  return false;
}

module.exports = {
  PERFIS_SUPERVISORES,
  USUARIOS_SUPERVISORES,
  SETORES_SUPERVISORES,
  PERFIS_DIRECAO,
  USUARIOS_DIRECAO,
  ehSupervisor,
  ehDirecao
};
