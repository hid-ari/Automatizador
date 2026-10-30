(function () {
  if (document.getElementById('digeig-auto-panel')) return;

  let isRunning = false;
  let stopRequested = false;

  // Utilidad para normalizar texto (sin acentos y en minúsculas)
  function normalize(str) {
    return (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Crear interfaz flotante
  const panel = document.createElement('div');
  panel.id = 'digeig-auto-panel';
  panel.innerHTML = `
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
      <div class="digeig-auto-options">
        <span>Espera entre pasos (ms):</span>
        <input type="number" id="digeig-delay" value="900" min="300" max="5000" step="100" />
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
  `;

  document.body.appendChild(panel);

  const textarea = document.getElementById('digeig-inst-list');
  const counterEl = document.getElementById('digeig-counter');
  const startBtn = document.getElementById('digeig-start-btn');
  const stopBtn = document.getElementById('digeig-stop-btn');
  const singleBtn = document.getElementById('digeig-single-btn');
  const delayInput = document.getElementById('digeig-delay');
  const logContainer = document.getElementById('digeig-log');
  const minBtn = document.getElementById('digeig-min-btn');
  const headerToggle = document.getElementById('digeig-header-toggle');

  // Restaurar lista guardada si existe
  const savedList = localStorage.getItem('digeig_auto_inst_list');
  if (savedList) {
    textarea.value = savedList;
  }

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
    return isNaN(val) || val < 300 ? 900 : val;
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

    // Encontrar el contenedor del selector "Parámetro de búsqueda"
    let container = labelEl.parentElement;
    if (container && container.children.length <= 1 && container.parentElement) {
      container = container.parentElement;
    }
    if (!container) return;

    // Si ya tiene seleccionado "Institución", no hacer nada
    const currentText = normalize(container.textContent).replace('parametro de busqueda', '').trim();
    if (currentText.includes('institucion') && !currentText.includes('seleccione una opcion')) {
      return;
    }

    log('🔽 Seleccionando "Institución" en Parámetro de búsqueda...', 'info');

    // Caso 1: Es un <select> nativo
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

    // Caso 2: Es un dropdown personalizado (React-Select, ng-select, etc.)
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

    // Buscar la opción "Institución" en el menú desplegable abierto (excluyendo <th> de la tabla)
    const candidates = Array.from(
      document.querySelectorAll('div, li, span, a, [role="option"]')
    ).filter((el) => {
      if (el.closest('thead') || el.closest('th') || el.closest('#digeig-auto-panel')) return false;
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
      log('⚠️ No se pudo clicar automáticamente la opción "Institución". Selecciónala manualmente.', 'warn');
    }
  }

  // Encontrar la caja de búsqueda principal ("Búsqueda")
  function findSearchInput() {
    // 1. Buscar por etiqueta "Búsqueda"
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

    // 2. Buscar cualquier input de texto visible en la barra superior que tenga un botón de lupa al lado
    const inputs = Array.from(
      document.querySelectorAll('input[type="text"], input[type="search"], input:not([type])')
    ).filter((inp) => {
      if (inp.closest('#digeig-auto-panel')) return false;
      if (inp.disabled || inp.readOnly) return false;
      const rect = inp.getBoundingClientRect();
      return rect.width > 120 && rect.height > 20;
    });

    // Preferir el input que está más a la derecha en la zona de filtros
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

  // Encontrar la tabla principal de resultados (fuera del modal)
  function getMainTableRows() {
    const tables = Array.from(document.querySelectorAll('table')).filter((t) => {
      // Excluir tablas dentro del modal de Calificar Evaluación
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
    const actionTd = tds[tds.length - 1]; // Última columna: "Acción"

    // Buscar botones o elementos clicables dentro de la celda de Acción
    let clickables = Array.from(actionTd.querySelectorAll('button, a, [role="button"]'));
    if (clickables.length === 0) {
      clickables = Array.from(actionTd.children);
    }

    // En la captura hay 3 botones en Acción: [0] Descargar, [1] Lápiz (Editar), [2] Basura (Eliminar)
    // Nunca tocar el último si es el de eliminar
    if (clickables.length >= 2) {
      return clickables[1];
    }
    return clickables[0] || null;
  }

  // Encontrar el modal "Calificar Evaluación" si está abierto
  function findOpenModal() {
    // Buscar contenedor que tenga el título "Calificar Evaluación"
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
    // 1. Coincidencia exacta primero (para no confundir "Iniciar" con "Reiniciar")
    for (const btn of buttons) {
      const txt = normalize(btn.textContent);
      if (txt === target) {
        return btn;
      }
    }
    // 2. Coincidencia por palabra completa
    const wordRegex = new RegExp(`\\b${target}\\b`, 'i');
    for (const btn of buttons) {
      const txt = normalize(btn.textContent);
      if (wordRegex.test(txt)) {
        return btn;
      }
    }
    return null;
  }

  // Verificar si un botón está habilitado
  function isButtonEnabled(btn) {
    if (!btn) return false;
    if (btn.disabled || btn.hasAttribute('disabled')) return false;
    if (btn.classList.contains('disabled')) return false;
    const style = window.getComputedStyle(btn);
    if (style.pointerEvents === 'none' || parseFloat(style.opacity) < 0.4) return false;
    return true;
  }

  // Verificar si un radio button (nativo o componente UI) está seleccionado
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

  // Procesar el modal abierto de "Calificar Evaluación"
  async function processOpenModal(rowStatusHint = '') {
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
      return false;
    }

    await sleep(500);

    // 2. Si nadie la ha evaluado aún, aparece el botón "Iniciar" y las secciones están ocultas
    let wasUnstarted = false;
    const iniciarBtn = findModalButton(modal, 'Iniciar');
    if (iniciarBtn && isButtonEnabled(iniciarBtn)) {
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
      (filledOtherRowsCount > 0 || normalize(rowStatusHint).includes('concluido'));

    const reiniciarBtn = findModalButton(modal, 'Reiniciar');

    if (isConcluidoOrFilled) {
      log(
        `📋 Evaluación con datos (${filledOtherRowsCount} secciones llenas). Aplicando: Reiniciar ➔ 5 (100%) ➔ Finalizar.`,
        'info'
      );

      // 1. Dar clic a Reiniciar si está activo
      if (reiniciarBtn && isButtonEnabled(reiniciarBtn)) {
        reiniciarBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(300);
        reiniciarBtn.click();
        log('🔄 Clic en "Reiniciar", esperando habilitación...', 'info');
        // Esperar hasta que los radios se habiliten (máx 5 seg)
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
        '📋 Todos los campos están vacíos. Aplicando: Bajar a Datos Abiertos ➔ 5 (100%) ➔ Guardar (sin Finalizar).',
        'warn'
      );
    }

    // Re-buscar la fila de Datos Abiertos por si el DOM se re-renderizó tras Reiniciar
    const updatedRows = Array.from(modal.querySelectorAll('tr'));
    datosAbiertosRow =
      updatedRows.find((r) => normalize(r.textContent).includes('evaluacion datos abiertos')) ||
      datosAbiertosRow;

    // 2. Bajar hasta la última opción: "15. Datos Abiertos" -> "Evaluación Datos Abiertos"
    datosAbiertosRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(stepDelay);

    // 3. Seleccionar el primer radio button ("Cumple 100%" = 5.00)
    const radiosInRow = Array.from(
      datosAbiertosRow.querySelectorAll(
        'input[type="radio"], [role="radio"], .p-radiobutton-box, .mat-radio-container'
      )
    );

    let firstRadio = radiosInRow[0];
    if (!firstRadio) {
      // Fallback: buscar en la 4ta columna (Cumple 100%)
      const cells = datosAbiertosRow.querySelectorAll('td');
      if (cells[3]) {
        firstRadio = cells[3].querySelector('input, label, div, span') || cells[3];
      }
    }

    if (!firstRadio) {
      log('❌ No se pudo encontrar el botón de opción "Cumple 100%" en Datos Abiertos.', 'err');
      return false;
    }

    // Si el radio estuviera deshabilitado en modo vacío porque requiere iniciar/reiniciar:
    if (firstRadio.disabled && reiniciarBtn && isButtonEnabled(reiniciarBtn)) {
      log('🔓 Habilitando edición con "Reiniciar"...', 'info');
      reiniciarBtn.click();
      await sleep(stepDelay);
      datosAbiertosRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(400);
    }

    // Hacer clic tanto en el input como en su contenedor/label por compatibilidad con Angular/React
    firstRadio.click();
    if (firstRadio.tagName === 'INPUT') {
      firstRadio.checked = true;
      firstRadio.dispatchEvent(new Event('input', { bubbles: true }));
      firstRadio.dispatchEvent(new Event('change', { bubbles: true }));
      if (firstRadio.parentElement) {
        firstRadio.parentElement.click();
      }
    }

    log('✅ Seleccionado "Cumple 100%" (5.00) en Datos Abiertos.', 'ok');
    await sleep(stepDelay);

    // 4. Según el caso: volver arriba y darle a "Finalizar" O darle a "Guardar"
    if (isConcluidoOrFilled) {
      const finalizarBtn = findModalButton(modal, 'Finalizar');
      if (!finalizarBtn) {
        log('❌ No se encontró el botón "Finalizar".', 'err');
        return false;
      }
      finalizarBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(500);
      finalizarBtn.click();
      log('🏁 Clic en "Finalizar" realizado.', 'ok');
    } else {
      const guardarBtn = findModalButton(modal, 'Guardar');
      if (!guardarBtn) {
        log('❌ No se encontró el botón "Guardar".', 'err');
        return false;
      }
      guardarBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(500);
      guardarBtn.click();
      log('💾 Clic en "Guardar" realizado (sin Finalizar).', 'ok');
    }

    await sleep(stepDelay + 400);

    // 5. Si el modal sigue abierto tras Guardar/Finalizar, cerrarlo con "Cerrar" o la "X"
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

  // Procesar una institución completa (Buscar ➔ Lápiz primera fila ➔ Modal)
  async function processInstitution(instName) {
    const stepDelay = getDelay();
    await ensureSearchParameterIsInstitucion();
    log(`🔎 Buscando: "${instName}"...`, 'info');

    const searchInput = findSearchInput();
    if (!searchInput) {
      log('❌ No se encontró la barra de "Búsqueda" en la página.', 'err');
      return false;
    }

    setNativeInputValue(searchInput, instName);
    await sleep(250);

    const searchBtn = findSearchButton(searchInput);
    if (searchBtn) {
      searchBtn.click();
    }

    // Esperar a que la tabla cargue los resultados de esa institución
    const normTarget = normalize(instName);
    let matchedRow = null;

    for (let attempt = 0; attempt < 20; attempt++) {
      if (stopRequested) return false;
      await sleep(400);
      const rows = getMainTableRows();
      if (rows.length > 0) {
        const firstRowText = normalize(rows[0].textContent);
        // Verificar si la primera fila coincide con la institución buscada
        if (
          firstRowText.includes(normTarget) ||
          normTarget.split(' ').filter((w) => w.length > 3).every((w) => firstRowText.includes(w))
        ) {
          matchedRow = rows[0];
          break;
        }
      }
    }

    if (!matchedRow) {
      log(`⚠️ No se encontró coincidencia en la tabla para "${instName}". Saltando...`, 'warn');
      return false;
    }

    const rowCells = matchedRow.querySelectorAll('td');
    const periodoText = rowCells[3] ? rowCells[3].textContent.trim() : '';
    const estatusText = rowCells[5] ? rowCells[5].textContent.trim() : '';

    const pencilBtn = findPencilButtonInRow(matchedRow);
    if (!pencilBtn) {
      log(`❌ No se encontró el botón del lápiz en la fila de "${instName}".`, 'err');
      return false;
    }

    log(`✏️ Abriendo evaluación (${periodoText || '1ra fila'} - ${estatusText || 'Sin estatus'})...`, 'info');
    pencilBtn.click();
    await sleep(stepDelay);

    const ok = await processOpenModal(estatusText);
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

      const success = await processInstitution(currentInst);
      if (success) {
        log(`🎉 Completado: ${currentInst}`, 'ok');
        // Quitar de la lista de pendientes las que ya se completaron con éxito
        remaining.shift();
        textarea.value = remaining.join('\n');
        updateCounter();
      } else {
        log(`⚠️ Hubo un inconveniente con: ${currentInst}. Se mantiene al final.`, 'warn');
      }

      await sleep(getDelay());
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
        await processOpenModal('');
      } else {
        const rows = getMainTableRows();
        if (rows.length === 0) {
          log('⚠️ No hay filas en la tabla para abrir.', 'warn');
        } else {
          const firstRow = rows[0];
          const rowCells = firstRow.querySelectorAll('td');
          const instName = rowCells[1] ? rowCells[1].textContent.trim() : 'Fila 1';
          const estatusText = rowCells[5] ? rowCells[5].textContent.trim() : '';
          const pencilBtn = findPencilButtonInRow(firstRow);
          if (pencilBtn) {
            log(`✏️ Abriendo 1ra fila (${instName})...`, 'info');
            pencilBtn.click();
            await sleep(getDelay());
            await processOpenModal(estatusText);
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
