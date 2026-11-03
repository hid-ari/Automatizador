(function () {
  if (document.getElementById('digeig-auto-wrapper')) return;

  let isRunning = false;
  let stopRequested = false;

  // Estado persistente de las cuatro tablas de reporte
  let diffZeroList = [];
  let unratedScoredList = [];
  let errorList = [];
  let notEvaluatedList = [];

  try {
    diffZeroList = JSON.parse(localStorage.getItem('digeig_table_diff_zero') || '[]');
    unratedScoredList = JSON.parse(localStorage.getItem('digeig_table_unrated_scored') || '[]');
    errorList = JSON.parse(localStorage.getItem('digeig_table_errors') || '[]');
    notEvaluatedList = JSON.parse(localStorage.getItem('digeig_table_not_evaluated') || '[]');
  } catch (e) {
    diffZeroList = [];
    unratedScoredList = [];
    errorList = [];
    notEvaluatedList = [];
  }

  // Utilidad para normalizar texto (sin acentos y en minúsculas)
  function normalize(str) {
    return (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Crear contenedor con las 2 tablas a la izquierda y el panel principal a la derecha
  const wrapper = document.createElement('div');
  wrapper.id = 'digeig-auto-wrapper';
  wrapper.innerHTML = `
    <!-- PANEL DE LAS 2 TABLAS DE REPORTE (AL LADO DEL FLOTANTE) -->
    <div id="digeig-tables-panel">
      <div class="digeig-tables-header" id="digeig-tables-header-toggle">
        <div class="digeig-auto-title">
          <span>📊 Reportes de Instituciones</span>
        </div>
        <button class="digeig-auto-toggle" id="digeig-tables-min-btn" title="Minimizar / Expandir tablas">−</button>
      </div>
      <div class="digeig-tables-body">
        <!-- TABLA 1: Nombre diferente y en 0 / No encontradas -->
        <div class="digeig-table-section">
          <div class="digeig-table-bar">
            <span>1. Nombre diferente / En 0 (<span id="digeig-count-t1">0</span>)</span>
            <div class="digeig-table-bar-actions">
              <button class="digeig-mini-btn" id="digeig-copy-t1" title="Copiar para Excel">📋 Copiar</button>
              <button class="digeig-mini-btn" id="digeig-clear-t1" title="Limpiar tabla">🗑️</button>
            </div>
          </div>
          <div class="digeig-table-scroll">
            <table class="digeig-report-table">
              <thead>
                <tr>
                  <th>Nombre Buscado</th>
                  <th>Nombre en Página</th>
                  <th>Estado / Calif.</th>
                </tr>
              </thead>
              <tbody id="digeig-tbody-t1">
                <tr><td colspan="3" style="text-align:center;color:#94a3b8;">Sin registros aún</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- TABLA 2: Puntuadas pero nadie las había evaluado en otros aspectos -->
        <div class="digeig-table-section">
          <div class="digeig-table-bar">
            <span>2. Puntuadas sin evaluar otros aspectos (<span id="digeig-count-t2">0</span>)</span>
            <div class="digeig-table-bar-actions">
              <button class="digeig-mini-btn" id="digeig-copy-t2" title="Copiar para Excel">📋 Copiar</button>
              <button class="digeig-mini-btn" id="digeig-clear-t2" title="Limpiar tabla">🗑️</button>
            </div>
          </div>
          <div class="digeig-table-scroll">
            <table class="digeig-report-table">
              <thead>
                <tr>
                  <th>Institución</th>
                  <th>Período</th>
                  <th>Analista</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody id="digeig-tbody-t2">
                <tr><td colspan="4" style="text-align:center;color:#94a3b8;">Sin registros aún</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- TABLA 3: Instituciones que dieron Error -->
        <div class="digeig-table-section">
          <div class="digeig-table-bar">
            <span>3. Con Error / No procesadas (<span id="digeig-count-t3">0</span>)</span>
            <div class="digeig-table-bar-actions">
              <button class="digeig-mini-btn" id="digeig-retry-t3" title="Volver a poner en la lista de pendientes">🔄 Reintentar</button>
              <button class="digeig-mini-btn" id="digeig-copy-t3" title="Copiar para Excel">📋 Copiar</button>
              <button class="digeig-mini-btn" id="digeig-clear-t3" title="Limpiar tabla">🗑️</button>
            </div>
          </div>
          <div class="digeig-table-scroll">
            <table class="digeig-report-table">
              <thead>
                <tr>
                  <th>Institución</th>
                  <th>Motivo del Error</th>
                </tr>
              </thead>
              <tbody id="digeig-tbody-t3">
                <tr><td colspan="2" style="text-align:center;color:#94a3b8;">Sin errores</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- TABLA 4: No Evaluadas (Modo Solo Confirmar) -->
        <div class="digeig-table-section">
          <div class="digeig-table-bar">
            <span>4. No Evaluadas / Pendientes (<span id="digeig-count-t4">0</span>)</span>
            <div class="digeig-table-bar-actions">
              <button class="digeig-mini-btn" id="digeig-retry-t4" title="Pasar estas instituciones a la caja de texto">🔄 Pasar a lista</button>
              <button class="digeig-mini-btn" id="digeig-copy-t4" title="Copiar para Excel">📋 Copiar</button>
              <button class="digeig-mini-btn" id="digeig-clear-t4" title="Limpiar tabla">🗑️</button>
            </div>
          </div>
          <div class="digeig-table-scroll">
            <table class="digeig-report-table">
              <thead>
                <tr>
                  <th>Institución</th>
                  <th>Período</th>
                  <th>Analista</th>
                  <th>Estado / Calif.</th>
                </tr>
              </thead>
              <tbody id="digeig-tbody-t4">
                <tr><td colspan="4" style="text-align:center;color:#94a3b8;">Sin registros aún</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- PANEL PRINCIPAL DE AUTOMATIZACIÓN -->
    <div id="digeig-auto-panel">
      <div class="digeig-auto-header" id="digeig-header-toggle">
        <div class="digeig-auto-title">
          <span>🤖 Automatizador DIGEIG (Datos Abiertos)</span>
        </div>
        <button class="digeig-auto-toggle" id="digeig-min-btn" title="Minimizar / Expandir">−</button>
      </div>
      <div class="digeig-auto-body">
        <div class="digeig-auto-label">
          <span>Lista de Instituciones (1 por línea):</span>
          <span id="digeig-counter">0 pendientes</span>
        </div>
        <textarea
          id="digeig-inst-list"
          class="digeig-auto-textarea"
          placeholder="Pega aquí los nombres de las instituciones (uno por línea)...&#10;Ejemplo:&#10;Instituto Nacional de Administración Pública (INAP)"
        ></textarea>
        <div class="digeig-auto-options digeig-switch-row">
          <div class="digeig-switch-info">
            <span class="digeig-switch-title">Solo confirmar evaluación:</span>
            <span id="digeig-confirm-badge" class="digeig-mode-badge mode-off">Desactivado</span>
          </div>
          <label class="digeig-switch digeig-switch-blue" title="Solo verifica si está evaluada sin modificar nada y guarda las no evaluadas en la Tabla 4">
            <input type="checkbox" id="digeig-confirm-only-switch" />
            <span class="digeig-slider"></span>
          </label>
        </div>
        <div class="digeig-auto-options digeig-switch-row" id="digeig-mark-option-row">
          <div class="digeig-switch-info">
            <span class="digeig-switch-title">Opción a marcar:</span>
            <span id="digeig-mode-badge" class="digeig-mode-badge mode-cumple">Cumple 100% (5.00)</span>
          </div>
          <label class="digeig-switch" title="Cambiar entre Cumple 100% (5.00) y No cumple (0.00)">
            <input type="checkbox" id="digeig-no-cumple-switch" />
            <span class="digeig-slider"></span>
          </label>
        </div>
        <div class="digeig-auto-options">
          <span>Espera entre pasos (ms):</span>
          <input type="number" id="digeig-delay" value="900" min="200" max="10000" step="100" />
        </div>
        <div class="digeig-auto-options">
          <span>Espera al terminar institución (ms):</span>
          <input type="number" id="digeig-after-inst-delay" value="2000" min="0" max="60000" step="500" />
        </div>
        <div class="digeig-auto-controls">
          <button id="digeig-start-btn" class="digeig-btn digeig-btn-primary">▶ Iniciar Lista</button>
          <button id="digeig-stop-btn" class="digeig-btn digeig-btn-stop" disabled>⏹ Detener</button>
        </div>
        <div class="digeig-auto-controls">
          <button id="digeig-single-btn" class="digeig-btn digeig-btn-secondary" title="Ejecuta el proceso en la fila actual o modal abierto">
            ⚡ Calificar actual (1 clic)
          </button>
        </div>
        <div class="digeig-auto-log" id="digeig-log">
          <div class="digeig-log-item digeig-log-info">Listo. Pega las instituciones y presiona "Iniciar Lista".</div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(wrapper);

  const panel = document.getElementById('digeig-auto-panel');
  const tablesPanel = document.getElementById('digeig-tables-panel');
  const textarea = document.getElementById('digeig-inst-list');
  const counterEl = document.getElementById('digeig-counter');
  const startBtn = document.getElementById('digeig-start-btn');
  const stopBtn = document.getElementById('digeig-stop-btn');
  const singleBtn = document.getElementById('digeig-single-btn');
  const delayInput = document.getElementById('digeig-delay');
  const afterInstDelayInput = document.getElementById('digeig-after-inst-delay');
  const confirmOnlySwitch = document.getElementById('digeig-confirm-only-switch');
  const confirmBadge = document.getElementById('digeig-confirm-badge');
  const markOptionRow = document.getElementById('digeig-mark-option-row');
  const noCumpleSwitch = document.getElementById('digeig-no-cumple-switch');
  const modeBadge = document.getElementById('digeig-mode-badge');
  const logContainer = document.getElementById('digeig-log');
  const minBtn = document.getElementById('digeig-min-btn');
  const headerToggle = document.getElementById('digeig-header-toggle');
  const tablesMinBtn = document.getElementById('digeig-tables-min-btn');
  const tablesHeaderToggle = document.getElementById('digeig-tables-header-toggle');

  const tbodyT1 = document.getElementById('digeig-tbody-t1');
  const tbodyT2 = document.getElementById('digeig-tbody-t2');
  const tbodyT3 = document.getElementById('digeig-tbody-t3');
  const tbodyT4 = document.getElementById('digeig-tbody-t4');
  const countT1 = document.getElementById('digeig-count-t1');
  const countT2 = document.getElementById('digeig-count-t2');
  const countT3 = document.getElementById('digeig-count-t3');
  const countT4 = document.getElementById('digeig-count-t4');

  function renderTables() {
    countT1.textContent = diffZeroList.length;
    if (diffZeroList.length === 0) {
      tbodyT1.innerHTML =
        '<tr><td colspan="3" style="text-align:center;color:#94a3b8;">Sin registros aún</td></tr>';
    } else {
      tbodyT1.innerHTML = diffZeroList
        .map(
          (item) => `
          <tr>
            <td>${item.searched}</td>
            <td>${item.pageName}</td>
            <td><span class="digeig-badge-warn">${item.status}</span></td>
          </tr>
        `
        )
        .join('');
    }

    countT2.textContent = unratedScoredList.length;
    if (unratedScoredList.length === 0) {
      tbodyT2.innerHTML =
        '<tr><td colspan="4" style="text-align:center;color:#94a3b8;">Sin registros aún</td></tr>';
    } else {
      tbodyT2.innerHTML = unratedScoredList
        .map(
          (item) => `
          <tr>
            <td>${item.institucion}</td>
            <td>${item.periodo}</td>
            <td>${item.analista}</td>
            <td><span class="digeig-badge-info">${item.accion}</span></td>
          </tr>
        `
        )
        .join('');
    }

    countT3.textContent = errorList.length;
    if (errorList.length === 0) {
      tbodyT3.innerHTML =
        '<tr><td colspan="2" style="text-align:center;color:#94a3b8;">Sin errores</td></tr>';
    } else {
      tbodyT3.innerHTML = errorList
        .map(
          (item) => `
          <tr>
            <td>${item.institucion}</td>
            <td><span class="digeig-badge-err">${item.motivo}</span></td>
          </tr>
        `
        )
        .join('');
    }

    countT4.textContent = notEvaluatedList.length;
    if (notEvaluatedList.length === 0) {
      tbodyT4.innerHTML =
        '<tr><td colspan="4" style="text-align:center;color:#94a3b8;">Sin registros aún</td></tr>';
    } else {
      tbodyT4.innerHTML = notEvaluatedList
        .map(
          (item) => `
          <tr>
            <td>${item.institucion}</td>
            <td>${item.periodo}</td>
            <td>${item.analista}</td>
            <td><span class="digeig-badge-warn">${item.estado}</span></td>
          </tr>
        `
        )
        .join('');
    }

    localStorage.setItem('digeig_table_diff_zero', JSON.stringify(diffZeroList));
    localStorage.setItem('digeig_table_unrated_scored', JSON.stringify(unratedScoredList));
    localStorage.setItem('digeig_table_errors', JSON.stringify(errorList));
    localStorage.setItem('digeig_table_not_evaluated', JSON.stringify(notEvaluatedList));
  }

  function addDiffZeroRecord(searched, pageName, status) {
    const exists = diffZeroList.some(
      (x) => normalize(x.searched) === normalize(searched) && normalize(x.pageName) === normalize(pageName)
    );
    if (!exists) {
      diffZeroList.push({ searched, pageName, status });
      renderTables();
    }
  }

  function addUnratedScoredRecord(institucion, periodo, analista, accion) {
    const exists = unratedScoredList.some(
      (x) => normalize(x.institucion) === normalize(institucion) && normalize(x.periodo) === normalize(periodo)
    );
    if (!exists) {
      unratedScoredList.push({ institucion, periodo, analista, accion });
      renderTables();
    }
  }

  function addErrorRecord(institucion, motivo) {
    const existingIdx = errorList.findIndex(
      (x) => normalize(x.institucion) === normalize(institucion)
    );
    if (existingIdx >= 0) {
      errorList[existingIdx].motivo = motivo;
    } else {
      errorList.push({ institucion, motivo });
    }
    renderTables();
  }

  function addNotEvaluatedRecord(institucion, periodo, analista, estado) {
    const existingIdx = notEvaluatedList.findIndex(
      (x) =>
        normalize(x.institucion) === normalize(institucion) &&
        normalize(x.periodo) === normalize(periodo)
    );
    if (existingIdx >= 0) {
      notEvaluatedList[existingIdx].analista = analista;
      notEvaluatedList[existingIdx].estado = estado;
    } else {
      notEvaluatedList.push({ institucion, periodo, analista, estado });
    }
    renderTables();
  }

  renderTables();

  // Botones de copiar y limpiar Tabla 1
  document.getElementById('digeig-copy-t1').addEventListener('click', () => {
    if (diffZeroList.length === 0) return;
    const text = [
      'Nombre Buscado\tNombre en Página\tEstado / Calificación',
      ...diffZeroList.map((r) => `${r.searched}\t${r.pageName}\t${r.status}`),
    ].join('\n');
    navigator.clipboard.writeText(text);
    log('📋 Tabla 1 copiada al portapapeles (lista para pegar en Excel).', 'ok');
  });

  document.getElementById('digeig-clear-t1').addEventListener('click', () => {
    diffZeroList = [];
    renderTables();
  });

  // Botones de copiar y limpiar Tabla 2
  document.getElementById('digeig-copy-t2').addEventListener('click', () => {
    if (unratedScoredList.length === 0) return;
    const text = [
      'Institución\tPeríodo\tAnalista\tAcción',
      ...unratedScoredList.map((r) => `${r.institucion}\t${r.periodo}\t${r.analista}\t${r.accion}`),
    ].join('\n');
    navigator.clipboard.writeText(text);
    log('📋 Tabla 2 copiada al portapapeles (lista para pegar en Excel).', 'ok');
  });

  document.getElementById('digeig-clear-t2').addEventListener('click', () => {
    unratedScoredList = [];
    renderTables();
  });

  // Botones de reintentar, copiar y limpiar Tabla 3 (Errores)
  document.getElementById('digeig-retry-t3').addEventListener('click', () => {
    if (errorList.length === 0) return;
    const currentLines = textarea.value
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const toRetry = errorList.map((e) => e.institucion);
    textarea.value = [...currentLines, ...toRetry].join('\n');
    errorList = [];
    renderTables();
    updateCounter();
    log(`🔄 ${toRetry.length} institución(es) con error devueltas a la lista.`, 'info');
  });

  document.getElementById('digeig-copy-t3').addEventListener('click', () => {
    if (errorList.length === 0) return;
    const text = [
      'Institución\tMotivo del Error',
      ...errorList.map((r) => `${r.institucion}\t${r.motivo}`),
    ].join('\n');
    navigator.clipboard.writeText(text);
    log('📋 Tabla 3 (Errores) copiada al portapapeles.', 'ok');
  });

  document.getElementById('digeig-clear-t3').addEventListener('click', () => {
    errorList = [];
    renderTables();
  });

  // Botones de pasar a lista, copiar y limpiar Tabla 4 (No Evaluadas)
  document.getElementById('digeig-retry-t4').addEventListener('click', () => {
    if (notEvaluatedList.length === 0) return;
    const currentLines = textarea.value
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const toAdd = notEvaluatedList.map((e) => e.institucion);
    textarea.value = [...currentLines, ...toAdd].join('\n');
    updateCounter();
    log(`🔄 ${toAdd.length} institución(es) no evaluadas pasadas a la lista.`, 'info');
  });

  document.getElementById('digeig-copy-t4').addEventListener('click', () => {
    if (notEvaluatedList.length === 0) return;
    const text = [
      'Institución\tPeríodo\tAnalista\tEstado / Calificación',
      ...notEvaluatedList.map((r) => `${r.institucion}\t${r.periodo}\t${r.analista}\t${r.estado}`),
    ].join('\n');
    navigator.clipboard.writeText(text);
    log('📋 Tabla 4 (No Evaluadas) copiada al portapapeles (lista para pegar en Excel).', 'ok');
  });

  document.getElementById('digeig-clear-t4').addEventListener('click', () => {
    notEvaluatedList = [];
    renderTables();
  });

  // Restaurar lista y tiempos guardados si existen
  const savedList = localStorage.getItem('digeig_auto_inst_list');
  if (savedList) {
    textarea.value = savedList;
  }
  const savedStepDelay = localStorage.getItem('digeig_auto_step_delay');
  if (savedStepDelay) {
    delayInput.value = savedStepDelay;
  }
  const savedAfterInstDelay = localStorage.getItem('digeig_auto_after_inst_delay');
  if (savedAfterInstDelay) {
    afterInstDelayInput.value = savedAfterInstDelay;
  }
  const savedNoCumple = localStorage.getItem('digeig_auto_no_cumple');
  if (savedNoCumple === 'true') {
    noCumpleSwitch.checked = true;
  }
  const savedConfirmOnly = localStorage.getItem('digeig_auto_confirm_only');
  if (savedConfirmOnly === 'true') {
    confirmOnlySwitch.checked = true;
  }

  function updateModeBadge() {
    const isNoCumple = noCumpleSwitch.checked;
    if (isNoCumple) {
      modeBadge.textContent = 'No cumple (0.00)';
      modeBadge.className = 'digeig-mode-badge mode-nocumple';
    } else {
      modeBadge.textContent = 'Cumple 100% (5.00)';
      modeBadge.className = 'digeig-mode-badge mode-cumple';
    }
    localStorage.setItem('digeig_auto_no_cumple', isNoCumple ? 'true' : 'false');
  }

  function updateConfirmModeUI() {
    const isConfirm = confirmOnlySwitch.checked;
    if (isConfirm) {
      confirmBadge.textContent = 'Activo (Solo lectura)';
      confirmBadge.className = 'digeig-mode-badge mode-confirm';
      startBtn.textContent = '🔍 Confirmar Lista';
      singleBtn.textContent = '🔍 Confirmar actual (1 clic)';
      if (markOptionRow) markOptionRow.style.opacity = '0.5';
    } else {
      confirmBadge.textContent = 'Desactivado';
      confirmBadge.className = 'digeig-mode-badge mode-off';
      startBtn.textContent = '▶ Iniciar Lista';
      singleBtn.textContent = '⚡ Calificar actual (1 clic)';
      if (markOptionRow) markOptionRow.style.opacity = '1';
    }
    localStorage.setItem('digeig_auto_confirm_only', isConfirm ? 'true' : 'false');
  }

  confirmOnlySwitch.addEventListener('change', () => {
    updateConfirmModeUI();
    if (confirmOnlySwitch.checked) {
      log('🔍 Modo "Solo confirmar evaluación" ACTIVADO (no modificará calificaciones, guardará las no evaluadas en Tabla 4).', 'info');
    } else {
      log('⚡ Modo "Solo confirmar evaluación" DESACTIVADO (calificará normalmente).', 'info');
    }
  });

  noCumpleSwitch.addEventListener('change', () => {
    updateModeBadge();
    const label = noCumpleSwitch.checked ? '"No cumple" (0.00)' : '"Cumple 100%" (5.00)';
    log(`🔀 Modo cambiado a: ${label}`, 'info');
  });
  updateModeBadge();
  updateConfirmModeUI();

  delayInput.addEventListener('change', () => {
    localStorage.setItem('digeig_auto_step_delay', delayInput.value);
  });
  afterInstDelayInput.addEventListener('change', () => {
    localStorage.setItem('digeig_auto_after_inst_delay', afterInstDelayInput.value);
  });

  function updateCounter() {
    const lines = textarea.value
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    counterEl.textContent = `${lines.length} pendiente(s)`;
    localStorage.setItem('digeig_auto_inst_list', textarea.value);
  }

  textarea.addEventListener('input', updateCounter);
  updateCounter();

  headerToggle.addEventListener('click', () => {
    panel.classList.toggle('minimized');
    minBtn.textContent = panel.classList.contains('minimized') ? '+' : '−';
  });

  tablesHeaderToggle.addEventListener('click', () => {
    tablesPanel.classList.toggle('minimized');
    tablesMinBtn.textContent = tablesPanel.classList.contains('minimized') ? '+' : '−';
  });

  function log(msg, type = 'info') {
    const item = document.createElement('div');
    item.className = `digeig-log-item digeig-log-${type}`;
    const time = new Date().toLocaleTimeString('es-DO', { hour12: false });
    item.textContent = `[${time}] ${msg}`;
    logContainer.appendChild(item);
    logContainer.scrollTop = logContainer.scrollHeight;
    console.log(`[DIGEIG-AUTO] ${msg}`);
  }

  function getDelay() {
    const val = parseInt(delayInput.value, 10);
    return isNaN(val) || val < 200 ? 900 : val;
  }

  function getAfterInstDelay() {
    const val = parseInt(afterInstDelayInput.value, 10);
    return isNaN(val) || val < 0 ? 2000 : val;
  }

  // Asignar valor a un input de Angular/React/Vue disparando eventos reales
  function setNativeInputValue(input, value) {
    input.focus();
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;
    if (nativeSetter) {
      nativeSetter.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true })
    );
    input.dispatchEvent(
      new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true })
    );
  }

  // Asegurar que "Parámetro de búsqueda" tenga seleccionado "Institución"
  async function ensureSearchParameterIsInstitucion() {
    const allElements = Array.from(document.querySelectorAll('label, span, div, p'));
    const labelEl = allElements.find(
      (el) => el.children.length === 0 && normalize(el.textContent) === 'parametro de busqueda'
    );

    if (!labelEl) return;

    let container = labelEl.parentElement;
    if (container && container.children.length <= 1 && container.parentElement) {
      container = container.parentElement;
    }
    if (!container) return;

    const currentText = normalize(container.textContent).replace('parametro de busqueda', '').trim();
    if (currentText.includes('institucion') && !currentText.includes('seleccione una opcion')) {
      return;
    }

    log('🔽 Seleccionando "Institución" en Parámetro de búsqueda...', 'info');

    const nativeSelect = container.querySelector('select');
    if (nativeSelect) {
      const opt = Array.from(nativeSelect.options).find((o) =>
        normalize(o.textContent).includes('institucion')
      );
      if (opt) {
        nativeSelect.value = opt.value;
        nativeSelect.dispatchEvent(new Event('input', { bubbles: true }));
        nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(350);
        return;
      }
    }

    const trigger =
      container.querySelector(
        '[class*="control"], [class*="select"], [role="combobox"], input, button'
      ) ||
      container.children[1] ||
      container;

    trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    trigger.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    trigger.click();

    await sleep(400);

    const candidates = Array.from(
      document.querySelectorAll('div, li, span, a, [role="option"]')
    ).filter((el) => {
      if (el.closest('thead') || el.closest('th') || el.closest('#digeig-auto-wrapper')) return false;
      if (el.children.length > 1) return false;
      if (normalize(el.textContent) !== 'institucion') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 20 && rect.height > 10;
    });

    const optionEl = candidates[candidates.length - 1];
    if (optionEl) {
      optionEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      optionEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      optionEl.click();
      log('✅ Parámetro de búsqueda cambiado a "Institución".', 'ok');
      await sleep(400);
    } else {
      log('⚠️ No se pudo clicar automáticamente la opción "Institución".', 'warn');
    }
  }

  // Encontrar la caja de búsqueda principal ("Búsqueda")
  function findSearchInput() {
    const allElements = Array.from(document.querySelectorAll('label, span, div, p'));
    for (const el of allElements) {
      if (el.children.length === 0 && normalize(el.textContent) === 'busqueda') {
        const container = el.parentElement;
        if (container) {
          const inp = container.querySelector('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"])');
          if (inp) return inp;
          if (container.parentElement) {
            const inp2 = container.parentElement.querySelector('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"])');
            if (inp2) return inp2;
          }
        }
      }
    }

    const inputs = Array.from(
      document.querySelectorAll('input[type="text"], input[type="search"], input:not([type])')
    ).filter((inp) => {
      if (inp.closest('#digeig-auto-wrapper')) return false;
      if (inp.disabled || inp.readOnly) return false;
      const rect = inp.getBoundingClientRect();
      return rect.width > 120 && rect.height > 20;
    });

    if (inputs.length > 0) {
      return inputs[inputs.length - 1];
    }
    return null;
  }

  // Encontrar el botón de lupa junto al input de búsqueda
  function findSearchButton(searchInput) {
    if (!searchInput) return null;
    let parent = searchInput.parentElement;
    for (let i = 0; i < 3 && parent; i++) {
      const btn = parent.querySelector('button, [role="button"], .input-group-append button, .btn');
      if (btn) return btn;
      parent = parent.parentElement;
    }
    return null;
  }

  // Encontrar la tabla principal de resultados (fuera del modal y fuera del panel flotante)
  function getMainTableRows() {
    const tables = Array.from(document.querySelectorAll('table')).filter((t) => {
      if (t.closest('#digeig-auto-wrapper')) return false;
      const headerText = normalize(t.textContent);
      if (headerText.includes('ponderacion') && headerText.includes('cumple 100%')) {
        return false;
      }
      return true;
    });

    if (tables.length === 0) return [];
    const mainTable = tables[0];
    return Array.from(mainTable.querySelectorAll('tbody tr')).filter(
      (tr) => tr.querySelectorAll('td').length >= 5
    );
  }

  // Encontrar el botón del lápiz (Editar) en la primera fila
  function findPencilButtonInRow(row) {
    const tds = row.querySelectorAll('td');
    if (tds.length === 0) return null;
    const actionTd = tds[tds.length - 1];

    let clickables = Array.from(actionTd.querySelectorAll('button, a, [role="button"]'));
    if (clickables.length === 0) {
      clickables = Array.from(actionTd.children);
    }

    if (clickables.length >= 2) {
      return clickables[1];
    }
    return clickables[0] || null;
  }

  // Encontrar el modal "Calificar Evaluación" si está abierto
  function findOpenModal() {
    const headers = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, div, span')).filter(
      (el) => el.children.length === 0 && normalize(el.textContent) === 'calificar evaluacion'
    );

    for (const h of headers) {
      let current = h.parentElement;
      while (current && current !== document.body) {
        const text = normalize(current.textContent);
        if (
          (text.includes('datos abiertos') || text.includes('resumen de la evaluacion')) &&
          text.includes('cerrar')
        ) {
          const rect = current.getBoundingClientRect();
          if (rect.width > 400 && rect.height > 300) {
            return current;
          }
        }
        current = current.parentElement;
      }
    }
    return null;
  }

  // Buscar un botón dentro del modal por su texto exacto ("Iniciar", "Reiniciar", "Finalizar", "Guardar", "Cerrar")
  function findModalButton(modal, buttonText) {
    const target = normalize(buttonText);
    const buttons = Array.from(modal.querySelectorAll('button, a.btn, [role="button"]'));
    for (const btn of buttons) {
      const txt = normalize(btn.textContent);
      if (txt === target) {
        return btn;
      }
    }
    const wordRegex = new RegExp(`\\b${target}\\b`, 'i');
    for (const btn of buttons) {
      const txt = normalize(btn.textContent);
      if (wordRegex.test(txt)) {
        return btn;
      }
    }
    return null;
  }

  function isButtonEnabled(btn) {
    if (!btn) return false;
    if (btn.disabled || btn.hasAttribute('disabled')) return false;
    if (btn.classList.contains('disabled')) return false;
    const style = window.getComputedStyle(btn);
    if (style.pointerEvents === 'none' || parseFloat(style.opacity) < 0.4) return false;
    return true;
  }

  function isRadioChecked(el) {
    if (!el) return false;
    if (el.tagName === 'INPUT' && el.type === 'radio') {
      return el.checked;
    }
    if (el.getAttribute('aria-checked') === 'true') return true;
    const cls = el.className || '';
    if (typeof cls === 'string' && /(checked|selected|active|p-highlight)/i.test(cls)) {
      return true;
    }
    const innerInput = el.querySelector?.('input[type="radio"]');
    if (innerInput && innerInput.checked) return true;
    return false;
  }

  // Comparación flexible entre el nombre buscado y el nombre en la página
  const STOP_WORDS = new Set([
    'de', 'la', 'el', 'los', 'las', 'del', 'y', 'en', 'para', 'por', 'con', 'nacional', 'general', 'dominicana', 'dominicano', 'republica'
  ]);

  function getSignificantWords(str) {
    return normalize(str)
      .replace(/[().,/-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  }

  function matchesInstitutionName(actualText, searchedName) {
    const normActual = normalize(actualText);
    const normSearch = normalize(searchedName);
    if (!normActual || !normSearch) return false;
    if (normActual === normSearch || normActual.includes(normSearch) || normSearch.includes(normActual)) {
      return true;
    }

    // Si ambos tienen la misma sigla entre paréntesis, ej. "(INAP)" o "(UTECT)", es la misma institución
    const acronymSearch = normSearch.match(/\(([a-z0-9-]+)\)/);
    const acronymActual = normActual.match(/\(([a-z0-9-]+)\)/);
    if (acronymSearch && acronymActual && acronymSearch[1] === acronymActual[1]) {
      return true;
    }

    // Comparar porcentaje de palabras clave significativas que coinciden
    const searchWords = getSignificantWords(searchedName);
    if (searchWords.length === 0) return false;
    const matchedCount = searchWords.filter((w) => normActual.includes(w)).length;
    return matchedCount / searchWords.length >= 0.65;
  }

  // Esperar a que aparezca el cartel verde de "¡Éxito!" arriba
  async function waitForToastConfirmation(expectedPhrase, timeoutMs = 12000) {
    const normExpected = normalize(expectedPhrase);
    const maxAttempts = Math.ceil(timeoutMs / 200);

    for (let i = 0; i < maxAttempts; i++) {
      if (stopRequested) return false;
      await sleep(200);

      const candidates = Array.from(
        document.querySelectorAll(
          '[role="alert"], .toast, .swal2-popup, .p-toast-message, .ngx-toastr, div, span, p'
        )
      ).filter((el) => {
        if (el.closest('#digeig-auto-wrapper')) return false;
        if (el.children.length > 4) return false;
        const txt = normalize(el.textContent);
        if (!txt.includes(normExpected)) return false;
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return (
          rect.width > 80 &&
          rect.height > 20 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          parseFloat(style.opacity || '1') > 0.2
        );
      });

      if (candidates.length > 0) {
        return true;
      }
    }
    return false;
  }

  // Procesar el modal abierto de "Calificar Evaluación"
  async function processOpenModal(rowContext = {}) {
    const {
      estatusText = '',
      searchedName = '',
      pageInstName = '',
      periodoText = '',
      analistaText = '',
      calificacionNum = null,
    } = rowContext;

    const stepDelay = getDelay();

    // 1. Esperar a que el modal "Calificar Evaluación" se abra
    let modal = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      if (stopRequested) return false;
      modal = findOpenModal();
      if (modal) break;
      await sleep(300);
    }

    if (!modal) {
      log('❌ No se detectó el modal "Calificar Evaluación".', 'err');
      addErrorRecord(searchedName || pageInstName || 'Actual', 'No abrió el modal Calificar Evaluación');
      return false;
    }

    await sleep(500);

    const isConfirmOnly = confirmOnlySwitch && confirmOnlySwitch.checked;
    const isNameDifferent =
      searchedName &&
      pageInstName &&
      normalize(searchedName) !== normalize(pageInstName);

    // 2. Si nadie la ha evaluado aún, aparece el botón "Iniciar" y las secciones están ocultas
    let wasUnstarted = false;
    const iniciarBtn = findModalButton(modal, 'Iniciar');
    if (iniciarBtn && isButtonEnabled(iniciarBtn)) {
      if (isConfirmOnly) {
        const statusMsg = `Sin iniciar (${estatusText || '0.00'})`;
        log(`⚠️ [No Evaluada] "${pageInstName || searchedName}": ${statusMsg}. Agregada a Tabla 4.`, 'warn');
        addNotEvaluatedRecord(
          pageInstName || searchedName || 'Institución actual',
          periodoText || 'Actual',
          analistaText || 'Asignado',
          statusMsg
        );
        if (isNameDifferent) {
          addDiffZeroRecord(searchedName, pageInstName, `En 0 (${estatusText || 'Sin iniciar'})`);
        }
        const cerrarBtn = findModalButton(modal, 'Cerrar');
        if (cerrarBtn) {
          cerrarBtn.click();
          await sleep(500);
        }
        return true;
      }

      log('▶️ Nadie la ha evaluado aún. Dando clic en "Iniciar"...', 'warn');
      iniciarBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(300);
      iniciarBtn.click();
      wasUnstarted = true;
      await sleep(stepDelay);
    }

    // 3. Esperar a que cargue la sección 15 ("Evaluación Datos Abiertos")
    let datosAbiertosRow = null;
    for (let attempt = 0; attempt < 25; attempt++) {
      if (stopRequested) return false;
      modal = findOpenModal() || modal;
      const rows = Array.from(modal.querySelectorAll('tr'));
      datosAbiertosRow = rows.find((r) =>
        normalize(r.textContent).includes('evaluacion datos abiertos')
      );
      if (datosAbiertosRow) break;
      await sleep(350);
    }

    if (!datosAbiertosRow) {
      log('❌ No se encontró la sección "Evaluación Datos Abiertos" en el modal.', 'err');
      addErrorRecord(searchedName || pageInstName || 'Actual', 'No cargó la sección 15 (Datos Abiertos)');
      return false;
    }

    await sleep(stepDelay);

    // 4. Determinar si las demás secciones (1 a 14) tienen campos llenos o si están todas vacías
    const allSectionRows = Array.from(modal.querySelectorAll('tbody tr')).filter((r) => {
      if (r === datosAbiertosRow) return false;
      return (
        r.querySelectorAll('input[type="radio"], [role="radio"], .p-radiobutton, .mat-radio-button')
          .length > 0
      );
    });

    let filledOtherRowsCount = 0;
    for (const r of allSectionRows) {
      const radios = Array.from(
        r.querySelectorAll('input[type="radio"], [role="radio"], .p-radiobutton, .mat-radio-button')
      );
      if (radios.some((rad) => isRadioChecked(rad))) {
        filledOtherRowsCount++;
      }
    }

    const isConcluidoOrFilled =
      !wasUnstarted &&
      (filledOtherRowsCount > 0 || normalize(estatusText).includes('concluido'));

    // Si el nombre buscado era diferente al nombre de la página y estaba en 0 (o sin evaluar), agregar a Tabla 1
    const wasInZero =
      wasUnstarted ||
      filledOtherRowsCount === 0 ||
      calificacionNum === 0;

    if (isNameDifferent && wasInZero) {
      addDiffZeroRecord(
        searchedName,
        pageInstName,
        `En 0 (${estatusText || 'Sin evaluar'})`
      );
    }

    // MODO SOLO CONFIRMAR: Verificar si está evaluada sin tocar ni guardar nada
    if (isConfirmOnly) {
      datosAbiertosRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(350);

      const daRadios = Array.from(
        datosAbiertosRow.querySelectorAll(
          'input[type="radio"], [role="radio"], .p-radiobutton, .mat-radio-button'
        )
      );
      const daCheckedIdx = daRadios.findIndex((rad) => isRadioChecked(rad));
      const daLabels = ['Cumple 100% (5)', 'Cumple 90%', 'Incompleto', 'No cumple (0)', 'No se evalúa'];
      const daLabel = daCheckedIdx >= 0 ? daLabels[daCheckedIdx] || 'Marcado' : null;

      if (filledOtherRowsCount === 0 && daCheckedIdx === -1) {
        const statusMsg = `En 0 / Sin evaluar (${estatusText || 'Pendiente'})`;
        log(`⚠️ [No Evaluada] "${pageInstName || searchedName}": ${statusMsg}. Agregada a Tabla 4.`, 'warn');
        addNotEvaluatedRecord(
          pageInstName || searchedName || 'Institución actual',
          periodoText || 'Actual',
          analistaText || 'Asignado',
          statusMsg
        );
      } else if (filledOtherRowsCount === 0 && daCheckedIdx >= 0) {
        const statusMsg = `Sin evaluar otros aspectos (Solo D.A.: ${daLabel})`;
        log(`⚠️ [Incompleta] "${pageInstName || searchedName}": ${statusMsg}. Agregada a Tabla 4.`, 'warn');
        addNotEvaluatedRecord(
          pageInstName || searchedName || 'Institución actual',
          periodoText || 'Actual',
          analistaText || 'Asignado',
          statusMsg
        );
      } else if (filledOtherRowsCount > 0 && daCheckedIdx === -1) {
        const statusMsg = `Falta Datos Abiertos (${filledOtherRowsCount} secc. llenas, Calif: ${calificacionNum ?? 0})`;
        log(`⚠️ [Falta D.A.] "${pageInstName || searchedName}": ${statusMsg}. Agregada a Tabla 4.`, 'warn');
        addNotEvaluatedRecord(
          pageInstName || searchedName || 'Institución actual',
          periodoText || 'Actual',
          analistaText || 'Asignado',
          statusMsg
        );
      } else {
        log(
          `✅ Confirmado: "${pageInstName || searchedName}" SÍ está evaluada (${filledOtherRowsCount} secc. + D.A.: ${daLabel}, Calif: ${calificacionNum ?? 0}).`,
          'ok'
        );
      }

      const cerrarBtn = findModalButton(modal, 'Cerrar');
      if (cerrarBtn) {
        cerrarBtn.click();
        await sleep(500);
      }
      return true;
    }

    const reiniciarBtn = findModalButton(modal, 'Reiniciar');
    const useNoCumple = noCumpleSwitch && noCumpleSwitch.checked;
    const optionName = useNoCumple ? 'No cumple' : 'Cumple 100%';
    const optionPoints = useNoCumple ? '0.00' : '5.00';
    const optionShort = useNoCumple ? '0 (No cumple)' : '5 (100%)';

    if (isConcluidoOrFilled) {
      log(
        `📋 Evaluación con datos (${filledOtherRowsCount} secciones llenas). Aplicando: Reiniciar ➔ ${optionShort} ➔ Finalizar.`,
        'info'
      );

      if (reiniciarBtn && isButtonEnabled(reiniciarBtn)) {
        reiniciarBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(300);
        reiniciarBtn.click();
        log('🔄 Clic en "Reiniciar", esperando habilitación...', 'info');
        for (let w = 0; w < 15; w++) {
          await sleep(350);
          const testRow = Array.from(modal.querySelectorAll('tr')).find((r) =>
            normalize(r.textContent).includes('evaluacion datos abiertos')
          );
          const testRadio = testRow?.querySelector('input[type="radio"]');
          if (testRadio && !testRadio.disabled) break;
        }
        await sleep(300);
      }
    } else {
      log(
        `📋 Nadie la había evaluado en otros aspectos. Aplicando: Datos Abiertos ➔ ${optionShort} ➔ Guardar.`,
        'warn'
      );
    }

    const updatedRows = Array.from(modal.querySelectorAll('tr'));
    datosAbiertosRow =
      updatedRows.find((r) => normalize(r.textContent).includes('evaluacion datos abiertos')) ||
      datosAbiertosRow;

    // Bajar hasta la última opción: "15. Datos Abiertos" -> "Evaluación Datos Abiertos"
    datosAbiertosRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(stepDelay);

    // Seleccionar el radio button correspondiente:
    // Índice 0 (columna 3) = "Cumple 100%" (5.00)
    // Índice 3 (columna 6) = "No cumple" (0.00)
    const targetRadioIdx = useNoCumple ? 3 : 0;
    const targetCellIdx = useNoCumple ? 6 : 3;

    const radiosInRow = Array.from(
      datosAbiertosRow.querySelectorAll(
        'input[type="radio"], [role="radio"], .p-radiobutton-box, .mat-radio-container'
      )
    );

    let targetRadio = radiosInRow[targetRadioIdx];
    if (!targetRadio) {
      const cells = datosAbiertosRow.querySelectorAll('td');
      if (cells[targetCellIdx]) {
        targetRadio =
          cells[targetCellIdx].querySelector('input, label, div, span') || cells[targetCellIdx];
      }
    }

    if (!targetRadio) {
      log(`❌ No se pudo encontrar el botón de opción "${optionName}" en Datos Abiertos.`, 'err');
      addErrorRecord(searchedName || pageInstName || 'Actual', `No se encontró opción ${optionName}`);
      return false;
    }

    if (targetRadio.disabled && reiniciarBtn && isButtonEnabled(reiniciarBtn)) {
      log('🔓 Habilitando edición con "Reiniciar"...', 'info');
      reiniciarBtn.click();
      await sleep(stepDelay);
      datosAbiertosRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(400);
    }

    targetRadio.click();
    if (targetRadio.tagName === 'INPUT') {
      targetRadio.checked = true;
      targetRadio.dispatchEvent(new Event('input', { bubbles: true }));
      targetRadio.dispatchEvent(new Event('change', { bubbles: true }));
      if (targetRadio.parentElement) {
        targetRadio.parentElement.click();
      }
    }

    log(`✅ Seleccionado "${optionName}" (${optionPoints}) en Datos Abiertos.`, 'ok');
    await sleep(stepDelay);

    if (isConcluidoOrFilled) {
      const finalizarBtn = findModalButton(modal, 'Finalizar');
      if (!finalizarBtn) {
        log('❌ No se encontró el botón "Finalizar".', 'err');
        addErrorRecord(searchedName || pageInstName || 'Actual', 'No se encontró botón Finalizar');
        return false;
      }
      finalizarBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(500);
      finalizarBtn.click();
      log('🏁 Clic en "Finalizar", esperando mensaje de éxito...', 'info');

      const toastOk = await waitForToastConfirmation('la evaluacion ha finalizado', 12000);
      if (toastOk) {
        log('✅ ¡Éxito! La evaluación ha finalizado.', 'ok');
      } else {
        log('⚠️ No se detectó el aviso de "La evaluación ha finalizado" a tiempo.', 'warn');
      }
    } else {
      const guardarBtn = findModalButton(modal, 'Guardar');
      if (!guardarBtn) {
        log('❌ No se encontró el botón "Guardar".', 'err');
        addErrorRecord(searchedName || pageInstName || 'Actual', 'No se encontró botón Guardar');
        return false;
      }
      guardarBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(500);
      guardarBtn.click();
      log('💾 Clic en "Guardar", esperando mensaje de éxito...', 'info');

      const toastOk = await waitForToastConfirmation('se ha guardado exitosamente', 12000);
      if (toastOk) {
        log('✅ ¡Éxito! Se ha guardado exitosamente.', 'ok');
      } else {
        log('⚠️ No se detectó el aviso de "Se ha guardado exitosamente" a tiempo.', 'warn');
      }

      // Registrar en Tabla 2: se puntuó pero nadie la había evaluado en los otros aspectos
      const tableScoreTag = useNoCumple ? '0 (No cumple)' : '5';
      addUnratedScoredRecord(
        pageInstName || searchedName || 'Institución actual',
        periodoText || 'Actual',
        analistaText || 'Asignado',
        wasUnstarted ? `Iniciada + ${tableScoreTag} + Guardar` : `${tableScoreTag} + Guardar`
      );
    }

    await sleep(500);

    // Si el modal sigue abierto tras el mensaje de éxito, cerrarlo con "Cerrar"
    const stillOpenModal = findOpenModal();
    if (stillOpenModal) {
      const cerrarBtn = findModalButton(stillOpenModal, 'Cerrar');
      if (cerrarBtn) {
        cerrarBtn.click();
        await sleep(600);
      }
    }

    return true;
  }

  // Ejecutar búsqueda en la barra de la página y esperar resultados
  async function executeSearchQuery(queryText, targetInstName) {
    const searchInput = findSearchInput();
    if (!searchInput) return null;

    setNativeInputValue(searchInput, queryText);
    await sleep(300);

    // Si "Búsqueda" despliega una lista de autocompletado, clicar la opción que coincida
    const autocompleteOpts = Array.from(
      document.querySelectorAll('[role="option"], .dropdown-item, .ng-option, [class*="option"]')
    ).filter((el) => {
      if (el.closest('table') || el.closest('#digeig-auto-wrapper')) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 50 && rect.height > 10 && matchesInstitutionName(el.textContent, targetInstName);
    });
    if (autocompleteOpts.length > 0) {
      autocompleteOpts[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      autocompleteOpts[0].click();
      await sleep(250);
    }

    const searchBtn = findSearchButton(searchInput);
    if (searchBtn) {
      searchBtn.click();
    }

    for (let attempt = 0; attempt < 14; attempt++) {
      if (stopRequested) return null;
      await sleep(400);
      const rows = getMainTableRows();
      if (rows.length > 0) {
        const cells = rows[0].querySelectorAll('td');
        const instColText = cells[1] ? cells[1].textContent : rows[0].textContent;
        if (matchesInstitutionName(instColText, targetInstName)) {
          return rows[0];
        }
      }
    }
    return null;
  }

  // Procesar una institución completa (Buscar ➔ Lápiz primera fila ➔ Modal)
  async function processInstitution(instName) {
    const stepDelay = getDelay();
    await ensureSearchParameterIsInstitucion();
    log(`🔎 Buscando: "${instName}"...`, 'info');

    // 1. Intentar búsqueda con el nombre completo tal cual viene en la lista
    let matchedRow = await executeSearchQuery(instName, instName);

    // 2. Si no apareció porque en la página está escrita con un nombre ligeramente diferente:
    //    Intentar buscar por sigla entre paréntesis ej. (INAP) o por las palabras principales
    if (!matchedRow && !stopRequested) {
      const acronymMatch = instName.match(/\(([A-Za-z0-9-]+)\)/);
      if (acronymMatch) {
        log(`🔎 Reintentando búsqueda por sigla "${acronymMatch[1]}"...`, 'info');
        matchedRow = await executeSearchQuery(acronymMatch[1], instName);
      }
    }

    if (!matchedRow && !stopRequested) {
      const sigWords = getSignificantWords(instName);
      if (sigWords.length >= 2) {
        const shortQuery = sigWords.slice(0, 2).join(' ');
        log(`🔎 Reintentando búsqueda flexible con "${shortQuery}"...`, 'info');
        matchedRow = await executeSearchQuery(shortQuery, instName);
      }
    }

    if (!matchedRow) {
      log(`❌ No se encontró "${instName}" en la página. Guardado en Tabla 3 (Errores).`, 'err');
      addErrorRecord(instName, 'No encontrada en búsqueda (0 resultados)');
      return false;
    }

    const rowCells = matchedRow.querySelectorAll('td');
    const confirmedRowName = rowCells[1] ? rowCells[1].textContent.trim() : instName;
    const periodoText = rowCells[3] ? rowCells[3].textContent.trim() : '';
    const analistaText = rowCells[4] ? rowCells[4].textContent.trim() : '';
    const estatusText = rowCells[5] ? rowCells[5].textContent.trim() : '';
    const califText = rowCells[6] ? rowCells[6].textContent.trim() : '0';
    const calificacionNum = parseFloat(califText.replace(',', '.')) || 0;

    const pencilBtn = findPencilButtonInRow(matchedRow);
    if (!pencilBtn) {
      log(`❌ No se encontró el botón del lápiz en la fila de "${confirmedRowName}".`, 'err');
      addErrorRecord(instName, 'No se encontró el botón Editar (lápiz)');
      return false;
    }

    log(
      `✏️ Abriendo "${confirmedRowName}" (${periodoText || '1ra fila'} - ${estatusText || 'Sin estatus'})...`,
      'info'
    );
    pencilBtn.click();
    await sleep(stepDelay);

    const ok = await processOpenModal({
      estatusText,
      searchedName: instName,
      pageInstName: confirmedRowName,
      periodoText,
      analistaText,
      calificacionNum,
    });
    await sleep(stepDelay);
    return ok;
  }

  // Botón: Iniciar Lista Completa
  startBtn.addEventListener('click', async () => {
    if (isRunning) return;

    const lines = textarea.value
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      log('⚠️ Pega al menos una institución en la caja de texto.', 'warn');
      return;
    }

    isRunning = true;
    stopRequested = false;
    startBtn.disabled = true;
    singleBtn.disabled = true;
    stopBtn.disabled = false;
    textarea.disabled = true;

    log(`🚀 Iniciando automatización de ${lines.length} institución(es)...`, 'info');

    const remaining = [...lines];

    for (let i = 0; i < lines.length; i++) {
      if (stopRequested) {
        log('🛑 Proceso detenido por el usuario.', 'warn');
        break;
      }

      const currentInst = lines[i];
      log(`--- [${i + 1}/${lines.length}] ${currentInst} ---`, 'info');

      let success = false;
      try {
        success = await processInstitution(currentInst);
      } catch (err) {
        log(`❌ Error inesperado en "${currentInst}": ${err.message || err}`, 'err');
        addErrorRecord(currentInst, `Error inesperado: ${err.message || err}`);
      }

      if (success) {
        log(`🎉 Completado: ${currentInst}`, 'ok');
      } else {
        log(`⚠️ Registrada en Tabla 3 (Errores): ${currentInst}`, 'warn');
      }

      remaining.shift();
      textarea.value = remaining.join('\n');
      updateCounter();

      if (i < lines.length - 1 && !stopRequested) {
        const afterDelay = getAfterInstDelay();
        if (afterDelay > 0) {
          log(`⏳ Esperando ${afterDelay} ms antes de la siguiente institución...`, 'info');
          await sleep(afterDelay);
        }
      }
    }

    isRunning = false;
    stopRequested = false;
    startBtn.disabled = false;
    singleBtn.disabled = false;
    stopBtn.disabled = true;
    textarea.disabled = false;
    log('🏁 Proceso finalizado.', 'ok');
  });

  // Botón: Detener
  stopBtn.addEventListener('click', () => {
    if (!isRunning) return;
    stopRequested = true;
    log('⏳ Deteniendo al terminar el paso actual...', 'warn');
  });

  // Botón: Calificar actual (1 clic)
  singleBtn.addEventListener('click', async () => {
    if (isRunning) return;
    isRunning = true;
    stopRequested = false;
    startBtn.disabled = true;
    singleBtn.disabled = true;
    stopBtn.disabled = false;

    try {
      const openModal = findOpenModal();
      if (openModal) {
        log('⚡ Modal detectado abierto. Calificando Datos Abiertos...', 'info');
        await processOpenModal({});
      } else {
        const rows = getMainTableRows();
        if (rows.length === 0) {
          log('⚠️ No hay filas en la tabla para abrir.', 'warn');
        } else {
          const firstRow = rows[0];
          const rowCells = firstRow.querySelectorAll('td');
          const confirmedRowName = rowCells[1] ? rowCells[1].textContent.trim() : 'Fila 1';
          const periodoText = rowCells[3] ? rowCells[3].textContent.trim() : '';
          const analistaText = rowCells[4] ? rowCells[4].textContent.trim() : '';
          const estatusText = rowCells[5] ? rowCells[5].textContent.trim() : '';
          const califText = rowCells[6] ? rowCells[6].textContent.trim() : '0';
          const calificacionNum = parseFloat(califText.replace(',', '.')) || 0;

          const pencilBtn = findPencilButtonInRow(firstRow);
          if (pencilBtn) {
            log(`✏️ Abriendo 1ra fila (${confirmedRowName})...`, 'info');
            pencilBtn.click();
            await sleep(getDelay());
            await processOpenModal({
              estatusText,
              searchedName: confirmedRowName,
              pageInstName: confirmedRowName,
              periodoText,
              analistaText,
              calificacionNum,
            });
          } else {
            log('❌ No se encontró el botón del lápiz en la primera fila.', 'err');
          }
        }
      }
    } finally {
      isRunning = false;
      startBtn.disabled = false;
      singleBtn.disabled = false;
      stopBtn.disabled = true;
    }
  });
})();
