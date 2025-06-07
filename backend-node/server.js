// backend-node/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');



// --- Importar funciones de db_operations.js ---
const {
    consultarStock,
    consultarItemStockPorId,
    procesarNuevoPedido,
    consultarListaPedidos,
    obtenerDetallesCompletosPedido,
    actualizarEstadoStockItem,
    eliminarPedidoCompleto,

    actualizarReferenciaProductoTerminado,
    insertarProductoTerminado,
    consultarProductosTerminados,
    consultarProductoTerminadoPorId,
    actualizarProductoTerminado,
    eliminarProductoTerminado,

    insertarMaquinaria,
    consultarMaquinaria,
    consultarMaquinariaPorId,
    actualizarMaquinaria,
    eliminarMaquinaria,

    insertarReceta,
    consultarRecetas,
    consultarRecetaPorId,
    actualizarReceta,
    eliminarReceta,

    insertarProcesoFabricacion,
    consultarProcesosFabricacion,
    consultarProcesoFabricacionPorId,
    actualizarProcesoFabricacion,
    eliminarProcesoFabricacion,

    insertarOrdenProduccion,
    consultarOrdenesProduccion,
    consultarOrdenProduccionPorId,
    actualizarOrdenProduccion,
    eliminarOrdenProduccion,
    procesarOrdenProduccion,

    insertarStockProductoTerminado,
    consultarStockProductosTerminados,
    consultarStockProductoTerminadoPorId,
    actualizarStockProductoTerminado,
    eliminarStockProductoTerminado,

    actualizarCosteFabricacionEstandar,

    consultarReferenciasStockConUltimoCoste,
    obtenerMaterialesGenericos,
    calcularPresupuestoProductoTerminado,
    calcularCosteMaterialEspecifico, // Asegúrate de exportar esta nueva función de cálculo

    obtenerConfiguracion,
    actualizarConfiguracion,

    consultarItems,

    conectarDB,
    runAsync
} = require('./db_operations.js');


const app = express();
const PORT = process.env.PORT || 5002;

// --- Cargar configuraciones desde config.json ---
let appConfig = {};
const configFilePath = path.resolve(__dirname, 'config.json');

// Función para cargar la configuración
function loadConfig() {
    try {
        const configFile = fs.readFileSync(configFilePath, 'utf8');
        appConfig = JSON.parse(configFile);
        console.log("Configuraciones cargadas desde config.json:", appConfig);
    } catch (error) {
        console.error("Error al cargar config.json. Asegúrate de que el archivo existe y es válido. Usando configuraciones por defecto.", error.message);
        appConfig = {
            margen_default_final: 0.50,
            margen_default_fabricante: 0.30,
            margen_default_metrajes: 0.60,
            margen_default_intermediario: 0.20,
            coste_mano_obra_default: 20.00,
            coste_mano_obra_por_metro_metraje: 0.15
        };
    }
}

// Cargar la configuración al iniciar el servidor
loadConfig();

// Middlewares
// Configuración de CORS para permitir peticiones desde el frontend de React
app.use(cors({
    origin: 'http://localhost:5173', // ¡Asegúrate de que este sea el puerto correcto de tu frontend!
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], // Permite los métodos HTTP que usas
    allowedHeaders: ['Content-Type', 'Authorization'], // Permite los encabezados comunes
}));
app.use(express.json()); // Middleware para parsear JSON en el cuerpo de las peticiones

// --- Configuración de la Base de Datos SQLite ---
const almacenDir = path.resolve(__dirname, 'almacen');
const dbPath = path.resolve(almacenDir, 'almacen.db');

// Crea el directorio 'almacen' si no existe
if (!fs.existsSync(almacenDir)){
    fs.mkdirSync(almacenDir, { recursive: true });
    console.log(`Directorio '${almacenDir}' creado.`);
}

// Conecta a la base de datos SQLite
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error al conectar/crear la base de datos SQLite:", err.message);
    } else {
        console.log("Conectado a la base de datos SQLite.");
        // Habilita las foreign keys para asegurar la integridad referencial
        db.exec('PRAGMA foreign_keys = ON;', (err) => {
            if (err) console.error("Error al habilitar foreign keys en conexión principal:", err.message);
            else console.log("Foreign keys habilitadas.");
        });
        crearTablasSiNoExisten(); // Llama a la función para crear tablas si no existen
    }
});

// En backend-node/server.js

