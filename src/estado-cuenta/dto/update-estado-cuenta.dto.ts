import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateEstadoCuentaDto {
  @IsOptional()
  @IsInt()
  id_metodo_pago?: number;

  @IsOptional()
  @IsInt()
  @Min(2000)
  anio?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  mes?: number;

  @IsOptional()
  @IsNumber()
  saldo_anterior_capital?: number;

  @IsOptional()
  @IsNumber()
  saldo_anterior_intereses?: number;

  @IsOptional()
  @IsNumber()
  saldo_anterior_recargos?: number;

  @IsOptional()
  @IsNumber()
  saldo_anterior_comisiones?: number;

  @IsOptional()
  @IsNumber()
  pagos_acreditaciones?: number;

  @IsOptional()
  @IsNumber()
  devoluciones?: number;

  @IsOptional()
  @IsNumber()
  cuota_extrafinanciamiento?: number;

  @IsOptional()
  @IsNumber()
  cuota_infrafinanciamiento?: number;

  @IsOptional()
  @IsNumber()
  compras_retiros?: number;

  @IsOptional()
  @IsNumber()
  interes_corriente_bonificable?: number;

  @IsOptional()
  @IsNumber()
  interes_corriente?: number;

  @IsOptional()
  @IsNumber()
  recargos_comisiones?: number;

  @IsOptional()
  @IsNumber()
  debitos?: number;

  @IsOptional()
  @IsNumber()
  saldo_contado?: number;

  @IsOptional()
  @IsNumber()
  saldo_a_plazos?: number;

  @IsOptional()
  @IsNumber()
  pago_minimo?: number;
}
