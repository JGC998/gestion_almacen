Cosas a arreglar:

Ver Stock:

Ver Pedidos:
-Me gustaría poder ver cuando veo una bobina de un pedido viendo los detalles del pedido el precio al que compré el metro lineal del material, y al lado, en un segundo apartado, el precio del metro lineal mas el porcentaje de gastos aplicados
-También hay que cambiar el color de las cabeceras de los datos, es demasiado claro, podriamos ponerle un verde mas oscuro
-Viendo los pedidos, hay que quitar el filtro de Fecha Pedido Hasta:
-Tambien hay que quitar la cabecera de Fecha Llegada, ya que no pasamos ese datos

Ver Tarifa Venta:
La tarifa de venta funciona bien, pero quiero que se vean otros datos, vamos a quitar la descripcion material, y la unidad, 
y vamos a meter ahi en la cabecera, el espesor y el ancho

Nuevo Pedido Nacional/Importacion
-Vamos a quitar Ubicación, eso no lo voy a usar realmente, o al menos no en principio, asi que podemos comentarlo en el codigo y si en un futuro lo necesito, lo descomento
-Debe dejar ponerme el numero de bobinas del mismo tipo que estoy dando de alta
-En el pedido de importacion, tiene que dejarme elegir si los gastos son suplidos, exentos, o sujetos

-Da este error en el terminal al crear un pedido de importacion: 
Servidor Node.js API escuchando en http://localhost:5002
Conectado a la base de datos SQLite.
Verificando/Creando tablas con la nueva estructura normalizada...
Verificación/Creación de tablas completada.
Foreign keys habilitadas.
Tabla 'Stock' verificada/creada.
Node.js: Solicitud a GET /api/stock (con nueva estructura)
Node.js: Solicitud a GET /api/stock (con nueva estructura)
Node.js: Devolviendo 4 lotes de stock.
Node.js: Devolviendo 4 lotes de stock.
Node.js: Se ha solicitado GET /api/pedidos
Node.js: Filtros recibidos en /api/pedidos: [Object: null prototype] {}
Node.js: Se ha solicitado GET /api/pedidos
Node.js: Filtros recibidos en /api/pedidos: [Object: null prototype] {}
Node.js: Devolviendo 4 pedidos.
Node.js: Devolviendo 4 pedidos.
Node.js: POST /api/pedidos-nacionales, Material: CARAMELO
Node.js: Pedido NACIONAL de CARAMELO creado con ID: 5
Node.js: Se ha solicitado GET /api/pedidos
Node.js: Filtros recibidos en /api/pedidos: [Object: null prototype] {}
Node.js: Devolviendo 5 pedidos.
Node.js: Se ha solicitado GET /api/pedidos
Node.js: Filtros recibidos en /api/pedidos: [Object: null prototype] {}
Node.js: Devolviendo 5 pedidos.
Node.js: Se ha solicitado GET /api/pedidos/5/detalles
Node.js: Devolviendo detalles para el pedido ID 5.
Node.js: Se ha solicitado GET /api/pedidos/5/detalles
Node.js: Devolviendo detalles para el pedido ID 5.
Node.js: Se ha solicitado GET /api/pedidos/5/detalles
Node.js: Devolviendo detalles para el pedido ID 5.
Node.js: Se ha solicitado GET /api/pedidos/5/detalles
Node.js: Devolviendo detalles para el pedido ID 5.
Node.js: Se ha solicitado GET /api/pedidos/5/detalles
Node.js: Devolviendo detalles para el pedido ID 5.
Node.js: Se ha solicitado GET /api/pedidos/5/detalles
Node.js: Devolviendo detalles para el pedido ID 5.
Node.js: Se ha solicitado GET /api/pedidos/5/detalles
Node.js: Devolviendo detalles para el pedido ID 5.
Node.js: Se ha solicitado GET /api/pedidos/5/detalles
Node.js: Devolviendo detalles para el pedido ID 5.
Node.js: GET /api/tarifa-venta para MATERIALES EN STOCK, tipo: fabricante
Tarifa de venta de MATERIALES generada para tipo_tarifa: fabricante
Node.js: POST /api/pedidos-importacion, Material: FIELTRO, Conv: 0.92
Error ejecutando SQL (transacción run): INSERT INTO Stock (item_id, lote, cantidad_inicial, cantidad_actual, coste_lote, ubicacion, pedido_id, fecha_entrada) VALUES (?, ?, ?, ?, ?, ?, ?, ?) [
  10,
  'FIELTRO 15',
  15,
  15,
  29.02409448818898,
  'NAVE DE ARRIBA',
  6,
  '2025-06-10'
] SQLITE_CONSTRAINT: UNIQUE constraint failed: Stock.lote
Error en la transacción de procesarNuevoPedido: [Error: SQLITE_CONSTRAINT: UNIQUE constraint failed: Stock.lote] {
  errno: 19,
  code: 'SQLITE_CONSTRAINT'
}
Error en POST /api/pedidos-importacion (FIELTRO): SQLITE_CONSTRAINT: UNIQUE constraint failed: Stock.lote


Gestión de artículos:
-Al crear una plantilla no necesito eso de coste material estimado, eso no hace falta
-Da este error al crear una plantilla nueva: Node.js: Se ha solicitado GET /api/materiales-genericos
Node.js: GET /api/productos-terminados [Object: null prototype] {}
Node.js: Solicitud de cálculo de coste temporal para Material: Fieltro, Espesor: F15, Ancho Prod: 550, Largo Prod: 5
No se encontró materia prima en stock para Fieltro con espesor F15.
Node.js: Solicitud de cálculo de coste temporal para Material: Fieltro, Espesor: F15, Ancho Prod: 550, Largo Prod: 50
No se encontró materia prima en stock para Fieltro con espesor F15.
Node.js: Solicitud de cálculo de coste temporal para Material: Fieltro, Espesor: F15, Ancho Prod: 550, Largo Prod: 500
No se encontró materia prima en stock para Fieltro con espesor F15.
Node.js: POST /api/productos-terminados, datos recibidos: {
  nombre: 'FALDETA ALDAMA FIELTRO',
  unidad_medida: 'unidad',
  coste_fabricacion_estandar: 75,
  material_principal: 'Fieltro',
  espesor_principal: 'F15',
  ancho_final: 550,
  largo_final: 500,
  status: 'ACTIVO'
}
Error en POST /api/productos-terminados: Cannot destructure property 'nombre' of 'productoData' as it is undefined.

-En material principal, debe dejarme seleccionar cualquier material que tenga en el almacen(familia), con su espesor correspondiente 


Gestión de procesos y ordenes de produccion, hay que darle una vuelta a eso, quiero que funcione de otra forma,
quiero las dos cosas juntas realmente, dame ideas para hacerlo lo mas completo posible en un solo apartado