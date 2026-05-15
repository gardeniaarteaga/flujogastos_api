import {
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, QueryFailedError, Repository } from 'typeorm';

import { Participante } from '../participantes/entities/participante.entity';
import { Notificacion } from './entities/notificacion.entity';

const NOTIFICACION_TIPO_PAGO_ASIGNADO = 'PAGO_ASIGNADO';
const NOTIFICACION_TIPO_COBRO_INGRESADO = 'COBRO_INGRESADO';

type NotificacionResponse = {
  id_notificacion: number;
  id_usuario_destino: number;
  id_usuario_origen: number | null;
  id_transaccion: number | null;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  fecha_leida: Date | null;
  fecha_creacion: Date;
};

type MarkAllAsReadResponse = {
  updated: number;
  ids_notificacion: number[];
  fecha_leida: Date | null;
};

type PagoAsignadoNotificationInput = {
  idUsuarioOrigen: number;
  idTransaccion: number;
  descripcion: string | null;
  fecha: string;
  detalles: Array<{
    id_participante: number;
    id_usuario_relacionado: number | null;
    monto: string | number;
  }>;
};

type CobroIngresadoNotificationInput = {
  idUsuarioOrigen: number;
  idTransaccion: number;
  descripcion: string | null;
  fecha: string;
  detalles: Array<{
    id_participante: number;
    id_usuario_relacionado: number | null;
    monto: string | number;
  }>;
};

