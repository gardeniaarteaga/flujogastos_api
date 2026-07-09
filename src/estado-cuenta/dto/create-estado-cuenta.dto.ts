import { IsInt, IsNumber, Max, Min } from 'class-validator';

export class CreateEstadoCuentaDto {
  @IsInt()
  id_metodo_pago!: number;

  @IsInt()
  @Min(2000)
  anio!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  mes!: number;

  @IsNumber()
  saldo_anterior_capital!: number;

  @IsNumber()
  saldo_anterior_intereses!: number;

  @IsNumber()
  saldo_anterior_recargos!: number;

  @IsNumber()
  saldo_anterior_comisiones!: number;

  @IsNumber()
  pagos_acreditaciones!: number;

  @IsNumber()
  devoluciones!: number;

  @IsNumber()
  cuota_extrafinanciamiento!: number;

  @IsNumber()
  cuota_infrafinanciamiento!: number;

  @IsNumber()
  compras_retiros!: number;

  @IsNumber()
  interes_corriente_bonificable!: number;

  @IsNumber()
  interes_corriente!: number;

  @IsNumber()
  recargos_comisiones!: number;

  @IsNumber()
  debitos!: number;

  @IsNumber()
  saldo_contado!: number;

  @IsNumber()
  saldo_a_plazos!: number;

  @IsNumber()
  pago_minimo!: number;
}
