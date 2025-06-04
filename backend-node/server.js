// backend-node/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// --- Importar funciones de db_operations.js ---
const {
    consultarStockMateriasPrimas,
    consultarItemStockPorId,
    procesarNuevoPedido,
    consultarListaPedidos,
    obtenerDetallesCompletosPedido,
    actualizarEstadoStockItem,
    eliminarPedidoCompleto,

    // Productos Terminados
    insertarProductoTerminado,
    consultarProductosTerminados,
    consultarProductoTerminadoPorId,
    actualizarProductoTerminado,
    eliminarProductoTerminado,

    // Maquinaria
    insertarMaquinaria,
    consultarMaquinaria,
    consultarMaquinariaPorId,
    actualizarMaquinaria,
    eliminarMaquinaria,

    // Recetas (Afectadas por refactor a genérico)
    insertarReceta,
    consultarRecetas,
    consultarRecetaPorId,
    actualizarReceta,
    eliminarReceta,

    // Procesos Fabricación (Afectados por campo aplica_a_clientes)
    insertarProcesoFabricacion,
    consultarProcesosFabricacion,
    consultarProcesoFabricacionPorId,
    actualizarProcesoFabricacion,
    eliminarProcesoFabricacion,

    // Órdenes Producción (Afectadas por el consumo de stock genérico)
    insertarOrdenProduccion,
    consultarOrdenesProduccion,
    consultarOrdenProduccionPorId,
    actualizarOrdenProduccion,
    eliminarOrdenProduccion,
    procesarOrdenProduccion, 

    // Stock Productos Terminados
    insertarStockProductoTerminado,
    consultarStockProductosTerminados,
    consultarStockProductoTerminadoPorId,
    actualizarStockProductoTerminado,
    eliminarStockProductoTerminado,

    actualizarCosteFabricacionEstandar, // Para recalcular el coste estándar

    consultarReferenciasStockConUltimoCoste, // Para auto-rellenar productos terminados
    consultarStockComponentes, 
    obtenerConfiguracion,
    actualizarConfiguracion,

    // NUEVAS IMPORTACIONES PARA EL REFACTOR
    obtenerMaterialesGenericos, // Para el nuevo endpoint /api/materiales-genericos
    calcularPresupuestoProductoTerminado // Para el nuevo endpoint /api/calcular-presupuesto-producto-terminado
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
app.use(cors());
app.use(express.json());

// --- Configuración de la Base de Datos SQLite ---
const almacenDir = path.resolve(__dirname, 'almacen');
const dbPath = path.resolve(almacenDir, 'almacen.db');

if (!fs.existsSync(almacenDir)){
    fs.mkdirSync(almacenDir, { recursive: true });
    console.log(`Directorio '${almacenDir}' creado.`);
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error al conectar/crear la base de datos SQLite:", err.message);
    } else {
        console.log("Conectado a la base de datos SQLite.");
        db.exec('PRAGMA foreign_keys = ON;', (err) => {
            if (err) console.error("Error al habilitar foreign keys en conexión principal:", err.message);
            else console.log("Foreign keys habilitadas.");
        });
        crearTablasSiNoExisten();
    }
});


