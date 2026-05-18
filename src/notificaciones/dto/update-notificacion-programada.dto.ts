import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateNotificacionProgramadaDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  descripcion?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dia_pago_programado?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  id_periodicidad?: number;
}
