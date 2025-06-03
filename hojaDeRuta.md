Hoja de Ruta: Aplicación de Gestión de Almacén (Node.js Backend + React Frontend)
Fase 0: Base Establecida y Configuración Inicial (COMPLETADA)

    [X] Definición de la arquitectura: Node.js/Express para el backend, React para el frontend.

    [X] Creación de la estructura del proyecto:

        Repositorio Git (gestion_almacen) inicializado en GitHub con README y .gitignore para Node.

        Carpeta raíz local clonada.

        Subcarpeta backend-node creada e inicializada (npm init -y).

        Subcarpeta frontend-react creada.

    [X] Configuración del Backend Node.js Inicial:

        Dependencias instaladas: express, cors, sqlite3, nodemon.

        Carpeta backend-node/almacen/ creada y archivo almacen.db copiado.

        Archivo backend-node/server.js creado con:

            Configuración de servidor Express.

            Conexión a almacen.db.

            Función crearTablasSiNoExisten() implementada para todas las tablas esenciales (PedidosProveedores, LineasPedido, GastosPedido, StockMateriasPrimas, StockComponentes, Configuracion). (Nota: Estructura de StockMateriasPrimas modificada para bobinas individuales).

            Actualización: Incluye la creación de las nuevas tablas de la Fase 5 (ProductosTerminados, Maquinaria, Recetas, ProcesosFabricacion, OrdenesProduccion, StockProductosTerminados).

            Endpoint de prueba GET /api/estado funcional.

            Escuchando en el puerto 5002.

        Verificación exitosa del inicio del servidor, conexión a DB y creación/verificación de tablas.

    [X] Creación del archivo backend-node/db_operations.js:

        Función conectarDB() definida.

        Función consultarStockMateriasPrimas() implementada (devuelve Promesa con datos de StockMateriasPrimas - ahora bobinas individuales).

        Actualización: Incluye funciones CRUD completas para todas las tablas de la Fase 5.

    [X] Modificación de backend-node/server.js:

        [X] Importación de consultarStockMateriasPrimas desde db_operations.js.

        [X] Creación y prueba exitosa del endpoint GET /api/stock que llama a consultarStockMateriasPrimas() y devuelve JSON.

        Actualización: Incluye todos los endpoints API para las nuevas tablas de la Fase 5.

    [X] Configuración Inicial del Frontend React:

        [X] Proyecto React creado con Vite dentro de frontend-react/.

        [X] Dependencias de React instaladas (npm install).

        [X] Componente frontend-react/src/App.jsx modificado para:

            [X] Hacer fetch al endpoint GET /api/stock del backend Node.js.

            [X] Almacenar y mostrar los datos del stock en una tabla HTML (ahora como lista plana de bobinas individuales, ordenada).

            [X] Manejar estados de carga y errores.

        [X] Verificación exitosa de la comunicación React -> Node.js API -> SQLite y visualización de datos del stock.

    [X] Script de siembra (seed_database.js) creado para poblar la base de datos con datos de prueba, incluyendo configuración de márgenes.

        Actualización: Incluye datos de prueba para todas las nuevas tablas de la Fase 5.

Fase 1: Funcionalidad Básica de Stock (Lectura Avanzada y Escritura)
1.3. Frontend (React) - Filtros Básicos para el Stock (COMPLETADO)

* **Tarea:** Añadir controles de filtro básicos a la vista de stock en React.
* **Detalles:**
    * Desplegables para filtrar por `Material` y `Estado`.
    * Campo de texto para búsqueda por `Referencia` o `Factura Origen` (y otros campos).
    * Los filtros se aplican en el frontend después de obtener todos los datos, o podrían pasarse al backend.
* **Backend (Node.js API):**
    * Endpoint `/api/stock` devuelve todos los items (bobinas individuales).
* **Entrega:** Vista de stock con capacidad de filtrado funcional.

1.4. Backend y Frontend - Visualización Detallada de Item de Stock (COMPLETADO)

* **Tarea:** Permitir al usuario ver todos los detalles de un ítem de stock específico (bobina).
* **Backend (Node.js API):**
    * Endpoint `GET /api/stock-item/:tabla/:id` devuelve todos los datos de un ítem de stock por su ID (funcionalidad inicial). (Nota: El modal de detalle de bobina en App.jsx ahora usa los datos ya cargados).
* **Frontend (React):**
    * Al hacer clic en un botón "Detalles" en una fila de la tabla de stock, se muestra un modal (`DetalleStockModal`) con todos los detalles de la bobina.
* **Entrega:** Capacidad de ver información detallada de cada bobina de stock.

Fase 2: Creación de Nuevas Entradas (Pedidos Nacionales y Contenedores)

Se ha generalizado para Goma, PVC y Fieltro.
2.1. Backend (Node.js API) - Endpoints para Nuevos Pedidos (COMPLETADO)

