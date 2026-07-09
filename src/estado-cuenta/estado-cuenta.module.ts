import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EstadoCuentaController } from './estado-cuenta.controller';
import { EstadoCuentaService } from './estado-cuenta.service';
import { EstadoCuenta } from './entities/estado-cuenta.entity';
import { FormaPago } from '../formas-pago/entities/forma-pago.entity';
import { Transaccion } from '../transacciones/entities/transaccion.entity';
import { DetalleTransaccion } from '../transacciones/entities/detalle-transaccion.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EstadoCuenta, FormaPago, Transaccion, DetalleTransaccion])],
  controllers: [EstadoCuentaController],
  providers: [EstadoCuentaService],
  exports: [EstadoCuentaService],
})
export class EstadoCuentaModule {}
