import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CategoriasModule } from './categorias/categorias.module';
import { SubcategoriasModule } from './subcategorias/subcategorias.module';
import { EntidadesFinancierasModule } from './entidades-financieras/entidades-financieras.module';
import { TipoEntidadModule } from './tipo-entidad/tipo-entidad.module';
import { TipoProductoModule } from './tipo-producto/tipo-producto.module';
import { FormasPagoModule } from './formas-pago/formas-pago.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { ParticipantesModule } from './participantes/participantes.module';
import { EstadosTransaccionModule } from './estados-transaccion/estados-transaccion.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { InteresesModule } from './intereses/intereses.module';
import { TransaccionesModule } from './transacciones/transacciones.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_NAME', 'flujo_gastos'),
        entities: [
          'dist/**/*.entity{.ts,.js}',
        ],
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    CategoriasModule,
    SubcategoriasModule,
    EntidadesFinancierasModule,
    TipoEntidadModule,
    TipoProductoModule,
    FormasPagoModule,
    ParticipantesModule,
    UsuariosModule,
    EstadosTransaccionModule,
    NotificacionesModule,
    InteresesModule,
    TransaccionesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
