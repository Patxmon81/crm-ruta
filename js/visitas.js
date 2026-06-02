// ============================================================
// visitas.js — Lógica de visita.html e historial.html
// ============================================================

// ---- VISITA.HTML --------------------------------------

async function iniciarVisita() {
  await cargarClientesSelect('selectCliente', 'clienteSearchInput', 'clienteDropdown');

  const hidden = document.getElementById('selectCliente');

  // Preseleccionar cliente si viene en URL ?cliente=id
  const params = new URLSearchParams(location.search);
  if (params.has('cliente')) {
    _seleccionarClienteCombo('selectCliente', 'clienteSearchInput', 'clienteDropdown', params.get('cliente'));
    _actualizarFormVisita(hidden);
  }

  hidden.addEventListener('change', () => _actualizarFormVisita(hidden));

  document.getElementById('formVisita').addEventListener('submit', guardarVisita);
  document.getElementById('fFecha').value = hoyISO();
}

// Cache de clientes por hiddenId para permitir preselección sin abrir el dropdown
const _clientesCache = {};

// Configura el combo de búsqueda de clientes
async function cargarClientesSelect(hiddenId, inputId, dropdownId) {
  const input    = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  const hidden   = document.getElementById(hiddenId);
  if (!input || !dropdown || !hidden) return;

  let todos = [];
  try {
    todos = await dbGetClientes(true);
    _clientesCache[hiddenId] = todos;
  } catch (e) {
    input.placeholder = 'Error al cargar clientes';
    return;
  }

  function etiqueta(c) {
    const icono = c.es_cerveza ? '🍺 ' : c.es_telefono ? '📞 ' : '';
    return `${c.orden_ruta ? c.orden_ruta + '. ' : ''}${icono}${c.nombre}`;
  }

  function mostrarOpciones(filtro) {
    const texto = filtro.trim().toLowerCase();
    const lista = texto
      ? todos.filter(c => c.nombre.toLowerCase().includes(texto) ||
                         etiqueta(c).toLowerCase().includes(texto) ||
                         (c.orden_ruta && String(c.orden_ruta).startsWith(texto)))
      : todos;

    if (!lista.length) {
      dropdown.innerHTML = '<div class="select-option no-results">Sin resultados</div>';
    } else {
      dropdown.innerHTML = lista.map(c =>
        `<div class="select-option" data-id="${c.id}"
              data-cerveza="${!!c.es_cerveza}" data-telefono="${!!c.es_telefono}">
          <div class="opt-name">${etiqueta(c)}</div>
        </div>`
      ).join('');
      dropdown.querySelectorAll('.select-option[data-id]').forEach(el => {
        el.addEventListener('mousedown', e => {
          e.preventDefault();
          input.value  = el.querySelector('.opt-name').textContent;
          hidden.value = el.dataset.id;
          hidden.dataset.cerveza  = el.dataset.cerveza;
          hidden.dataset.telefono = el.dataset.telefono;
          dropdown.classList.remove('open');
          hidden.dispatchEvent(new Event('change'));
        });
      });
    }
    dropdown.classList.add('open');
  }

  input.addEventListener('focus', () => mostrarOpciones(input.value));
  input.addEventListener('input', () => mostrarOpciones(input.value));
  input.addEventListener('blur',  () => {
    // pequeño delay para que el mousedown del option se procese antes
    setTimeout(() => dropdown.classList.remove('open'), 150);
  });
}

// Preselecciona un cliente por ID usando el cache de datos (no el DOM del dropdown)
function _seleccionarClienteCombo(hiddenId, inputId, _dropdownId, clienteId) {
  const input  = document.getElementById(inputId);
  const hidden = document.getElementById(hiddenId);
  if (!input || !hidden) return;

  const todos = _clientesCache[hiddenId] || [];
  const c = todos.find(cl => String(cl.id) === String(clienteId));
  if (c) {
    const icono = c.es_cerveza ? '🍺 ' : c.es_telefono ? '📞 ' : '';
    input.value = `${c.orden_ruta ? c.orden_ruta + '. ' : ''}${icono}${c.nombre}`;
    hidden.dataset.cerveza  = !!c.es_cerveza;
    hidden.dataset.telefono = !!c.es_telefono;
  }
  hidden.value = clienteId;
}

function _actualizarFormVisita(hiddenEl) {
  const esCerveza = hiddenEl.dataset.cerveza === 'true';
  const nota      = document.getElementById('notaCerveza');
  if (nota) nota.style.display = esCerveza ? 'block' : 'none';
}