function crearTablasSiNoExisten() {
    db.serialize(() => {
        console.log("Verificando/Creando tablas con la nueva estructura...");

        // 1. Tabla Maestra de Artículos (reemplaza a ProductosTerminados y las descripciones de Stock)
        db.run(`CREATE TABLE IF NOT EXISTS Items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sku TEXT UNIQUE NOT NULL,                       -- Código único de artículo (ej: GOM-EPDM-6-1000)
            descripcion TEXT NOT NULL,
            tipo_item TEXT NOT NULL CHECK(tipo_item IN ('MATERIA_PRIMA', 'COMPONENTE', 'PRODUCTO_TERMINADO')),
            familia TEXT,                                   -- GOMA, FIELTRO, FALDETAS...
            espesor TEXT,
            ancho REAL,
            unidad_medida TEXT NOT NULL,                    -- m, kg, unidad
            coste_estandar REAL DEFAULT 0                   -- Coste de fabricación (para productos) o último coste conocido (para materias)
        )`, (err) => {
            if (err) console.error("Error creando tabla Items:", err.message);
            else console.log("Tabla 'Items' verificada/creada.");
        });

        // 2. Tablas de Compras (se mantienen pero LineasPedido ahora apunta a Items)
        db.run(`CREATE TABLE IF NOT EXISTS PedidosProveedores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero_factura TEXT NOT NULL UNIQUE,
            proveedor TEXT,
            fecha_pedido TEXT,
            fecha_llegada TEXT,
            origen_tipo TEXT NOT NULL CHECK(origen_tipo IN ('CONTENEDOR', 'NACIONAL')),
            observaciones TEXT,
            valor_conversion REAL
        )`, (err) => { if (err) console.error("Error creando tabla PedidosProveedores:", err.message); else console.log("Tabla 'PedidosProveedores' verificada/creada."); });

        db.run(`CREATE TABLE IF NOT EXISTS GastosPedido (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER NOT NULL,
            tipo_gasto TEXT,
            descripcion TEXT NOT NULL,
            coste_eur REAL NOT NULL,
            FOREIGN KEY(pedido_id) REFERENCES PedidosProveedores(id) ON DELETE CASCADE
        )`, (err) => { if (err) console.error("Error creando tabla GastosPedido:", err.message); else console.log("Tabla 'GastosPedido' verificada/creada."); });

        db.run(`CREATE TABLE IF NOT EXISTS LineasPedido (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER NOT NULL,
            item_id INTEGER NOT NULL,                         -- AHORA APUNTA A UN ITEM ESPECiFICO
            cantidad_original REAL NOT NULL,
            precio_unitario_original REAL NOT NULL,
            moneda_original TEXT,
            FOREIGN KEY(pedido_id) REFERENCES PedidosProveedores(id) ON DELETE CASCADE,
            FOREIGN KEY(item_id) REFERENCES Items(id) ON DELETE RESTRICT
        )`, (err) => { if (err) console.error("Error creando tabla LineasPedido:", err.message); else console.log("Tabla 'LineasPedido' verificada/creada."); });


        // 3. Nueva Tabla de Stock Unificada
        db.run(`CREATE TABLE IF NOT EXISTS Stock (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NOT NULL,
            lote TEXT NOT NULL UNIQUE,                      -- Lote del proveedor o generado internamente
            cantidad_inicial REAL NOT NULL,
            cantidad_actual REAL NOT NULL,
            coste_lote REAL NOT NULL,                       -- El coste real de ESE lote específico (por unidad de medida del item)
            ubicacion TEXT,
            pedido_id INTEGER,                              -- Pedido de compra (si aplica)
            orden_produccion_id INTEGER,                    -- Orden de producción (si aplica)
            fecha_entrada TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'DISPONIBLE',
            FOREIGN KEY(item_id) REFERENCES Items(id) ON DELETE CASCADE,
            FOREIGN KEY(pedido_id) REFERENCES PedidosProveedores(id) ON DELETE SET NULL,
            FOREIGN KEY(orden_produccion_id) REFERENCES OrdenesProduccion(id) ON DELETE SET NULL
        )`, (err) => {
            if (err) console.error("Error creando tabla Stock:", err.message);
            else console.log("Tabla 'Stock' verificada/creada.");
        });

        // 4. Tablas de Fabricación (ahora apuntan a Items)
        db.run(`CREATE TABLE IF NOT EXISTS Maquinaria (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            descripcion TEXT,
            coste_hora_operacion REAL
        )`, (err) => { if (err) console.error("Error creando tabla Maquinaria:", err.message); else console.log("Tabla 'Maquinaria' verificada/creada."); });

        db.run(`CREATE TABLE IF NOT EXISTS Recetas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            producto_id INTEGER NOT NULL,                     -- ID de un PRODUCTO_TERMINADO de la tabla Items
            material_id INTEGER NOT NULL,                     -- ID de una MATERIA_PRIMA o COMPONENTE de la tabla Items
            cantidad_requerida REAL NOT NULL,
            notas TEXT,
            FOREIGN KEY(producto_id) REFERENCES Items(id) ON DELETE CASCADE,
            FOREIGN KEY(material_id) REFERENCES Items(id) ON DELETE RESTRICT
        )`, (err) => { if (err) console.error("Error creando tabla Recetas:", err.message); else console.log("Tabla 'Recetas' verificada/creada."); });
        
        db.run(`CREATE TABLE IF NOT EXISTS ProcesosFabricacion (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            producto_id INTEGER NOT NULL,                     -- APUNTA A ITEMS
            maquinaria_id INTEGER NOT NULL,
            nombre_proceso TEXT NOT NULL,
            tiempo_estimado_segundos INTEGER NOT NULL,
            aplica_a_clientes TEXT,
            FOREIGN KEY(producto_id) REFERENCES Items(id) ON DELETE CASCADE,
            FOREIGN KEY(maquinaria_id) REFERENCES Maquinaria(id) ON DELETE RESTRICT
        )`, (err) => { if (err) console.error("Error creando tabla ProcesosFabricacion:", err.message); else console.log("Tabla 'ProcesosFabricacion' verificada/creada."); });

        db.run(`CREATE TABLE IF NOT EXISTS OrdenesProduccion (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NOT NULL,                         -- APUNTA A ITEMS
            cantidad_a_producir REAL NOT NULL,
            fecha TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'PENDIENTE',
            coste_real_fabricacion REAL,
            observaciones TEXT,
            FOREIGN KEY(item_id) REFERENCES Items(id) ON DELETE RESTRICT
        )`, (err) => { if (err) console.error("Error creando tabla OrdenesProduccion:", err.message); else console.log("Tabla 'OrdenesProduccion' verificada/creada."); });
        
        console.log("Verificación/Creación de todas las tablas completada.");
    });
}


// --- Rutas de la API (Endpoints existentes) ---
app.get('/api/estado', (req, res) => {
    console.log('Node.js: Se ha solicitado GET /api/estado');
    res.json({ estado: 'Servidor Backend Node.js funcionando correctamente!' });
});

app.get('/api/stock', async (req, res) => {
    console.log('Node.js: Solicitud a GET /api/stock (con nueva estructura)');
    try {
        const filtros = req.query;
        const stockItems = await consultarStock(filtros); // <-- LLAMADA A LA NUEVA FUNCIÓN
        console.log(`Node.js: Devolviendo ${stockItems.length} lotes de stock.`);
        res.json(stockItems);
    } catch (error) {
        console.error("Error en el endpoint /api/stock:", error.message);
        res.status(500).json({ error: "Error interno del servidor al obtener el stock.", detalle: error.message });
    }
});

app.get('/api/stock-item/:tabla/:id', async (req, res) => {
    const tablaItem = req.params.tabla;
    const idItem = parseInt(req.params.id, 10);

    console.log(`Node.js: Se ha solicitado GET /api/stock-item/${tablaItem}/${idItem}`);

    if (!['StockMateriasPrimas', 'StockComponentes'].includes(tablaItem)) {
        return res.status(400).json({ error: "Nombre de tabla no válido." });
    }
    if (isNaN(idItem) || idItem <= 0) {
        return res.status(400).json({ error: "ID de ítem no válido." });
    }

    try {
        const item = await consultarItemStockPorId(idItem, tablaItem);

        if (item) {
            console.log(`Node.js: Devolviendo detalles para ${tablaItem} ID ${idItem}.`);
            res.json(item);
        } else {
            console.log(`Node.js: No se encontró ${tablaItem} con ID ${idItem}.`);
            res.status(404).json({ error: `No se encontró ${tablaItem} con ID ${idItem}.` });
        }
    } catch (error) {
        console.error(`Error en el endpoint /api/stock-item/${tablaItem}/${idItem}:`, error.message);
        if (error.message && error.message.startsWith("Tabla no válida")) {
             return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: "Error interno del servidor al obtener el ítem de stock.", detalle: error.message });
    }
});

app.get('/api/stock-componentes', async (req, res) => {
    console.log('Node.js: Se ha solicitado GET /api/stock-componentes');
    try {
        const filtros = req.query;
        const stockComponentes = await consultarStockComponentes(filtros);
        console.log(`Node.js: Devolviendo ${stockComponentes.length} items de stock de componentes.`);
        res.json(stockComponentes);
    } catch (error) {
        console.error("Error en GET /api/stock-componentes:", error.message);
        res.status(500).json({ error: "Error interno del servidor al obtener el stock de componentes.", detalle: error.message });
    }
});


app.get('/api/pedidos', async (req, res) => {
    console.log('Node.js: Se ha solicitado GET /api/pedidos');
    try {
        const filtros = req.query;
        console.log('Node.js: Filtros recibidos en /api/pedidos:', filtros);

        const pedidos = await consultarListaPedidos(filtros);

        console.log(`Node.js: Devolviendo ${pedidos.length} pedidos.`);
        res.json(pedidos);
    } catch (error) {
        console.error("Error en el endpoint /api/pedidos:", error.message);
        res.status(500).json({ error: "Error interno del servidor al obtener la lista de pedidos.", detalle: error.message });
    }
});

