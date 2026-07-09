import { CreateDateColumn, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'estados_cuenta' })
export class EstadoCuenta {
  @PrimaryGeneratedColumn({ name: 'id_estado_cuenta' })
  id_estado_cuenta!: number;

  @Column({ name: 'id_usuario', type: 'int' })
  id_usuario!: number;

  @Column({ name: 'id_metodo_pago', type: 'int' })
  id_metodo_pago!: number;

  @Column({ name: 'anio', type: 'int' })
  anio!: number;

  @Column({ name: 'mes', type: 'int' })
  mes!: number;

  @Column({ name: 'fecha_inicio_periodo', type: 'date' })
  fecha_inicio_periodo!: string;

  @Column({ name: 'fecha_fin_periodo', type: 'date' })
  fecha_fin_periodo!: string;

  @Column({ name: 'saldo_anterior_capital', type: 'numeric', precision: 12, scale: 2, default: () => "'0.00'" })
  saldo_anterior_capital!: string;

  @Column({ name: 'saldo_anterior_intereses', type: 'numeric', precision: 12, scale: 2, default: () => "'0.00'" })
  saldo_anterior_intereses!: string;

  @Column({ name: 'saldo_anterior_recargos', type: 'numeric', precision: 12, scale: 2, default: () => "'0.00'" })
  saldo_anterior_recargos!: string;

  @Column({ name: 'saldo_anterior_comisiones', type: 'numeric', precision: 12, scale: 2, default: () => "'0.00'" })
  saldo_anterior_comisiones!: string;

  @Column({ name: 'pagos_acreditaciones', type: 'numeric', precision: 12, scale: 2, default: () => "'0.00'" })
  pagos_acreditaciones!: string;

  @Column({ name: 'devoluciones', type: 'numeric', precision: 12, scale: 2, default: () => "'0.00'" })
  devoluciones!: string;

  @Column({ name: 'cuota_extrafinanciamiento', type: 'numeric', precision: 12, scale: 2, default: () => "'0.00'" })
  cuota_extrafinanciamiento!: string;

  @Column({ name: 'cuota_infrafinanciamiento', type: 'numeric', precision: 12, scale: 2, default: () => "'0.00'" })
  cuota_infrafinanciamiento!: string;

  @Column({ name: 'compras_retiros', type: 'numeric', precision: 12, scale: 2, default: () => "'0.00'" })
  compras_retiros!: string;

  @Column({ name: 'interes_corriente_bonificable', type: 'numeric', precision: 12, scale: 2, default: () => "'0.00'" })
  interes_corriente_bonificable!: string;

  @Column({ name: 'interes_corriente', type: 'numeric', precision: 12, scale: 2, default: () => "'0.00'" })
  interes_corriente!: string;

  @Column({ name: 'recargos_comisiones', type: 'numeric', precision: 12, scale: 2, default: () => "'0.00'" })
  recargos_comisiones!: string;

  @Column({ name: 'debitos', type: 'numeric', precision: 12, scale: 2, default: () => "'0.00'" })
  debitos!: string;

  @Column({ name: 'saldo_contado', type: 'numeric', precision: 12, scale: 2, default: () => "'0.00'" })
  saldo_contado!: string;

  @Column({ name: 'saldo_a_plazos', type: 'numeric', precision: 12, scale: 2, default: () => "'0.00'" })
  saldo_a_plazos!: string;

  @Column({ name: 'pago_minimo', type: 'numeric', precision: 12, scale: 2, default: () => "'0.00'" })
  pago_minimo!: string;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'timestamp' })
  fecha_creacion!: Date;
}
