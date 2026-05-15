import { TransaccionesService } from "./transacciones.service";
import { DetalleTransaccion } from "./entities/detalle-transaccion.entity";
import { Transaccion } from "./entities/transaccion.entity";

type RepositoryMock<T = unknown> = {
  find: jest.Mock<Promise<T[]>, [unknown?]>;
  findOne: jest.Mock<Promise<T | null>, [unknown?]>;
};

const createRepositoryMock = <T = unknown>(): RepositoryMock<T> => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
});

describe("TransaccionesService", () => {
  it("mantiene el encabezado y el registro como anulados aunque existan cuotas con saldo pendiente", async () => {
    const transaccionesRepository = createRepositoryMock<Transaccion>();
    const detalleRepository = createRepositoryMock<DetalleTransaccion>();
    const formasPagoRepository = createRepositoryMock();
    const categoriasRepository = createRepositoryMock();
    const subcategoriasRepository = createRepositoryMock();
    const participantesRepository = createRepositoryMock();
    const estadosRepository = createRepositoryMock();
    const tiposTransaccionRepository = createRepositoryMock();
    const usuariosRepository = createRepositoryMock();

    formasPagoRepository.find.mockResolvedValue([
      { id_metodo: 10, nombre_metodo: "Tarjeta", calcula_interes: false },
    ]);
    categoriasRepository.find.mockResolvedValue([
      { id_categoria: 5, nombre_categoria: "Servicios" },
    ]);
    tiposTransaccionRepository.find.mockResolvedValue([
      { id_tipo: 1, nombre: "Gasto" },
    ]);
    participantesRepository.find.mockResolvedValue([
      {
        id_participante: 20,
        nombre_participante: "Titular",
      },
    ]);
    estadosRepository.find.mockResolvedValue([
      {
        id_estado: 2,
        nombre_estado: "ANULADO",
        estado: "ACTIVO",
        flag: "T",
      },
      {
        id_estado: 3,
        nombre_estado: "PENDIENTE",
        estado: "ACTIVO",
        flag: "T",
      },
      {
        id_estado: 4,
        nombre_estado: "PAGO PARCIAL",
        estado: "ACTIVO",
        flag: "T",
      },
      {
        id_estado: 5,
        nombre_estado: "PAGADO",
        estado: "ACTIVO",
        flag: "T",
      },
      {
        id_estado: 7,
        nombre_estado: "ANULADO",
        estado: "ACTIVO",
        flag: "R",
      },
    ]);

    const service = new TransaccionesService(
      {} as never,
      transaccionesRepository as never,
      detalleRepository as never,
      formasPagoRepository as never,
      categoriasRepository as never,
      subcategoriasRepository as never,
      participantesRepository as never,
      estadosRepository as never,
      tiposTransaccionRepository as never,
      usuariosRepository as never,
      {} as never,
    );

    const transaccion = {
      id_transaccion: 1,
      id_usuario: 1,
      fecha: "2026-05-15",
      monto: "100.00",
      id_tipo_transaccion: 1,
      id_metodo_pago: 10,
      id_categoria: 5,
      id_subcategoria: null,
      id_estado: 2,
      id_estado_registro: 7,
      descripcion: "Pago anulado",
      intereses: "0.00",
      saldo_pendiente: "100.00",
      cuotas_sin_intereses: false,
      fecha_ultimo_pago: null,
      fecha_creacion: new Date("2026-05-15T10:00:00.000Z"),
      pagocompartido: false,
    } as Transaccion;

    const detalles = [
      {
        id: 100,
        id_usuario: 1,
        id_transaccion: 1,
        fecha_pago: null,
        fecha_programada: "2026-05-20",
        fecha_inicio_interes: null,
        interes_acumulado: "0.00",
        interes_pagado: "0.00",
        interes_pendiente: "0.00",
        fecha_ultimo_calculo: null,
        dias_interes: 0,
        id_participante: 20,
        id_usuario_relacionado: null,
        monto: "100.00",
        monto_pagado: "0.00",
        numero_cuota: 1,
        total_cuotas: 1,
        id_tipo_transaccion: 1,
        id_metodo_pago: 10,
        id_estado: 2,
        fecha_creacion: new Date("2026-05-15T10:00:00.000Z"),
      } as DetalleTransaccion,
    ];

    const [response] = await (
      service as unknown as {
        buildDetailedResponses: (
          transacciones: Transaccion[],
          idUsuario: number,
          detallesPrecargados?: DetalleTransaccion[],
        ) => Promise<Array<Record<string, unknown>>>;
      }
    ).buildDetailedResponses([transaccion], 1, detalles);

    expect(response.id_estado).toBe(2);
    expect(response.nombre_estado).toBe("ANULADO");
    expect(response.id_estado_registro).toBe(7);
    expect(response.nombre_estado_registro).toBe("ANULADO");
    expect(response.saldo_pendiente).toBe(0);
    expect(response.participantes_detalle).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 100,
          id_estado: 2,
          nombre_estado: "ANULADO",
          saldo_pendiente: 0,
        }),
      ]),
    );
  });
});
