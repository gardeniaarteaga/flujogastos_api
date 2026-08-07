import { IsInt, IsNumber, IsOptional, Matches, Min } from 'class-validator';

export class ApplyPagoDetalleDto {
  @IsInt()
  @Min(1)
  id_detalle!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto!: number;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fecha_pago debe tener el formato YYYY-MM-DD',
  })
  fecha_pago?: string;

  @IsOptional()
  @Matches(/^\d{1,20}$/, {
    message: 'id_referencia_banco debe contener solo numeros (maximo 20 digitos)',
  })
  id_referencia_banco?: string;
}
