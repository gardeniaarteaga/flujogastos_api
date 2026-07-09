import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { buildVisibleUserIds } from '../common/admin-visibility.util';
import { CreateEstadoCuentaDto } from './dto/create-estado-cuenta.dto';
import { UpdateEstadoCuentaDto } from './dto/update-estado-cuenta.dto';
import { EstadoCuenta } from './entities/estado-cuenta.entity';
import { FormaPago } from '../formas-pago/entities/forma-pago.entity';
import { Transaccion } from '../transacciones/entities/transaccion.entity';
import { DetalleTransaccion } from '../transacciones/entities/detalle-transaccion.entity';

const ESTADO_REGISTRO_ANULADO_ID = 7;

type CampoMonto =
  | 'saldo_anterior_capital'
  | 'saldo_anterior_intereses'
  | 'saldo_anterior_recargos'
  | 'saldo_anterior_comisiones'
  | 'pagos_acreditaciones'
  | 'devoluciones'
  | 'cuota_extrafinanciamiento'
  | 'cuota_infrafinanciamiento'
  | 'compras_retiros'
  | 'interes_corriente_bonificable'
  | 'interes_corriente'
  | 'recargos_comisiones'
  | 'debitos'
  | 'saldo_contado'
  | 'saldo_a_plazos'
  | 'pago_minimo';

const CAMPOS_MONTO: CampoMonto[] = [
  'saldo_anterior_capital',
  'saldo_anterior_intereses',
  'saldo_anterior_recargos',
  'saldo_anterior_comisiones',
  'pagos_acreditaciones',
  'devoluciones',
  'cuota_extrafinanciamiento',
  'cuota_infrafinanciamiento',
  'compras_retiros',
  'interes_corriente_bonificable',
  'interes_corriente',
  'recargos_comisiones',
  'debitos',
  'saldo_contado',
  'saldo_a_plazos',
  'pago_minimo',
];

export type EstadoCuentaResponse = Omit<EstadoCuenta, CampoMonto> &
  Record<CampoMonto, number> & {
    nombre_forma: string;
    total_deuda: number;
    compras_calculado: number;
    compras_estado_cuenta: number;
    compras_diferencia: number;
    pagos_calculado: number;
    pagos_diferencia: number;
  };

@Injectable()
export class EstadoCuentaService {
  constructor(
    @InjectRepository(EstadoCuenta)
    private readonly estadoCuentaRepository: Repository<EstadoCuenta>,
    @InjectRepository(FormaPago)
    private readonly formaPagoRepository: Repository<FormaPago>,
    @InjectRepository(Transaccion)
    private readonly transaccionRepository: Repository<Transaccion>,
    @InjectRepository(DetalleTransaccion)
    private readonly detalleTransaccionRepository: Repository<DetalleTransaccion>,
  ) {}

  async create(dto: CreateEstadoCuentaDto, idUsuario: number): Promise<EstadoCuentaResponse> {
    const forma = await this.findVisibleForma(dto.id_metodo_pago, idUsuario);
    await this.assertPeriodoDisponible(idUsuario, dto.id_metodo_pago, dto.anio, dto.mes);
    const periodo = this.resolvePeriodo(dto.anio, dto.mes, forma.dia_corte);

    const estadoCuenta = this.estadoCuentaRepository.create({
      id_usuario: idUsuario,
      id_metodo_pago: dto.id_metodo_pago,
      anio: dto.anio,
      mes: dto.mes,
      fecha_inicio_periodo: periodo.inicio,
      fecha_fin_periodo: periodo.fin,
      saldo_anterior_capital: String(dto.saldo_anterior_capital),
      saldo_anterior_intereses: String(dto.saldo_anterior_intereses),
      saldo_anterior_recargos: String(dto.saldo_anterior_recargos),
      saldo_anterior_comisiones: String(dto.saldo_anterior_comisiones),
      pagos_acreditaciones: String(dto.pagos_acreditaciones),
      devoluciones: String(dto.devoluciones),
      cuota_extrafinanciamiento: String(dto.cuota_extrafinanciamiento),
      cuota_infrafinanciamiento: String(dto.cuota_infrafinanciamiento),
      compras_retiros: String(dto.compras_retiros),
      interes_corriente_bonificable: String(dto.interes_corriente_bonificable),
      interes_corriente: String(dto.interes_corriente),
      recargos_comisiones: String(dto.recargos_comisiones),
      debitos: String(dto.debitos),
      saldo_contado: String(dto.saldo_contado),
      saldo_a_plazos: String(dto.saldo_a_plazos),
      pago_minimo: String(dto.pago_minimo),
    });

    const saved = await this.estadoCuentaRepository.save(estadoCuenta);
    return this.toResponse(saved, forma.nombre_metodo);
  }

