import {
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, QueryFailedError, Repository } from 'typeorm';

import { Participante } from '../participantes/entities/participante.entity';
import { CreateNotificacionProgramadaDto } from './dto/create-notificacion-programada.dto';
import { UpdateNotificacionProgramadaDto } from './dto/update-notificacion-programada.dto';
import { Notificacion } from './entities/notificacion.entity';
import { NotificacionProgramada } from './entities/notificacion-programada.entity';
import { Periodicidad } from './entities/periodicidad.entity';

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

type PeriodicidadResponse = {
  id_periodicidad: number;
  nombre_periodicidad: string;
  descripcion: string | null;
  codigo: string;
  estado: boolean;
};

type NotificacionProgramadaResponse = {
  id_notificacion_programada: number;
  id_usuario: number;
  descripcion: string;
  dia_pago_programado: number;
  id_periodicidad: number;
  periodicidad_nombre: string;
  periodicidad_codigo: string;
  estado: boolean;
  fecha_creacion: Date;
  fecha_actualizacion: Date;
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
    @InjectRepository(Periodicidad)
    private readonly periodicidadRepository: Repository<Periodicidad>,
    @InjectRepository(NotificacionProgramada)
    private readonly notificacionesProgramadasRepository: Repository<NotificacionProgramada>,
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

  async findPeriodicidades(): Promise<PeriodicidadResponse[]> {
    await this.ensureSchemaReady();

    const items = await this.periodicidadRepository.find({
      where: { estado: true },
      order: { id_periodicidad: 'ASC' },
    });

    return items.map((item) => ({
      id_periodicidad: item.id_periodicidad,
      nombre_periodicidad: item.nombre_periodicidad,
      descripcion: item.descripcion ?? null,
      codigo: item.codigo,
      estado: item.estado,
    }));
  }

  async findProgramadas(
    idUsuario: number,
  ): Promise<NotificacionProgramadaResponse[]> {
    await this.ensureSchemaReady();

    const items = await this.notificacionesProgramadasRepository.find({
      where: { id_usuario: idUsuario, estado: true },
      relations: { periodicidad: true },
      order: {
        dia_pago_programado: 'ASC',
        id_notificacion_programada: 'DESC',
      },
    });

    return items.map((item) => this.toProgramadaResponse(item));
  }

  async createProgramada(
    createDto: CreateNotificacionProgramadaDto,
    idUsuario: number,
  ): Promise<NotificacionProgramadaResponse> {
    await this.ensureSchemaReady();
    const periodicidad = await this.findPeriodicidadOrFail(createDto.id_periodicidad);

    const entity = this.notificacionesProgramadasRepository.create({
      id_usuario: idUsuario,
      descripcion: createDto.descripcion.trim(),
      dia_pago_programado: createDto.dia_pago_programado,
      id_periodicidad: periodicidad.id_periodicidad,
      estado: true,
    });

    const saved = await this.notificacionesProgramadasRepository.save(entity);
    saved.periodicidad = periodicidad;
    return this.toProgramadaResponse(saved);
  }

  async updateProgramada(
    idNotificacionProgramada: number,
    updateDto: UpdateNotificacionProgramadaDto,
    idUsuario: number,
  ): Promise<NotificacionProgramadaResponse> {
    await this.ensureSchemaReady();

    const entity = await this.findProgramadaOwnedOrFail(
      idNotificacionProgramada,
      idUsuario,
    );

    if (updateDto.id_periodicidad !== undefined) {
      const periodicidad = await this.findPeriodicidadOrFail(updateDto.id_periodicidad);
      entity.id_periodicidad = periodicidad.id_periodicidad;
      entity.periodicidad = periodicidad;
    }

    if (updateDto.descripcion !== undefined) {
      entity.descripcion = updateDto.descripcion.trim();
    }

    if (updateDto.dia_pago_programado !== undefined) {
      entity.dia_pago_programado = updateDto.dia_pago_programado;
    }

    const saved = await this.notificacionesProgramadasRepository.save(entity);

    if (!saved.periodicidad) {
      saved.periodicidad = await this.findPeriodicidadOrFail(saved.id_periodicidad);
    }

    return this.toProgramadaResponse(saved);
  }

  async removeProgramada(
    idNotificacionProgramada: number,
    idUsuario: number,
  ): Promise<{ message: string }> {
    await this.ensureSchemaReady();

    const entity = await this.findProgramadaOwnedOrFail(
      idNotificacionProgramada,
      idUsuario,
    );

    await this.notificacionesProgramadasRepository.remove(entity);

    return {
      message: `La notificacion programada con id ${idNotificacionProgramada} fue eliminada`,
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

  private toProgramadaResponse(
    notification: NotificacionProgramada,
  ): NotificacionProgramadaResponse {
    return {
      id_notificacion_programada: notification.id_notificacion_programada,
      id_usuario: notification.id_usuario,
      descripcion: notification.descripcion,
      dia_pago_programado: notification.dia_pago_programado,
      id_periodicidad: notification.id_periodicidad,
      periodicidad_nombre:
        notification.periodicidad?.nombre_periodicidad ?? 'Periodicidad',
      periodicidad_codigo: notification.periodicidad?.codigo ?? 'mensual',
      estado: notification.estado,
      fecha_creacion: notification.fecha_creacion,
      fecha_actualizacion: notification.fecha_actualizacion,
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
        CREATE TABLE IF NOT EXISTS periodicidad (
          id_periodicidad SERIAL PRIMARY KEY,
          nombre_periodicidad VARCHAR(80) NOT NULL,
          descripcion VARCHAR(180) NULL,
          codigo VARCHAR(40) NOT NULL UNIQUE,
          estado BOOLEAN NOT NULL DEFAULT TRUE
        )
      `);

      await this.dataSource.query(`
        ALTER TABLE periodicidad
        ADD COLUMN IF NOT EXISTS id_periodicidad SERIAL
      `);

      await this.dataSource.query(`
        ALTER TABLE periodicidad
        ADD COLUMN IF NOT EXISTS nombre_periodicidad VARCHAR(80)
      `);

      await this.dataSource.query(`
        ALTER TABLE periodicidad
        ADD COLUMN IF NOT EXISTS descripcion VARCHAR(180) NULL
      `);

      await this.dataSource.query(`
        ALTER TABLE periodicidad
        ADD COLUMN IF NOT EXISTS codigo VARCHAR(40)
      `);

      await this.dataSource.query(`
        ALTER TABLE periodicidad
        ADD COLUMN IF NOT EXISTS estado BOOLEAN NOT NULL DEFAULT TRUE
      `);

      await this.dataSource.query(`
        ALTER TABLE periodicidad
        ALTER COLUMN nombre_periodicidad TYPE VARCHAR(80)
      `);

      await this.dataSource.query(`
        ALTER TABLE periodicidad
        ALTER COLUMN descripcion TYPE VARCHAR(180)
      `);

      await this.dataSource.query(`
        ALTER TABLE periodicidad
        ALTER COLUMN codigo TYPE VARCHAR(40)
      `);

      await this.dataSource.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_periodicidad_codigo
        ON periodicidad (codigo)
      `);

      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS notificaciones_programadas (
          id_notificacion_programada SERIAL PRIMARY KEY,
          id_usuario INTEGER NOT NULL,
          descripcion VARCHAR(160) NOT NULL,
          dia_pago_programado INTEGER NOT NULL CHECK (dia_pago_programado BETWEEN 1 AND 31),
          id_periodicidad INTEGER NOT NULL REFERENCES periodicidad (id_periodicidad),
          estado BOOLEAN NOT NULL DEFAULT TRUE,
          fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
          fecha_actualizacion TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      await this.dataSource.query(`
        ALTER TABLE notificaciones_programadas
        ADD COLUMN IF NOT EXISTS id_notificacion_programada SERIAL
      `);

      await this.dataSource.query(`
        ALTER TABLE notificaciones_programadas
        ADD COLUMN IF NOT EXISTS id_usuario INTEGER
      `);

      await this.dataSource.query(`
        ALTER TABLE notificaciones_programadas
        ADD COLUMN IF NOT EXISTS descripcion VARCHAR(160)
      `);

      await this.dataSource.query(`
        ALTER TABLE notificaciones_programadas
        ADD COLUMN IF NOT EXISTS dia_pago_programado INTEGER
      `);

      await this.dataSource.query(`
        ALTER TABLE notificaciones_programadas
        ADD COLUMN IF NOT EXISTS id_periodicidad INTEGER
      `);

      await this.dataSource.query(`
        ALTER TABLE notificaciones_programadas
        ADD COLUMN IF NOT EXISTS estado BOOLEAN NOT NULL DEFAULT TRUE
      `);

      await this.dataSource.query(`
        ALTER TABLE notificaciones_programadas
        ADD COLUMN IF NOT EXISTS fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
      `);

      await this.dataSource.query(`
        ALTER TABLE notificaciones_programadas
        ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMP NOT NULL DEFAULT NOW()
      `);

      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_notificaciones_programadas_usuario
        ON notificaciones_programadas (id_usuario, estado, dia_pago_programado, id_notificacion_programada DESC)
      `);

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

      await this.seedPeriodicidades();
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

  private async seedPeriodicidades(): Promise<void> {
    await this.dataSource.query(`
      INSERT INTO periodicidad (nombre_periodicidad, descripcion, codigo, estado)
      VALUES
        ('Cada mes', 'Se repetira todos los meses en el mismo dia de pago.', 'mensual', TRUE),
        ('Dia especifico', 'Se ejecutara una vez en el dia programado del ciclo actual.', 'fecha-especifica', TRUE),
        ('Cada ano', 'Se repetira cada ano en el mismo dia del ciclo actual.', 'anual', TRUE)
      ON CONFLICT (codigo)
      DO UPDATE SET
        nombre_periodicidad = EXCLUDED.nombre_periodicidad,
        descripcion = EXCLUDED.descripcion,
        estado = EXCLUDED.estado
    `);
  }

  private async findPeriodicidadOrFail(idPeriodicidad: number): Promise<Periodicidad> {
    const periodicidad = await this.periodicidadRepository.findOne({
      where: { id_periodicidad: idPeriodicidad, estado: true },
    });

    if (!periodicidad) {
      throw new NotFoundException(
        `La periodicidad con id ${idPeriodicidad} no existe o no esta activa`,
      );
    }

    return periodicidad;
  }

  private async findProgramadaOwnedOrFail(
    idNotificacionProgramada: number,
    idUsuario: number,
  ): Promise<NotificacionProgramada> {
    const notification = await this.notificacionesProgramadasRepository.findOne({
      where: {
        id_notificacion_programada: idNotificacionProgramada,
        id_usuario: idUsuario,
        estado: true,
      },
      relations: { periodicidad: true },
    });

    if (!notification) {
      throw new NotFoundException(
        `La notificacion programada con id ${idNotificacionProgramada} no existe para el usuario logueado`,
      );
    }

    return notification;
  }
}
