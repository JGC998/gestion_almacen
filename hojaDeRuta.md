Hoja de Ruta: Aplicación de Gestión de Almacén (Node.js Backend + React Frontend)
Fase 0: Base Establecida y Configuración Inicial (COMPLETADA)

    [X] Definición de la arquitectura: Node.js/Express para el backend, React para el frontend.

    [X] Creación de la estructura del proyecto:

        [X] Repositorio Git (gestion_almacen) inicializado en GitHub con README y .gitignore para Node.

        [X] Carpeta raíz local clonada.

        [X] Subcarpeta backend-node creada e inicializada (npm init -y).

        [X] Subcarpeta frontend-react creada.

    [X] Configuración del Backend Node.js Inicial:

        [X] Dependencias instaladas: express, cors, sqlite3, nodemon.

        [X] Carpeta backend-node/almacen/ creada y archivo almacen.db gestionado.

        [X] Archivo backend-node/server.js creado con:

            [X] Configuración de servidor Express.

            [X] Conexión a almacen.db.

            [X] Función crearTablasSiNoExisten() implementada para todas las tablas esenciales (PedidosProveedores, LineasPedido, GastosPedido, StockMateriasPrimas, StockComponentes, ProductosTerminados, Maquinaria, Recetas, ProcesosFabricacion, OrdenesProduccion, StockProductosTerminados, Configuracion).

            [X] Endpoint de prueba GET /api/estado funcional.

        [X] Verificación exitosa del inicio del servidor, conexión a DB y creación/verificación de tablas.

    [X] Creación del archivo backend-node/db_operations.js:

        [X] Función conectarDB() y helpers para operaciones DB (runDB, allDB, getDB, runAsync, allAsync, getAsync).

        [X] Funciones CRUD básicas para las entidades principales.

    [X] Modificación de backend-node/server.js:

        [X] Importación de funciones desde db_operations.js.

        [X] Endpoints API para las funcionalidades básicas.

    [X] Configuración Inicial del Frontend React:

        [X] Proyecto React creado con Vite dentro de frontend-react/.

        [X] Dependencias de React instaladas.

        [X] Componente frontend-react/src/App.jsx modificado para navegación y visualización inicial.

    [X] Script de siembra (seed_database.js) creado y actualizado para poblar la base de datos con datos de prueba coherentes con la estructura actual.

Fase 1: Funcionalidad Básica de Stock (Lectura Avanzada y Escritura)

    1.3. Frontend (React) - Filtros Básicos para el Stock (COMPLETADO)

        Vista de stock con capacidad de filtrado funcional.

    1.4. Backend y Frontend - Visualización Detallada de Item de Stock (COMPLETADO)

        Capacidad de ver información detallada de cada bobina/item de stock en un modal.

Fase 2: Creación de Nuevas Entradas (Pedidos Nacionales y Contenedores)

    2.1. Backend (Node.js API) - Endpoints para Nuevos Pedidos (COMPLETADO)

        Endpoints POST /api/pedidos-nacionales y POST /api/pedidos-importacion funcionales.

        Validación de datos básica.

        Lógica de cálculo de costes por ítem, incluyendo manejo de gastos y conversión de moneda para importación.

        Operaciones de Base de Datos para insertar en PedidosProveedores, GastosPedido, y StockMateriasPrimas (como bobinas individuales).

    2.2. Frontend (React) - Formularios para Nuevos Pedidos (COMPLETADO)

        Componentes FormularioPedidoNacional.jsx y FormularioPedidoImportacion.jsx funcionales.

        Interfaz para añadir/eliminar dinámicamente gastos y líneas de pedido.

    2.3. Extender para Otros Tipos de Entrada (COMPLETADO)

        Capacidad de crear todos los tipos de pedidos/contenedores para Goma, PVC y Fieltro.

Fase 3: Gestión de Stock (Actualizaciones) y Visualización de Pedidos

    3.1. Backend y Frontend - Listar Pedidos/Contenedores (COMPLETADO)

        Endpoint GET /api/pedidos con filtros.

        Componente ListaPedidos.jsx con filtros y modal de detalle (DetallePedidoModal.jsx).

    3.2. Backend y Frontend - Actualizar Estado del Stock (COMPLETADO)

        Endpoint PATCH /api/stock-items/:stockItemId/estado para actualizar el estado.

        Acciones en la tabla de stock (App.jsx) para cambiar el estado.

    3.3. Backend y Frontend - Eliminar Pedidos/Contenedores (COMPLETADO)

        Endpoint DELETE /api/pedidos/:pedidoId funcional (maneja eliminación de stock asociado).

        Botón de eliminar en ListaPedidos.jsx con confirmación.

Fase 4: Cálculo de Costes de Venta y Tarifa

    4.1. Backend (Node.js API) - Endpoint para Tarifa de Venta (COMPLETADO)

        Endpoint GET /api/tarifa-venta que ahora calcula la tarifa basada en ProductosTerminados (plantillas) y sus coste_fabricacion_estandar.

    4.2. Frontend (React) - Vista de Tarifa de Venta (COMPLETADO)

        Componente TarifaVenta.jsx muestra la tarifa de productos terminados.