* **Tarea:** En `server.js`, crear endpoints para `POST /api/pedidos-nacionales` y `POST /api/pedidos-importacion`.
* **Detalles:**
    * Reciben datos JSON del frontend (incluyendo `material_tipo` y `valor_conversion` para importación).
    * Validación de datos.
    * **Lógica de Negocio en Node.js:**
        * Cálculo de costes por ítem, incluyendo manejo de gastos y conversión de moneda para importación.
        * **Actualización:** La lógica de gastos repercutibles ahora excluye los gastos `SUPLIDOS` que contengan la palabra "IVA". La fórmula del precio por metro lineal se ha ajustado a `(precio metro lineal en dolares * valor de conversion) * (1 + porcentaje de gasto repercutible)`.
        * **Operaciones de Base de Datos (en `db_operations.js` con `procesarNuevoPedido`):**
            * Inserción en `PedidosProveedores`.
            * Inserción en `GastosPedido`.
            * Inserción de cada bobina como una nueva fila en `StockMateriasPrimas` (con `coste_unitario_final` calculado para esa bobina).
    * Devolver respuesta JSON (éxito/error).
* **Entrega:** Endpoints funcionales para crear pedidos nacionales y de importación para Goma, PVC y Fieltro.

2.2. Frontend (React) - Formularios para Nuevos Pedidos (COMPLETADO)

* **Tarea:** Crear componentes React (`FormularioPedidoNacional.jsx`, `FormularioPedidoImportacion.jsx`).
* **Detalles:**
    * Campos para datos generales, selector de material.
    * `FormularioPedidoImportacion.jsx` incluye campo para `valor_conversion` y tipos de gasto específicos.
    * Interfaz para añadir/eliminar dinámicamente gastos y bobinas (líneas de pedido).
    * Al enviar, recopilar datos, enviar como JSON a los endpoints correspondientes.
    * Mostrar feedback al usuario.
* **Entrega:** Formularios funcionales en React.

2.3. Extender para Otros Tipos de Entrada (COMPLETADO)

* **Tarea:** Replicado y adaptado en los pasos 2.1 y 2.2 para:
    * Pedidos Nacionales de Goma, PVC y Fieltro.
    * Contenedores de Importación de Goma, PVC y Fieltro (incluyendo `valor_conversion` y estructura de gastos por tipo SUPLIDOS, EXENTO, SUJETO).
* **Entrega:** Capacidad de crear todos los tipos de pedidos/contenedores.

Fase 3: Gestión de Stock (Actualizaciones) y Visualización de Pedidos
3.1. Backend y Frontend - Listar Pedidos/Contenedores (COMPLETADO)

* **Tarea:** Crear endpoints y vistas React para listar Pedidos Nacionales y Contenedores.
* **Backend:** Endpoint `GET /api/pedidos` con filtros.
* **Frontend:** Componente `ListaPedidos.jsx` con filtros.
* **Extensión:** Funcionalidad de doble clic en `ListaPedidos.jsx` para abrir `DetallePedidoModal.jsx` que muestra información del pedido, gastos y bobinas (usando endpoint `GET /api/pedidos/:pedidoId/detalles`).
* **Entrega:** Vistas para consultar los pedidos y contenedores existentes con filtros y visualización de detalles.

3.2. Backend y Frontend - Actualizar Estado del Stock (COMPLETADO)

* **Tarea:** Implementar la funcionalidad para marcar items de stock (bobinas) como "EMPEZADA" o "AGOTADO".
* **Backend (API):** Endpoint `PATCH /api/stock-items/:stockItemId/estado` para actualizar el estado.
* **Frontend (React):** Botones/acciones en la tabla de stock (`App.jsx`) para cambiar el estado.
* **Entrega:** Funcionalidad completa para cambiar el estado.

3.3. Backend y Frontend - Eliminar Pedidos/Contenedores (COMPLETADO)

* **Tarea:** Implementar la funcionalidad para eliminar un pedido/contenedor completo.
* **Backend (API):** Endpoint `DELETE /api/pedidos/:pedidoId`. Considera eliminación en cascada o manejo de stock asociado (actualmente elimina stock asociado).
* **Frontend (React):** Botón de eliminar en `ListaPedidos.jsx` con confirmación.
* **Entrega:** Capacidad de eliminar pedidos/contenedores.

Fase 4: Cálculo de Costes de Venta y Tarifa
4.1. Backend (Node.js API) - Endpoint para Tarifa de Venta (COMPLETADO)

