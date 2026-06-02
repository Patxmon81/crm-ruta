// ============================================================
// db.js — Almacenamiento local con localStorage
// Misma API pública que la versión Supabase: todo async.
// ============================================================

const DB_CLIENTES   = 'crm_clientes';
const DB_VISITAS    = 'crm_visitas';
const DB_PENDIENTES = 'crm_pendientes';

// ---- Utilidades internas --------------------------------

function _load(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); }
  catch { return []; }
}

function _save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function _uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function _now() { return new Date().toISOString(); }

// ---- Clientes -------------------------------------------

async function dbGetClientes(soloActivos = true) {
  let data = _load(DB_CLIENTES);
  if (soloActivos) data = data.filter(c => c.activo !== false);
  return data.sort((a, b) => (a.orden_ruta || 0) - (b.orden_ruta || 0));
}

async function dbGetCliente(id) {
  const todos = _load(DB_CLIENTES);
  const c = todos.find(c => c.id === id);
  if (!c) throw new Error('Cliente no encontrado');
  return c;
}

async function dbInsertCliente(cliente) {
  const todos = _load(DB_CLIENTES);
  if (todos.some(c => c.codigo_cliente === cliente.codigo_cliente)) {
    throw new Error(`El código "${cliente.codigo_cliente}" ya existe`);
  }
  // Auto-asignar orden al final de la ruta
  const maxOrden = todos.reduce((m, c) => Math.max(m, c.orden_ruta || 0), 0);
  const nuevo = { ...cliente, id: _uuid(), activo: true, orden_ruta: maxOrden + 1, created_at: _now() };
  todos.push(nuevo);
  _save(DB_CLIENTES, todos);
  return nuevo;
}

async function dbUpdateCliente(id, campos) {
  const todos = _load(DB_CLIENTES);
  const idx = todos.findIndex(c => c.id === id);
  if (idx === -1) throw new Error('Cliente no encontrado');
  // Si cambia el código, verificar unicidad
  if (campos.codigo_cliente && campos.codigo_cliente !== todos[idx].codigo_cliente) {
    if (todos.some(c => c.codigo_cliente === campos.codigo_cliente && c.id !== id)) {
      throw new Error(`El código "${campos.codigo_cliente}" ya existe`);
    }
  }
  todos[idx] = { ...todos[idx], ...campos };
  _save(DB_CLIENTES, todos);
  return todos[idx];
}

async function dbDesactivarCliente(id) {
  return dbUpdateCliente(id, { activo: false });
}

// ---- Visitas --------------------------------------------

async function dbGetVisitasHoy() {
  const hoy = hoyISO();
  const clientes = _load(DB_CLIENTES);
  const cMap = Object.fromEntries(clientes.map(c => [c.id, c]));

  return _load(DB_VISITAS)
    .filter(v => v.fecha === hoy)
    .map(v => ({ ...v, clientes: cMap[v.cliente_id] || null }));
}