function crearTablasSiNoExisten() {
    db.serialize(() => {
        console.log("Verificando/Creando tablas esenciales...");

        db.run(`CREATE TABLE IF NOT EXISTS PedidosProveedores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero_factura TEXT NOT NULL UNIQUE,
            proveedor TEXT,
            fecha_pedido TEXT,
            fecha_llegada TEXT,
            origen_tipo TEXT NOT NULL CHECK(origen_tipo IN ('CONTENEDOR', 'NACIONAL')),
            observaciones TEXT,
            valor_conversion REAL
        )`, (err) => {
            if (err) console.error("Error creando tabla PedidosProveedores:", err.message);
            else console.log("Tabla PedidosProveedores verificada/creada.");
        });

        db.run(`CREATE TABLE IF NOT EXISTS LineasPedido (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER NOT NULL,
            descripcion_original TEXT,
            cantidad_original REAL NOT NULL,
            unidad_original TEXT NOT NULL,
            precio_unitario_original REAL NOT NULL,
            moneda_original TEXT CHECK(moneda_original IN ('USD', 'EUR')),
            FOREIGN KEY(pedido_id) REFERENCES PedidosProveedores(id) ON DELETE CASCADE
        )`, (err) => {
            if (err) console.error("Error creando tabla LineasPedido:", err.message);
            else console.log("Tabla LineasPedido verificada/creada.");
        });

        db.run(`CREATE TABLE IF NOT EXISTS GastosPedido (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER NOT NULL,
            tipo_gasto TEXT CHECK(tipo_gasto IN ('SUPLIDOS', 'EXENTO', 'SUJETO', 'NACIONAL', 'OTRO')),
            descripcion TEXT NOT NULL,
            coste_eur REAL NOT NULL,
            FOREIGN KEY(pedido_id) REFERENCES PedidosProveedores(id) ON DELETE CASCADE
        )`, (err) => {
            if (err) console.error("Error creando tabla GastosPedido:", err.message);
            else console.log("Tabla GastosPedido verificada/creada.");
        });

        db.run(`CREATE TABLE IF NOT EXISTS StockMateriasPrimas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER,
            material_tipo TEXT NOT NULL CHECK(material_tipo IN ('GOMA', 'PVC', 'FIELTRO', 'MAQUINARIA', 'COMPONENTE')),
            subtipo_material TEXT,
            referencia_stock TEXT NOT NULL UNIQUE, -- REFERENCIA_STOCK AHORA ES ÚNICA
            fecha_entrada_almacen TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'DISPONIBLE' CHECK(status IN ('DISPONIBLE', 'AGOTADO', 'EMPEZADA', 'DESCATALOGADO')),
            espesor TEXT,
            ancho REAL,
            largo_inicial REAL,
            largo_actual REAL,
            unidad_medida TEXT NOT NULL DEFAULT 'm',
            coste_unitario_final REAL,
            color TEXT,
            ubicacion TEXT,
            notas TEXT,
            origen_factura TEXT,
            peso_total_kg REAL,
            FOREIGN KEY(pedido_id) REFERENCES PedidosProveedores(id) ON DELETE SET NULL
            -- Eliminada la restricción UNIQUE por (referencia_stock, subtipo_material, espesor, ancho, color)
            -- Ahora la referencia_stock es el identificador único del tipo de bobina
        )`, (err) => {
            if (err) console.error("Error creando tabla StockMateriasPrimas:", err.message);
            else console.log("Tabla StockMateriasPrimas verificada/creada.");
        });


        db.run(`CREATE TABLE IF NOT EXISTS StockComponentes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            componente_ref TEXT NOT NULL UNIQUE,
            descripcion TEXT,
            pedido_id INTEGER,
            cantidad_inicial REAL NOT NULL,
            cantidad_actual REAL NOT NULL,
            unidad_medida TEXT NOT NULL DEFAULT 'ud',
            coste_unitario_final REAL NOT NULL,
            fecha_entrada_almacen TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'DISPONIBLE' CHECK(status IN ('DISPONIBLE', 'AGOTADO', 'RESERVADO', 'DESCATALOGADO')),
            ubicacion TEXT,
            notas TEXT,
            origen_factura TEXT,
            FOREIGN KEY(pedido_id) REFERENCES PedidosProveedores(id) ON DELETE SET NULL
        )`, (err) => {
            if (err) console.error("Error creando tabla StockComponentes:", err.message);
            else console.log("Tabla StockComponentes verificada/creada.");
        });

        // --- NUEVAS TABLAS PARA LA FASE 5 (Revisado con nuevos campos en Recetas) ---

        db.run(`CREATE TABLE IF NOT EXISTS ProductosTerminados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            referencia TEXT NOT NULL UNIQUE,
            nombre TEXT NOT NULL,
            descripcion TEXT,
            unidad_medida TEXT NOT NULL DEFAULT 'unidad',
            coste_fabricacion_estandar REAL,
            margen_venta_default REAL,
            precio_venta_sugerido REAL,
            coste_extra_unitario REAL,
            fecha_creacion TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'ACTIVO' CHECK(status IN ('ACTIVO', 'DESCATALOGADO', 'OBSOLETO'))
        )`, (err) => {
            if (err) console.error("Error creando tabla ProductosTerminados:", err.message);
            else console.log("Tabla ProductosTerminados verificada/creada.");
        });

        db.run(`CREATE TABLE IF NOT EXISTS Maquinaria (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            descripcion TEXT,
            coste_adquisicion REAL,
            coste_hora_operacion REAL
        )`, (err) => {
            if (err) console.error("Error creando tabla Maquinaria:", err.message);
            else console.log("Tabla Maquinaria verificada/creada.");
        });

        // MODIFICADA: Tabla Recetas para ser genérica
        db.run(`CREATE TABLE IF NOT EXISTS Recetas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            producto_terminado_id INTEGER NOT NULL,
            
            -- Material genérico (bobinas)
            material_tipo_generico TEXT CHECK(material_tipo_generico IN ('GOMA', 'PVC', 'FIELTRO')),
            subtipo_material_generico TEXT,
            espesor_generico TEXT,
            ancho_generico REAL,
            color_generico TEXT,

            -- Componente genérico
            componente_ref_generico TEXT,

            cantidad_requerida REAL NOT NULL,
            unidad_medida_requerida TEXT NOT NULL,
            unidades_por_ancho_material REAL, -- Cuántas unidades de PT caben en el ancho de la MP
            peso_por_unidad_producto REAL, -- Peso estimado de una unidad de producto terminado
            notas TEXT,
            
            FOREIGN KEY(producto_terminado_id) REFERENCES ProductosTerminados(id) ON DELETE CASCADE,
            CHECK (
                (material_tipo_generico IS NOT NULL AND componente_ref_generico IS NULL) OR
                (material_tipo_generico IS NULL AND componente_ref_generico IS NOT NULL)
            ) -- Asegura que solo uno de los tipos genéricos esté presente
        )`, (err) => {
            if (err) console.error("Error creando tabla Recetas:", err.message);
            else console.log("Tabla Recetas verificada/creada.");
        });

        // MODIFICADA: Tabla ProcesosFabricacion (añadido campo aplica_a_clientes)
        db.run(`CREATE TABLE IF NOT EXISTS ProcesosFabricacion (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            producto_terminado_id INTEGER NOT NULL,
            maquinaria_id INTEGER NOT NULL,
            nombre_proceso TEXT NOT NULL,
            tiempo_estimado_horas REAL NOT NULL,
            aplica_a_clientes TEXT, -- NUEVO CAMPO: 'FABRICANTE', 'FINAL,FABRICANTE', 'ALL', etc.
            FOREIGN KEY(producto_terminado_id) REFERENCES ProductosTerminados(id) ON DELETE CASCADE,
            FOREIGN KEY(maquinaria_id) REFERENCES Maquinaria(id) ON DELETE RESTRICT
        )`, (err) => {
            if (err) console.error("Error creando tabla ProcesosFabricacion:", err.message);
            else console.log("Tabla ProcesosFabricacion verificada/creada.");
        });

        db.run(`CREATE TABLE IF NOT EXISTS OrdenesProduccion (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            producto_terminado_id INTEGER NOT NULL,
            cantidad_a_producir REAL NOT NULL,
            fecha TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK(status IN ('PENDIENTE', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA')),
            coste_real_fabricacion REAL,
            observaciones TEXT,
            FOREIGN KEY(producto_terminado_id) REFERENCES ProductosTerminados(id) ON DELETE RESTRICT
        )`, (err) => {
            if (err) console.error("Error creando tabla OrdenesProduccion:", err.message);
            else console.log("Tabla OrdenesProduccion verificada/creada.");
        });

        db.run(`CREATE TABLE IF NOT EXISTS StockProductosTerminados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            producto_id INTEGER NOT NULL,
            orden_produccion_id INTEGER,
            cantidad_actual REAL NOT NULL,
            unidad_medida TEXT NOT NULL DEFAULT 'unidad',
            coste_unitario_final REAL NOT NULL,
            fecha_entrada_almacen TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'DISPONIBLE' CHECK(status IN ('DISPONIBLE', 'RESERVADO', 'AGOTADO', 'DAÑADO')),
            ubicacion TEXT,
            notas TEXT,
            FOREIGN KEY(producto_id) REFERENCES ProductosTerminados(id) ON DELETE RESTRICT,
            FOREIGN KEY(orden_produccion_id) REFERENCES OrdenesProduccion(id) ON DELETE SET NULL
        )`, (err) => {
            if (err) console.error("Error creando tabla StockProductosTerminados:", err.message);
            else console.log("Tabla StockProductosTerminados verificada/creada.");
        });

        console.log("Verificación/Creación de todas las tablas esenciales completada.");
    });
}


