// ============================================================
// visitas.js — Lógica de visita.html e historial.html
// ============================================================

// ---- VISITA.HTML --------------------------------------

async function iniciarVisita() {
  await cargarClientesSelect('selectCliente');

  const sel = document.getElementById('selectCliente');

  // Preseleccionar cliente si viene en URL ?cliente=id
  const params = new URLSearchParams(location.search);
  if (params.has('cliente')) {
    sel.value = params.get('cliente');
    _actualizarFormVisita(sel);
  }

  // Actualizar formulario al cambiar cliente
  sel.addEventListener('change', () => _actualizarFormVisita(sel));

  document.getElementById('formVisita').addEventListener('submit', guardarVisita);
  document.getElementById('fFecha').value = hoyISO();
}

async function cargarClientesSelect(selectId) {
  const sel = document.getElementById(selectId);
  sel.innerHTML = '<option value="">Cargando...</option>';
  try {
    const clientes = await dbGetClientes(true);
    sel.innerHTML = '<option value="">— Selecciona cliente —</option>' +
      clientes.map(c => {
        const icono = c.es_cerveza ? '🍺 ' : c.es_telefono ? '📞 ' : '';
        return `<option value="${c.id}"
          data-cerveza="${!!c.es_cerveza}"
          data-telefono="${!!c.es_telefono}"
        >${c.orden_ruta ? c.orden_ruta + '. ' : ''}${icono}${c.nombre}</option>`;
      }).join('');
  } catch (e) {
    sel.innerHTML = '<option value="">Error al cargar</option>';
  }
}

function _actualizarFormVisita(selectEl) {
  const opt        = selectEl.options[selectEl.selectedIndex];
  const esCerveza  = opt?.dataset?.cerveza === 'true';
  const wrap       = document.getElementById('importeWrap');
  const nota       = document.getElementById('notaCerveza');
  const cervezaWrap = document.getElementById('cervezaWrap');

  // Cliente cerveza: ocultar importe y el toggle de botella (su "compró" ya es la botella)
  if (wrap)        wrap.style.display      = esCerveza ? 'none' : 'block';
  if (nota)        nota.style.display      = esCerveza ? 'block' : 'none';
  if (cervezaWrap) cervezaWrap.style.display = esCerveza ? 'none' : 'block';
}

async function guardarVisita(e) {
  e.preventDefault();
  const btn = document.getElementById('btnGuardarVisita');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const sel       = document.getElementById('selectCliente');
  const opt       = sel.options[sel.selectedIndex];
  const esCerveza = opt?.dataset?.cerveza === 'true';
  const compro    = document.getElementById('toggleCompro').checked;

  const payload = {
    cliente_id:     sel.value,
    fecha:          document.getElementById('fFecha').value,
    compro,
    importe:        esCerveza ? 0 : (parseFloat(document.getElementById('fImporte').value) || 0),
    // Es cerveza: su "compró" principal ya indica la botella
    // Cliente normal: usar el toggle específico de botella
    compro_cerveza: esCerveza
      ? compro
      : document.getElementById('toggleCerveza').checked,
    notas: document.getElementById('fNotasVisita').value.trim() || null
  };

  try {
    await dbInsertVisita(payload);
    showToast('Visita registrada');
    document.getElementById('formVisita').reset();
    document.getElementById('fFecha').value = hoyISO();
    _actualizarFormVisita(sel); // restaurar visibilidad tras reset
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar visita';
  }
}

// ---- HISTORIAL.HTML -----------------------------------

async function iniciarHistorial() {
  await cargarClientesSelect('selectClienteHistorial');
  document.getElementById('selectClienteHistorial')
    .addEventListener('change', cargarHistorial);

  // Preseleccionar si viene en URL
  const params = new URLSearchParams(location.search);
  if (params.has('cliente')) {
    document.getElementById('selectClienteHistorial').value = params.get('cliente');
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
