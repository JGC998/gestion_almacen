# Hoja de Ruta: Aplicación de Gestión de Almacén (Node.js Backend + React Frontend)

## Fase 0: Base Establecida y Configuración Inicial (COMPLETADA)

* [X] Definición de la arquitectura: Node.js/Express para el backend, React para el frontend.
* [X] Creación de la estructura del proyecto:
    * Repositorio Git (`gestion_almacen`) inicializado en GitHub con README y .gitignore para Node.
    * Carpeta raíz local clonada.
    * Subcarpeta `backend-node` creada e inicializada (`npm init -y`).
    * Subcarpeta `frontend-react` creada.
* [X] Configuración del Backend Node.js Inicial:
    * Dependencias instaladas: `express`, `cors`, `sqlite3`, `nodemon`.
    * Carpeta `backend-node/almacen/` creada y archivo `almacen.db` copiado.
    * Archivo `backend-node/server.js` creado con:
        * Configuración de servidor Express.
        * Conexión a `almacen.db`.
        * Función `crearTablasSiNoExisten()` implementada para todas las tablas esenciales (`PedidosProveedores`, `LineasPedido`, `GastosPedido`, `StockMateriasPrimas`, `StockComponentes`, `Configuracion`). (Nota: Estructura de StockMateriasPrimas modificada para bobinas individuales).
        * Endpoint de prueba `GET /api/estado` funcional.
        * Escuchando en el puerto `5002`.
    * Verificación exitosa del inicio del servidor, conexión a DB y creación/verificación de tablas.
* [X] Creación del archivo `backend-node/db_operations.js`:
    * Función `conectarDB()` definida.
    * Función `consultarStockMateriasPrimas()` implementada (devuelve Promesa con datos de `StockMateriasPrimas` - ahora bobinas individuales).
* [X] Modificación de `backend-node/server.js`:
    * Importación de `consultarStockMateriasPrimas` desde `db_operations.js`.
    * Creación y prueba exitosa del endpoint `GET /api/stock` que llama a `consultarStockMateriasPrimas()` y devuelve JSON.
* [X] Configuración Inicial del Frontend React:
    * Proyecto React creado con Vite dentro de `frontend-react/`.
    * Dependencias de React instaladas (`npm install`).
    * Componente `frontend-react/src/App.jsx` modificado para:
        * Hacer `fetch` al endpoint `GET /api/stock` del backend Node.js.
        * Almacenar y mostrar los datos del stock en una tabla HTML (ahora como lista plana de bobinas individuales, ordenada).
        * Manejar estados de carga y errores.
    * Verificación exitosa de la comunicación React -> Node.js API -> SQLite y visualización de datos del stock.

## Fase 1: Funcionalidad Básica de Stock (Lectura Avanzada y Escritura)

### 1.3. Frontend (React) - Filtros Básicos para el Stock (COMPLETADO)
    * **Tarea:** Añadir controles de filtro básicos a la vista de stock en React.
    * **Detalles:**
        * Desplegables para filtrar por `Material` y `Estado`.
        * Campo de texto para búsqueda por `Referencia` o `Factura Origen` (y otros campos).
        * Los filtros se aplican en el frontend después de obtener todos los datos, o podrían pasarse al backend.
    * **Backend (Node.js API):**
        * Endpoint `/api/stock` devuelve todos los items (bobinas individuales).
    * **Entrega:** Vista de stock con capacidad de filtrado funcional.

### 1.4. Backend y Frontend - Visualización Detallada de Item de Stock (COMPLETADO)
    * **Tarea:** Permitir al usuario ver todos los detalles de un ítem de stock específico (bobina).
    * **Backend (Node.js API):**
        * Endpoint `GET /api/stock-item/:tabla/:id` devuelve todos los datos de un ítem de stock por su ID (funcionalidad inicial). (Nota: El modal de detalle de bobina en App.jsx ahora usa los datos ya cargados).
    * **Frontend (React):**
        * Al hacer clic en un botón "Detalles" en una fila de la tabla de stock, se muestra un modal (`DetalleStockModal`) con todos los detalles de la bobina.
    * **Entrega:** Capacidad de ver información detallada de cada bobina de stock.

## Fase 2: Creación de Nuevas Entradas (Pedidos Nacionales y Contenedores)

*Se ha generalizado para Goma, PVC y Fieltro.*

### 2.1. Backend (Node.js API) - Endpoints para Nuevos Pedidos (COMPLETADO)
    * **Tarea:** En `server.js`, crear endpoints para `POST /api/pedidos-nacionales` y `POST /api/pedidos-importacion`.
    * **Detalles:**
        * Reciben datos JSON del frontend (incluyendo `material_tipo` y `valor_conversion` para importación).
        * Validación de datos.
        * **Lógica de Negocio en Node.js:**
            * Cálculo de costes por ítem, incluyendo manejo de gastos y conversión de moneda para importación.
            * **Operaciones de Base de Datos (en `db_operations.js` con `procesarNuevoPedido`):**
                * Inserción en `PedidosProveedores`.
                * Inserción en `GastosPedido`.
                * Inserción de cada bobina como una nueva fila en `StockMateriasPrimas` (con `coste_unitario_final` calculado para esa bobina).
        * Devolver respuesta JSON (éxito/error).
    * **Entrega:** Endpoints funcionales para crear pedidos nacionales y de importación para Goma, PVC y Fieltro.