@Injectable()
export class NotificacionesService implements OnModuleInit {
  private ensureSchemaPromise: Promise<void> | null = null;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(Notificacion)
    private readonly notificacionesRepository: Repository<Notificacion>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSchemaReady();
  }

  async findAll(idUsuario: number, limite = 8): Promise<{
    pendientes: number;
    items: NotificacionResponse[];
  }> {
    await this.ensureSchemaReady();

    const normalizedLimit = Math.min(Math.max(1, limite), 20);
    const [pendientes, items] = await Promise.all([
      this.notificacionesRepository.count({
        where: {
          id_usuario_destino: idUsuario,
          leida: false,
        },
      }),
      this.notificacionesRepository.find({
        where: {
          id_usuario_destino: idUsuario,
          leida: false,
        },
        order: { fecha_creacion: 'DESC', id_notificacion: 'DESC' },
        take: normalizedLimit,
      }),
    ]);

    return {
      pendientes,
      items: items.map((item) => this.toResponse(item)),
    };
  }

  async markAllAsRead(idUsuario: number): Promise<MarkAllAsReadResponse> {
    await this.ensureSchemaReady();

    const unreadNotifications = await this.notificacionesRepository.find({
      where: {
        id_usuario_destino: idUsuario,
        leida: false,
      },
    });

    if (unreadNotifications.length === 0) {
      return { updated: 0, ids_notificacion: [], fecha_leida: null };
    }

    const readAt = new Date();
    unreadNotifications.forEach((notification) => {
      notification.leida = true;
      notification.fecha_leida = readAt;
    });

    await this.notificacionesRepository.save(unreadNotifications);

    return {
      updated: unreadNotifications.length,
      ids_notificacion: unreadNotifications.map(
        (notification) => notification.id_notificacion,
      ),
      fecha_leida: readAt,
    };
  }

  async markAsRead(
    idNotificacion: number,
    idUsuario: number,
  ): Promise<NotificacionResponse> {
    await this.ensureSchemaReady();

    const notification = await this.notificacionesRepository.findOne({
      where: {
        id_notificacion: idNotificacion,
        id_usuario_destino: idUsuario,
      },
    });

    if (!notification) {
      throw new NotFoundException(
        `La notificacion con id ${idNotificacion} no existe para el usuario logueado`,
      );
    }

    if (!notification.leida) {
      notification.leida = true;
      notification.fecha_leida = new Date();
      await this.notificacionesRepository.save(notification);
    }

    return this.toResponse(notification);
  }

  async syncPagoAsignadoNotificationsSafely(
    input: PagoAsignadoNotificationInput,
  ): Promise<void> {
    try {
      await this.ensureSchemaReady();
      await this.notificacionesRepository.manager.transaction(async (manager) => {
        await this.syncPagoAsignadoNotifications(manager, input);
      });
    } catch (error) {
      console.warn(
        'No se pudieron sincronizar las notificaciones de pago asignado:',
        error,
      );
    }
  }

  async createCobroIngresadoNotificationsSafely(
    input: CobroIngresadoNotificationInput,
  ): Promise<void> {
    try {
      await this.ensureSchemaReady();
      await this.notificacionesRepository.manager.transaction(async (manager) => {
        await this.createCobroIngresadoNotifications(manager, input);
      });
    } catch (error) {
      console.warn(
        'No se pudieron crear las notificaciones de cobro ingresado:',
        error,
      );
    }
  }

  async syncPagoAsignadoNotifications(
    manager: EntityManager,
    input: PagoAsignadoNotificationInput,
  ): Promise<void> {
    await manager.delete(Notificacion, {
      id_transaccion: input.idTransaccion,
      tipo: NOTIFICACION_TIPO_PAGO_ASIGNADO,
    });

    const detallesRelacionados = input.detalles.filter(
      (detalle) =>
        detalle.id_usuario_relacionado !== null &&
        detalle.id_usuario_relacionado !== input.idUsuarioOrigen,
    );

    if (detallesRelacionados.length === 0) {
      return;
    }

    const participantes = await manager.find(Participante, {
      where: {
        id_participante: In(
          Array.from(new Set(detallesRelacionados.map((detalle) => detalle.id_participante))),
        ),
      },
    });
    const participantesMap = new Map(
      participantes.map((participante) => [
        participante.id_participante,
        participante.nombre_participante,
      ]),
    );
    const detallesByUser = new Map<
      number,
      {
        montoCentavos: number;
        participantes: Set<string>;
      }
    >();

    for (const detalle of detallesRelacionados) {
      const idUsuarioDestino = detalle.id_usuario_relacionado!;
      const currentEntry = detallesByUser.get(idUsuarioDestino) ?? {
        montoCentavos: 0,
        participantes: new Set<string>(),
      };
      const participanteNombre = participantesMap.get(detalle.id_participante)?.trim();

      currentEntry.montoCentavos += this.toCents(Number(detalle.monto));

      if (participanteNombre) {
        currentEntry.participantes.add(participanteNombre);
      }

      detallesByUser.set(idUsuarioDestino, currentEntry);
    }

    const referenciaTransaccion =
      input.descripcion?.trim() || `transaccion del ${input.fecha}`;
    const notifications = Array.from(detallesByUser.entries()).map(
      ([idUsuarioDestino, detail]) =>
        manager.create(Notificacion, {
          id_usuario_destino: idUsuarioDestino,
          id_usuario_origen: input.idUsuarioOrigen,
          id_transaccion: input.idTransaccion,
          tipo: NOTIFICACION_TIPO_PAGO_ASIGNADO,
          titulo: 'Pago asignado',
          mensaje: this.buildPagoAsignadoMessage(
            referenciaTransaccion,
            detail.participantes,
            detail.montoCentavos,
          ),
          leida: false,
          fecha_leida: null,
        }),
    );

    await manager.save(Notificacion, notifications);
  }

  async createCobroIngresadoNotifications(
    manager: EntityManager,
    input: CobroIngresadoNotificationInput,
  ): Promise<void> {
    const detallesRelacionados = input.detalles.filter(
      (detalle) =>
        detalle.id_usuario_relacionado !== null &&
        detalle.id_usuario_relacionado !== input.idUsuarioOrigen &&
        this.toCents(Number(detalle.monto)) > 0,
    );

    if (detallesRelacionados.length === 0) {
      return;
    }

    const participantes = await manager.find(Participante, {
      where: {
        id_participante: In(
          Array.from(new Set(detallesRelacionados.map((detalle) => detalle.id_participante))),
        ),
      },
    });
    const participantesMap = new Map(
      participantes.map((participante) => [
        participante.id_participante,
        participante.nombre_participante,
      ]),
    );
    const detallesByUser = new Map<
      number,
      {
        montoCentavos: number;
        participantes: Set<string>;
      }
    >();

    for (const detalle of detallesRelacionados) {
      const idUsuarioDestino = detalle.id_usuario_relacionado!;
      const currentEntry = detallesByUser.get(idUsuarioDestino) ?? {
        montoCentavos: 0,
        participantes: new Set<string>(),
      };
      const participanteNombre = participantesMap.get(detalle.id_participante)?.trim();

      currentEntry.montoCentavos += this.toCents(Number(detalle.monto));

      if (participanteNombre) {
        currentEntry.participantes.add(participanteNombre);
      }

      detallesByUser.set(idUsuarioDestino, currentEntry);
    }

    const referenciaTransaccion =
      input.descripcion?.trim() || `transaccion del ${input.fecha}`;
    const notifications = Array.from(detallesByUser.entries()).map(
      ([idUsuarioDestino, detail]) =>
        manager.create(Notificacion, {
          id_usuario_destino: idUsuarioDestino,
          id_usuario_origen: input.idUsuarioOrigen,
          id_transaccion: input.idTransaccion,
          tipo: NOTIFICACION_TIPO_COBRO_INGRESADO,
          titulo: 'Cobro registrado',
          mensaje: this.buildCobroIngresadoMessage(
            referenciaTransaccion,
            detail.participantes,
            detail.montoCentavos,
          ),
          leida: false,
          fecha_leida: null,
        }),
    );

    await manager.save(Notificacion, notifications);
  }

  private buildPagoAsignadoMessage(
    referenciaTransaccion: string,
    participantes: Set<string>,
    montoCentavos: number,
  ): string {
    const monto = this.centsToAmount(montoCentavos).toFixed(2);
    const participantesTexto =
      participantes.size > 0
        ? ` para ${Array.from(participantes).join(', ')}`
        : '';

    return `Se te asigno un pago de $${monto}${participantesTexto} en ${referenciaTransaccion}.`;
  }

  private buildCobroIngresadoMessage(
    referenciaTransaccion: string,
    participantes: Set<string>,
    montoCentavos: number,
  ): string {
    const monto = this.centsToAmount(montoCentavos).toFixed(2);
    const participantesTexto =
      participantes.size > 0
        ? ` para ${Array.from(participantes).join(', ')}`
        : '';

    return `Se ingreso un cobro de $${monto}${participantesTexto} en ${referenciaTransaccion}.`;
  }

  private toResponse(notification: Notificacion): NotificacionResponse {
    return {
      id_notificacion: notification.id_notificacion,
      id_usuario_destino: notification.id_usuario_destino,
      id_usuario_origen: notification.id_usuario_origen ?? null,
      id_transaccion: notification.id_transaccion ?? null,
      tipo: notification.tipo,
      titulo: notification.titulo,
      mensaje: notification.mensaje,
      leida: notification.leida,
      fecha_leida: notification.fecha_leida ?? null,
      fecha_creacion: notification.fecha_creacion,
    };
  }

  private toCents(value: number): number {
    return Math.round(value * 100);
  }

  private centsToAmount(value: number): number {
    return Number((value / 100).toFixed(2));
  }

  private async ensureSchemaReady(): Promise<void> {
    if (!this.ensureSchemaPromise) {
      this.ensureSchemaPromise = this.createSchemaIfNeeded().catch((error) => {
        this.ensureSchemaPromise = null;
        throw error;
      });
    }

    await this.ensureSchemaPromise;
  }

  private async createSchemaIfNeeded(): Promise<void> {
    try {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS notificaciones (
          id_notificacion SERIAL PRIMARY KEY,
          id_usuario_destino INTEGER NOT NULL,
          id_usuario_origen INTEGER NULL,
          id_transaccion INTEGER NULL,
          tipo VARCHAR(50) NOT NULL,
          titulo VARCHAR(160) NOT NULL,
          mensaje VARCHAR(500) NOT NULL,
          leida BOOLEAN NOT NULL DEFAULT FALSE,
          fecha_leida TIMESTAMP NULL,
          fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_fecha
        ON notificaciones (id_usuario_destino, fecha_creacion DESC, id_notificacion DESC)
      `);

      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_leida
        ON notificaciones (id_usuario_destino, leida)
      `);
    } catch (error) {
      if (this.isRelationAlreadyBeingCreated(error)) {
        return;
      }

      throw error;
    }
  }

  private isRelationAlreadyBeingCreated(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as { code?: string; message?: string } | undefined;
    return driverError?.code === '42P07' || driverError?.message?.includes('already exists') === true;
  }
}
