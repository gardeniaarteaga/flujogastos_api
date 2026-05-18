import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateNotificacionProgramadaDto {
  @IsString()
  @MaxLength(160)
  descripcion!: string;

  @IsInt()
  @Min(1)
  @Max(31)
  dia_pago_programado!: number;

  @IsInt()
  @Min(1)
  id_periodicidad!: number;
}