// --- Rutas de la API (Endpoints existentes) ---
app.get('/api/estado', (req, res) => {
    console.log('Node.js: Se ha solicitado GET /api/estado');
    res.json({ estado: 'Servidor Backend Node.js funcionando correctamente!' });
});

app.get('/api/stock', async (req, res) => {
    console.log('Node.js: Se ha solicitado GET /api/stock');
    try {
        const filtros = req.query;
        console.log('Node.js: Filtros recibidos en /api/stock:', filtros);
        const stockItems = await consultarStockMateriasPrimas(filtros);
        console.log(`Node.js: Devolviendo ${stockItems.length} items de stock (con filtros aplicados).`);
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

// Lógica de cálculo de costes de línea (se mantiene igual, no impactada por receta genérica)
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
        // Solo incluir gastos SUPLIDOS que NO contengan la palabra "IVA" en la descripción
        if (gasto.tipo_gasto && gasto.tipo_gasto.toUpperCase() === 'SUPLIDOS' &&
            gasto.descripcion && !gasto.descripcion.toUpperCase().includes('IVA')) {
            totalGastosRepercutibles += (parseFloat(gasto.coste_eur) || 0);
        }
    });

    const porcentajeGastosRepercutibles = costeTotalPedidoSinGastosEnMonedaOriginal > 0
        ? totalGastosRepercutibles / costeTotalPedidoSinGastosEnMonedaOriginal
        : 0;

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
app.get('/api/tarifa-venta', async (req, res) => {
    const { tipo_tarifa } = req.query;

    console.log(`Node.js: Se ha solicitado GET /api/tarifa-venta para tipo_tarifa: ${tipo_tarifa}`);

    if (!tipo_tarifa) {
        return res.status(400).json({ error: "El parámetro 'tipo_tarifa' es requerido." });
    }
    const tipoTarifaNormalizado = tipo_tarifa.toLowerCase();

    const tiposTarifaValidos = ['final', 'fabricante', 'metrajes', 'intermediario'];
    if (!tiposTarifaValidos.includes(tipoTarifaNormalizado)) {
        return res.status(400).json({ error: `Valor de 'tipo_tarifa' no válido. Valores permitidos: ${tiposTarifaValidos.join(', ')}.` });
    }

    try {
        const configuraciones = appConfig;
        // Obtener todos los productos terminados activos
        const productosTerminados = await consultarProductosTerminados({ status: 'ACTIVO' });

        if (productosTerminados.length === 0) {
            return res.json([]);
        }

        const tarifaVenta = [];
        for (const producto of productosTerminados) {
            const claveMargen = `margen_default_${tipoTarifaNormalizado}`;
            let margenAplicado = configuraciones[claveMargen];

            if (margenAplicado === undefined) {
                console.warn(`Margen no encontrado para la clave '${claveMargen}'. Usando 0.`);
                margenAplicado = 0;
            }

            margenAplicado = parseFloat(margenAplicado);
            if (isNaN(margenAplicado)) {
                console.warn(`Margen para '${claveMargen}' no es numérico ('${configuraciones[claveMargen]}'). Usando 0.`);
                margenAplicado = 0;
            }

            let costeBase = parseFloat(producto.coste_fabricacion_estandar || 0);
            let costeAdicionalMetraje = 0;
            
            // Aquí se podría aplicar lógica adicional si un producto terminado tiene un "tipo" que justifique un coste adicional
            // por metro para tarifas de metrajes (aunque coste_mano_obra_por_metro_metraje está pensado para materia prima)
            // Por ahora, asumimos que el coste_fabricacion_estandar ya es el "coste antes de margen" para el PT.

            const precioVenta = costeBase * (1 + margenAplicado);

            tarifaVenta.push({
                producto_referencia: producto.referencia,
                producto_nombre: producto.nombre,
                unidad_medida: producto.unidad_medida,
                coste_base_fabricacion: parseFloat(costeBase.toFixed(4)),
                margen_aplicado: parseFloat(margenAplicado.toFixed(4)),
                precio_venta_aplicado_margen: parseFloat(precioVenta.toFixed(4))
            });
        }

        console.log(`Tarifa de venta de Productos Terminados generada para tipo_tarifa: ${tipoTarifaNormalizado}`);
        res.json(tarifaVenta);

    } catch (error) {
        console.error("Error en el endpoint /api/tarifa-venta:", error.message, error.stack);
        res.status(500).json({ error: "Error interno del servidor al generar la tarifa de venta.", detalle: error.message });
    }
});


// --- NUEVOS ENDPOINTS PARA LA FASE 5 (ACTUALIZADOS) ---

// --- ProductosTerminados ---
app.post('/api/productos-terminados', async (req, res) => {
    const productoData = req.body;
    console.log('Node.js: POST /api/productos-terminados', productoData);
    // Ya no se requiere margen, precio sugerido, coste_extra_unitario en la creación (se gestionan aparte o calculan)
    if (!productoData.referencia || !productoData.nombre) {
        return res.status(400).json({ error: "Referencia y nombre del producto son requeridos." });
    }
    // Aseguramos que la unidad_medida sea 'unidad' por defecto si no se envía o está vacía
    if (!productoData.unidad_medida) {
        productoData.unidad_medida = 'unidad';
    }

    try {
        const id = await insertarProductoTerminado(productoData);
        res.status(201).json({ mensaje: "Producto terminado creado con éxito.", id });
    } catch (error) {
        console.error("Error en POST /api/productos-terminados:", error.message);
        if (error.message.includes("ya existe")) {
            return res.status(409).json({ error: error.message });
        }
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

// ... (GET/PUT/DELETE /api/productos-terminados/:id se mantienen, ya que los campos existen en DB)

// --- Maquinaria (No cambia significativamente aquí) ---

// --- Recetas (Endpoints de Recetas: ahora trabajan con recetas genéricas) ---
app.post('/api/recetas', async (req, res) => {
    const recetaData = req.body;
    console.log('Node.js: POST /api/recetas', recetaData);
    // Validar que se reciba información genérica de material O componente
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
// ... (GET, PUT, DELETE de ProcesosFabricacion se mantienen, pero su lógica en db_operations.js cambia)

// --- OrdenesProduccion (Endpoint de procesamiento afectado por la nueva lógica de stock) ---

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

// --- NUEVO ENDPOINT para calcular presupuesto de producto terminado (la funcionalidad central) ---
app.post('/api/calcular-presupuesto-producto-terminado', async (req, res) => {
    const { producto_id, cantidad, tipo_cliente, materiales_seleccionados_stock } = req.body;
    console.log(`Node.js: POST /api/calcular-presupuesto-producto-terminado para Producto ID: ${producto_id}, Cantidad: ${cantidad}, Cliente: ${tipo_cliente}`);

    if (!producto_id || !cantidad || !tipo_cliente || !materiales_seleccionados_stock) {
        return res.status(400).json({ error: "Datos incompletos. Se requieren producto_id, cantidad, tipo_cliente y materiales_seleccionados_stock." });
    }
    if (isNaN(cantidad) || cantidad <= 0) {
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


// ... (StockProductosTerminados, consultarReferenciasStockConUltimoCoste se mantienen)

// --- ENDPOINTS PARA CONFIGURACIÓN (se mantienen) ---
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
        
        loadConfig(); 
        
        res.json({ mensaje: "Configuración actualizada con éxito." });
    } catch (error) {
        console.error("Error en PUT /api/configuracion:", error.message);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});


app.listen(PORT, () => {
    console.log(`Servidor Node.js API escuchando en http://localhost:${PORT}`);
});

// Cerrar la conexión a la base de datos cuando la aplicación se cierra
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            return console.error(err.message);
        }
        console.log('Conexión a la base de datos SQLite cerrada.');
        process.exit(0);
    });
});