* **Tarea:** Crear un endpoint `GET /api/tarifa-venta`.
* **Detalles:**
    * Obtener datos de stock (`coste_unitario_final` de `StockMateriasPrimas` para items 'DISPONIBLE' o 'EMPEZADA').
    * Obtener márgenes de la tabla `Configuracion` (función `obtenerConfiguraciones` en `db_operations.js`). Márgenes por `tipo_tarifa` (final, fabricante, metrajes).
    * Lógica de agrupación (material, subtipo, espesor, **ancho**) y cálculo del `max_cost` por grupo.
    * Aplicar márgenes para calcular `precio_venta_aplicado_margen` según `tipo_tarifa` (parámetro query).
    * Devolver `precio_metro_lineal_antes_margen`, `margen_aplicado` y `precio_venta_aplicado_margen`.
* **Entrega:** Endpoint que provee los datos para la tarifa.

4.2. Frontend (React) - Vista de Tarifa de Venta (COMPLETADO)

* **Tarea:** Crear un componente React (`TarifaVenta.jsx`) para mostrar la tarifa.
* **Detalles:** Selector para `tipo_tarifa`. Tabla para mostrar los datos de la tarifa (material, subtipo, espesor, ancho, precio ML antes margen, margen, precio venta aplicado margen).
* **Entrega:** Interfaz para visualizar la tarifa de venta.

Fase 5: Gestión de Maquinaria y Costes de Fabricación (COMPLETADA)

    Tarea: Implementar la lógica y las interfaces para la gestión de maquinaria y el cálculo de costes de fabricación de productos terminados.

    Detalles:

        [X] Nuevas Tablas de Base de Datos: ProductosTerminados, Maquinaria, Recetas, ProcesosFabricacion, OrdenesProduccion, StockProductosTerminados.

        [X] Operaciones CRUD Completas (Backend): Endpoints API y funciones en db_operations.js para todas las nuevas tablas.

        [X] Gestión de Productos Terminados y Recetas (Frontend y Backend):

            Frontend: Componente GestionProductosRecetas.jsx combinado.

            Backend: La tabla Recetas ya no requiere cantidad_requerida ni unidad_medida_requerida (se asume un modelo teórico).

            Backend: Al seleccionar un producto en la receta, se rellena su nombre y referencia.

        [X] Gestión de Maquinaria (Frontend y Backend):

            Frontend: Componente GestionMaquinaria.jsx.

            Backend: La tabla Maquinaria ha simplificado sus campos, eliminando vida_util_horas y depreciacion_hora.

        [X] Gestión de Procesos de Fabricación (Frontend y Backend):

            Frontend: Componente GestionProcesosFabricacion.jsx.

            Backend: El coste_mano_obra_hora se ha eliminado de la tabla ProcesosFabricacion y ahora se utiliza un coste_mano_obra_default de la tabla Configuracion.

        [X] Cálculo Automático del Coste de Fabricación Estándar:

            Backend: Funciones para calcularCosteMateriales y calcularCosteProcesos (usando el coste de mano de obra por defecto y el coste por hora de operación de la maquinaria).

            Backend: actualizarCosteFabricacionEstandar recalcula y actualiza el coste_fabricacion_estandar en ProductosTerminados automáticamente al crear/modificar/eliminar recetas o procesos asociados.

        [X] Gestión de Órdenes de Producción (Frontend y Backend):

            Frontend: Componente GestionOrdenesProduccion.jsx.

            Backend: La tabla OrdenesProduccion usa un solo campo fecha en lugar de fecha_inicio y fecha_fin. El status se gestiona internamente pero no se expone en la UI de creación/edición.

            [X] Procesamiento de Órdenes de Producción: Endpoint POST /api/ordenes-produccion/:id/procesar que realiza una transacción para:

                Verificar stock de materias primas/componentes.

                Descontar el stock de materias primas/componentes según la receta y la cantidad a producir (asumiendo 1 unidad de material por 1 unidad de producto si la receta es teórica).

                Calcular el coste real de fabricación de la orden.

                Insertar el producto terminado en StockProductosTerminados.

                Marcar la orden como COMPLETADA.

        [X] Stock de Productos Terminados:

            Frontend: Componente GestionStockProductosTerminados.jsx para visualizar el inventario de productos finales.

            Backend: Endpoints para consultar y eliminar ítems de StockProductosTerminados.

    Entrega: Funcionalidad completa para la gestión de fabricación y productos terminados.

Fase 6: Mejoras Continuas y Refinamiento (PENDIENTE)

    Tareas: Refactorización, optimización, mejoras UX/UI, documentación, pruebas. Considerar empaquetado como aplicación de escritorio (Electron/Tauri) si se desea.

    Ideas:

        Añadir funcionalidad para "Editar Pedido/Contenedor" de materias primas.

        Implementar gestión de ventas y salida de stock de productos terminados.

        Alertas de stock mínimo.

        Informes y analíticas más avanzadas.

        Manejo de usuarios y roles.

        [PENDIENTE] Depuración detallada de los valores NaN y el porcentaje de gastos en DetallePedidoModal.jsx si persiste el problema.