### 2.2. Frontend (React) - Formularios para Nuevos Pedidos (COMPLETADO)
    * **Tarea:** Crear componentes React (`FormularioPedidoNacional.jsx`, `FormularioPedidoImportacion.jsx`).
    * **Detalles:**
        * Campos para datos generales, selector de material.
        * `FormularioPedidoImportacion.jsx` incluye campo para `valor_conversion` y tipos de gasto específicos.
        * Interfaz para añadir/eliminar dinámicamente gastos y bobinas (líneas de pedido).
        * Al enviar, recopilar datos, enviar como JSON a los endpoints correspondientes.
        * Mostrar feedback al usuario.
    * **Entrega:** Formularios funcionales en React.

### 2.3. Extender para Otros Tipos de Entrada (COMPLETADO)
    * **Tarea:** Replicado y adaptado en los pasos 2.1 y 2.2 para:
        * Pedidos Nacionales de Goma, PVC y Fieltro.
        * Contenedores de Importación de Goma, PVC y Fieltro (incluyendo `valor_conversion` y estructura de gastos por tipo SUPLIDOS, EXENTO, SUJETO).
    * **Entrega:** Capacidad de crear todos los tipos de pedidos/contenedores.

## Fase 3: Gestión de Stock (Actualizaciones) y Visualización de Pedidos

### 3.1. Backend y Frontend - Listar Pedidos/Contenedores (COMPLETADO)
    * **Tarea:** Crear endpoints y vistas React para listar Pedidos Nacionales y Contenedores.
    * **Backend:** Endpoint `GET /api/pedidos` con filtros.
    * **Frontend:** Componente `ListaPedidos.jsx` con filtros.
    * **Extensión:** Funcionalidad de doble clic en `ListaPedidos.jsx` para abrir `DetallePedidoModal.jsx` que muestra información del pedido, gastos y bobinas (usando endpoint `GET /api/pedidos/:pedidoId/detalles`).
    * **Entrega:** Vistas para consultar los pedidos y contenedores existentes con filtros y visualización de detalles.

### 3.2. Backend y Frontend - Actualizar Estado del Stock (COMPLETADO)
    * **Tarea:** Implementar la funcionalidad para marcar items de stock (bobinas) como "EMPEZADA" o "AGOTADO".
    * **Backend (API):** Endpoint `PATCH /api/stock-items/:stockItemId/estado` para actualizar el estado.
    * **Frontend (React):** Botones/acciones en la tabla de stock (`App.jsx`) para cambiar el estado.
    * **Entrega:** Funcionalidad completa para cambiar el estado (pendiente de testeo exhaustivo por el usuario).

### 3.3. Backend y Frontend - Eliminar Pedidos/Contenedores (PENDIENTE)
    * **Tarea:** Implementar la funcionalidad para eliminar un pedido/contenedor completo.
    * **Backend (API):** Endpoint para eliminar (`DELETE`). Considerar eliminación en cascada o manejo de stock asociado.
    * **Frontend (React):** Botón de eliminar con confirmación.
    * **Entrega:** Capacidad de eliminar pedidos/contenedores.

## Fase 4: Cálculo de Costes de Venta y Tarifa

### 4.1. Backend (Node.js API) - Endpoint para Tarifa de Venta (PENDIENTE)
    * **Tarea:** Crear un endpoint `GET /api/tarifa-venta`.
    * **Detalles:**
        * Obtener datos de stock (`coste_unitario_final` de `StockMateriasPrimas`).
        * Obtener márgenes de la tabla `Configuracion` (necesitaremos una función en `db_operations.js` para esto).
        * Reimplementar la lógica de agrupación (material, subtipo, espesor) y cálculo del `max_cost` por grupo.
        * Aplicar márgenes para calcular precios de venta.
        * Devolver como JSON.
    * **Entrega:** Endpoint que provee los datos para la tarifa.

### 4.2. Frontend (React) - Vista de Tarifa de Venta (PENDIENTE)
    * **Tarea:** Crear un componente React para mostrar la tarifa.
    * **Entrega:** Interfaz para visualizar la tarifa de venta.

## Fase 5: Gestión de Maquinaria y Costes de Fabricación (PENDIENTE)

* **Tarea:** Implementar la lógica y las interfaces para la gestión de maquinaria y el cálculo de costes de fabricación de productos terminados.
* **Detalles:** Será una fase más extensa que incluirá la reimplementación de la lógica de maquinaria, la definición de productos y procesos, y sus correspondientes endpoints y vistas.

## Fase 6: Mejoras Continuas y Refinamiento (PENDIENTE)

* **Tareas:** Refactorización, optimización, mejoras UX/UI, documentación, pruebas. Considerar empaquetado como aplicación de escritorio (Electron/Tauri) si se desea.

---