/* ============================================================= */
/* API SERVICE — Etapa / Tempo de Permanência (TASY Analytics)   */
/* Contrato detalhado em ../API_CONTRATO.md                      */
/*                                                               */
/* INTEGRAÇÃO COM BACKEND / BANCO DE DADOS:                      */
/* Defina USAR_MOCK = false para que as consultas sejam feitas   */
/* via POST em ENDPOINT. A resposta deve seguir os schemas       */
/* descritos no contrato (camelCase, sufixos _fmt/_ant/_var).    */
/* ============================================================= */
(function (angular) {
  'use strict';

  var app = angular.module('DashboardApp', []);

  app.factory('ApiService', function($q, $timeout, $http) {

    // ====================================================================
    // CONFIGURAÇÃO DE INTEGRAÇÃO
    // USAR_MOCK = true  → dados simulados (demo sem backend)
    // USAR_MOCK = false → POST real em ENDPOINT (contrato: API_CONTRATO.md)
    // ====================================================================
    var USAR_MOCK = false;
    var ENDPOINT = '/api/etapa';

    // BASE DE DADOS MOCK PARA AS 6 DIMENSÕES (+ "mes" p/ tendência e drill-down)
    const basesDeDados = {
      conta: [
        'Conta #10841', 'Conta #10842', 'Conta #10843', 'Conta #10844', 'Conta #10845',
        'Conta #10846', 'Conta #10847', 'Conta #10848', 'Conta #10849', 'Conta #10850',
        'Conta #10851', 'Conta #10852', 'Conta #10853', 'Conta #10854', 'Conta #10855'
      ],
      convenio: [
        'Unimed Regional', 'Bradesco Saúde', 'SulAmérica Saúde', 'Amil Assistência Médica',
        'NotreDame Intermédica', 'Cassi Caixa de Assistência', 'Allianz Saúde', 'Prevent Senior',
        'Porto Seguro Saúde', 'Particular Direto', 'Golden Cross', 'Mediservice',
        'IPERGS / Estado', 'Geap Autogestão'
      ],
      etapa: [
        '01 - Recepção / Entrada do Paciente', '02 - Triagem e Classificação de Risco',
        '03 - Atendimento Médico e Diagnóstico', '04 - Prescrição e Administração MatMed',
        '05 - Realização de Procedimentos / SADT', '06 - Internação / Leito Assistencial',
        '07 - Pareceres e Interconsultas Médicas', '08 - Alta Médica e Fechamento Clínico',
        '09 - Auditoria Médica e Pré-Fatura', '10 - Faturamento e Envio de Lotes'
      ],
      motivo_devolucao: [
        'Ausência de Guia / Autorização Prévia', 'Divergência no Laudo / Justificativa Clínica',
        'Falta de Assinatura / Carimbo Médico', 'Inconsistência em Itens de OPME',
        'Código de Procedimento Incompatível', 'Relatório Cirúrgico Incompleto',
        'Duplicidade de Cobrança de Taxa', 'Prazo Limite de Envio Excedido'
      ],
      pessoa_fisica: [
        'Dr. Carlos Eduardo Silva', 'Dra. Ana Paula Mendonça', 'Dr. Roberto Santos Guimarães',
        'Dra. Camila Lima Fontes', 'Dr. Fernando Costa Nogueira', 'Dra. Juliana Alves Pereira',
        'Dr. Marcelo Vieira Ramos', 'Dra. Beatriz Toledo Martins'
      ],
      tipo_atendimento: [
        'Internação Hospitalar Cirúrgica', 'Internação Clínica Geral',
        'Pronto Atendimento (Urgência)', 'Consulta Ambulatorial', 'SADT / Exames Diagnósticos',
        'Cirurgia Ambulatorial (Hospital Dia)', 'Home Care / Assistência Domiciliar'
      ],
      mes: [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ]
    };

    const nomesDimensao = {
      mes: 'Mês',
      convenio: 'Convênio',
      estabelecimento: 'Estabelecimento',
      motivo_devolucao: 'Motivo devolução'
    };

    // CONFIGURAÇÃO DOS 5 INDICADORES / MÉTRICAS
    const configIndicadores = {
      qtd_contas:  { nome: 'Qtde Contas', isMoeda: false, isPercentual: false, isDecimal: false, baseMin: 15,  baseMax: 280,  color: '#475569', badgeClass: 'badge-qtd-contas' },
      dias_etapa:  { nome: 'Dias Etapa',  isMoeda: false, isPercentual: false, isDecimal: false, baseMin: 40,  baseMax: 950,  color: '#7c3aed', badgeClass: 'badge-dias-etapa' },
      media_etapa: { nome: 'Média Etapa', isMoeda: false, isPercentual: false, isDecimal: true,  baseMin: 0.8, baseMax: 6.5,  color: '#059669', badgeClass: 'badge-media-etapa' },
      vl_conta:    { nome: 'Valor Conta', isMoeda: true, isPercentual: false, isDecimal: false, baseMin: 1000, baseMax: 50000, color: '#0284c7', badgeClass: 'badge-vl-conta' }
    };

    function formatarValor(val, cfg) {
      if (!cfg) return Math.round(val || 0).toLocaleString('pt-BR');
      if (cfg.isDecimal) {
        return Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + ' dias';
      }
      var n = Math.round(val || 0).toLocaleString('pt-BR');
      return n;
    }

    return {
      getConfigIndicadores: function() { return configIndicadores; },
      getNomesDimensao: function() { return nomesDimensao; },
      isMock: function() { return USAR_MOCK; },

      obterDadosDashboard: function(req) {
        if (!USAR_MOCK) {
          // Chamada REST real — contrato detalhado em API_CONTRATO.md
          var token = localStorage.getItem('tasy_token');
          return $http.post(ENDPOINT, req, { timeout: 120000, headers: token ? { Authorization: 'Bearer ' + token } : {} }).then(function(response) {
            return response.data;
          }, function(response) {
            var msg = (response && response.data && response.data.mensagem)
              ? response.data.mensagem
              : 'Falha na consulta ao servidor' + (response && response.status ? ' (HTTP ' + response.status + ')' : '') + '.';
            return $q.reject(msg);
          });
        }

        var deferred = $q.defer();

        $timeout(function() {
          try {
            let labelsBase = basesDeDados[req.dimensao] || [];
            if (!labelsBase.length && !(req.rotulo && req.dimensao === 'mes')) {
              deferred.reject('Dimensão inválida ou sem dados: ' + req.dimensao);
              return;
            }

            // ------------------------------------------------------------------
            // DRILL-DOWN (campo opcional "rotulo" — extensão do contrato):
            // série mensal determinística de um único item da dimensão.
            // Backend real: filtrar pelo rótulo e retornar o mesmo schema.
            // ------------------------------------------------------------------
            if (req.rotulo && req.dimensao === 'mes') {
              let seedD = 0;
              for (let i = 0; i < req.rotulo.length; i++) seedD = (seedD * 31 + req.rotulo.charCodeAt(i)) % 997;
              let seedNorm = (seedD % 100) / 100;

              let serieMensal = basesDeDados.mes.map(function(nomeMes, mi) {
                let fatorMes = 0.75 + (((seedD * (mi + 3)) % 50) / 100); // 0,75 – 1,24
                let item = { label: nomeMes.substring(0, 3) };

                if (req.indicador !== 'todos') {
                  let ind = configIndicadores[req.indicador];
                  let v = ind.isDecimal
                    ? parseFloat((ind.baseMin + seedNorm * (ind.baseMax - ind.baseMin)) * (0.9 + (fatorMes - 1) * 0.2)).toFixed(1) * 1
                    : Math.round((ind.baseMin + seedNorm * (ind.baseMax - ind.baseMin)) * fatorMes);
                  item.valorRaw = v;
                  item.valorFormatado = formatarValor(v, ind);
                } else {
                  Object.keys(configIndicadores).forEach(function(k) {
                    let ind = configIndicadores[k];
                    let v = ind.isDecimal
                      ? parseFloat((ind.baseMin + seedNorm * (ind.baseMax - ind.baseMin)) * (0.9 + (fatorMes - 1) * 0.2)).toFixed(1) * 1
                      : Math.round((ind.baseMin + seedNorm * (ind.baseMax - ind.baseMin)) * fatorMes);
                    item[k] = v;
                    item[k + '_fmt'] = formatarValor(v, ind);
                  });
                  item.valorRawSort = item.dias_etapa || 0;
                }
                return item;
              });

              deferred.resolve({
                nomeDimensao: 'Mês',
                modoTodos: req.indicador === 'todos',
                totalBase: serieMensal.length,
                dados: serieMensal
              });
              return;
            }

            let multPeriodo = 1;
            if (req.tipoPeriodo === 'dia') multPeriodo = 0.05;
            if (req.tipoPeriodo === 'mes') multPeriodo = 1.0;
            if (req.tipoPeriodo === 'ano') multPeriodo = 12.0;

            // Fator determinístico por período (ano/mês): dá realismo ao
            // comparativo vs. ano passado e à evolução temporal na demo
            let fatorPeriodo = 1;
            if (req.periodoValor instanceof Date && !isNaN(req.periodoValor.getTime())) {
              let marca = req.periodoValor.getFullYear() * 12 + req.periodoValor.getMonth();
              fatorPeriodo = 1 + (((marca * 37) % 11) - 5) * 0.035;
            } else if (typeof req.periodoValor === 'number' && req.periodoValor > 0) {
              fatorPeriodo = 1 + (((Math.floor(req.periodoValor) * 29) % 9) - 4) * 0.04;
            }

            let dadosMock = [];

            if (req.indicador === 'todos') {
              labelsBase.forEach(function(label, index) {
                let baseSeed = (index * 17 + label.length * 23) % 100 / 100;

                let qtdContas = Math.max(1, Math.round((15 + baseSeed * 240) * multPeriodo * fatorPeriodo));
                let mediaEtapa = parseFloat((0.8 + baseSeed * 5.7).toFixed(1));
                let diasEtapa = Math.round(qtdContas * mediaEtapa);

                let mediaAlta = parseFloat((mediaEtapa + 2.5 + baseSeed * 8.5).toFixed(1));
                let diasAlta = Math.round(qtdContas * mediaAlta);

                let item = {
                  label: label,
                  qtd_contas: qtdContas,
                  qtd_contas_fmt: formatarValor(qtdContas, configIndicadores.qtd_contas),

                  dias_etapa: diasEtapa,
                  dias_etapa_fmt: formatarValor(diasEtapa, configIndicadores.dias_etapa),

                  media_etapa: mediaEtapa,
                  media_etapa_fmt: formatarValor(mediaEtapa, configIndicadores.media_etapa),

                  dias_alta: diasAlta,
                  dias_alta_fmt: formatarValor(diasAlta, configIndicadores.dias_alta),

                  media_alta: mediaAlta,
                  media_alta_fmt: formatarValor(mediaAlta, configIndicadores.media_alta),

                  valorRawSort: diasEtapa
                };

                // Período anterior (determinístico por item, coerente entre indicadores)
                if (req.modo === 'comparativo') {
                  let fatorBase = 0.85 + (((index * 13 + label.length * 29) % 100) / 100) * 0.30; // 0.85 – 1.15

                  let contasAnt = Math.max(1, Math.round(qtdContas / fatorBase));
                  let mediaEtapaAnt = parseFloat((mediaEtapa / (fatorBase * (0.95 + (baseSeed * 0.1)))).toFixed(1));
                  let mediaAltaAnt = parseFloat((mediaAlta / (fatorBase * (0.95 + (baseSeed * 0.1)))).toFixed(1));
                  let diasEtapaAnt = Math.round(contasAnt * mediaEtapaAnt);
                  let diasAltaAnt = Math.round(contasAnt * mediaAltaAnt);

                  item.qtd_contas_ant = contasAnt;
                  item.dias_etapa_ant = diasEtapaAnt;
                  item.media_etapa_ant = mediaEtapaAnt;
                  item.dias_alta_ant = diasAltaAnt;
                  item.media_alta_ant = mediaAltaAnt;

                  // Δ% por indicador (consumido pelas células da tabela multivariada)
                  let paresVariacao = [
                    ['qtd_contas',  qtdContas,  contasAnt],
                    ['dias_etapa',  diasEtapa,  diasEtapaAnt],
                    ['media_etapa', mediaEtapa, mediaEtapaAnt],
                    ['dias_alta',   diasAlta,   diasAltaAnt],
                    ['media_alta',  mediaAlta,  mediaAltaAnt]
                  ];
                  paresVariacao.forEach(function(par) {
                    item[par[0] + '_var'] = par[2] > 0 ? ((par[1] - par[2]) / par[2]) * 100 : 0;
                  });
                }

                dadosMock.push(item);
              });

              if (req.ordem === 'desc') dadosMock.sort((a, b) => b.valorRawSort - a.valorRawSort);
              else dadosMock.sort((a, b) => a.valorRawSort - b.valorRawSort);

              let totalBase = dadosMock.length;
              if (req.limite !== 'todos') { var _nLim = parseInt(req.limite, 10); if (isNaN(_nLim) || _nLim <= 0) _nLim = totalBase; dadosMock = dadosMock.slice(0, _nLim); }

              deferred.resolve({
                nomeDimensao: nomesDimensao[req.dimensao] || req.dimensao,
                modoTodos: true,
                totalBase: totalBase,
                dados: dadosMock
              });

            } else {
              let indConfig = configIndicadores[req.indicador];
              if (!indConfig) { deferred.reject('Indicador inválido: ' + req.indicador); return; }

              labelsBase.forEach(function(label, index) {
                let baseSeed = (index * 19 + label.length * 31) % 100 / 100;
                let valorAtual = 0;

                if (indConfig.isDecimal) {
                  valorAtual = parseFloat((indConfig.baseMin + baseSeed * (indConfig.baseMax - indConfig.baseMin)) * fatorPeriodo);
                } else {
                  valorAtual = Math.round((indConfig.baseMin + baseSeed * (indConfig.baseMax - indConfig.baseMin)) * multPeriodo * fatorPeriodo);
                }

                let item = {
                  label: label,
                  valorRaw: valorAtual,
                  valorFormatado: formatarValor(valorAtual, indConfig)
                };

                if (req.modo === 'comparativo') {
                  let variacaoPercentual = 0.85 + (baseSeed * 0.30); // ≈ -15% a +18%
                  let valorAnterior = indConfig.isDecimal
                    ? parseFloat((valorAtual / variacaoPercentual).toFixed(1))
                    : Math.max(1, Math.round(valorAtual / variacaoPercentual));
                  item.valorAnteriorRaw = valorAnterior;
                  item.valorAnteriorFormatado = formatarValor(valorAnterior, indConfig);
                  item.variacao = ((valorAtual - valorAnterior) / valorAnterior) * 100;
                }

                dadosMock.push(item);
              });

              if (req.ordem === 'desc') dadosMock.sort((a, b) => b.valorRaw - a.valorRaw);
              else dadosMock.sort((a, b) => a.valorRaw - b.valorRaw);

              let totalBase = dadosMock.length;
              if (req.limite !== 'todos') { var _nLim = parseInt(req.limite, 10); if (isNaN(_nLim) || _nLim <= 0) _nLim = totalBase; dadosMock = dadosMock.slice(0, _nLim); }

              deferred.resolve({
                nomeDimensao: nomesDimensao[req.dimensao] || req.dimensao,
                nomeIndicador: indConfig.nome,
                modoTodos: false,
                isMoeda: indConfig.isMoeda,
                isPercentual: indConfig.isPercentual,
                isDecimal: indConfig.isDecimal,
                color: indConfig.color,
                badgeClass: indConfig.badgeClass,
                totalBase: totalBase,
                dados: dadosMock
              });
            }

          } catch(e) {
            deferred.reject("Erro ao processar dados de permanência por etapa.");
          }
        }, 200);

        return deferred.promise;
      }
    };
  });

})(window.angular);
