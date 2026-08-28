const PERFIL_ADMIN = 1848;

function valorValido(valor) {
  return valor !== null && valor !== undefined && valor !== '';
}

function resolverEscopo(usuario) {
  const perfil = Number(usuario.cd_perfil_inicial);

  if (perfil === PERFIL_ADMIN) {
    return { global: true, parametros: [] };
  }

  return {
    global: false,
    estabelecimento: valorValido(usuario.cd_estabelecimento) ? usuario.cd_estabelecimento : null,
    setor: valorValido(usuario.cd_setor_atendimento) ? usuario.cd_setor_atendimento : null,
    parametros: []
  };
}

function adicionarParametro(escopo, valor, parametros) {
  escopo.parametros.push(valor);
  return '$' + (parametros.length + escopo.parametros.length);
}

function filtroParaTabela(usuario, tabela, parametros) {
  const escopo = resolverEscopo(usuario);
  if (escopo.global) return { sql: '', parametros: [] };

  const filtros = [];
  if (['pp', 'cm', 'gi'].includes(tabela) && escopo.setor !== null) {
    filtros.push(tabela + '.cd_setor_atendimento = ' + adicionarParametro(escopo, escopo.setor, parametros));
  }
  if (['cp', 'gp', 'gi'].includes(tabela) && escopo.estabelecimento !== null) {
    filtros.push(tabela + '.cd_estabelecimento = ' + adicionarParametro(escopo, escopo.estabelecimento, parametros));
  }

  if (!filtros.length) return { sql: ' AND 1 = 0', parametros: [] };
  return { sql: ' AND ' + filtros.join(' AND '), parametros: escopo.parametros };
}

function aplicarEscopo(query, usuario, tabela, parametros) {
  const filtro = filtroParaTabela(usuario, tabela, parametros);
  return {
    query: query.replace('/* ESCOPO */', filtro.sql),
    parametros: parametros.concat(filtro.parametros)
  };
}

module.exports = { aplicarEscopo, resolverEscopo };