app.get('/api/pedidos/:pedidoId/detalles', async (req, res) => {
    const pedidoId = parseInt(req.params.pedidoId, 10);
    console.log(`Node.js: Se ha solicitado GET /api/pedidos/${pedidoId}/detalles`);

    if (isNaN(pedidoId) || pedidoId <= 0) {
        return res.status(400).json({ error: "ID de pedido no válido." });
    }

    try {
        const detallesPedido = await obtenerDetallesCompletosPedido(pedidoId); // Esta función ya usa la lógica de IVA

        if (detallesPedido) {
            console.log(`Node.js: Devolviendo detalles para el pedido ID ${pedidoId}.`);
            res.json(detallesPedido);
        } else {
            console.log(`Node.js: No se encontró el pedido con ID ${pedidoId}.`);
            res.status(404).json({ error: `No se encontró el pedido con ID ${pedidoId}.` });
        }
    } catch (error) {
        console.error(`Error en el endpoint /api/pedidos/${pedidoId}/detalles:`, error.message);
        res.status(500).json({ error: "Error interno del servidor al obtener los detalles del pedido.", detalle: error.message });
    }
});

app.get('/api/items', async (req, res) => {
    console.log('Node.js: Solicitud a GET /api/items');
    try {
        const filtros = req.query; // para filtrar por ej. ?tipo_item=MATERIA_PRIMA
        const items = await consultarItems(filtros);
        res.json(items);
    } catch (error) {
        console.error("Error en el endpoint /api/items:", error.message);
        res.status(500).json({ error: "Error interno del servidor al obtener los items."});
    }
});

// En backend-node/server.js - Pega esta función completa
function calcularCostesLinea(lineasItems, gastosItems, valorConversion = 1) {
    let costeTotalPedidoSinGastosEnMonedaOriginal = 0;

    const lineasConPrecioBase = lineasItems.map(linea => {
        const cantidad = parseFloat(linea.cantidad_original) || 0;
        const precioUnitarioOriginal = parseFloat(linea.precio_unitario_original) || 0;

        let precioUnitarioEur = precioUnitarioOriginal;
        if (linea.moneda_original && linea.moneda_original.toUpperCase() !== 'EUR' && valorConversion !== 1) {
            precioUnitarioEur = precioUnitarioOriginal * valorConversion;
        } else if (valorConversion !== 1 && (!linea.moneda_original || linea.moneda_original.toUpperCase() === 'EUR')) {
             if (!linea.moneda_original) {
                 precioUnitarioEur = precioUnitarioOriginal * valorConversion;
            }
        }

        const precioTotalBaseLineaEur = cantidad * precioUnitarioEur;
        costeTotalPedidoSinGastosEnMonedaOriginal += precioTotalBaseLineaEur;
        return { ...linea, precio_total_euro_base: precioTotalBaseLineaEur, precio_unitario_eur: precioUnitarioEur };
    });

    let totalGastosRepercutibles = 0;
    gastosItems.forEach(gasto => {
        const tipoGastoUpper = gasto.tipo_gasto?.toUpperCase();
        if ( (tipoGastoUpper === 'SUPLIDOS' && !(gasto.descripcion?.toUpperCase().includes('IVA'))) || tipoGastoUpper === 'NACIONAL' ) {
            totalGastosRepercutibles += (parseFloat(gasto.coste_eur) || 0);
        }
    });

    const porcentajeGastosRepercutibles = costeTotalPedidoSinGastosEnMonedaOriginal > 0
        ? totalGastosRepercutibles / costeTotalPedidoSinGastosEnMonedaOriginal
        : 0;

    console.log(`DEBUG -> Coste Total Base: ${costeTotalPedidoSinGastosEnMonedaOriginal}, Gastos Repercutibles: ${totalGastosRepercutibles}, Porcentaje: ${porcentajeGastosRepercutibles}`);

    return lineasConPrecioBase.map(linea => {
        const costeUnitarioFinalCalculado = linea.precio_unitario_eur * (1 + porcentajeGastosRepercutibles);
        return { ...linea, coste_unitario_final_calculado: costeUnitarioFinalCalculado };
    });
}




app.post('/api/pedidos-nacionales', async (req, res) => {
    const { pedido, lineas, gastos, material_tipo } = req.body;

    console.log(`Node.js: POST /api/pedidos-nacionales, Material: ${material_tipo}`);

    if (!pedido || !lineas || !gastos || !material_tipo) {
        return res.status(400).json({ error: "Datos incompletos. Se requiere 'pedido', 'lineas', 'gastos' y 'material_tipo'." });
    }
    if (!['GOMA', 'PVC', 'FIELTRO'].includes(material_tipo.toUpperCase())) {
        return res.status(400).json({ error: "Valor de 'material_tipo' no válido." });
    }
    if (!Array.isArray(lineas) || lineas.length === 0) {
        return res.status(400).json({ error: "Debe haber al menos una línea de pedido." });
    }

    try {
        const lineasConCostes = calcularCostesLinea(lineas, gastos);

        const datosParaDB = {
            pedido: { ...pedido, origen_tipo: 'NACIONAL' },
            lineas: lineasConCostes,
            gastos: gastos,
            material_tipo_general: material_tipo.toUpperCase()
        };

        const resultado = await procesarNuevoPedido(datosParaDB);

        console.log(`Node.js: Pedido NACIONAL de ${material_tipo} creado con ID: ${resultado.pedidoId}`);
        res.status(201).json({ mensaje: resultado.mensaje, pedidoId: resultado.pedidoId });

    } catch (error) {
        console.error(`Error en POST /api/pedidos-nacionales (${material_tipo}):`, error.message);
        if (error.message.includes("ya existe")) {
             return res.status(409).json({ error: error.message });
        }
        res.status(500).json({ error: "Error interno del servidor al crear el pedido nacional.", detalle: error.message });
    }
});

app.post('/api/pedidos-importacion', async (req, res) => {
    const { pedido, lineas, gastos, material_tipo, valor_conversion } = req.body;

    console.log(`Node.js: POST /api/pedidos-importacion, Material: ${material_tipo}, Conv: ${valor_conversion}`);

    if (!pedido || !lineas || !gastos || !material_tipo || valor_conversion === undefined) {
        return res.status(400).json({ error: "Datos incompletos. Se requiere 'pedido', 'lineas', 'gastos', 'material_tipo' y 'valor_conversion'." });
    }
    if (!['GOMA', 'PVC', 'FIELTRO'].includes(material_tipo.toUpperCase())) {
        return res.status(400).json({ error: "Valor de 'material_tipo' no válido." });
    }
    const vc = parseFloat(valor_conversion);
    if (isNaN(vc) || vc <= 0) {
        return res.status(400).json({ error: "El 'valor_conversion' debe ser un número positivo." });
    }
    if (!Array.isArray(lineas) || lineas.length === 0) {
        return res.status(400).json({ error: "Debe haber al menos una línea de pedido." });
    }
    const tiposGastoImportacionValidos = ['SUPLIDOS', 'EXENTO', 'SUJETO'];
    if (gastos.some(g => !tiposGastoImportacionValidos.includes(g.tipo_gasto?.toUpperCase()))) {
        return res.status(400).json({ error: `Tipos de gasto para importación deben ser ${tiposGastoImportacionValidos.join(', ')}`});
    }

    try {
        const lineasConCostes = calcularCostesLinea(lineas, gastos, vc);

        const datosParaDB = {
            pedido: { ...pedido, origen_tipo: 'CONTENEDOR', valor_conversion: vc },
            lineas: lineasConCostes,
            gastos: gastos.map(g => ({...g, tipo_gasto: g.tipo_gasto.toUpperCase()})),
            material_tipo_general: material_tipo.toUpperCase()
        };

        const resultado = await procesarNuevoPedido(datosParaDB);

        console.log(`Node.js: Pedido de IMPORTACIÓN de ${material_tipo} creado con ID: ${resultado.pedidoId}`);
        res.status(201).json({ mensaje: resultado.mensaje, pedidoId: resultado.pedidoId });

    } catch (error) {
        console.error(`Error en POST /api/pedidos-importacion (${material_tipo}):`, error.message);
        if (error.message.includes("ya existe")) {
             return res.status(409).json({ error: error.message });
        }
        res.status(500).json({ error: "Error interno del servidor al crear el pedido de importación.", detalle: error.message });
    }
});

