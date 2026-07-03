import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import { CuotaProgramadaDto } from './cuota-programada.dto';

export class CreateDetalleTransaccionDto {
  @IsInt()
  @Min(1)
  id_participante!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monto!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  @Max(100)
  porcentaje?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  cantidad_cuotas?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  id_metodo_pago?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CuotaProgramadaDto)
  cuotas?: CuotaProgramadaDto[];
}