async function dbGetVisitasPorCliente(clienteId) {
  return _load(DB_VISITAS)
    .filter(v => v.cliente_id === clienteId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

async function dbGetVisitasRango(desde, hasta) {
  const clientes = _load(DB_CLIENTES);
  const cMap = Object.fromEntries(clientes.map(c => [c.id, c]));

  return _load(DB_VISITAS)
    .filter(v => v.fecha >= desde && v.fecha <= hasta)
    .map(v => ({ ...v, clientes: cMap[v.cliente_id] || null }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

async function dbGetClientesPorDia(dia) {
  const clientes = await dbGetClientes(true);
  return clientes.filter(c => Array.isArray(c.dias_visita) && c.dias_visita.includes(dia));
}

async function dbInsertVisita(visita) {
  const todas = _load(DB_VISITAS);
  const nueva = { ...visita, id: _uuid(), created_at: _now() };
  todas.push(nueva);
  _save(DB_VISITAS, todas);
  // Si el cliente tenía pedido pendiente esta semana, se resuelve automáticamente
  dbResolverPendiente(visita.cliente_id);
  return nueva;
}

async function dbUpdateVisita(id, campos) {
  const todas = _load(DB_VISITAS);
  const idx = todas.findIndex(v => v.id === id);
  if (idx === -1) throw new Error('Visita no encontrada');
  todas[idx] = { ...todas[idx], ...campos };
  _save(DB_VISITAS, todas);
  return todas[idx];
}

// ---- Pedidos pendientes (clientes telefónicos) ----------

function dbMarcarPendiente(clienteId) {
  const semana = getLunesISO();
  const todos  = _load(DB_PENDIENTES);
  if (todos.some(p => p.cliente_id === clienteId && p.semana === semana && !p.resuelto)) return;
  todos.push({ id: _uuid(), cliente_id: clienteId, semana, fecha: hoyISO(), resuelto: false });
  _save(DB_PENDIENTES, todos);
}

function dbResolverPendiente(clienteId) {
  const semana = getLunesISO();
  const todos  = _load(DB_PENDIENTES);
  let changed  = false;
  todos.forEach(p => {
    if (p.cliente_id === clienteId && p.semana === semana && !p.resuelto) {
      p.resuelto = true; changed = true;
    }
  });
  if (changed) _save(DB_PENDIENTES, todos);
}

function dbEsPendiente(clienteId) {
  const semana = getLunesISO();
  return _load(DB_PENDIENTES).some(p => p.cliente_id === clienteId && p.semana === semana && !p.resuelto);
}

async function dbGetPendientesSemana() {
  const semana   = getLunesISO();
  const todos    = _load(DB_PENDIENTES).filter(p => p.semana === semana && !p.resuelto);
  const cMap     = Object.fromEntries(_load(DB_CLIENTES).map(c => [c.id, c]));
  return todos.map(p => ({ ...p, cliente: cMap[p.cliente_id] || null })).filter(p => p.cliente);
}

function dbGetCountPendientes() {
  const semana = getLunesISO();
  return _load(DB_PENDIENTES).filter(p => p.semana === semana && !p.resuelto).length;
}

// ---- Estimado mensual -----------------------------------

async function dbGetEstimadoMes() {
  const hoy = hoyISO();
  const [anyo, mes] = hoy.split('-');
  const inicioMes = `${anyo}-${mes}-01`;

  // Último día del mes actual
  const finMes = new Date(parseInt(anyo), parseInt(mes), 0)
    .toISOString().split('T')[0];

  // Ventas acumuladas este mes (excluye cerveza)
  const cIds  = _getCervezaIds();
  const todas = _load(DB_VISITAS);
  const ventasMes = todas
    .filter(v => v.fecha >= inicioMes && v.fecha <= hoy && !cIds.has(v.cliente_id))
    .reduce((s, v) => s + Number(v.importe || 0), 0);

  // Días Lun-Jue ya transcurridos (incluyendo hoy)
  const diasPasados = contarDiasLaborables(inicioMes, hoy);

  // Días Lun-Jue restantes desde mañana hasta fin de mes
  const manana = new Date(hoy + 'T12:00:00');
  manana.setDate(manana.getDate() + 1);
  const mananaISO = manana.toISOString().split('T')[0];
  const diasRestantes = mananaISO <= finMes
    ? contarDiasLaborables(mananaISO, finMes)
    : 0;

  const totalDias    = diasPasados + diasRestantes;
  const promedioDia  = diasPasados > 0 ? ventasMes / diasPasados : 0;
  // Nota: ventasMes ya excluye cerveza (calculado arriba con cIds)
  const estimado     = ventasMes + promedioDia * diasRestantes;
  const progreso     = totalDias > 0 ? diasPasados / totalDias : 0;

  return { ventasMes, promedioDia, diasPasados, diasRestantes, totalDias, estimado, progreso };
}

function contarDiasLaborables(desdeISO, hastaISO) {
  if (desdeISO > hastaISO) return 0;
  let count = 0;
  const fin = new Date(hastaISO + 'T12:00:00');
  const d   = new Date(desdeISO + 'T12:00:00');
  while (d <= fin) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 4) count++; // Lun=1 … Jue=4
    d.setDate(d.getDate() + 1);
  }
  return count;
}

// ---- Objetivo mensual -----------------------------------

const DB_OBJETIVOS = 'crm_objetivos';

function dbGetObjetivo(mesISO) {
  try {
    return Number(JSON.parse(localStorage.getItem(DB_OBJETIVOS) || '{}')[mesISO] || 0);
  } catch { return 0; }
}

function dbSetObjetivo(mesISO, valor) {
  try {
    const obj = JSON.parse(localStorage.getItem(DB_OBJETIVOS) || '{}');
    if (valor > 0) obj[mesISO] = valor; else delete obj[mesISO];
    localStorage.setItem(DB_OBJETIVOS, JSON.stringify(obj));
  } catch {}
}

// ---- Histórico mensual ----------------------------------

async function dbGetHistoricoMeses(numMeses = 12) {
  const cIds    = _getCervezaIds();
  const visitas = _load(DB_VISITAS);
  const hoy     = hoyISO();
  const meses   = [];

  for (let i = 0; i < numMeses; i++) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const mesISO  = d.toISOString().substring(0, 7);
    const inicio  = mesISO + '-01';
    const finD    = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const fin     = i === 0 ? hoy : finD.toISOString().split('T')[0];

    const total = visitas
      .filter(v => v.fecha >= inicio && v.fecha <= fin && !cIds.has(v.cliente_id))
      .reduce((s, v) => s + Number(v.importe || 0), 0);

    const objetivo = dbGetObjetivo(mesISO);

    // Omitir meses vacíos sin objetivo (salvo el actual)
    if (i > 0 && total === 0 && objetivo === 0) continue;

    meses.push({
      mesISO,
      nombre:      d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
      total,
      objetivo,
      esMesActual: i === 0
    });
  }
  return meses;
}

// ---- IDs de clientes cerveza (excluidos de ventas) ------

function _getCervezaIds() {
  return new Set(_load(DB_CLIENTES).filter(c => c.es_cerveza).map(c => c.id));
}

// ---- Estadística clientes cerveza (compraron este mes) --

function dbGetCervezaMes() {
  const hoy       = hoyISO();
  const inicioMes = hoy.substring(0, 7) + '-01';
  const cIds      = _getCervezaIds(); // clientes es_cerveza

  const visitas   = _load(DB_VISITAS).filter(v => v.fecha >= inicioMes && v.fecha <= hoy);

  // Cuenta clientes únicos que compraron botella:
  // · Cliente es_cerveza: su campo "compro" indica la botella
  //   (soporte a registros antiguos sin compro_cerveza)
  // · Cualquier cliente: campo compro_cerveza = true
  const compraron = new Set(
    visitas
      .filter(v =>
        v.compro_cerveza ||
        (cIds.has(v.cliente_id) && v.compro && v.compro_cerveza === undefined)
      )
      .map(v => v.cliente_id)
  );

  // Total de clientes es_cerveza (denominador de la numérica propia)
  const totalCerveza = _load(DB_CLIENTES).filter(c => c.es_cerveza && c.activo !== false).length;

  return { compraron: compraron.size, total: totalCerveza };
}

// ---- Resumen ventas (hoy / semana / mes) ----------------

async function dbGetResumenVentas() {
  const hoy       = hoyISO();
  const lunes     = getLunesISO();
  const inicioMes = hoy.substring(0, 7) + '-01';
  const todas     = _load(DB_VISITAS);
  const cIds      = _getCervezaIds();
  const suma      = arr => arr
    .filter(v => !cIds.has(v.cliente_id))
    .reduce((s, v) => s + Number(v.importe || 0), 0);
  return {
    hoy:    suma(todas.filter(v => v.fecha === hoy)),
    semana: suma(todas.filter(v => v.fecha >= lunes && v.fecha <= hoy)),
    mes:    suma(todas.filter(v => v.fecha >= inicioMes && v.fecha <= hoy))
  };
}

// ---- Ranking de clientes por mes ------------------------

async function dbGetRankingClientesMes(mesISO) {
  const clientes = await dbGetClientes(true);
  const inicio   = mesISO + '-01';
  const [y, m]   = mesISO.split('-');
  const fin      = new Date(parseInt(y), parseInt(m), 0).toISOString().split('T')[0];
  const hasta    = fin < hoyISO() ? fin : hoyISO();
  const cIds     = _getCervezaIds();

  const visitas = _load(DB_VISITAS).filter(v => v.fecha >= inicio && v.fecha <= hasta);

  const importeMap = {};
  for (const v of visitas) {
    importeMap[v.cliente_id] = (importeMap[v.cliente_id] || 0) + Number(v.importe || 0);
  }

  // Total excluye cerveza, igual que el dashboard, para que los números coincidan
  const totalGlobal = Object.entries(importeMap)
    .filter(([id]) => !cIds.has(id))
    .reduce((s, [, v]) => s + v, 0);

  const ranking = clientes
    .map(c => ({ ...c, totalMes: importeMap[c.id] || 0 }))
    .sort((a, b) => b.totalMes - a.totalMes);

  return { ranking, totalGlobal };
}

// ---- Contexto para Claude --------------------------------

async function dbGetResumenContexto() {
  const [clientes, visitas30] = await Promise.all([
    dbGetClientes(true),
    dbGetVisitasRango(hace30Dias(), hoyISO())
  ]);

  return {
    fecha_hoy: hoyISO(),
    total_clientes: clientes.length,
    clientes: clientes.map(c => ({
      id: c.id, codigo: c.codigo_cliente, nombre: c.nombre, orden: c.orden_ruta
    })),
    visitas_ultimos_30_dias: visitas30.map(v => ({
      fecha: v.fecha,
      cliente: v.clientes?.nombre,
      compro: v.compro,
      importe: v.importe,
      notas: v.notas
    }))
  };
}

// ---- Exportar / Importar datos --------------------------

function dbBorrarTodo() {
  [DB_CLIENTES, DB_VISITAS, DB_PENDIENTES, DB_OBJETIVOS].forEach(k => localStorage.removeItem(k));
}

function dbExportar() {
  const backup = {
    version: 1,
    exportado: _now(),
    clientes: _load(DB_CLIENTES),
    visitas: _load(DB_VISITAS)
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `crm-backup-${hoyISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function dbImportar(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const backup = JSON.parse(e.target.result);
        if (!backup.clientes || !backup.visitas) throw new Error('Archivo inválido');
        _save(DB_CLIENTES, backup.clientes);
        _save(DB_VISITAS,  backup.visitas);
        resolve({ clientes: backup.clientes.length, visitas: backup.visitas.length });
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Error leyendo archivo'));
    reader.readAsText(file);
  });
}

function dbGetEstadisticas() {
  const clientes = _load(DB_CLIENTES);
  const visitas  = _load(DB_VISITAS);
  const sizeKB   = Math.round(
    (localStorage.getItem(DB_CLIENTES)?.length + localStorage.getItem(DB_VISITAS)?.length || 0) / 1024
  );
  return { clientes: clientes.length, visitas: visitas.length, sizeKB };
}

// ---- Helpers de fecha -----------------------------------

function hoyISO() {
  return new Date().toISOString().split('T')[0];
}

function getLunesISO() {
  const d   = new Date();
  const dow = d.getDay(); // 0=Dom
  const diff = dow === 0 ? -6 : 1 - dow;
  const lunes = new Date(d);
  lunes.setDate(d.getDate() + diff);
  return lunes.toISOString().split('T')[0];
}

function diaSemanaHoy() {
  const dias = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
  return dias[new Date().getDay()];
}

function hace30Dias() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
}

function formatFecha(isoDate) {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function formatImporte(num) {
  return Number(num || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}

// ---- Toast ----------------------------------------------

function showToast(msg, type = 'success') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = type;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}

