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
        * Función `crearTablasSiNoExisten()` implementada para todas las tablas esenciales (`PedidosProveedores`, `LineasPedido`, `GastosPedido`, `StockMateriasPrimas`, `StockComponentes`, `Configuracion`).
        * Endpoint de prueba `GET /api/estado` funcional.
        * Escuchando en el puerto `5002`.
    * Verificación exitosa del inicio del servidor, conexión a DB y creación/verificación de tablas.
* [X] Creación del archivo `backend-node/db_operations.js`:
    * Función `conectarDB()` definida.
    * Función `consultarStockMateriasPrimas()` implementada (devuelve Promesa con datos de `StockMateriasPrimas`).
* [X] Modificación de `backend-node/server.js`:
    * Importación de `consultarStockMateriasPrimas` desde `db_operations.js`.
    * Creación y prueba exitosa del endpoint `GET /api/stock` que llama a `consultarStockMateriasPrimas()` y devuelve JSON.
* [X] Configuración Inicial del Frontend React:
    * Proyecto React creado con Vite dentro de `frontend-react/`.
    * Dependencias de React instaladas (`npm install`).
    * Componente `frontend-react/src/App.jsx` modificado para:
        * Hacer `fetch` al endpoint `GET /api/stock` del backend Node.js.
        * Almacenar y mostrar los datos del stock en una tabla HTML.
        * Manejar estados de carga y errores.
    * Verificación exitosa de la comunicación React -> Node.js API -> SQLite y visualización de datos del stock.

## Fase 1: Funcionalidad Básica de Stock (Lectura Avanzada y Escritura)

### 1.3. Frontend (React) - Filtros Básicos para el Stock (PENDIENTE)
    * **Tarea:** Añadir controles de filtro básicos a la vista de stock en React.
    * **Detalles:**
        * Desplegables para filtrar por `Material` y `Estado`.
        * Campo de texto para búsqueda por `Referencia` o `Factura Origen`.
        * Al aplicar los filtros, volver a llamar al endpoint `/api/stock` pasando los parámetros de filtro.
    * **Backend (Node.js API):**
        * Modificar el endpoint `/api/stock` y la función `consultarStockMateriasPrimas` en `db_operations.js` para que acepten y procesen estos parámetros de filtro en la consulta SQL.
    * **Entrega:** Vista de stock con capacidad de filtrado funcional.

### 1.4. Backend y Frontend - Visualización Detallada de Item de Stock (PENDIENTE)
    * **Tarea:** Permitir al usuario ver todos los detalles de un ítem de stock específico.
    * **Backend (Node.js API):**
        * Crear un endpoint (ej: `GET /api/stock/{id_item}`) que devuelva todos los datos de un ítem de stock por su ID.
        * Crear la función correspondiente en `db_operations.js`.
    * **Frontend (React):**
        * Al hacer clic (o doble clic) en una fila de la tabla de stock, mostrar una vista/modal con todos los detalles del ítem, incluyendo campos que no están en la tabla principal (ej: notas, ubicación, historial si se implementa).
    * **Entrega:** Capacidad de ver información detallada de cada ítem de stock.

## Fase 2: Creación de Nuevas Entradas (Pedidos Nacionales y Contenedores)

*Empezaremos con "Pedido Nacional de Goma" y luego extenderemos a otros.*

### 2.1. Backend (Node.js API) - Endpoint para Nuevo Pedido Nacional Goma (PENDIENTE)
    * **Tarea:** En `server.js`, crear un endpoint para `POST /api/pedidos-nacionales/goma`.
    * **Detalles:**
        * Recibirá datos JSON del frontend.
        * Validar los datos.
        * **Lógica de Negocio en Node.js:**
            * Reimplementar la lógica de tu clase `MercanciaNacionalGoma`:
                * Cálculo de `precio_total_euro` base del ítem.
                * Gestión de `gastos` del pedido.
                * Cálculo de `total_gastos_pedido`.
                * Cálculo de `porcentaje_gastos`.
                * Cálculo de `precio_total_euro_gastos` por ítem.
                * Cálculo de `metro_lineal_euro_mas_gastos` por ítem.
            * **Operaciones de Base de Datos (en `db_operations.js`):**
                * Función para insertar en `PedidosProveedores`.
                * Función para insertar en `GastosPedido`.
                * Función para insertar en `StockMateriasPrimas` (guardando `metro_lineal_euro_mas_gastos` como `coste_unitario_final`).
        * Devolver respuesta JSON (éxito/error).
    * **Entrega:** Endpoint funcional para crear pedidos nacionales de goma.

### 2.2. Frontend (React) - Formulario para Nuevo Pedido Nacional Goma (PENDIENTE)
    * **Tarea:** Crear un componente React (ej: `FormularioPedidoNacionalGoma.jsx`).
    * **Detalles:**
        * Campos para datos generales (fechas, proveedor, factura, etc.).
        * Interfaz para añadir/eliminar dinámicamente gastos y bobinas (con todos sus atributos, incluyendo subtipo).
        * Al enviar, recopilar datos, enviar como JSON al endpoint.
        * Mostrar feedback al usuario.
    * **Entrega:** Formulario funcional en React.

### 2.3. Extender para Otros Tipos de Entrada (PENDIENTE)
    * **Tarea:** Replicar y adaptar los pasos 2.1 y 2.2 para:
        * Pedidos Nacionales de PVC y Fieltro.
        * Contenedores de Importación de Goma, PVC y Fieltro (incluir `valor_conversion` y estructura de gastos por tipo SUPLIDOS, EXENTO, SUJETO).
    * **Entrega:** Capacidad de crear todos los tipos de pedidos/contenedores.

## Fase 3: Gestión de Stock (Actualizaciones) y Visualización de Pedidos

### 3.1. Backend y Frontend - Listar Pedidos/Contenedores (PENDIENTE)
    * **Tarea:** Crear endpoints y vistas React para listar Pedidos Nacionales y Contenedores.
    * **Entrega:** Vistas para consultar los pedidos y contenedores existentes con filtros.

### 3.2. Backend y Frontend - Actualizar Estado del Stock (PENDIENTE)
    * **Tarea:** Implementar la funcionalidad para marcar items de stock como "EMPEZADA" o "AGOTADO".
    * **Backend (API):** Endpoints para actualizar el estado.
    * **Frontend (React):** Botones/acciones en la tabla de stock.
    * **Entrega:** Funcionalidad completa para cambiar el estado.

### 3.3. Backend y Frontend - Eliminar Pedidos/Contenedores (PENDIENTE)
    * **Tarea:** Implementar la funcionalidad para eliminar un pedido/contenedor completo.
    * **Backend (API):** Endpoint para eliminar (`DELETE`).
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

## Fase 5: Gestión de Maquinaria y Costes de Fabricación

* **Tarea:** Implementar la lógica y las interfaces para la gestión de maquinaria y el cálculo de costes de fabricación de productos terminados.
* **Detalles:** Será una fase más extensa que incluirá la reimplementación de la lógica de maquinaria, la definición de productos y procesos, y sus correspondientes endpoints y vistas.

## Fase 6: Mejoras Continuas y Refinamiento

* **Tareas:** Refactorización, optimización, mejoras UX/UI, documentación, pruebas. Considerar empaquetado como aplicación de escritorio (Electron/Tauri) si se desea.

---