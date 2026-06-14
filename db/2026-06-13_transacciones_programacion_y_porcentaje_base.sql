ALTER TABLE detalle_transacciones
  ADD COLUMN IF NOT EXISTS porcentaje_base NUMERIC(12,6) NULL;
