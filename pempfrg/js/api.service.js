/* ============================================================= */
/* API SERVICE — Produção / Faturamento / MatMed (TASY Analytics)*/
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
    var USAR_MOCK = true;
    var ENDPOINT = '/api/hospital/producao-faturamento-matmed';

    // BASE DE DADOS MOCK PARA AS 12 DIMENSÕES (+ "mes" p/ tendência e drill-down)
    const basesDeDados = {
      estabelecimento: [
        'Hospital Central - Matriz', 'Hospital Santa Helena', 'Pronto Atendimento Sul',
        'Maternidade Luz e Vida', 'Hospital Infantil da Criança', 'Instituto Regional de Oncologia',
        'Centro de Trauma e Ortopedia', 'Unidade Hospitalar Leste'
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
      convenio: [
        'Unimed Regional', 'Bradesco Saúde', 'SulAmérica Saúde', 'Amil Assistência Médica',
        'NotreDame Intermédica', 'Cassi Caixa de Assistência', 'Allianz Saúde', 'Prevent Senior',
        'Porto Seguro Saúde', 'Particular Direto', 'Golden Cross', 'Mediservice',
        'IPERGS / Estado', 'Geap Autogestão'
      ],
      tipo_atendimento: [
        'Internação Hospitalar Cirúrgica', 'Internação Clínica Geral',
        'Pronto Atendimento (Urgência)', 'Consulta Ambulatorial', 'SADT / Exames Diagnósticos',
        'Cirurgia Ambulatorial (Hospital Dia)', 'Home Care / Assistência Domiciliar'
      ],
      medico_executor: [
        'Dr. Carlos Eduardo Silva', 'Dra. Ana Paula Mendonça', 'Dr. Roberto Santos Guimarães',
        'Dra. Camila Lima Fontes', 'Dr. Fernando Costa Nogueira', 'Dra. Juliana Alves Pereira',
        'Dr. Marcelo Vieira Ramos', 'Dra. Beatriz Toledo Martins'
      ],
      paciente: [
        'PAC-00841 - João P.', 'PAC-00842 - Maria S.', 'PAC-00843 - Antonio R.',
        'PAC-00844 - Francisca L.', 'PAC-00845 - Pedro A.', 'PAC-00846 - Lucia F.',
        'PAC-00847 - Marcos V.', 'PAC-00848 - Rita C.'
      ],
      grupo_procedimentos: [
        'Consultas', 'Exames Laboratoriais', 'Radiologia e Imagem', 'Tomografia e Ressonância',
        'Cirurgias Eletivas', 'Cirurgias de Urgência', 'Terapias Renais', 'Quimioterapia',
        'Fisioterapia', 'Hemodinâmica', 'Endoscopia', 'Cardiologia Diagnóstica'
      ],
      tipo_procedimentos: [
        'Consulta Ambulatorial', 'Exame Laboratorial', 'Exame de Imagem', 'Procedimento Cirúrgico',
        'Procedimento Endoscópico', 'Sessão Terapêutica', 'Urgência e Emergência'
      ],
      procedimentos: [
        'Consulta Cardiológica', 'Hemograma Completo', 'Tomografia de Crânio', 'Ressonância Magnética',
        'Colecistectomia Videolaparoscópica', 'Artroscopia de Joelho', 'Cateterismo Cardíaco',
        'Hemodiálise (Sessão)', 'Quimioterapia (Ciclo)', 'Colonoscopia Diagnóstica', 'Ecocardiograma'
      ],
      grupo_matmed: [
        'Materiais de Consumo', 'Medicamentos Oral', 'Medicamentos Injectável',
        'Órteses e Próteses (OPME)', 'Kits Cirúrgicos', 'Soluções e Hemocomponentes'
      ],
      tipo_matmed: [
        'Material Simples', 'Material Especial', 'Medicamento Padronizado',
        'Medicamento Alto Custo', 'OPME Nacional', 'OPME Importado'
      ],
      matmed: [
        'Luva Cirúrgica Estéril (Par)', 'Soro Fisiológico 0,9% 500ml', 'Dipirona 500mg (Comp.)',
        'Stent Coronariano Farmacológico', 'Placa de Titânio 6 Furos', 'Fio Sutura Mononylon 3-0',
        'Ondansetrona 8mg (Amp.)', 'Cateter Central Duplo Lúmen'
      ],
      mes: [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ]
    };

    const nomesDimensao = {
      estabelecimento: 'Estabelecimento',
      setor: 'Setor',
      tipo_convenio: 'Tipo Convênio',
      convenio: 'Convênio',
      tipo_atendimento: 'Tipo Atendimento',
      medico_executor: 'Médico Executor',
      paciente: 'Paciente',
      grupo_procedimentos: 'Grupo Proc./Exames',
      tipo_procedimentos: 'Tipo Proc./Exames',
      procedimentos: 'Procedimento/Exame',
      grupo_matmed: 'Grupo Mat/Med',
      tipo_matmed: 'Tipo Mat/Med',
      matmed: 'Material/Medicamento'
    };

    // CONFIGURAÇÃO DOS 9 INDICADORES / INFORMAÇÕES
    // (% Glosa é derivada — calculada como valor_glosado ÷ valor_faturado)
    const configIndicadores = {
      qtd_contas:        { nome: 'Qtd. Contas',       isMoeda: false, isPercentual: false, baseMin: 20,   baseMax: 320,     color: '#475569', badgeClass: 'badge-qtd-contas' },
      qtd_procedimentos: { nome: 'Qtd. Proc./Exames', isMoeda: false, isPercentual: false, baseMin: 60,   baseMax: 2400,    color: '#0284c7', badgeClass: 'badge-qtd-proc' },
      qtd_matmed:        { nome: 'Qtd. Mat./Med.',    isMoeda: false, isPercentual: false, baseMin: 40,   baseMax: 1600,    color: '#7c3aed', badgeClass: 'badge-qtd-matmed' },
      valor_produzido:   { nome: 'Valor Produzido',   isMoeda: true,  isPercentual: false, baseMin: 48000, baseMax: 520000, color: '#d97706', badgeClass: 'badge-val-produzido' },
      valor_faturado:    { nome: 'Valor Faturado',    isMoeda: true,  isPercentual: false, baseMin: 45000, baseMax: 480000, color: '#2563eb', badgeClass: 'badge-val-faturado' },
      valor_recebido:    { nome: 'Valor Recebido',    isMoeda: true,  isPercentual: false, baseMin: 38000, baseMax: 430000, color: '#059669', badgeClass: 'badge-val-recebido' },
      valor_glosado:     { nome: 'Valor Glosado',     isMoeda: true,  isPercentual: false, baseMin: 1200,  baseMax: 35000,  color: '#dc2626', badgeClass: 'badge-val-glosado' },
      valor_adicional:   { nome: 'Valor Adicional',   isMoeda: true,  isPercentual: false, baseMin: 400,   baseMax: 15000,  color: '#e11d48', badgeClass: 'badge-val-adicional' },
      valor_medico:      { nome: 'Repasse Médico',    isMoeda: true,  isPercentual: false, baseMin: 12000, baseMax: 180000, color: '#9333ea', badgeClass: 'badge-val-medico' }
    };

    function formatarValor(val, cfg) {
      if (!cfg) return Math.round(val || 0).toLocaleString('pt-BR');
      if (cfg.isPercentual) {
        return Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + '%';
      }
      if (cfg.isMoeda) {
        return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
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
          return $http.post(ENDPOINT, req).then(function(response) {
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
                  let v = ind.isPercentual
                    ? ind.baseMin + seedNorm * (ind.baseMax - ind.baseMin)
                    : (ind.baseMin + seedNorm * (ind.baseMax - ind.baseMin)) * fatorMes * (ind.isMoeda ? 0.25 : 1);
                  item.valorRaw = v;
                  item.valorFormatado = formatarValor(v, ind);
                } else {
                  Object.keys(configIndicadores).forEach(function(k) {
                    let ind = configIndicadores[k];
                    let v = (ind.baseMin + seedNorm * (ind.baseMax - ind.baseMin)) * fatorMes * (ind.isMoeda ? 0.25 : 1);
                    item[k] = v;
                    item[k + '_fmt'] = formatarValor(v, ind);
                  });
                  let fatItem = item.valor_faturado || 0;
                  let gloItem = item.valor_glosado || 0;
                  item.taxa_glosa = fatItem > 0 ? (gloItem / fatItem) * 100 : 0;
                  item.taxa_glosa_fmt = formatarValor(item.taxa_glosa, { isPercentual: true });
                  item.valorRawSort = fatItem;
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
            if (req.periodoValor instanceof Date) {
              let marca = req.periodoValor.getFullYear() * 12 + req.periodoValor.getMonth();
              fatorPeriodo = 1 + (((marca * 37) % 11) - 5) * 0.035;
            } else if (typeof req.periodoValor === 'number' && req.periodoValor > 0) {
              fatorPeriodo = 1 + (((Math.floor(req.periodoValor) * 29) % 9) - 4) * 0.04;
            }

            let dadosMock = [];

            if (req.indicador === 'todos') {
              labelsBase.forEach(function(label, index) {
                let baseSeed = (index * 17 + label.length * 23) % 100 / 100;

                let qtdContas = Math.max(1, Math.round((20 + baseSeed * 280) * multPeriodo * fatorPeriodo));
                let qtdProc = Math.round(qtdContas * (3 + baseSeed * 12));
                let qtdMatmed = Math.round(qtdContas * (1.5 + baseSeed * 6));

                let valProduzido = (48000 + baseSeed * 470000) * multPeriodo * fatorPeriodo;
                let taxaGlosaReal = 0.02 + (baseSeed * 0.07); // 2% a 9%
                let valFaturado = valProduzido * (0.90 + baseSeed * 0.08); // produção ≥ faturado
                let valGlosado = valFaturado * taxaGlosaReal;

                let valAdicional = valFaturado * (0.008 + baseSeed * 0.03);

                let taxaRepasse = 0.25 + baseSeed * 0.20; // 25% a 45% do faturado
                let valMedico = valFaturado * taxaRepasse;

                let valRecebido = (valFaturado - valGlosado) + (valAdicional * 0.6);

                let taxaGlosa = valFaturado > 0 ? (valGlosado / valFaturado) * 100 : 0;

                let item = {
                  label: label,
                  qtd_contas: qtdContas,
                  qtd_contas_fmt: formatarValor(qtdContas, configIndicadores.qtd_contas),

                  qtd_procedimentos: qtdProc,
                  qtd_procedimentos_fmt: formatarValor(qtdProc, configIndicadores.qtd_procedimentos),

                  qtd_matmed: qtdMatmed,
                  qtd_matmed_fmt: formatarValor(qtdMatmed, configIndicadores.qtd_matmed),

                  valor_produzido: valProduzido,
                  valor_produzido_fmt: formatarValor(valProduzido, configIndicadores.valor_produzido),

                  valor_faturado: valFaturado,
                  valor_faturado_fmt: formatarValor(valFaturado, configIndicadores.valor_faturado),

                  valor_recebido: valRecebido,
                  valor_recebido_fmt: formatarValor(valRecebido, configIndicadores.valor_recebido),

                  valor_glosado: valGlosado,
                  valor_glosado_fmt: formatarValor(valGlosado, configIndicadores.valor_glosado),

                  valor_adicional: valAdicional,
                  valor_adicional_fmt: formatarValor(valAdicional, configIndicadores.valor_adicional),

                  valor_medico: valMedico,
                  valor_medico_fmt: formatarValor(valMedico, configIndicadores.valor_medico),

                  taxa_glosa: taxaGlosa,
                  taxa_glosa_fmt: formatarValor(taxaGlosa, { isPercentual: true }),

                  valorRawSort: valFaturado
                };

                // Período anterior (determinístico por item, coerente entre indicadores)
                if (req.modo === 'comparativo') {
                  let fatorBase = 0.85 + (((index * 13 + label.length * 29) % 100) / 100) * 0.30; // 0.85 – 1.15
                  let jitter = function(n) { return 0.97 + ((((n * 37 + label.length * 11) % 100) / 100)) * 0.06; };

                  let contasAnt = Math.max(1, Math.round(qtdContas / fatorBase));
                  let procAnt = Math.round(qtdProc / fatorBase / jitter(1));
                  let matmedAnt = Math.round(qtdMatmed / fatorBase / jitter(2));
                  let prodAnt = valProduzido / fatorBase;
                  let fatAnt = valFaturado / fatorBase;
                  let gloAnt = valGlosado / fatorBase / jitter(3);
                  let adiAnt = valAdicional / fatorBase / jitter(4);
                  let medAnt = valMedico / fatorBase / jitter(5);
                  let recAnt = (fatAnt - gloAnt) + (adiAnt * 0.6);

                  item.qtd_contas_ant = contasAnt;
                  item.qtd_procedimentos_ant = procAnt;
                  item.qtd_matmed_ant = matmedAnt;
                  item.valor_produzido_ant = prodAnt;
                  item.valor_faturado_ant = fatAnt;
                  item.valor_recebido_ant = recAnt;
                  item.valor_glosado_ant = gloAnt;
                  item.valor_adicional_ant = adiAnt;
                  item.valor_medico_ant = medAnt;
                  item.taxa_glosa_ant = fatAnt > 0 ? (gloAnt / fatAnt) * 100 : 0;

                  // Δ% por indicador (consumido pelas células da tabela multivariada)
                  let paresVariacao = [
                    ['qtd_contas',        qtdContas,    contasAnt],
                    ['qtd_procedimentos', qtdProc,      procAnt],
                    ['qtd_matmed',        qtdMatmed,    matmedAnt],
                    ['valor_produzido',   valProduzido, prodAnt],
                    ['valor_faturado',    valFaturado,  fatAnt],
                    ['valor_recebido',    valRecebido,  recAnt],
                    ['valor_glosado',     valGlosado,   gloAnt],
                    ['valor_adicional',   valAdicional, adiAnt],
                    ['valor_medico',      valMedico,    medAnt],
                    ['taxa_glosa',        taxaGlosa,    item.taxa_glosa_ant]
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
              if (req.limite !== 'todos') dadosMock = dadosMock.slice(0, parseInt(req.limite));

              deferred.resolve({
                nomeDimensao: nomesDimensao[req.dimensao] || req.dimensao,
                modoTodos: true,
                totalBase: totalBase,
                dados: dadosMock
              });

            } else {
              let indConfig = configIndicadores[req.indicador];

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
                  valorFormatado: formatarValor(valorAtual, indConfig)
                };

                if (req.modo === 'comparativo') {
                  let variacaoPercentual = 0.88 + (baseSeed * 0.28); // -12% a +16%
                  let valorAnterior = valorAtual / variacaoPercentual;
                  item.valorAnteriorRaw = valorAnterior;
                  item.valorAnteriorFormatado = formatarValor(valorAnterior, indConfig);
                  item.variacao = ((valorAtual - valorAnterior) / valorAnterior) * 100;
                }

                dadosMock.push(item);
              });

              if (req.ordem === 'desc') dadosMock.sort((a, b) => b.valorRaw - a.valorRaw);
              else dadosMock.sort((a, b) => a.valorRaw - b.valorRaw);

              let totalBase = dadosMock.length;
              if (req.limite !== 'todos') dadosMock = dadosMock.slice(0, parseInt(req.limite));

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
            deferred.reject("Erro ao processar dados de produção, faturamento e MatMed.");
          }
        }, 200);

        return deferred.promise;
      }
    };
  });

})(window.angular);