async function guardarVisita(e) {
  e.preventDefault();
  const btn = document.getElementById('btnGuardarVisita');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const hidden    = document.getElementById('selectCliente');
  const esCerveza = hidden.dataset.cerveza === 'true';
  const compro    = document.getElementById('toggleCompro').checked;

  if (!hidden.value) {
    showToast('Selecciona un cliente', 'error');
    btn.disabled = false;
    btn.textContent = 'Guardar visita';
    return;
  }

  const payload = {
    cliente_id:     hidden.value,
    fecha:          document.getElementById('fFecha').value,
    compro,
    importe:        parseFloat(document.getElementById('fImporte').value) || 0,
    notas: document.getElementById('fNotasVisita').value.trim() || null
  };

  try {
    await dbInsertVisita(payload);
    showToast('Visita registrada');
    document.getElementById('formVisita').reset();
    document.getElementById('fFecha').value = hoyISO();
    // Limpiar combo y restaurar visibilidad
    document.getElementById('clienteSearchInput').value = '';
    hidden.value = '';
    hidden.dataset.cerveza = 'false';
    _actualizarFormVisita(hidden);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar visita';
  }
}

// ---- HISTORIAL.HTML -----------------------------------

async function iniciarHistorial() {
  await cargarClientesSelect('selectClienteHistorial', 'histClienteSearchInput', 'histClienteDropdown');
  document.getElementById('selectClienteHistorial')
    .addEventListener('change', cargarHistorial);

  const params = new URLSearchParams(location.search);
  if (params.has('cliente')) {
    _seleccionarClienteCombo('selectClienteHistorial', 'histClienteSearchInput', 'histClienteDropdown', params.get('cliente'));
    cargarHistorial();
  }
}

async function cargarHistorial() {
  const clienteId = document.getElementById('selectClienteHistorial').value;
  const contenido = document.getElementById('historialContenido');

  if (!clienteId) {
    contenido.innerHTML = '';
    return;
  }

  contenido.innerHTML = '<div class="loader"><div class="spinner"></div> Cargando...</div>';

  try {
    const visitas = await dbGetVisitasPorCliente(clienteId);
    renderHistorial(visitas);
  } catch (e) {
    contenido.innerHTML = `<div class="loader" style="color:var(--danger)">Error: ${e.message}</div>`;
  }
}

function renderHistorial(visitas) {
  const contenido = document.getElementById('historialContenido');

  if (!visitas.length) {
    contenido.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <p>Sin visitas registradas</p>
      </div>`;
    return;
  }

  // Calcular totales
  const totalVisitas = visitas.length;
  const vecesCompro  = visitas.filter(v => v.compro).length;
  const importeTotal = visitas.reduce((s, v) => s + Number(v.importe || 0), 0);
  const ticketMedio  = vecesCompro > 0 ? importeTotal / vecesCompro : 0;
  const efectividad  = Math.round((vecesCompro / totalVisitas) * 100);

  // Visitas del último mes para el gráfico
  const hace30 = new Date(); hace30.setDate(hace30.getDate() - 30);
  const ultimoMes = visitas
    .filter(v => new Date(v.fecha) >= hace30)
    .slice(0, 15)
    .reverse();

  const maxImporte = Math.max(...ultimoMes.map(v => Number(v.importe || 0)), 1);

  contenido.innerHTML = `
    <div class="stats-grid mb-16">
      <div class="stat-card">
        <div class="stat-val">${totalVisitas}</div>
        <div class="stat-lbl">Visitas</div>
      </div>
      <div class="stat-card success">
        <div class="stat-val text-success">${efectividad}%</div>
        <div class="stat-lbl">Efectividad</div>
      </div>
      <div class="stat-card accent">
        <div class="stat-val text-accent">${formatImporte(importeTotal)}</div>
        <div class="stat-lbl">Total</div>
      </div>
    </div>

    ${ultimoMes.length ? `
    <p class="section-title">Importes último mes</p>
    <div class="card mb-16">
      <div class="bar-chart">
        ${ultimoMes.map(v => `
          <div class="bar-row">
            <span class="bar-label">${formatFecha(v.fecha)}</span>
            <div class="bar-track">
              <div class="bar-fill" style="width:${(Number(v.importe || 0) / maxImporte * 100).toFixed(1)}%"></div>
            </div>
            <span class="bar-val">${formatImporte(v.importe)}</span>
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    <p class="section-title">Historial completo</p>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>¿Compró?</th>
            <th>Importe</th>
            <th>Notas</th>
          </tr>
        </thead>
        <tbody>
          ${visitas.map(v => `
            <tr>
              <td>${formatFecha(v.fecha)}</td>
              <td>
                ${v.compro
                  ? '<span class="chip chip-success">Sí</span>'
                  : '<span class="chip chip-danger">No</span>'}
              </td>
              <td class="fw-700">${v.compro ? formatImporte(v.importe) : '—'}</td>
              <td class="text-muted fs-sm">${v.notas || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}