Fase 5: Gestión de Fabricación (Plantillas de Producto, Maquinaria, Procesos, Órdenes)

    5.1. Backend y Frontend - Gestión de Plantillas de Producto (EN PROGRESO / REVISADO)

        Tarea: Implementar la creación y gestión de "Plantillas de Producto" (anteriormente "Productos Terminados").

        Detalles:

            [X] Tabla ProductosTerminados modificada:

                referencia ahora es UNIQUE pero no NOT NULL inicialmente (se genera en backend).

                Campo descripcion eliminado.

                Se utilizan material_principal, espesor_principal, ancho_final, largo_final para definir las características base de la plantilla.

            [X] Backend: Endpoint POST /api/productos-terminados modificado para:

                No esperar referencia ni descripcion del frontend.

                Generar referencia automáticamente (ej. "PT-0000X").

                Manejar la inserción en una transacción.

                Llamar a actualizarCosteFabricacionEstandar (aunque el coste inicial puede ser 0 o basado en coste_extra_unitario si no hay recetas/procesos).

            [X] Frontend: Componente GestionProductosRecetas.jsx (ahora "Gestión de Plantillas de Producto") modificado:

                Formulario de creación/edición no incluye campos para referencia (editable) ni descripcion.

                Se muestran los campos para material_principal, espesor_principal, ancho_final, largo_final.

                Se calcula un coste de material estimado preliminar (coste) en el frontend y se envía como coste_fabricacion_estandar inicial.

            [ ] Backend: Revisar actualizarCosteFabricacionEstandar para que use correctamente el ancho_bobina_mm de StockMateriasPrimas y las dimensiones (ancho_final, largo_final) del producto para el cálculo por m². (EN PROGRESO - depurando cálculo de coste)

            [ ] Backend: Lógica de ON DELETE CASCADE para OrdenesProduccion y StockProductosTerminados en server.js al definir tablas (si es el comportamiento deseado). (IMPLEMENTADO, a verificar)

            [ ] Frontend: Corregir warnings de key y whitespace en tablas. (EN PROGRESO)

    5.2. Backend y Frontend - Gestión de Recetas (COMPLETADO)

        Componente GestionRecetas.jsx (integrado en GestionProductosRecetas.jsx o como sección separada).

        Endpoints y lógica para CRUD de recetas asociadas a las plantillas de producto.

    5.3. Backend y Frontend - Gestión de Maquinaria (COMPLETADO)

        Componente GestionMaquinaria.jsx.

        Endpoints y lógica para CRUD de maquinaria.

    5.4. Backend y Frontend - Gestión de Procesos de Fabricación (COMPLETADO)

        Componente GestionProcesosFabricacion.jsx.

        Endpoints y lógica para CRUD de procesos, asociándolos a plantillas de producto y maquinaria.

    5.5. Backend y Frontend - Gestión de Órdenes de Producción (EN PROGRESO)

        Componente GestionOrdenesProduccion.jsx.

        Endpoints y lógica para CRUD de órdenes de producción.

        [ ] Frontend: Al crear una orden, permitir seleccionar una "Plantilla de Producto".

        [ ] Frontend/Backend: Basado en el material_principal y espesor_principal de la plantilla, permitir seleccionar una bobina específica de StockMateriasPrimas con suficiente material.

        [ ] Backend: Endpoint POST /api/ordenes-produccion/:id/procesar para:

            Verificar y descontar stock de materias primas (de la bobina seleccionada).

            Calcular coste real de fabricación de la orden.

            Añadir producto terminado a StockProductosTerminados.

            Marcar orden como "COMPLETADA".

    5.6. Backend y Frontend - Stock de Productos Terminados (COMPLETADO)

        Componente GestionStockProductosTerminados.jsx para visualizar el inventario.

        Endpoints para consultar y eliminar ítems de StockProductosTerminados.

    5.7. Backend y Frontend - Herramientas (Calculadora de Presupuestos y Configuración) (COMPLETADO)

        Componente CalculadoraPresupuestos.jsx.

        Componente FormularioConfiguracion.jsx.

Fase 6: Mejoras Continuas y Refinamiento (PENDIENTE / EN CURSO)

    [ ] Depuración detallada de los valores NaN en cálculos de costes si persisten.

    [ ] Revisión y mejora de la UX/UI general.

    [ ] Optimización de consultas a la base de datos (ej. uso de índices).

    [ ] Validación de datos más robusta (frontend y backend).

    [ ] Mejorar el manejo de errores y el feedback al usuario.

    [ ] Revisión y ajuste de la lógica de cálculo de costes para asegurar precisión.

    [ ] Implementar gestión de ventas y salida de stock de productos terminados.

    [ ] Alertas de stock mínimo para materias primas y productos terminados.

    [ ] Informes y analíticas más avanzadas (valor de inventario, rentabilidad).

    [ ] Considerar empaquetado como aplicación de escritorio (Electron/Tauri).