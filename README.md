# Gestión de Almacén con Node.js y React

Aplicación de escritorio (en desarrollo) para la gestión de inventario de materias primas (goma, PVC, fieltro, etc.), cálculo de costes de adquisición y generación de tarifas de venta. El backend está siendo desarrollado con Node.js y Express.js, utilizando una base de datos SQLite para la persistencia de datos. El frontend se está construyendo con React.

## Motivación

Este proyecto nace de la necesidad de digitalizar y optimizar la gestión de inventario, los complejos cálculos de costes asociados a la importación y pedidos nacionales de materiales, y la posterior generación de precios de venta para diferentes tipos de clientes. El objetivo es reemplazar un sistema anterior (posiblemente manual o con herramientas menos integradas) por una aplicación moderna, eficiente y fácil de usar.

## Tecnologías Principales

* **Backend:**
    * Node.js
    * Express.js (para la API RESTful)
    * SQLite (base de datos)
    * Librería `sqlite3` de Node.js para interactuar con la base de datos.
* **Frontend:**
    * React (con Vite para el entorno de desarrollo)
    * JavaScript (ES6+)
    * HTML5
    * CSS3
* **Control de Versiones:** Git y GitHub

## Características Implementadas (Hasta Ahora)

* **Backend (Node.js):**
    * Servidor Express básico configurado.
    * Conexión a base de datos SQLite (`almacen.db`) al iniciar.
    * Creación/verificación automática de todas las tablas esenciales de la base de datos (`PedidosProveedores`, `LineasPedido`, `GastosPedido`, `StockMateriasPrimas`, `StockComponentes`, `Configuracion`) al iniciar el servidor.
    * Módulo `db_operations.js` para encapsular la lógica de acceso a datos.
    * Endpoint `GET /api/estado` para verificar el estado del servidor.
    * Endpoint `GET /api/stock` que consulta la tabla `StockMateriasPrimas` y devuelve los datos (con capacidad de filtrado por `material_tipo`, `status` y un campo de `buscar`).
    * Endpoint `GET /api/stock-item/:tabla/:id` para obtener los detalles completos de un ítem de stock específico.
* **Frontend (React):**
    * Proyecto React inicializado con Vite.
    * Componente principal `App.jsx` que:
        * Realiza una petición `fetch` al endpoint `/api/stock` para obtener y mostrar los ítems de stock.
        * Implementa controles de filtro (desplegables para material y estado, campo de texto para búsqueda) que actualizan dinámicamente la tabla de stock.
        * Permite ver los detalles completos de un ítem de stock (mediante clic/doble clic) en un modal, obteniendo los datos del endpoint `/api/stock-item/:tabla/:id`.
        * Maneja estados de carga y errores básicos.
    * Estilos CSS básicos para la presentación de la tabla, filtros y modal.

## Hoja de Ruta del Proyecto

A continuación, se detalla la hoja de ruta planificada para el desarrollo de la aplicación.

### Fase 0: Base Establecida y Configuración Inicial (COMPLETADA)

* [X] Definición de la arquitectura: Node.js/Express para el backend, React para el frontend.
* [X] Creación de la estructura del proyecto:
    * [X] Repositorio Git (`gestion_almacen`) inicializado en GitHub con README y .gitignore para Node.
    * [X] Carpeta raíz local clonada.
    * [X] Subcarpeta `backend-node` creada e inicializada (`npm init -y`).
    * [X] Subcarpeta `frontend-react` creada.
* [X] Configuración del Backend Node.js Inicial:
    * [X] Dependencias instaladas: `express`, `cors`, `sqlite3`, `nodemon`.
    * [X] Carpeta `backend-node/almacen/` creada y archivo `almacen.db` (existente) copiado.
    * [X] Archivo `backend-node/server.js` creado con:
        * [X] Configuración de servidor Express.
        * [X] Conexión a `almacen.db`.
        * [X] Función `crearTablasSiNoExisten()` implementada para todas las tablas esenciales.
        * [X] Endpoint de prueba `GET /api/estado` funcional.
* [X] Creación del archivo `backend-node/db_operations.js`:
    * [X] Función `conectarDB()` definida.
    * [X] Función `consultarStockMateriasPrimas()` implementada (devuelve Promesa con datos de `StockMateriasPrimas`).
    * [X] Función `consultarItemStockPorId()` implementada.
* [X] Modificación de `backend-node/server.js`:
    * [X] Importación de funciones desde `db_operations.js`.
    * [X] Creación y prueba exitosa del endpoint `GET /api/stock` (con filtros).
    * [X] Creación y prueba exitosa del endpoint `GET /api/stock-item/:tabla/:id`.
* [X] Configuración Inicial del Frontend React:
    * [X] Proyecto React creado con Vite dentro de `frontend-react/`.
    * [X] Dependencias de React instaladas (`npm install`).
    * [X] Componente `frontend-react/src/App.jsx` modificado para:
        * [X] Hacer `fetch` al endpoint `GET /api/stock`.
        * [X] Almacenar y mostrar los datos del stock en una tabla HTML.
        * [X] Implementar controles de filtro que actualizan la tabla.
        * [X] Implementar visualización de detalles de ítem en un modal (llamando a `GET /api/stock-item/:tabla/:id`).
        * [X] Manejar estados de carga y errores básicos.
    * [X] Verificación exitosa de la comunicación React -> Node.js API -> SQLite y visualización de datos.

### Fase 1: Funcionalidad Básica de Stock (Continuación)

