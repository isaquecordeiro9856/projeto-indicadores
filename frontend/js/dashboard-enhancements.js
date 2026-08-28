(function() {
  'use strict';

  function getDashboardScope() {
    if (!window.angular || !document.body) return null;
    return angular.element(document.body).scope();
  }

  function createButton(label, className, handler) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'dashboard-action ' + className;
    button.textContent = label;
    button.addEventListener('click', handler);
    return button;
  }

  function addToolbar() {
    var header = document.querySelector('.main-header');
    if (!header || header.querySelector('.dashboard-tools')) return;

    var tools = document.createElement('div');
    tools.className = 'dashboard-tools';

    var period = document.createElement('label');
    period.className = 'period-control';
    period.textContent = 'Período';
    var periodInput = document.createElement('input');
    periodInput.type = 'month';
    periodInput.className = 'period-input';
    periodInput.setAttribute('aria-label', 'Selecionar mês e ano');
    var monthSelect = header.querySelector('select[ng-model="mesRef"]');
    var yearSelect = header.querySelector('select[ng-model="anoRef"]');
    if (monthSelect && yearSelect) {
      periodInput.value = yearSelect.value + '-' + monthSelect.value;
      periodInput.addEventListener('change', function() {
        var value = periodInput.value.split('-');
        var scope = getDashboardScope();
        if (value.length !== 2 || !scope) return;
        scope.$applyAsync(function() {
          scope.anoRef = value[0];
          scope.mesRef = value[1];
          scope.carregarDados();
        });
      });
      period.appendChild(periodInput);
      tools.appendChild(period);
    }

    var search = document.createElement('input');
    search.type = 'search';
    search.className = 'dashboard-search';
    search.placeholder = 'Buscar nos resultados';
    search.setAttribute('aria-label', 'Buscar nos resultados');
    search.addEventListener('input', function() {
      var term = search.value.toLocaleLowerCase();
      document.querySelectorAll('.data-table tbody tr').forEach(function(row) {
        row.hidden = term && row.textContent.toLocaleLowerCase().indexOf(term) === -1;
      });
    });

    tools.appendChild(search);
    tools.appendChild(createButton('Atualizar', 'action-refresh', function() {
      var scope = getDashboardScope();
      if (scope && typeof scope.carregarDados === 'function') {
        scope.$applyAsync(function() { scope.carregarDados(); });
      }
    }));
    tools.appendChild(createButton('Evolução', 'action-evolution', function() {
      var item = Array.from(document.querySelectorAll('.sidebar-item')).find(function(option) {
        return option.textContent.toLocaleLowerCase().indexOf('evolução mensal') !== -1;
      });
      if (item) item.click();
    }));
    tools.appendChild(createButton('CSV', 'action-export', exportCsv));
    tools.appendChild(createButton('Imprimir', 'action-print', function() { window.print(); }));
    tools.appendChild(createButton('Tema', 'action-theme', toggleTheme));

    header.appendChild(tools);
  }

  function addSidebarSearch() {
    var sidebarHeader = document.querySelector('.sidebar-header');
    if (!sidebarHeader || sidebarHeader.querySelector('.sidebar-search')) return;

    var wrapper = document.createElement('label');
    wrapper.className = 'sidebar-search';
    wrapper.textContent = 'Filtrar opções';
    var input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Dimensões e indicadores';
    input.setAttribute('aria-label', 'Filtrar dimensões e indicadores');
    input.addEventListener('input', function() {
      var term = input.value.toLocaleLowerCase();
      document.querySelectorAll('.sidebar-item').forEach(function(item) {
        item.hidden = term && item.textContent.toLocaleLowerCase().indexOf(term) === -1;
      });
    });
    wrapper.appendChild(input);
    sidebarHeader.appendChild(wrapper);
  }

  function addSorting() {
    document.querySelectorAll('.data-table thead th').forEach(function(header, index) {
      if (header.dataset.sortable) return;
      header.dataset.sortable = 'true';
      header.title = 'Ordenar coluna';
      header.addEventListener('click', function() {
        var table = header.closest('table');
        var body = table.querySelector('tbody');
        var rows = Array.from(body.querySelectorAll('tr')).filter(function(row) { return !row.hidden; });
        var direction = header.dataset.direction === 'asc' ? -1 : 1;
        header.dataset.direction = direction === 1 ? 'asc' : 'desc';
        rows.sort(function(left, right) {
          var a = left.children[index] ? left.children[index].textContent.trim() : '';
          var b = right.children[index] ? right.children[index].textContent.trim() : '';
          var numberA = parseFloat(a.replace(/[^0-9,-]/g, '').replace('.', '').replace(',', '.'));
          var numberB = parseFloat(b.replace(/[^0-9,-]/g, '').replace('.', '').replace(',', '.'));
          if (!isNaN(numberA) && !isNaN(numberB)) return (numberA - numberB) * direction;
          return a.localeCompare(b, 'pt-BR') * direction;
        });
        rows.forEach(function(row) { body.appendChild(row); });
      });
    });
  }

  function exportCsv() {
    var table = document.querySelector('.data-table');
    if (!table) return;
    var lines = Array.from(table.querySelectorAll('tr')).filter(function(row) { return !row.hidden; }).map(function(row) {
      return Array.from(row.children).map(function(cell) {
        return '"' + cell.textContent.trim().replace(/"/g, '""') + '"';
      }).join(';');
    });
    var blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = (document.title || 'dashboard').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function toggleTheme() {
    document.body.classList.toggle('theme-dark');
    localStorage.setItem('tasy_theme', document.body.classList.contains('theme-dark') ? 'dark' : 'light');
  }

  function syncPeriodInput() {
    var input = document.querySelector('.period-input');
    var monthSelect = document.querySelector('select[ng-model="mesRef"]');
    var yearSelect = document.querySelector('select[ng-model="anoRef"]');
    if (input && monthSelect && yearSelect) input.value = yearSelect.value + '-' + monthSelect.value;
  }

  function initialize() {
    if (localStorage.getItem('tasy_theme') === 'dark') document.body.classList.add('theme-dark');
    addToolbar();
    addSidebarSearch();
    addSorting();
    document.querySelectorAll('select[ng-model="mesRef"], select[ng-model="anoRef"]').forEach(function(select) {
      select.addEventListener('change', syncPeriodInput);
    });
    new MutationObserver(addSorting).observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener('DOMContentLoaded', initialize);
})();
