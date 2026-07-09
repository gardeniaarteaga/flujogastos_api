import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { EstadoCuentaService } from './estado-cuenta.service';
import { CreateEstadoCuentaDto } from './dto/create-estado-cuenta.dto';
import { UpdateEstadoCuentaDto } from './dto/update-estado-cuenta.dto';

@Controller('estado-cuenta')
export class EstadoCuentaController {
  constructor(private readonly estadoCuentaService: EstadoCuentaService) {}

  @Post()
  create(
    @Body() createEstadoCuentaDto: CreateEstadoCuentaDto,
    @Query('id_usuario') idUsuario?: string,
  ) {
    return this.estadoCuentaService.create(createEstadoCuentaDto, this.parseIdUsuario(idUsuario));
  }

  @Get()
  findAll(
    @Query('id_usuario') idUsuario?: string,
    @Query('id_metodo_pago') idMetodoPago?: string,
  ) {
    return this.estadoCuentaService.findAll(
      this.parseIdUsuario(idUsuario),
      idMetodoPago !== undefined ? this.parseIdMetodoPago(idMetodoPago) : undefined,
    );
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('id_usuario') idUsuario?: string,
  ) {
    return this.estadoCuentaService.findOne(id, this.parseIdUsuario(idUsuario));
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEstadoCuentaDto: UpdateEstadoCuentaDto,
    @Query('id_usuario') idUsuario?: string,
  ) {
    return this.estadoCuentaService.update(
      id,
      updateEstadoCuentaDto,
      this.parseIdUsuario(idUsuario),
    );
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('id_usuario') idUsuario?: string,
  ) {
    return this.estadoCuentaService.remove(id, this.parseIdUsuario(idUsuario));
  }

  private parseIdUsuario(idUsuario?: string): number {
    const parsedValue = Number(idUsuario);

    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
      throw new BadRequestException('El id_usuario debe ser un entero positivo');
    }

    return parsedValue;
  }

  private parseIdMetodoPago(idMetodoPago: string): number {
    const parsedValue = Number(idMetodoPago);

    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
      throw new BadRequestException('El id_metodo_pago debe ser un entero positivo');
    }

    return parsedValue;
  }
}
