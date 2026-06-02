// ============================================================
// clientes.js — Lógica de la página clientes.html
// ============================================================

let todosClientes = [];
let editandoId = null;

async function iniciarClientes() {
  await cargarClientes();
  bindBuscador();
  bindModal();
}

// ---- Carga y render ----------------------------------

async function cargarClientes() {
  const lista = document.getElementById('listaClientes');
  lista.innerHTML = '<div class="loader"><div class="spinner"></div> Cargando...</div>';

  try {
    todosClientes = await dbGetClientes(false);
    renderTabla(todosClientes);
  } catch (e) {
    lista.innerHTML = `<div class="loader" style="color:var(--danger)">Error: ${e.message}</div>`;
  }
}

function renderTabla(clientes) {
  const lista = document.getElementById('listaClientes');

  if (!clientes.length) {
    lista.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <p>No hay clientes</p>
      </div>`;
    return;
  }

  const DIA_LABEL = { lunes:'Lun', martes:'Mar', miercoles:'Mié', jueves:'Jue' };

  lista.innerHTML = `<div class="item-list">
    ${clientes.map(c => {

      const chips = [
        c.es_telefono ? '<span class="chip chip-telefono">📞 Tel.</span>' : '',
        c.es_cerveza  ? '<span class="chip" style="background:rgba(234,179,8,.15);color:#ca8a04;border:1px solid rgba(234,179,8,.3)">🍺 Cerv.</span>' : '',
        !c.es_telefono && !c.es_cerveza ? '<span class="chip chip-muted">Visita</span>' : '',
        c.activo
          ? '<span class="chip chip-success">Activo</span>'
          : '<span class="chip chip-danger">Inactivo</span>',
      ].filter(Boolean).join('');

      const dias = (c.dias_visita || [])
        .map(d => `<span class="day-chip">${DIA_LABEL[d] || d}</span>`)
        .join('');

      return `
        <div class="item-row" style="align-items:flex-start;gap:10px">
          <div style="flex:1;min-width:0">
            <div class="item-name">${escHtml(c.nombre)}</div>
            <div class="item-sub" style="margin-bottom:4px">${c.codigo_cliente}${c.telefono ? ' · ' + escHtml(c.telefono) : ''}</div>
            <div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center">
              ${chips}
              ${dias}
            </div>
          </div>

          <div style="display:flex;gap:6px;flex-shrink:0;margin-top:2px">
            <button class="btn-icon" onclick="abrirEditar('${c.id}')" title="Editar">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            ${c.activo ? `
            <button class="btn-icon" onclick="desactivar('${c.id}','${escAttr(c.nombre)}')" title="Desactivar"
              style="color:var(--danger);border-color:rgba(239,68,68,.3)">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
            </button>` : ''}
          </div>
        </div>`;
    }).join('')}
  </div>`;
}

// ---- Buscador ----------------------------------------

function bindBuscador() {
  const input = document.getElementById('buscador');
  if (!input) return;
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    if (!q) { renderTabla(todosClientes); return; }
    const filtrados = todosClientes.filter(c =>
      c.nombre.toLowerCase().includes(q) || c.codigo_cliente.toLowerCase().includes(q)
    );
    renderTabla(filtrados);
  });
}

// ---- Modal -------------------------------------------

function bindModal() {
  document.getElementById('btnNuevoCliente')
    .addEventListener('click', () => abrirModal());

  document.getElementById('btnCerrarModal')
    .addEventListener('click', cerrarModal);

  document.getElementById('overlayCliente')
    .addEventListener('click', e => { if (e.target.id === 'overlayCliente') cerrarModal(); });

  document.getElementById('formCliente')
    .addEventListener('submit', guardarCliente);
}

function abrirModal(datos = null) {
  editandoId = datos?.id || null;
  const titulo = document.getElementById('modalTitulo');
  titulo.textContent = editandoId ? 'Editar cliente' : 'Nuevo cliente';

  document.getElementById('fCodigo').value      = datos?.codigo_cliente || '';
  document.getElementById('fNombre').value      = datos?.nombre || '';
  document.getElementById('fTelefono').value    = datos?.telefono || '';
  document.getElementById('fNotas').value       = datos?.notas || '';
  document.getElementById('fEsTelefono').checked = datos?.es_telefono || false;
  document.getElementById('fEsCerveza').checked  = datos?.es_cerveza  || false;

  // Días de visita/pedido
  const dias = datos?.dias_visita || [];
  ['lunes','martes','miercoles','jueves'].forEach(d => {
    const cb = document.getElementById('fDia_' + d);
    if (cb) cb.checked = dias.includes(d);
  });

  document.getElementById('overlayCliente').classList.add('open');
}

function cerrarModal() {
  document.getElementById('overlayCliente').classList.remove('open');
  editandoId = null;
}

async function abrirEditar(id) {
  const cliente = todosClientes.find(c => c.id === id);
  if (cliente) abrirModal(cliente);
}

async function guardarCliente(e) {
  e.preventDefault();
  const btn = document.getElementById('btnGuardarCliente');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const dias_visita = ['lunes','martes','miercoles','jueves']
    .filter(d => document.getElementById('fDia_' + d)?.checked);

  const payload = {
    codigo_cliente: document.getElementById('fCodigo').value.trim(),
    nombre:         document.getElementById('fNombre').value.trim(),
    telefono:       document.getElementById('fTelefono').value.trim() || null,
    notas:          document.getElementById('fNotas').value.trim() || null,
    dias_visita,
    es_telefono:    document.getElementById('fEsTelefono').checked,
    es_cerveza:     document.getElementById('fEsCerveza').checked
  };

  try {
    if (editandoId) {
      await dbUpdateCliente(editandoId, payload);
      showToast('Cliente actualizado');
    } else {
      await dbInsertCliente(payload);
      showToast('Cliente creado');
    }
    cerrarModal();
    await cargarClientes();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
}

async function desactivar(id, nombre) {
  if (!confirm(`¿Desactivar a "${nombre}"?`)) return;
  try {
    await dbDesactivarCliente(id);
    showToast(`${nombre} desactivado`);
    await cargarClientes();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ---- Helpers -----------------------------------------

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function escAttr(s) {
  return String(s || '').replace(/'/g, '&#39;');
}