  async findAll(idUsuario: number, idMetodoPago?: number): Promise<EstadoCuentaResponse[]> {
    const usuariosVisibles = await this.getVisibleUserIds(idUsuario);
    const registros = await this.estadoCuentaRepository.find({
      where: {
        id_usuario: idUsuario,
        ...(idMetodoPago !== undefined ? { id_metodo_pago: idMetodoPago } : {}),
      },
      order: { anio: 'DESC', mes: 'DESC' },
    });

    const formasPorId = await this.loadFormasPorId(usuariosVisibles);

    return Promise.all(
      registros.map((registro) =>
        this.toResponse(
          registro,
          formasPorId.get(registro.id_metodo_pago)?.nombre_metodo ?? 'Forma de pago no disponible',
        ),
      ),
    );
  }

  async findOne(id: number, idUsuario: number): Promise<EstadoCuentaResponse> {
    const registro = await this.findOwned(id, idUsuario);
    const forma = await this.findVisibleForma(registro.id_metodo_pago, idUsuario);
    return this.toResponse(registro, forma.nombre_metodo);
  }

  async update(
    id: number,
    dto: UpdateEstadoCuentaDto,
    idUsuario: number,
  ): Promise<EstadoCuentaResponse> {
    const registro = await this.findOwned(id, idUsuario);

    if (dto.id_metodo_pago !== undefined) {
      registro.id_metodo_pago = dto.id_metodo_pago;
    }

    if (dto.anio !== undefined) {
      registro.anio = dto.anio;
    }

    if (dto.mes !== undefined) {
      registro.mes = dto.mes;
    }

    const forma = await this.findVisibleForma(registro.id_metodo_pago, idUsuario);

    if (dto.id_metodo_pago !== undefined || dto.anio !== undefined || dto.mes !== undefined) {
      await this.assertPeriodoDisponible(
        idUsuario,
        registro.id_metodo_pago,
        registro.anio,
        registro.mes,
        registro.id_estado_cuenta,
      );

      const periodo = this.resolvePeriodo(registro.anio, registro.mes, forma.dia_corte);
      registro.fecha_inicio_periodo = periodo.inicio;
      registro.fecha_fin_periodo = periodo.fin;
    }

    const camposNumericos: Array<keyof UpdateEstadoCuentaDto> = [
      'saldo_anterior_capital',
      'saldo_anterior_intereses',
      'saldo_anterior_recargos',
      'saldo_anterior_comisiones',
      'pagos_acreditaciones',
      'devoluciones',
      'cuota_extrafinanciamiento',
      'cuota_infrafinanciamiento',
      'compras_retiros',
      'interes_corriente_bonificable',
      'interes_corriente',
      'recargos_comisiones',
      'debitos',
      'saldo_contado',
      'saldo_a_plazos',
      'pago_minimo',
    ];

    for (const campo of camposNumericos) {
      const valor = dto[campo];
      if (valor !== undefined) {
        (registro[campo] as string) = String(valor);
      }
    }

    const actualizado = await this.estadoCuentaRepository.save(registro);
    return this.toResponse(actualizado, forma.nombre_metodo);
  }

  async remove(id: number, idUsuario: number): Promise<void> {
    const registro = await this.findOwned(id, idUsuario);
    await this.estadoCuentaRepository.remove(registro);
  }

  private async assertPeriodoDisponible(
    idUsuario: number,
    idMetodoPago: number,
    anio: number,
    mes: number,
    excludeId?: number,
  ): Promise<void> {
    const existente = await this.estadoCuentaRepository.findOne({
      where: { id_usuario: idUsuario, id_metodo_pago: idMetodoPago, anio, mes },
    });

    if (existente && existente.id_estado_cuenta !== excludeId) {
      throw new ConflictException(
        'Ya existe un estado de cuenta registrado para esa forma de pago en ese periodo.',
      );
    }
  }

  private resolvePeriodo(
    anio: number,
    mes: number,
    diaCorte: number | null,
  ): { inicio: string; fin: string } {
    const diaCorteEfectivo = diaCorte ?? 31;

    const fin = this.buildFechaCorte(anio, mes, diaCorteEfectivo);

    const mesAnteriorFecha = new Date(anio, mes - 2, 1);
    const inicioAnclado = this.buildFechaCorte(
      mesAnteriorFecha.getFullYear(),
      mesAnteriorFecha.getMonth() + 1,
      diaCorteEfectivo,
    );
    const inicio = new Date(inicioAnclado);
    inicio.setDate(inicio.getDate() + 1);

    return {
      inicio: this.formatDate(inicio),
      fin,
    };
  }

