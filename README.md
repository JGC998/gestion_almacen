# Gestión de Almacén con Node.js y React

Aplicación de escritorio para la gestión de inventario de materias primas, cálculo de costes de adquisición, gestión de producción y generación de tarifas de venta. El backend está desarrollado con Node.js y Express.js, utilizando una base de datos SQLite. El frontend está construido con React.

## Tecnologías Principales

* **Backend:** Node.js, Express.js, SQLite, `sqlite3`
* **Frontend:** React (con Vite), JavaScript (ES6+), HTML5, CSS3
* **Control de Versiones:** Git y GitHub

## Características Implementadas

* **Gestión de Stock:**
    * Visualización de stock de materia prima agrupado por material.
    * Filtro dinámico de stock por Familia, cargando las opciones desde la base de datos.
    * Cálculo automático de costes de adquisición repercutiendo gastos de transporte, aduanas, etc.

* **Gestión de Pedidos:**
    * Formularios para crear Pedidos Nacionales y de Importación.
    * Generación automática de referencias de bobina (`familia-espesor-ancho`).
    * Generación de lotes únicos (`P_ID-L_ID-B_ID`) para evitar colisiones en la base de datos.
    * Soporte para múltiples bobinas en una sola línea de pedido.
    * Clasificación de gastos de importación (suplidos, exentos, sujetos).
    * Listado de pedidos históricos y borradores.
    * Modal con vista detallada de cada pedido, incluyendo desglose de costes por línea.

* **Gestión de Producción:**
    * Módulo de "Gestión de Plantillas" para definir los productos a fabricar.
    * Módulo de "Producción" unificado para crear y procesar Órdenes de Producción.
    * Flujo interactivo para procesar órdenes: selección de lotes de stock específicos para cada material de la receta.
    * Consumo automático de stock de materia prima y creación de stock de producto terminado al procesar una orden.

* **Tarifas y Configuración:**
    * Cálculo y visualización de una matriz de tarifas de venta dinámica, basada en el último coste de stock y márgenes de beneficio.
    * Panel de configuración para ajustar márgenes y costes globales de la aplicación.

## Hoja de Ruta del Proyecto

* **Fase 0: Base Establecida (COMPLETADA)**
    * [X] Definición de la arquitectura (Node.js + React).
    * [X] Creación de la estructura del proyecto y configuración de `npm`.
    * [X] Conexión a base de datos SQLite y creación automática de tablas.

* **Fase 1-3: Gestión de Stock y Pedidos (COMPLETADA)**
    * [X] Visualización de stock y pedidos con filtros dinámicos.
    * [X] Creación de formularios para pedidos Nacionales y de Importación.
    * [X] Lógica de negocio para el cálculo de costes y generación de lotes de stock.
    * [X] Solución de error de lotes duplicados (`UNIQUE constraint`).
    * [X] Mejora de la interfaz de detalles del pedido.

* **Fase 4: Cálculo de Costes de Venta (COMPLETADA)**
    * [X] Endpoint y vista para la Tarifa de Venta, calculada dinámicamente.
    * [X] Panel de Configuración para gestionar márgenes y costes.

* **Fase 5: Gestión de Fabricación (COMPLETADA)**
    * [X] Gestión de "Plantillas de Producto" (Artículos).
    * [X] Módulo de Producción unificado con flujo interactivo.
    * [X] Lógica para crear, listar y procesar Órdenes de Producción.
    * [X] Consumo de stock de materia prima y creación de stock de producto terminado.

* **Fase 6: Mejoras Futuras (PENDIENTE)**
    * [ ] Refinamiento de la UX/UI general.
    * [ ] Implementar gestión de ventas y salida de stock de productos terminados.
    * [ ] Alertas de stock mínimo.
    * [ ] Informes y analíticas avanzadas.

## Configuración y Ejecución

### Backend (Node.js)

1.  Navegar a la carpeta `backend-node`.
2.  (Si es la primera vez) Ejecutar `npm install`.
3.  (Opcional, para poblar la DB) Ejecutar `node seed_database.js`.
4.  Ejecutar en modo desarrollo: `npm run dev`.
    * El servidor se iniciará en `http://localhost:5002`.

### Frontend (React)

1.  Navegar a la carpeta `frontend-react`.
2.  (Si es la primera vez) Ejecutar `npm install`.
3.  Ejecutar en modo desarrollo: `npm run dev`.
    * La aplicación se abrirá en el navegador, usualmente en `http://localhost:5173`.