* **1.5. Backend y Frontend - Mejoras en la Visualización Detallada (PENDIENTE)**
    * **Tarea:** Refinar el modal de detalles.
    * **Detalles:**
        * Asegurar que todos los campos relevantes de `StockMateriasPrimas` y `StockComponentes` se muestren de forma clara.
        * Mejorar el formato de fechas, números y unidades.
        * Considerar la posibilidad de editar ciertos campos directamente desde el modal (esto podría moverse a una fase posterior).

### Fase 2: Creación de Nuevas Entradas (Pedidos Nacionales y Contenedores)

*Empezaremos con "Pedido Nacional de Goma" y luego extenderemos a otros.*

* **2.1. Backend (Node.js API) - Endpoint para Nuevo Pedido Nacional Goma (PENDIENTE)**
    * **Tarea:** En `server.js`, crear un endpoint para `POST /api/pedidos-nacionales/goma`.
    * **Detalles:**
        * Recibirá datos JSON del frontend.
        * Validar los datos.
        * **Lógica de Negocio en Node.js:**
            * Reimplementar la lógica de tu clase `MercanciaNacionalGoma` original de Python: cálculo de `precio_total_euro` base, gestión de `gastos`, cálculo de `total_gastos_pedido`, `porcentaje_gastos`, `precio_total_euro_gastos` por ítem, y `metro_lineal_euro_mas_gastos` por ítem.
            * **Operaciones de Base de Datos (en `db_operations.js`):**
                * Función para insertar en `PedidosProveedores`.
                * Función para insertar en `GastosPedido`.
                * Función para insertar en `StockMateriasPrimas` (guardando `metro_lineal_euro_mas_gastos` como `coste_unitario_final`).
        * Devolver respuesta JSON (éxito/error).
* **2.2. Frontend (React) - Formulario para Nuevo Pedido Nacional Goma (PENDIENTE)**
    * **Tarea:** Crear un componente React (ej: `FormularioPedidoNacionalGoma.jsx`).
    * **Detalles:** Campos para datos generales, interfaz para añadir/eliminar dinámicamente gastos y bobinas (con todos sus atributos, incluyendo subtipo). Al enviar, recopilar datos y enviar como JSON al endpoint. Mostrar feedback.
* **2.3. Extender para Otros Tipos de Entrada (PENDIENTE)**
    * **Tarea:** Replicar y adaptar para Pedidos Nacionales de PVC y Fieltro, y luego para Contenedores de Importación (Goma, PVC, Fieltro), incluyendo `valor_conversion` y estructura de gastos por tipo (SUPLIDOS, EXENTO, SUJETO).

### Fase 3: Gestión de Stock (Actualizaciones) y Visualización de Pedidos

* **3.1. Backend y Frontend - Listar Pedidos/Contenedores (PENDIENTE)**
    * **Tarea:** Crear endpoints y vistas React para listar Pedidos Nacionales y Contenedores Importados, con filtros y opción de ver detalles.
* **3.2. Backend y Frontend - Actualizar Estado del Stock (PENDIENTE)**
    * **Tarea:** Implementar funcionalidad para marcar items de stock como "EMPEZADA" o "AGOTADO" (llamando a funciones backend que actualicen la DB).
* **3.3. Backend y Frontend - Eliminar Pedidos/Contenedores (PENDIENTE)**
    * **Tarea:** Implementar funcionalidad para eliminar un pedido/contenedor completo (incluyendo gastos y stock asociado).

### Fase 4: Cálculo de Costes de Venta y Tarifa

* **4.1. Backend (Node.js API) - Endpoint para Tarifa de Venta (PENDIENTE)**
    * **Tarea:** Crear un endpoint `GET /api/tarifa-venta`.
    * **Detalles:** Obtener `coste_unitario_final` del stock, márgenes de `Configuracion`, agrupar, calcular `max_cost` y aplicar márgenes.
* **4.2. Frontend (React) - Vista de Tarifa de Venta (PENDIENTE)**
    * **Tarea:** Crear un componente React para mostrar la tarifa.

### Fase 5: Gestión de Maquinaria y Costes de Fabricación (A Futuro)

* **Tarea:** Implementar la lógica y las interfaces para la gestión de maquinaria y el cálculo de costes de fabricación de productos terminados (basado en tu `hojaDeRuta.txt` original).

### Fase 6: Mejoras Continuas y Refinamiento (A Futuro)

* **Tareas:** Refactorización, optimización, mejoras UX/UI, documentación, pruebas. Considerar empaquetado como aplicación de escritorio (Electron/Tauri).

## Configuración y Ejecución

### Backend (Node.js)

1.  Navegar a la carpeta `backend-node`.
2.  Instalar dependencias (si es la primera vez): `npm install`
3.  Ejecutar en modo desarrollo (con Nodemon): `npm run dev`
    * El servidor API se iniciará en `http://localhost:5002` (o el puerto configurado).

### Frontend (React)

1.  Navegar a la carpeta `frontend-react`.
2.  Instalar dependencias (si es la primera vez): `npm install`
3.  Ejecutar en modo desarrollo: `npm run dev`
    * La aplicación React se abrirá en el navegador, usualmente en `http://localhost:5173`.

**Nota:** Ambos servidores (backend y frontend) deben estar ejecutándose simultáneamente para que la aplicación funcione completamente.

---

Este `README.md` es un buen punto de partida. Puedes ir actualizándolo a medida que completas más fases y añades nuevas funcionalidades.
