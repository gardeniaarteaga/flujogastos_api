import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  Matches,
  Min,
} from 'class-validator';

export class ApplyPagosMasivosDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids_detalle!: number[];

  @IsOptional()
  @Matches(/^\d{1,20}$/, {
    message: 'id_referencia_banco debe contener solo numeros (maximo 20 digitos)',
  })
  id_referencia_banco?: string;
}
