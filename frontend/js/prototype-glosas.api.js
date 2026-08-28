/* ============================================================= */
/* API SERVICE — Glosas por Convênio (TASY Analytics)            */
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
    var ENDPOINT = '/api/glosas';

    // BASE DE DADOS MOCK PARA AS 10 DIMENSÕES
    const basesDeDados = {
      ano: ['2026', '2025', '2024', '2023', '2022', '2021'],
      convenio: [
        'Unimed Regional', 'Bradesco Saúde', 'SulAmérica Saúde', 'Amil Assistência Médica',
        'NotreDame Intermédica', 'Cassi Caixa de Assistência', 'Allianz Saúde', 'Prevent Senior',
        'Porto Seguro Saúde', 'Particular Direto', 'Golden Cross', 'Mediservice',
        'IPERGS / Estado', 'Geap Autogestão'
      ],
      estabelecimento: [
        'Hospital Central - Matriz', 'Hospital Santa Helena', 'Pronto Atendimento Sul',
        'Maternidade Luz e Vida', 'Hospital Infantil da Criança', 'Instituto Regional de Oncologia',
        'Centro de Trauma e Ortopedia', 'Unidade Hospitalar Leste'
      ],
      mes: [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ],
      mes_referencia: [
        '01/2026', '12/2025', '11/2025', '10/2025', '09/2025', '08/2025',
        '07/2025', '06/2025', '05/2025', '04/2025', '03/2025', '02/2025'
      ],
      protocolo: [
        'PROT-2026-8801', 'PROT-2026-8802', 'PROT-2026-8803', 'PROT-2026-8804',
        'PROT-2026-8805', 'PROT-2026-8806', 'PROT-2026-8807', 'PROT-2026-8808',
        'PROT-2026-8809', 'PROT-2026-8810', 'PROT-2026-8811', 'PROT-2026-8812'
      ],
      sequencia_protocolo: [
        'Seq. 01 - Remessa Regular', 'Seq. 02 - Complemento Diárias',
        'Seq. 03 - OPME / MatMed', 'Seq. 04 - Recurso 1ª Instância',
        'Seq. 05 - Recurso 2ª Instância', 'Seq. 06 - Ajuste de Honorários',
        'Seq. 07 - Reanálise Contratual'
      ],
      setor: [
        'UTI Adulto Geral', 'UTI Coronariana (UCO)', 'UTI Neonatal e Pediátrica',
        'Centro Cirúrgico Geral', 'Pronto Socorro / Emergência', 'Enfermaria Cirúrgica 3º Andar',
        'Ambulatório de Especialidades', 'SADT - Imagem e Tomografia', 'Hemodinâmica e Cateterismo',
        'Endoscopia e Colonoscopia', 'Centro de Terapia Renal (Hemodiálise)', 'Quimioterapia Ambulatorial'
      ],
      tipo_convenio: [
        'Planos de Saúde (Medicina de Grupo)', 'Seguradoras Especializadas',
        'Autogestão em Saúde', 'Cooperativas Médicas (Unimeds)', 'Particular / Desembolso Direto', 'SUS / Governamental'
      ],
      tipo_protocolo: [
        'Eletrônico (XML TISS)', 'Físico / Papel', 'Reapresentação / Recurso',
        'Complementar / Aditivo', 'Urgência / Liminar', 'Direto / Portal Operadora'
      ]
    };

    const nomesDimensao = {
      ano: 'Ano',
      convenio: 'Convênio',
      estabelecimento: 'Estabelecimento',
      mes: 'Mês',
      mes_referencia: 'Mês de Referência',
      protocolo: 'Protocolo',
      sequencia_protocolo: 'Sequência do Protocolo',
      setor: 'Setor',
      tipo_convenio: 'Tipo Convênio',
      tipo_protocolo: 'Tipo de Protocolo'
    };

    // CONFIGURAÇÃO DOS 12 INDICADORES / INFORMAÇÕES
    const configIndicadores = {
      valor_faturado: { nome: 'Valor Faturado', isMoeda: true, isPercentual: false, baseMin: 45000, baseMax: 480000, color: '#2563eb', badgeClass: 'badge-val-faturado' },
      valor_recebido: { nome: 'Valor Recebido', isMoeda: true, isPercentual: false, baseMin: 38000, baseMax: 420000, color: '#059669', badgeClass: 'badge-val-recebido' },
      valor_a_receber: { nome: 'Valor a Receber', isMoeda: true, isPercentual: false, baseMin: 8000, baseMax: 90000, color: '#0284c7', badgeClass: 'badge-val-a-receber' },
      valor_glosado: { nome: 'Valor Glosado', isMoeda: true, isPercentual: false, baseMin: 1200, baseMax: 35000, color: '#dc2626', badgeClass: 'badge-val-glosado' },
      valor_glosa_aceita: { nome: 'Valor Glosa Aceita', isMoeda: true, isPercentual: false, baseMin: 300, baseMax: 12000, color: '#991b1b', badgeClass: 'badge-val-glosa-aceita' },
      valor_reapresentado: { nome: 'Valor Reapresentado', isMoeda: true, isPercentual: false, baseMin: 800, baseMax: 24000, color: '#d97706', badgeClass: 'badge-val-reapresentado' },
      valor_adicional: { nome: 'Valor Adicional', isMoeda: true, isPercentual: false, baseMin: 400, baseMax: 15000, color: '#7c3aed', badgeClass: 'badge-val-adicional' },
      valor_retorno: { nome: 'Valor Retorno', isMoeda: true, isPercentual: false, baseMin: 600, baseMax: 20000, color: '#0d9488', badgeClass: 'badge-val-retorno' },
      pct_recebido: { nome: '% Recebido', isMoeda: false, isPercentual: true, baseMin: 78.5, baseMax: 97.2, color: '#059669', badgeClass: 'badge-pct-recebido' },
      pct_glosado: { nome: '% Glosado', isMoeda: false, isPercentual: true, baseMin: 2.1, baseMax: 9.8, color: '#dc2626', badgeClass: 'badge-pct-glosado' },
      pct_glosa_aceita: { nome: '% Glosa Aceita', isMoeda: false, isPercentual: true, baseMin: 0.5, baseMax: 4.2, color: '#991b1b', badgeClass: 'badge-pct-glosa-aceita' },
      pct_adicional: { nome: '% Adicional', isMoeda: false, isPercentual: true, baseMin: 0.8, baseMax: 5.5, color: '#7c3aed', badgeClass: 'badge-pct-adicional' }
    };

    function formatarValor(val, isMoeda, isPercentual) {
      if (isPercentual) {
        return (val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + '%';
      }
      if (isMoeda) {
        return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
      }
      return Math.round(val || 0).toLocaleString('pt-BR');
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
                  let base = ind.baseMin + seedNorm * (ind.baseMax - ind.baseMin);
                  let v = ind.isPercentual ? base * (0.9 + (fatorMes - 1) * 0.2) : base * fatorMes * 0.25;
                  item.valorRaw = v;
                  item.valorFormatado = formatarValor(v, ind.isMoeda, ind.isPercentual);
                } else {
                  Object.keys(configIndicadores).forEach(function(k) {
                    let ind = configIndicadores[k];
                    let base = ind.baseMin + seedNorm * (ind.baseMax - ind.baseMin);
                    let v = ind.isPercentual ? base * (0.9 + (fatorMes - 1) * 0.2) : base * fatorMes * 0.25;
                    item[k] = v;
                    item[k + '_fmt'] = formatarValor(v, ind.isMoeda, ind.isPercentual);
                  });
                  item.valorRawSort = item.valor_faturado || 0;
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

                let valFaturado = (45000 + baseSeed * 380000) * multPeriodo * fatorPeriodo;
                let taxaGlosaReal = 0.025 + (baseSeed * 0.065); // 2.5% a 9%
                let valGlosado = valFaturado * taxaGlosaReal;

                let taxaGlosaAceitaReal = taxaGlosaReal * (0.20 + baseSeed * 0.35); // 20% a 55% da glosa
                let valGlosaAceita = valGlosado * (taxaGlosaAceitaReal / taxaGlosaReal);

                let valReapresentado = (valGlosado - valGlosaAceita) * (0.75 + baseSeed * 0.20);
                let valRetorno = valReapresentado * (0.65 + baseSeed * 0.30);

                let taxaAdicionalReal = 0.01 + (baseSeed * 0.035);
                let valAdicional = valFaturado * taxaAdicionalReal;

                let valRecebido = (valFaturado - valGlosado) + valRetorno + (valAdicional * 0.7);
                let valAReceber = Math.max(0, valFaturado - valRecebido - valGlosaAceita);

                let pctRecebido = (valRecebido / valFaturado) * 100;
                let pctGlosado = (valGlosado / valFaturado) * 100;
                let pctGlosaAceita = (valGlosaAceita / valFaturado) * 100;
                let pctAdicional = (valAdicional / valFaturado) * 100;

                let item = {
                  label: label,
                  valor_faturado: valFaturado,
                  valor_faturado_fmt: formatarValor(valFaturado, true, false),

                  valor_recebido: valRecebido,
                  valor_recebido_fmt: formatarValor(valRecebido, true, false),

                  valor_a_receber: valAReceber,
                  valor_a_receber_fmt: formatarValor(valAReceber, true, false),

                  valor_glosado: valGlosado,
                  valor_glosado_fmt: formatarValor(valGlosado, true, false),

                  valor_glosa_aceita: valGlosaAceita,
                  valor_glosa_aceita_fmt: formatarValor(valGlosaAceita, true, false),

                  valor_reapresentado: valReapresentado,
                  valor_reapresentado_fmt: formatarValor(valReapresentado, true, false),

                  valor_adicional: valAdicional,
                  valor_adicional_fmt: formatarValor(valAdicional, true, false),

                  valor_retorno: valRetorno,
                  valor_retorno_fmt: formatarValor(valRetorno, true, false),

                  pct_recebido: pctRecebido,
                  pct_recebido_fmt: formatarValor(pctRecebido, false, true),

                  pct_glosado: pctGlosado,
                  pct_glosado_fmt: formatarValor(pctGlosado, false, true),

                  pct_glosa_aceita: pctGlosaAceita,
                  pct_glosa_aceita_fmt: formatarValor(pctGlosaAceita, false, true),

                  pct_adicional: pctAdicional,
                  pct_adicional_fmt: formatarValor(pctAdicional, false, true),

                  valorRawSort: valFaturado
                };

                // Período anterior (determinístico por item, coerente entre indicadores)
                if (req.modo === 'comparativo') {
                  let fatorBase = 0.85 + (((index * 13 + label.length * 29) % 100) / 100) * 0.30; // 0.85 – 1.15
                  let jitter = function(n) { return 0.97 + ((((n * 37 + label.length * 11) % 100) / 100)) * 0.06; };

                  let fatAnt = valFaturado * fatorBase;
                  let gloAnt = valGlosado * fatorBase * jitter(1);
                  let aceAnt = valGlosaAceita * fatorBase * jitter(2);
                  let repAnt = valReapresentado * fatorBase * jitter(3);
                  let retAnt = valRetorno * fatorBase * jitter(4);
                  let adiAnt = valAdicional * fatorBase * jitter(5);
                  let recAnt = (fatAnt - gloAnt) + retAnt + (adiAnt * 0.7);
                  let aRecAnt = Math.max(0, fatAnt - recAnt - aceAnt);

                  item.valor_faturado_ant = fatAnt;
                  item.valor_recebido_ant = recAnt;
                  item.valor_a_receber_ant = aRecAnt;
                  item.valor_glosado_ant = gloAnt;
                  item.valor_glosa_aceita_ant = aceAnt;
                  item.valor_reapresentado_ant = repAnt;
                  item.valor_adicional_ant = adiAnt;
                  item.valor_retorno_ant = retAnt;

                  item.pct_recebido_ant = fatAnt > 0 ? (recAnt / fatAnt) * 100 : 0;
                  item.pct_glosado_ant = fatAnt > 0 ? (gloAnt / fatAnt) * 100 : 0;
                  item.pct_glosa_aceita_ant = fatAnt > 0 ? (aceAnt / fatAnt) * 100 : 0;
                  item.pct_adicional_ant = fatAnt > 0 ? (adiAnt / fatAnt) * 100 : 0;

                  // Δ% por indicador (consumido pelas células da tabela multivariada)
                  let paresVariacao = [
                    ['valor_faturado',      valFaturado,      fatAnt],
                    ['valor_recebido',      valRecebido,      recAnt],
                    ['valor_a_receber',     valAReceber,      aRecAnt],
                    ['valor_glosado',       valGlosado,       gloAnt],
                    ['valor_glosa_aceita',  valGlosaAceita,   aceAnt],
                    ['valor_reapresentado', valReapresentado, repAnt],
                    ['valor_adicional',     valAdicional,     adiAnt],
                    ['valor_retorno',       valRetorno,       retAnt],
                    ['pct_recebido',        pctRecebido,      item.pct_recebido_ant],
                    ['pct_glosado',         pctGlosado,       item.pct_glosado_ant],
                    ['pct_glosa_aceita',    pctGlosaAceita,   item.pct_glosa_aceita_ant],
                    ['pct_adicional',       pctAdicional,     item.pct_adicional_ant]
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

                if (indConfig.isPercentual) {
                  valorAtual = (indConfig.baseMin + baseSeed * (indConfig.baseMax - indConfig.baseMin)) * fatorPeriodo;
                  if (valorAtual < 0) valorAtual = 0;
                } else {
                  valorAtual = (indConfig.baseMin + baseSeed * (indConfig.baseMax - indConfig.baseMin)) * multPeriodo * fatorPeriodo;
                }

                let item = {
                  label: label,
                  valorRaw: valorAtual,
                  valorFormatado: formatarValor(valorAtual, indConfig.isMoeda, indConfig.isPercentual)
                };

                if (req.modo === 'comparativo') {
                  let variacaoPercentual = 0.88 + (baseSeed * 0.28); // -12% a +16%
                  let valorAnterior = valorAtual / variacaoPercentual;
                  item.valorAnteriorRaw = valorAnterior;
                  item.valorAnteriorFormatado = formatarValor(valorAnterior, indConfig.isMoeda, indConfig.isPercentual);
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
                color: indConfig.color,
                badgeClass: indConfig.badgeClass,
                totalBase: totalBase,
                dados: dadosMock
              });
            }

          } catch(e) {
            deferred.reject("Erro ao processar dados de faturamento e glosas.");
          }
        }, 200);

        return deferred.promise;
      }
    };
  });

})(window.angular);