  private buildFechaCorte(anio: number, mes: number, diaCorte: number): string {
    const ultimoDiaDelMes = new Date(anio, mes, 0).getDate();
    const dia = Math.min(diaCorte, ultimoDiaDelMes);
    return this.formatDate(new Date(anio, mes - 1, dia));
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private async calcularComprasYPagos(
    idMetodoPago: number,
    idUsuario: number,
    fechaInicio: string,
    fechaFin: string,
  ): Promise<{ compras: number; pagos: number }> {
    const comprasResult = await this.transaccionRepository
      .createQueryBuilder('transaccion')
      .select('COALESCE(SUM(transaccion.monto), 0)', 'total')
      .where('transaccion.id_metodo_pago = :idMetodoPago', { idMetodoPago })
      .andWhere('transaccion.id_usuario = :idUsuario', { idUsuario })
      .andWhere('transaccion.fecha BETWEEN :fechaInicio AND :fechaFin', { fechaInicio, fechaFin })
      .andWhere(
        '(transaccion.id_estado_registro IS NULL OR transaccion.id_estado_registro != :anulado)',
        { anulado: ESTADO_REGISTRO_ANULADO_ID },
      )
      .getRawOne<{ total: string }>();

    const pagosResult = await this.detalleTransaccionRepository
      .createQueryBuilder('detalle')
      .innerJoin(Transaccion, 'transaccion', 'transaccion.id_transaccion = detalle.id_transaccion')
      .select('COALESCE(SUM(detalle.monto_pagado), 0)', 'total')
      .where('detalle.id_metodo_pago = :idMetodoPago', { idMetodoPago })
      .andWhere('detalle.id_usuario = :idUsuario', { idUsuario })
      .andWhere('detalle.fecha_pago BETWEEN :fechaInicio AND :fechaFin', { fechaInicio, fechaFin })
      .andWhere(
        '(transaccion.id_estado_registro IS NULL OR transaccion.id_estado_registro != :anulado)',
        { anulado: ESTADO_REGISTRO_ANULADO_ID },
      )
      .getRawOne<{ total: string }>();

    return {
      compras: Number(comprasResult?.total ?? 0),
      pagos: Number(pagosResult?.total ?? 0),
    };
  }

  private async toResponse(
    registro: EstadoCuenta,
    nombreForma: string,
  ): Promise<EstadoCuentaResponse> {
    const { compras, pagos } = await this.calcularComprasYPagos(
      registro.id_metodo_pago,
      registro.id_usuario,
      registro.fecha_inicio_periodo,
      registro.fecha_fin_periodo,
    );

    const compraRetiros = Number(registro.compras_retiros);
    const pagosAcreditaciones = Number(registro.pagos_acreditaciones);
    const totalDeuda =
      Number(registro.cuota_extrafinanciamiento) +
      Number(registro.cuota_infrafinanciamiento) +
      compraRetiros +
      Number(registro.recargos_comisiones) +
      Number(registro.interes_corriente);
    const comprasEstadoCuenta =
      Number(registro.cuota_extrafinanciamiento) +
      Number(registro.cuota_infrafinanciamiento) +
      compraRetiros +
      Number(registro.interes_corriente) +
      Number(registro.recargos_comisiones) -
      Number(registro.devoluciones);

    const montos = Object.fromEntries(
      CAMPOS_MONTO.map((campo) => [campo, this.roundMoney(Number(registro[campo]))]),
    ) as Record<CampoMonto, number>;

    return {
      ...registro,
      ...montos,
      nombre_forma: nombreForma,
      total_deuda: this.roundMoney(totalDeuda),
      compras_calculado: this.roundMoney(compras),
      compras_estado_cuenta: this.roundMoney(comprasEstadoCuenta),
      compras_diferencia: this.roundMoney(comprasEstadoCuenta - compras),
      pagos_calculado: this.roundMoney(pagos),
      pagos_diferencia: this.roundMoney(pagosAcreditaciones - pagos),
    };
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private async findOwned(id: number, idUsuario: number): Promise<EstadoCuenta> {
    const registro = await this.estadoCuentaRepository.findOne({
      where: { id_estado_cuenta: id, id_usuario: idUsuario },
    });

    if (!registro) {
      throw new NotFoundException(`El estado de cuenta con id ${id} no existe`);
    }

    return registro;
  }

  private async findVisibleForma(idMetodoPago: number, idUsuario: number): Promise<FormaPago> {
    const usuariosVisibles = await this.getVisibleUserIds(idUsuario);
    const forma = await this.formaPagoRepository.findOne({
      where: usuariosVisibles.map((usuarioVisible) => ({
        id_metodo: idMetodoPago,
        id_usuario: usuarioVisible,
      })),
    });

    if (!forma) {
      throw new NotFoundException(`La forma de pago con id ${idMetodoPago} no existe`);
    }

    return forma;
  }

  private async loadFormasPorId(usuariosVisibles: number[]): Promise<Map<number, FormaPago>> {
    const formas = await this.formaPagoRepository.find({
      where: usuariosVisibles.map((usuarioVisible) => ({ id_usuario: usuarioVisible })),
    });

    return new Map(formas.map((forma) => [forma.id_metodo, forma]));
  }

  private getVisibleUserIds(idUsuario: number): Promise<number[]> {
    return buildVisibleUserIds(this.formaPagoRepository, idUsuario);
  }
}
