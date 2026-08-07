-- Agrega campo para almacenar el id de referencia bancaria del pago.
-- Es nullable, solo acepta digitos (numeros) y hasta 20 caracteres.
-- En pagos multiples (varios registros de detalle pagados bajo la misma
-- referencia) este valor debe replicarse en cada uno de los registros
-- involucrados (logica a nivel de aplicacion, no de base de datos).

ALTER TABLE detalle_transacciones
ADD COLUMN IF NOT EXISTS id_referencia_banco VARCHAR(20);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_detalle_transacciones_id_referencia_banco_numerico'
  ) THEN
    ALTER TABLE detalle_transacciones
    ADD CONSTRAINT chk_detalle_transacciones_id_referencia_banco_numerico
    CHECK (id_referencia_banco IS NULL OR id_referencia_banco ~ '^[0-9]{1,20}$');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_detalle_transacciones_id_referencia_banco
ON detalle_transacciones (id_referencia_banco);