app.patch('/api/stock-items/:stockItemId/estado', async (req, res) => {
    const stockItemId = parseInt(req.params.stockItemId, 10);
    const { status: nuevoEstado } = req.body;

    console.log(`Node.js: Se ha solicitado PATCH /api/stock-items/${stockItemId}/estado con nuevo estado: ${nuevoEstado}`);

    if (isNaN(stockItemId) || stockItemId <= 0) {
        return res.status(400).json({ error: "ID de ítem de stock no válido." });
    }
    if (!nuevoEstado || typeof nuevoEstado !== 'string') {
        return res.status(400).json({ error: "Nuevo estado no proporcionado o en formato incorrecto. Se espera { \"status\": \"NUEVO_ESTADO\" }." });
    }

    try {
        const changes = await actualizarEstadoStockItem(stockItemId, nuevoEstado);

        if (changes > 0) {
            console.log(`Node.js: Estado del ítem de stock ID ${stockItemId} actualizado a ${nuevoEstado}.`);
            res.json({ mensaje: `Estado del ítem de stock ID ${stockItemId} actualizado a ${nuevoEstado}.` });
        } else {
            console.log(`Node.js: No se encontró o no se actualizó el ítem de stock ID ${stockItemId}.`);
            res.status(404).json({ error: `No se encontró el ítem de stock con ID ${stockItemId} o no se pudo actualizar.` });
        }
    } catch (error) {
        console.error(`Error en PATCH /api/stock-items/${stockItemId}/estado:`, error.message);
        if (error.message.includes("No se encontró el ítem de stock")) {
            return res.status(404).json({ error: error.message });
        }
        if (error.message.includes("Estado") && error.message.includes("no válido")) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: "Error interno del servidor al actualizar el estado del ítem de stock.", detalle: error.message });
    }
});

