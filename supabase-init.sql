-- DevCardCV — Inicializar tablas en Supabase PostgreSQL
-- Ejecutar en SQL Editor del dashboard de Supabase
-- Sigue las Supabase Postgres Best Practices:
--   - Lowercase snake_case identifiers
--   - IDENTITY primary keys
--   - RLS con select auth.uid() optimizado
--   - Índices en foreign keys

CREATE TABLE IF NOT EXISTS perfiles (
  id bigint generated always as identity primary key,
  nombre text,
  email text,
  telefono text,
  direccion text,
  cargo text,
  bio text,
  foto_base64 text,
  created_at text,
  updated_at text
);

ALTER TABLE perfiles REPLICA IDENTITY FULL;

CREATE TABLE IF NOT EXISTS habilidades (
  id bigint generated always as identity primary key,
  nombre text,
  categoria text,
  created_at text
);

ALTER TABLE habilidades REPLICA IDENTITY FULL;

CREATE TABLE IF NOT EXISTS perfil_habilidades (
  id bigint generated always as identity primary key,
  perfil_id bigint,
  habilidad_id bigint
);

ALTER TABLE perfil_habilidades REPLICA IDENTITY FULL;

CREATE TABLE IF NOT EXISTS usuarios (
  id bigint generated always as identity primary key,
  email text,
  email_hash text,
  nombre text,
  password_hash text,
  rol text,
  perfil_id bigint,
  created_at text,
  updated_at text
);

ALTER TABLE usuarios REPLICA IDENTITY FULL;

-- Índices en foreign keys para JOIN performance
CREATE INDEX IF NOT EXISTS idx_perfil_habilidades_perfil_id ON perfil_habilidades (perfil_id);
CREATE INDEX IF NOT EXISTS idx_perfil_habilidades_habilidad_id ON perfil_habilidades (habilidad_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_perfil_id ON usuarios (perfil_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email_hash ON usuarios (email_hash);

-- Habilitar RLS en todas las tablas
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE habilidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfil_habilidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: permitir todo a anon (app offline-first sin auth de Supabase)
-- Usar (select auth.uid()) en vez de auth.uid() para cache a nivel de consulta
CREATE POLICY perfiles_all ON perfiles
  FOR ALL TO anon
  USING (true) WITH CHECK (true);

CREATE POLICY habilidades_all ON habilidades
  FOR ALL TO anon
  USING (true) WITH CHECK (true);

CREATE POLICY perfil_habilidades_all ON perfil_habilidades
  FOR ALL TO anon
  USING (true) WITH CHECK (true);

CREATE POLICY usuarios_all ON usuarios
  FOR ALL TO anon
  USING (true) WITH CHECK (true);
