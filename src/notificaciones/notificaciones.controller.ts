import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';

import { NotificacionesService } from './notificaciones.service';

@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Get()
  findAll(
    @Query('id_usuario') idUsuario?: string,
    @Query('limite') limite?: string,
  ) {
    return this.notificacionesService.findAll(
      this.parseIdUsuario(idUsuario),
      this.parseLimite(limite),
    );
  }

  @Patch('marcar-todas')
  markAllAsRead(@Query('id_usuario') idUsuario?: string) {
    return this.notificacionesService.markAllAsRead(this.parseIdUsuario(idUsuario));
  }

  @Patch(':id/marcar-leida')
  markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @Query('id_usuario') idUsuario?: string,
  ) {
    return this.notificacionesService.markAsRead(
      id,
      this.parseIdUsuario(idUsuario),
    );
  }

  private parseIdUsuario(idUsuario?: string): number {
    const parsedValue = Number(idUsuario ?? 1);

    if (!Number.isInteger(parsedValue) || parsedValue < 1) {
      throw new BadRequestException('El id_usuario debe ser un entero positivo');
    }

    return parsedValue;
  }

  private parseLimite(limite?: string): number {
    if (limite === undefined || limite.trim() === '') {
      return 8;
    }

    const parsedValue = Number(limite);

    if (!Number.isInteger(parsedValue) || parsedValue < 1) {
      throw new BadRequestException('El limite debe ser un entero positivo');
    }

    return parsedValue;
  }
}