app.delete('/api/pedidos/:pedidoId', async (req, res) => {
    const pedidoId = parseInt(req.params.pedidoId, 10);
    console.log(`Node.js: Se ha solicitado DELETE /api/pedidos/${pedidoId}`);

    if (isNaN(pedidoId) || pedidoId <= 0) {
        return res.status(400).json({ error: "ID de pedido no válido." });
    }

    try {
        const resultado = await eliminarPedidoCompleto(pedidoId);
        console.log(`Node.js: Pedido ID ${pedidoId} procesado para eliminación.`);
        res.json(resultado);
    } catch (error) {
        console.error(`Error en DELETE /api/pedidos/${pedidoId}:`, error.message);
        if (error.message.includes("no encontrado")) {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});


// MODIFICADA: Endpoint /api/tarifa-venta para usar ProductosTerminados
// En backend-node/server.js

app.get('/api/tarifa-venta', async (req, res) => {
    const { tipo_tarifa } = req.query;

    console.log(`Node.js: GET /api/tarifa-venta para MATERIALES EN STOCK, tipo: ${tipo_tarifa}`);

    if (!tipo_tarifa) {
        return res.status(400).json({ error: "El parámetro 'tipo_tarifa' es requerido." });
    }
    const tipoTarifaNormalizado = tipo_tarifa.toLowerCase();
    const tiposTarifaValidos = ['final', 'fabricante', 'metrajes', 'intermediario'];
    if (!tiposTarifaValidos.includes(tipoTarifaNormalizado)) {
        return res.status(400).json({ error: `Valor de 'tipo_tarifa' no válido.` });
    }

    try {
        const configuraciones = appConfig;
        const claveMargen = `margen_default_${tipoTarifaNormalizado}`;
        let margenAplicado = configuraciones[claveMargen];

        if (margenAplicado === undefined || isNaN(parseFloat(margenAplicado))) {
            margenAplicado = 0;
        }
        margenAplicado = parseFloat(margenAplicado);

        const stockItems = await consultarStockMateriasPrimas({ status: 'DISPONIBLE,EMPEZADA' });

        if (stockItems.length === 0) {
            return res.json([]);
        }

        const tarifaVentaMateriales = stockItems.map(item => {
            const costeBase = parseFloat(item.coste_unitario_final) || 0;
            const precioVenta = costeBase * (1 + margenAplicado);

            return {
                id: item.id,
                referencia_stock: item.referencia_stock,
                descripcion: `${item.material_tipo} ${item.espesor || ''} ${item.subtipo_material || ''} ${item.ancho || ''}mm ${item.color || ''}`.trim().replace(/\s+/g, ' '),
                unidad_medida: item.unidad_medida,
                coste_metro_lineal: costeBase,
                margen_aplicado: margenAplicado,
                precio_venta_metro_lineal: precioVenta
            };
        });

        console.log(`Tarifa de venta de MATERIALES generada para tipo_tarifa: ${tipoTarifaNormalizado}`);
        res.json(tarifaVentaMateriales);

    } catch (error) {
        console.error("Error en /api/tarifa-venta (materiales):", error.message);
        res.status(500).json({ error: "Error interno al generar la tarifa de venta de materiales.", detalle: error.message });
    }
});


// --- ENDPOINTS PARA LA FASE 5 (ACTUALIZADOS) ---

app.post('/api/productos-terminados', async (req, res) => {
    const productoData = req.body;
    console.log('Node.js: POST /api/productos-terminados, datos recibidos:', productoData);

    if (!productoData.nombre || !productoData.material_principal || !productoData.espesor_principal ||
        productoData.ancho_final === undefined || productoData.largo_final === undefined) {
        return res.status(400).json({ error: "Nombre, material principal, espesor principal, ancho final y largo final de la plantilla son requeridos." });
    }

    // Validar que ancho_final y largo_final sean números
    const anchoFinalNum = parseFloat(productoData.ancho_final);
    const largoFinalNum = parseFloat(productoData.largo_final);

    if (isNaN(anchoFinalNum) || anchoFinalNum <= 0) {
        return res.status(400).json({ error: "El 'ancho_final' debe ser un número positivo." });
    }
    if (isNaN(largoFinalNum) || largoFinalNum <= 0) {
        return res.status(400).json({ error: "El 'largo_final' debe ser un número positivo." });
    }
    // Sobrescribir con los números parseados para asegurar consistencia
    productoData.ancho_final = anchoFinalNum;
    productoData.largo_final = largoFinalNum;


    const db = conectarDB(); // Obtener una instancia de DB para la transacción. Es crucial que sea la misma instancia para todas las operaciones de la transacción.

    try {
        await runAsync(db, 'BEGIN TRANSACTION;'); // Iniciar transacción

        // 1. Insertar el producto (que ahora inserta NULL para referencia)
        // La función insertarProductoTerminado debe estar adaptada para usar dbInstance (db en este caso) y runAsync.
        const productoId = await insertarProductoTerminado(db, productoData);

        // 2. Generar y actualizar la referencia
        const referenciaGenerada = `PT-${productoId.toString().padStart(5, '0')}`;
        // La función actualizarReferenciaProductoTerminado también debe usar dbInstance y runAsync.
        await actualizarReferenciaProductoTerminado(db, productoId, referenciaGenerada);

        // 3. Recalcular/actualizar el coste estándar.
        // Esta función y las que llama (calcularCosteMateriales, calcularCosteProcesos, obtenerUltimoCosteMaterialGenerico)
        // deben estar adaptadas para usar dbInstance y los helpers ...Async.
        // El 'coste_fabricacion_estandar' enviado desde el frontend (productoData.coste_fabricacion_estandar)
        // es el coste de material estimado, que se guarda inicialmente por insertarProductoTerminado.
        // Esta llamada lo recalculará (o lo confirmará si la lógica de cálculo da el mismo resultado).
        await actualizarCosteFabricacionEstandar(productoId, appConfig);

        await runAsync(db, 'COMMIT;'); // Confirmar transacción

        console.log(`Plantilla de producto ID ${productoId} creada con referencia ${referenciaGenerada}.`);
        res.status(201).json({ mensaje: "Plantilla de producto creada con éxito.", id: productoId, referencia: referenciaGenerada });

    } catch (error) {
        console.error("Error en POST /api/productos-terminados (transacción):", error.message, error.stack);
        if (db) { // Solo intentar ROLLBACK si db está definida
            try {
                await runAsync(db, 'ROLLBACK;');
                console.log("Transacción revertida (ROLLBACK) en POST /api/productos-terminados.");
            } catch (rollbackError) {
                console.error("Error crítico durante ROLLBACK en POST /api/productos-terminados:", rollbackError.message, rollbackError.stack);
            }
        }
        // Manejo de errores específicos
        if (error.message && error.message.toUpperCase().includes("UNIQUE CONSTRAINT FAILED")) {
            if (error.message.includes("ProductosTerminados.referencia")) {
                 return res.status(409).json({ error: "Conflicto al generar referencia única. Intente de nuevo.", detalle: error.message });
            } else if (error.message.includes("ProductosTerminados.nombre")) { // Si haces el nombre único
                 return res.status(409).json({ error: "El nombre de la plantilla de producto ya existe.", detalle: error.message });
            }
        }
        res.status(500).json({ error: "Error interno del servidor al crear la plantilla de producto.", detalle: error.message });
    } finally {
        if (db) { // Solo cerrar si db está definida
            db.close((err) => {
                if (err) console.error("Error cerrando la BD en POST /api/productos-terminados:", err.message);
            });
        }
    }
});
// ...

// GET para obtener todos los productos terminados
app.get('/api/productos-terminados', async (req, res) => {
    const filtros = req.query;
    console.log('Node.js: GET /api/productos-terminados', filtros);
    try {
        const productos = await consultarProductosTerminados(filtros);
        res.json(productos);
    } catch (error) {
        console.error("Error en GET /api/productos-terminados:", error.message);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

// GET para obtener un producto terminado por ID
app.get('/api/productos-terminados/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    console.log('Node.js: GET /api/productos-terminados/:id', id);
    if (isNaN(id)) {
        return res.status(400).json({ error: "ID de producto terminado no válido." });
    }
    try {
        const producto = await consultarProductoTerminadoPorId(id);
        if (producto) {
            res.json(producto);
        } else {
            res.status(404).json({ error: "Producto terminado no encontrado." });
        }
    } catch (error) {
        console.error("Error en GET /api/productos-terminados/:id:", error.message);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

// PUT para actualizar un producto terminado por ID
app.put('/api/productos-terminados/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const updates = req.body;
    console.log('Node.js: PUT /api/productos-terminados/:id', id, updates);
    if (isNaN(id) || Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "ID de producto terminado no válido o no se proporcionaron datos para actualizar." });
    }
    try {
        const changes = await actualizarProductoTerminado(id, updates);
        if (changes > 0) {
            // Recalcular coste estándar si se actualizan campos relevantes para el coste
            await actualizarCosteFabricacionEstandar(id, appConfig); 
            res.json({ mensaje: `Producto terminado ID ${id} actualizado con éxito.` });
        } else {
            res.status(404).json({ error: "Producto terminado no encontrado para actualizar." });
        }
    } catch (error) {
        console.error("Error en PUT /api/productos-terminados/:id:", error.message);
        if (error.message.includes("UNIQUE constraint failed")) {
            return res.status(409).json({ error: "La referencia de producto ya existe." });
        }
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

// DELETE para eliminar un producto terminado por ID
app.delete('/api/productos-terminados/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    console.log('Node.js: DELETE /api/productos-terminados/:id', id);
    if (isNaN(id)) {
        return res.status(400).json({ error: "ID de producto terminado no válido." });
    }
    try {
        const changes = await eliminarProductoTerminado(id);
        if (changes > 0) {
            res.json({ mensaje: `Producto terminado ID ${id} eliminado con éxito.` });
        } else {
            res.status(404).json({ error: "Producto terminado no encontrado para eliminar." });
        }
    } catch (error) {
        console.error("Error en DELETE /api/productos-terminados/:id:", error.message);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

// --- Maquinaria ---
app.post('/api/maquinaria', async (req, res) => {
    const maquinaData = req.body;
    console.log('Node.js: POST /api/maquinaria', maquinaData);
    if (!maquinaData.nombre) {
        return res.status(400).json({ error: "El nombre de la máquina es requerido." });
    }
    try {
        const id = await insertarMaquinaria(maquinaData);
        res.status(201).json({ mensaje: "Máquina creada con éxito.", id });
    } catch (error) {
        console.error("Error en POST /api/maquinaria:", error.message);
        if (error.message.includes("ya existe")) {
            return res.status(409).json({ error: error.message });
        }
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

app.get('/api/maquinaria', async (req, res) => {
    const filtros = req.query;
    console.log('Node.js: GET /api/maquinaria', filtros);
    try {
        const maquinaria = await consultarMaquinaria(filtros);
        res.json(maquinaria);
    } catch (error) {
        console.error("Error en GET /api/maquinaria:", error.message);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

app.get('/api/maquinaria/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    console.log('Node.js: GET /api/maquinaria/:id', id);
    if (isNaN(id)) {
        return res.status(400).json({ error: "ID de máquina no válido." });
    }
    try {
        const maquina = await consultarMaquinariaPorId(id);
        if (maquina) {
            res.json(maquina);
        } else {
            res.status(404).json({ error: "Máquina no encontrada." });
        }
    } catch (error) {
        console.error("Error en GET /api/maquinaria/:id:", error.message);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

app.put('/api/maquinaria/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const updates = req.body;
    console.log('Node.js: PUT /api/maquinaria/:id', id, updates);
    if (isNaN(id) || Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "ID de máquina no válido o no se proporcionaron datos para actualizar." });
    }
    try {
        const changes = await actualizarMaquinaria(id, updates);
        if (changes > 0) {
            res.json({ mensaje: `Máquina ID ${id} actualizada con éxito.` });
        } else {
            res.status(404).json({ error: "Máquina no encontrada para actualizar." });
        }
    } catch (error) {
        console.error("Error en PUT /api/maquinaria/:id:", error.message);
        if (error.message.includes("ya existe")) {
            return res.status(409).json({ error: error.message });
        }
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

app.delete('/api/maquinaria/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    console.log('Node.js: DELETE /api/maquinaria/:id', id);
    if (isNaN(id)) {
        return res.status(400).json({ error: "ID de máquina no válido." });
    }
    try {
        const changes = await eliminarMaquinaria(id);
        if (changes > 0) {
            res.json({ mensaje: `Máquina ID ${id} eliminada con éxito.` });
        } else {
            res.status(404).json({ error: "Máquina no encontrada para eliminar." });
        }
    } catch (error) {
        console.error("Error en DELETE /api/maquinaria/:id:", error.message);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

// --- Recetas (Endpoints de Recetas: ahora trabajan con recetas genéricas) ---
app.post('/api/recetas', async (req, res) => {
    const recetaData = req.body;
    console.log('Node.js: POST /api/recetas', recetaData);
    if (!recetaData.producto_terminado_id || !recetaData.cantidad_requerida || !recetaData.unidad_medida_requerida || 
        ((!recetaData.material_tipo_generico && !recetaData.componente_ref_generico) || (recetaData.material_tipo_generico && recetaData.componente_ref_generico))) {
        return res.status(400).json({ error: "Datos de receta incompletos o inválidos: ID de producto, cantidad y unidad requerida son obligatorios. Debe especificar un material genérico O un componente genérico, no ambos." });
    }
    try {
        const id = await insertarReceta(recetaData);
        await actualizarCosteFabricacionEstandar(recetaData.producto_terminado_id, appConfig); 
        res.status(201).json({ mensaje: "Receta creada con éxito.", id });
    } catch (error) {
        console.error("Error en POST /api/recetas:", error.message);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

app.get('/api/recetas', async (req, res) => {
    const filtros = req.query;
    console.log('Node.js: GET /api/recetas', filtros);
    try {
        const recetas = await consultarRecetas(filtros);
        res.json(recetas);
    } catch (error) {
        console.error("Error en GET /api/recetas:", error.message);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

app.get('/api/recetas/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    console.log('Node.js: GET /api/recetas/:id', id);
    if (isNaN(id)) {
        return res.status(400).json({ error: "ID de receta no válido." });
    }
    try {
        const receta = await consultarRecetaPorId(id);
        if (receta) {
            res.json(receta);
        } else {
            res.status(404).json({ error: "Receta no encontrada." });
        }
    } catch (error) {
        console.error("Error en GET /api/recetas/:id:", error.message);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

app.put('/api/recetas/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const updates = req.body;
    console.log('Node.js: PUT /api/recetas/:id', id, updates);
    if (isNaN(id) || Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "ID de receta no válido o no se proporcionaron datos para actualizar." });
    }
    try {
        const changes = await actualizarReceta(id, updates);
        if (updates.producto_terminado_id) { 
            await actualizarCosteFabricacionEstandar(updates.producto_terminado_id, appConfig); 
        } else if (changes > 0) { 
            const recetaOriginal = await consultarRecetaPorId(id);
            if (recetaOriginal && recetaOriginal.producto_terminado_id) {
                await actualizarCosteFabricacionEstandar(recetaOriginal.producto_terminado_id, appConfig);
            }
        }
        res.json({ mensaje: `Receta ID ${id} actualizada con éxito.` });
    } catch (error) {
        console.error("Error en PUT /api/recetas/:id:", error.message);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

app.delete('/api/recetas/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    console.log('Node.js: DELETE /api/recetas/:id', id);
    if (isNaN(id)) {
        return res.status(400).json({ error: "ID de receta no válido." });
    }
    try {
        const receta = await consultarRecetaPorId(id); 
        const changes = await eliminarReceta(id);
        if (changes > 0) {
            if (receta && receta.producto_terminado_id) {
                await actualizarCosteFabricacionEstandar(receta.producto_terminado_id, appConfig);
            }
            res.json({ mensaje: `Receta ID ${id} eliminada con éxito.` });
        } else {
            res.status(404).json({ error: "Receta no encontrada para eliminar." });
        }
    } catch (error) {
        console.error("Error en DELETE /api/recetas/:id:", error.message);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

// --- ProcesosFabricacion (Endpoints afectados por aplica_a_clientes) ---
app.post('/api/procesos-fabricacion', async (req, res) => {
    const procesoData = req.body;
    console.log('Node.js: POST /api/procesos-fabricacion', procesoData);
    if (!procesoData.producto_terminado_id || !procesoData.maquinaria_id || !procesoData.nombre_proceso || !procesoData.tiempo_estimado_horas) {
        return res.status(400).json({ error: "Datos de proceso incompletos." });
    }
    try {
        const id = await insertarProcesoFabricacion(procesoData);
        await actualizarCosteFabricacionEstandar(procesoData.producto_terminado_id, appConfig); 
        res.status(201).json({ mensaje: "Proceso de fabricación creado con éxito.", id });
    }
    catch (error) {
        console.error("Error en POST /api/procesos-fabricacion:", error.message);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

app.get('/api/procesos-fabricacion', async (req, res) => {
    const filtros = req.query;
    console.log('Node.js: GET /api/procesos-fabricacion', filtros);
    try {
        const procesos = await consultarProcesosFabricacion(filtros);
        res.json(procesos);
    } catch (error) {
        console.error("Error en GET /api/procesos-fabricacion:", error.message);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

app.get('/api/procesos-fabricacion/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    console.log('Node.js: GET /api/procesos-fabricacion/:id', id);
    if (isNaN(id)) {
        return res.status(400).json({ error: "ID de proceso de fabricación no válido." });
    }
    try {
        const proceso = await consultarProcesoFabricacionPorId(id);
        if (proceso) {
            res.json(proceso);
        } else {
            res.status(404).json({ error: "Proceso de fabricación no encontrado." });
        }
    } catch (error) {
        console.error("Error en GET /api/procesos-fabricacion/:id:", error.message);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

app.put('/api/procesos-fabricacion/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const updates = req.body;
    console.log('Node.js: PUT /api/procesos-fabricacion/:id', id, updates);

    if (isNaN(id) || Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "ID de proceso no válido o no se proporcionaron datos para actualizar." });
    }

    try {
        // Obtenemos la información del proceso ANTES de actualizar, para saber el producto_terminado_id
        const procesoOriginal = await consultarProcesoFabricacionPorId(id);
        if (!procesoOriginal) {
            return res.status(404).json({ error: "Proceso de fabricación no encontrado para actualizar." });
        }

        const changes = await actualizarProcesoFabricacion(id, updates);
        
        // Después de actualizar el proceso, recalculamos el coste del producto asociado
        // La función ahora maneja su propia conexión a la BD, por lo que no necesita `dbInstance`
        await actualizarCosteFabricacionEstandar(procesoOriginal.producto_terminado_id, appConfig);
        
        // Si el ID del producto también se cambió, actualizamos también el coste del nuevo producto asociado
        if (updates.producto_terminado_id && updates.producto_terminado_id !== procesoOriginal.producto_terminado_id) {
             await actualizarCosteFabricacionEstandar(updates.producto_terminado_id, appConfig);
        }

        res.json({ mensaje: `Proceso de fabricación ID ${id} actualizado y coste de producto recalculado.` });

    } catch (error) {
        console.error(`Error en PUT /api/procesos-fabricacion/:id:`, error.message, error.stack);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

app.delete('/api/procesos-fabricacion/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    console.log('Node.js: DELETE /api/procesos-fabricacion/:id', id);

    if (isNaN(id)) {
        return res.status(400).json({ error: "ID de proceso de fabricación no válido." });
    }

    try {
        // Obtenemos la información del proceso ANTES de eliminar, para saber el producto_terminado_id
        const proceso = await consultarProcesoFabricacionPorId(id);
        if (!proceso) {
             return res.status(404).json({ error: "Proceso de fabricación no encontrado para eliminar." });
        }
        
        const changes = await eliminarProcesoFabricacion(id);
        
        if (changes > 0) {
            // Después de eliminar el proceso, recalculamos el coste del producto que estaba asociado
            await actualizarCosteFabricacionEstandar(proceso.producto_terminado_id, appConfig);
            res.json({ mensaje: `Proceso de fabricación ID ${id} eliminado y coste de producto recalculado.` });
        } else {
             res.status(404).json({ error: "Proceso de fabricación no encontrado para eliminar (changes=0)." });
        }
    } catch (error) {
        console.error(`Error en DELETE /api/procesos-fabricacion/:id:`, error.message, error.stack);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});


// --- OrdenesProduccion (Endpoint de procesamiento afectado por la nueva lógica de stock) ---
app.post('/api/ordenes-produccion', async (req, res) => {
    const ordenData = req.body;
    console.log('Node.js: POST /api/ordenes-produccion', ordenData);
    if (!ordenData.producto_terminado_id || !ordenData.cantidad_a_producir || !ordenData.fecha) {
        return res.status(400).json({ error: "Datos de orden de producción incompletos." });
    }
    try {
        const id = await insertarOrdenProduccion(ordenData);
        res.status(201).json({ mensaje: "Orden de producción creada con éxito.", id });
    } catch (error) {
        console.error("Error en POST /api/ordenes-produccion:", error.message);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

app.get('/api/ordenes-produccion', async (req, res) => {
    const filtros = req.query;
    console.log('Node.js: GET /api/ordenes-produccion', filtros);
    try {
        const ordenes = await consultarOrdenesProduccion(filtros);
        res.json(ordenes);
    } catch (error) {
        console.error("Error en GET /api/ordenes-produccion:", error.message);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

app.get('/api/ordenes-produccion/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    console.log('Node.js: GET /api/ordenes-produccion/:id', id);
    if (isNaN(id)) {
        return res.status(400).json({ error: "ID de orden de producción no válido." });
    }
    try {
        const orden = await consultarOrdenProduccionPorId(id);
        if (orden) {
            res.json(orden);
        } else {
            res.status(404).json({ error: "Orden de producción no encontrada." });
        }
    } catch (error) {
        console.error("Error en GET /api/ordenes-produccion/:id:", error.message);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

app.put('/api/ordenes-produccion/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const updates = req.body;
    console.log('Node.js: PUT /api/ordenes-produccion/:id', id, updates);
    if (isNaN(id) || Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "ID de orden de producción no válido o no se proporcionaron datos para actualizar." });
    }
    try {
        const changes = await actualizarOrdenProduccion(id, updates);
        if (changes > 0) {
            res.json({ mensaje: `Orden de producción ID ${id} actualizada con éxito.` });
        } else {
            res.status(404).json({ error: "Orden de producción no encontrada para actualizar." });
        }
    } catch (error) {
        console.error("Error en PUT /api/ordenes-produccion/:id:", error.message);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

app.delete('/api/ordenes-produccion/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    console.log('Node.js: DELETE /api/ordenes-produccion/:id', id);
    if (isNaN(id)) {
        return res.status(400).json({ error: "ID de orden de producción no válido." });
    }
    try {
        const changes = await eliminarOrdenProduccion(id);
        if (changes > 0) {
            res.json({ mensaje: `Orden de producción ID ${id} eliminada con éxito.` });
        } else {
            res.status(404).json({ error: "Orden de producción no encontrada para eliminar." });
        }
    } catch (error) {
        console.error("Error en DELETE /api/ordenes-produccion/:id:", error.message);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

// Endpoint para procesar una orden de producción (consumir stock, generar PT)
app.post('/api/ordenes-produccion/:id/procesar', async (req, res) => {
    const ordenId = parseInt(req.params.id, 10);
    console.log(`Node.js: POST /api/ordenes-produccion/${ordenId}/procesar`);
    if (isNaN(ordenId)) {
        return res.status(400).json({ error: "ID de orden de producción no válido." });
    }
    try {
        const resultado = await procesarOrdenProduccion(ordenId, appConfig);
        res.json({ mensaje: "Orden de producción procesada con éxito.", ...resultado });
    } catch (error) {
        console.error(`Error en POST /api/ordenes-produccion/${ordenId}/procesar:`, error.message);
        res.status(500).json({ error: "Error al procesar la orden de producción.", detalle: error.message });
    }
});


// --- NUEVO ENDPOINT para obtener materiales genéricos (para frontend de recetas) ---
app.get('/api/materiales-genericos', async (req, res) => {
    console.log('Node.js: Se ha solicitado GET /api/materiales-genericos');
    try {
        const materiales = await obtenerMaterialesGenericos();
        res.json(materiales);
    } catch (error) {
        console.error("Error en GET /api/materiales-genericos:", error.message);
        res.status(500).json({ error: "Error interno del servidor al obtener materiales genéricos.", detalle: error.message });
    }
});

// backend-node/server.js
// ...
app.post('/api/calcular-coste-producto-temporal', async (req, res) => {
    // Esperar los nombres descriptivos del frontend
    const { material_tipo, espesor, ancho_producto_m, largo_producto_m } = req.body; 
    console.log(`Node.js: Solicitud de cálculo de coste temporal para Material: ${material_tipo}, Espesor: ${espesor}, Ancho Prod: ${ancho_producto_m}, Largo Prod: ${largo_producto_m}`);

    // Validar con los nuevos nombres
    if (!material_tipo || !espesor || 
        ancho_producto_m === undefined || isNaN(parseFloat(ancho_producto_m)) || parseFloat(ancho_producto_m) <= 0 ||
        largo_producto_m === undefined || isNaN(parseFloat(largo_producto_m)) || parseFloat(largo_producto_m) <= 0) {
        return res.status(400).json({ error: "Datos incompletos o inválidos para el cálculo de coste temporal. Se requieren material_tipo, espesor, ancho_producto_m y largo_producto_m válidos." });
    }

    try {
        // Pasar los valores parseados a la función de cálculo
        const costeCalculado = await calcularCosteMaterialEspecifico(
            material_tipo, 
            espesor, 
            parseFloat(ancho_producto_m), 
            parseFloat(largo_producto_m), 
            appConfig
        );
        res.json({ costeCalculado: costeCalculado });
    } catch (error) {
        console.error("Error en POST /api/calcular-coste-producto-temporal:", error.message, error.stack);
        res.status(500).json({ error: "Error interno del servidor al calcular el coste temporal.", detalle: error.message });
    }
});
// ...


// --- NUEVO ENDPOINT para calcular presupuesto de producto terminado (la funcionalidad central) ---
app.post('/api/calcular-presupuesto-producto-terminado', async (req, res) => {
    const { producto_id, cantidad, tipo_cliente, materiales_seleccionados_stock } = req.body;
    console.log(`Node.js: POST /api/calcular-presupuesto-producto-terminado para Producto ID: ${producto_id}, Cantidad: ${cantidad}, Cliente: ${tipo_cliente}`);

    if (!producto_id || !cantidad || !tipo_cliente || !materiales_seleccionados_stock) {
        return res.status(400).json({ error: "Datos incompletos. Se requieren producto_id, cantidad, tipo_cliente y materiales_seleccionados_stock." });
    }
    if (isNaN(cantidad) || quantity <= 0) {
        return res.status(400).json({ error: "La cantidad debe ser un número positivo." });
    }

    try {
        const resultadoPresupuesto = await calcularPresupuestoProductoTerminado(producto_id, cantidad, tipo_cliente, materiales_seleccionados_stock, appConfig);
        res.json(resultadoPresupuesto);
    } catch (error) {
        console.error("Error en POST /api/calcular-presupuesto-producto-terminado:", error.message, error.stack);
        res.status(500).json({ error: "Error al calcular el presupuesto.", detalle: error.message });
    }
});

// --- StockProductosTerminados ---
app.post('/api/stock-productos-terminados', async (req, res) => {
    const stockData = req.body;
    console.log('Node.js: POST /api/stock-productos-terminados', stockData);
    if (!stockData.producto_id || !stockData.cantidad_actual || !stockData.coste_unitario_final || !stockData.fecha_entrada_almacen) {
        return res.status(400).json({ error: "Datos de stock de producto terminado incompletos." });
    }
    try {
        const id = await insertarStockProductoTerminado(stockData);
        res.status(201).json({ mensaje: "Stock de producto terminado añadido con éxito.", id });
    } catch (error) {
        console.error("Error en POST /api/stock-productos-terminados:", error.message);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

app.get('/api/stock-productos-terminados', async (req, res) => {
    const filtros = req.query;
    console.log('Node.js: GET /api/stock-productos-terminados', filtros);
    try {
        const stock = await consultarStockProductosTerminados(filtros);
        res.json(stock);
    } catch (error) {
        console.error("Error en GET /api/stock-productos-terminados:", error.message);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

app.get('/api/stock-productos-terminados/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    console.log('Node.js: GET /api/stock-productos-terminados/:id', id);
    if (isNaN(id)) {
        return res.status(400).json({ error: "ID de stock de producto terminado no válido." });
    }
    try {
        const item = await consultarStockProductoTerminadoPorId(id);
        if (item) {
            res.json(item);
        } else {
            res.status(404).json({ error: "Stock de producto terminado no encontrado." });
        }
    } catch (error) {
        console.error("Error en GET /api/stock-productos-terminados/:id:", error.message);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

app.put('/api/stock-productos-terminados/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const updates = req.body;
    console.log('Node.js: PUT /api/stock-productos-terminados/:id', id, updates);
    if (isNaN(id) || Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "ID de stock de producto terminado no válido o no se proporcionaron datos para actualizar." });
    }
    try {
        const changes = await actualizarStockProductoTerminado(id, updates);
        if (changes > 0) {
            res.json({ mensaje: `Stock de producto terminado ID ${id} actualizado con éxito.` });
        } else {
            res.status(404).json({ error: "Stock de producto terminado no encontrado para actualizar." });
        }
    } catch (error) {
        console.error("Error en PUT /api/stock-productos-terminados/:id:", error.message);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

app.delete('/api/stock-productos-terminados/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    console.log('Node.js: DELETE /api/stock-productos-terminados/:id', id);
    if (isNaN(id)) {
        return res.status(400).json({ error: "ID de stock de producto terminado no válido." });
    }
    try {
        const changes = await eliminarStockProductoTerminado(id);
        if (changes > 0) {
            res.json({ mensaje: `Stock de producto terminado ID ${id} eliminado con éxito.` });
        } else {
            res.status(404).json({ error: "Stock de producto terminado no encontrado para eliminar." });
        }
    } catch (error) {
        console.error("Error en DELETE /api/stock-productos-terminados/:id:", error.message);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

// --- Endpoint para consultar referencias de stock con último coste (para auto-rellenar) ---
app.get('/api/referencias-stock-con-coste', async (req, res) => {
    console.log('Node.js: Se ha solicitado GET /api/referencias-stock-con-coste');
    try {
        const referencias = await consultarReferenciasStockConUltimoCoste();
        res.json(referencias);
    } catch (error) {
        console.error("Error en GET /api/referencias-stock-con-coste:", error.message);
        res.status(500).json({ error: "Error interno del servidor al obtener referencias de stock con coste.", detalle: error.message });
    }
});


// --- ENDPOINTS PARA CONFIGURACIÓN ---
app.get('/api/configuracion', async (req, res) => {
    console.log('Node.js: Se ha solicitado GET /api/configuracion');
    try {
        loadConfig(); // Recargar por si ha habido cambios externos
        res.json(appConfig);
    } catch (error) {
        console.error("Error en GET /api/configuracion:", error.message);
        res.status(500).json({ error: "Error interno del servidor al obtener la configuración.", detalle: error.message });
    }
});

app.put('/api/configuracion', async (req, res) => {
    const updates = req.body;
    console.log('Node.js: Se ha solicitado PUT /api/configuracion', updates);
    try {
        const currentConfig = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
        const newConfig = { ...currentConfig, ...updates };
        fs.writeFileSync(configFilePath, JSON.stringify(newConfig, null, 2), 'utf8');
        
        loadConfig(); // Recargar la configuración en memoria después de guardar
        
        res.json({ mensaje: "Configuración actualizada con éxito." });
    } catch (error) {
        console.error("Error en PUT /api/configuracion:", error.message);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

// --- INICIO DEL SERVIDOR ---
// Esta es la parte crucial que mantiene el servidor escuchando peticiones.
app.listen(PORT, () => {
    console.log(`Servidor Node.js API escuchando en http://localhost:${PORT}`);
});

// Cerrar la conexión a la base de datos cuando la aplicación se cierra
// Esto es importante para un cierre limpio de la base de datos.
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            return console.error(err.message);
        }
        console.log('Conexión a la base de datos SQLite cerrada.');
        process.exit(0); // Termina el proceso de Node.js
    });
});
