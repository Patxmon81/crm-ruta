-- ============================================================
-- CRM RUTAS DE VENTAS — Schema Supabase
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- Tabla: clientes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo_cliente TEXT UNIQUE NOT NULL,
  nombre         TEXT NOT NULL,
  telefono       TEXT,
  notas          TEXT,
  orden_ruta     INTEGER DEFAULT 0,
  activo         BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_clientes_activo     ON clientes (activo);
CREATE INDEX IF NOT EXISTS idx_clientes_orden_ruta ON clientes (orden_ruta);

-- ------------------------------------------------------------
-- Tabla: visitas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS visitas (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  fecha      DATE NOT NULL,
  importe    NUMERIC(10,2) DEFAULT 0,
  compro     BOOLEAN DEFAULT FALSE,
  notas      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_visitas_cliente_id ON visitas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_visitas_fecha      ON visitas (fecha);

-- ------------------------------------------------------------
-- Row Level Security (RLS) — habilitar acceso desde frontend
-- ------------------------------------------------------------
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitas  ENABLE ROW LEVEL SECURITY;

-- Política abierta para anon (ajustar según necesidades de auth)
CREATE POLICY "allow_all_clientes" ON clientes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_visitas"  ON visitas  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- Datos de ejemplo (opcional, borrar en producción)
-- ------------------------------------------------------------
INSERT INTO clientes (codigo_cliente, nombre, telefono, notas, orden_ruta) VALUES
  ('C001', 'Panadería San Luis',    '612345678', 'Prefiere visita antes de las 10h', 1),
  ('C002', 'Supermercado Central',  '623456789', 'Responsable: María García',        2),
  ('C003', 'Bar El Rincón',         '634567890', 'Solo cash',                        3),
  ('C004', 'Cafetería Olimpia',     '645678901', 'Cerrado los lunes',                4),
  ('C005', 'Frutería La Huerta',    '656789012', 'Buen cliente habitual',            5)
ON CONFLICT (codigo_cliente) DO NOTHING;
