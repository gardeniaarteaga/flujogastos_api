-- Amplia el campo comentario (usado como "nota" tanto en pagos individuales
-- como en pagos/gastos compartidos, ya que es una unica columna en transacciones)
-- de VARCHAR(50) a VARCHAR(75).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'transacciones'
      AND column_name = 'comentario'
      AND character_maximum_length < 75
  ) THEN
    ALTER TABLE transacciones
    ALTER COLUMN comentario TYPE VARCHAR(75);
  END IF;
END $$;
