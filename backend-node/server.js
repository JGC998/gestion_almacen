const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs'); // Para leer el archivo config.json y crear el directorio si no existe

// --- Importar funciones de db_operations.js ---
const {
    consultarStockMateriasPrimas,
    consultarItemStockPorId,
    procesarNuevoPedido,
    consultarListaPedidos,
    obtenerDetallesCompletosPedido,
    actualizarEstadoStockItem,
    eliminarPedidoCompleto,
    // REMOVIDA: obtenerConfiguraciones, // Ya no se importa desde db_operations

    // Nuevas importaciones para la Fase 5
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
    procesarOrdenProduccion, // Función clave para la producción

    insertarStockProductoTerminado, // Aunque no haya CRUD completo, se usa en procesarOrdenProduccion
    consultarStockProductosTerminados, // Para la vista de stock de PT
    consultarStockProductoTerminadoPorId,
    actualizarStockProductoTerminado,
    eliminarStockProductoTerminado,

    actualizarCosteFabricacionEstandar, // Para recalcular el coste estándar

    consultarReferenciasStockConUltimoCoste // Nueva importación
} = require('./db_operations.js');


const app = express();
const PORT = process.env.PORT || 5002;

// --- Cargar configuraciones desde config.json ---
let appConfig = {};
try {
    const configPath = path.resolve(__dirname, 'config.json');
    const configFile = fs.readFileSync(configPath, 'utf8');
    appConfig = JSON.parse(configFile);
    console.log("Configuraciones cargadas desde config.json:", appConfig);
} catch (error) {
    console.error("Error al cargar config.json. Asegúrate de que el archivo existe y es válido.", error.message);
    // Establecer valores por defecto si el archivo no se puede cargar
    appConfig = {
        margen_default_final: 0.50,
        margen_default_fabricante: 0.30,
        margen_default_metrajes: 0.60,
        margen_default_intermediario: 0.20, // Nuevo margen por defecto
        coste_mano_obra_default: 20.00,
        coste_mano_obra_por_metro_metraje: 0.15 // Nuevo coste por defecto
    };
    console.warn("Usando configuraciones por defecto.");
}


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
            referencia_stock TEXT NOT NULL,
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
            FOREIGN KEY(pedido_id) REFERENCES PedidosProveedores(id) ON DELETE SET NULL,
            UNIQUE (referencia_stock, subtipo_material, espesor, ancho, color)
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

        // REMOVIDA: Tabla Configuracion
        // db.run(`CREATE TABLE IF NOT EXISTS Configuracion ( ... )`)

        // --- NUEVAS TABLAS PARA LA FASE 5 ---

        db.run(`CREATE TABLE IF NOT EXISTS ProductosTerminados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            referencia TEXT NOT NULL UNIQUE,
            nombre TEXT NOT NULL,
            descripcion TEXT,
            unidad_medida TEXT NOT NULL DEFAULT 'unidad',
            coste_fabricacion_estandar REAL,
            margen_venta_default REAL,
            precio_venta_sugerido REAL,
            coste_extra_unitario REAL, -- Añadido coste_extra_unitario
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
            coste_hora_operacion REAL -- Se eliminan vida_util_horas y depreciacion_hora
        )`, (err) => {
            if (err) console.error("Error creando tabla Maquinaria:", err.message);
            else console.log("Tabla Maquinaria verificada/creada.");
        });

        db.run(`CREATE TABLE IF NOT EXISTS Recetas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            producto_terminado_id INTEGER NOT NULL,
            material_id INTEGER,
            componente_id INTEGER,
            -- Se eliminan cantidad_requerida y unidad_medida_requerida
            notas TEXT,
            FOREIGN KEY(producto_terminado_id) REFERENCES ProductosTerminados(id) ON DELETE CASCADE,
            FOREIGN KEY(material_id) REFERENCES StockMateriasPrimas(id) ON DELETE CASCADE,
            FOREIGN KEY(componente_id) REFERENCES StockComponentes(id) ON DELETE CASCADE,
            UNIQUE (producto_terminado_id, material_id),
            UNIQUE (producto_terminado_id, componente_id)
        )`, (err) => {
            if (err) console.error("Error creando tabla Recetas:", err.message);
            else console.log("Tabla Recetas verificada/creada.");
        });

        db.run(`CREATE TABLE IF NOT EXISTS ProcesosFabricacion (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            producto_terminado_id INTEGER NOT NULL,
            maquinaria_id INTEGER NOT NULL,
            nombre_proceso TEXT NOT NULL,
            tiempo_estimado_horas REAL NOT NULL,
            -- Se elimina coste_mano_obra_hora, ahora es global
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
            fecha TEXT NOT NULL, -- Un solo campo de fecha
            status TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK(status IN ('PENDIENTE', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA')), -- Mantener status interno para lógica
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

// Lógica de cálculo de costes de línea (modificada para gastos repercutibles)
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
        // Precio por metro lineal en euros = (precio metro lineal en dolares * valor de conversion) * (1 + porcentaje de gasto repercutible)
        // Asumiendo que 'precio_unitario_eur' ya es el precio por metro lineal en EUR (si la moneda original no era EUR y se convirtió)
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


app.get('/api/tarifa-venta', async (req, res) => {
    const { tipo_tarifa } = req.query;

    console.log(`Node.js: Se ha solicitado GET /api/tarifa-venta para tipo_tarifa: ${tipo_tarifa}`);

    if (!tipo_tarifa) {
        return res.status(400).json({ error: "El parámetro 'tipo_tarifa' es requerido." });
    }
    const tipoTarifaNormalizado = tipo_tarifa.toLowerCase();

    const tiposTarifaValidos = ['final', 'fabricante', 'metrajes', 'intermediario']; // Añadido 'intermediario'
    if (!tiposTarifaValidos.includes(tipoTarifaNormalizado)) {
        return res.status(400).json({ error: `Valor de 'tipo_tarifa' no válido. Valores permitidos: ${tiposTarifaValidos.join(', ')}.` });
    }

    try {
        // Las configuraciones ahora se obtienen de appConfig
        const configuraciones = appConfig;
        const todosLosStockItems = await consultarStockMateriasPrimas();
        const stockItemsRelevantes = todosLosStockItems.filter(
            item => item.status === 'DISPONIBLE' || item.status === 'EMPEZADA'
        );

        if (stockItemsRelevantes.length === 0) {
            return res.json([]);
        }

        const gruposDeStock = {};
        stockItemsRelevantes.forEach(item => {
            const material = (item.material_tipo || 'DESCONOCIDO').toUpperCase();
            const subtipo = item.subtipo_material || 'N/A';
            const espesor = item.espesor || 'N/A';
            const ancho = item.ancho || 'N/A'; // Incluir ancho
            const claveGrupo = `${material}-${subtipo}-${espesor}-${ancho}`; // Clave de grupo más completa

            if (!gruposDeStock[claveGrupo]) {
                gruposDeStock[claveGrupo] = {
                    material_tipo: material,
                    subtipo_material: subtipo,
                    espesor: espesor,
                    ancho: ancho, // Añadir ancho al grupo
                    items: []
                };
            }
            gruposDeStock[claveGrupo].items.push(item);
        });

        const tarifaVenta = [];
        for (const claveGrupo in gruposDeStock) {
            const grupo = gruposDeStock[claveGrupo];
            let maxCost = 0;
            grupo.items.forEach(item => {
                if (item.coste_unitario_final > maxCost) {
                    maxCost = item.coste_unitario_final;
                }
            });

            const claveMargen = `margen_default_${tipoTarifaNormalizado}`;
            let margenAplicado = appConfig[claveMargen]; // Usar appConfig

            if (margenAplicado === undefined) {
                console.warn(`Margen no encontrado para la clave '${claveMargen}'. Usando 0.`);
                margenAplicado = 0;
            }

            margenAplicado = parseFloat(margenAplicado);
            if (isNaN(margenAplicado)) {
                console.warn(`Margen para '${claveMargen}' no es numérico ('${appConfig[claveMargen]}'). Usando 0.`);
                margenAplicado = 0;
            }

            let costeAdicionalMetraje = 0;
            // Aplicar coste de mano de obra por metro para metrajes si el material es relevante
            if (tipoTarifaNormalizado === 'metrajes' && ['GOMA', 'PVC', 'FIELTRO'].includes(grupo.material_tipo)) {
                costeAdicionalMetraje = parseFloat(appConfig.coste_mano_obra_por_metro_metraje || 0);
            }

            const precioVenta = (maxCost + costeAdicionalMetraje) * (1 + margenAplicado); // Sumar coste adicional antes de margen

            tarifaVenta.push({
                material_tipo: grupo.material_tipo,
                subtipo_material: grupo.subtipo_material,
                espesor: grupo.espesor,
                ancho: grupo.ancho,
                precio_metro_lineal_antes_margen: parseFloat(maxCost.toFixed(4)),
                margen_aplicado: parseFloat(margenAplicado.toFixed(4)),
                precio_venta_aplicado_margen: parseFloat(precioVenta.toFixed(4))
            });
        }

        console.log(`Tarifa de venta generada para tipo_tarifa: ${tipoTarifaNormalizado}`);
        res.json(tarifaVenta);

    } catch (error) {
        console.error("Error en el endpoint /api/tarifa-venta:", error.message, error.stack);
        res.status(500).json({ error: "Error interno del servidor al generar la tarifa de venta.", detalle: error.message });
    }
});

// --- NUEVOS ENDPOINTS PARA LA FASE 5 ---

// --- ProductosTerminados ---
app.post('/api/productos-terminados', async (req, res) => {
    const productoData = req.body;
    console.log('Node.js: POST /api/productos-terminados', productoData);
    if (!productoData.referencia || !productoData.nombre) {
        return res.status(400).json({ error: "Referencia y nombre del producto son requeridos." });
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

app.get('/api/productos-terminados/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    console.log('Node.js: GET /api/productos-terminados/:id', id);
    if (isNaN(id)) {
        return res.status(400).json({ error: "ID de producto no válido." });
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

app.put('/api/productos-terminados/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const updates = req.body;
    console.log('Node.js: PUT /api/productos-terminados/:id', id, updates);
    if (isNaN(id) || Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "ID de producto no válido o no se proporcionaron datos para actualizar." });
    }
    try {
        const changes = await actualizarProductoTerminado(id, updates);
        if (changes > 0) {
            // Recalcular coste de fabricación estándar si se actualiza el producto
            await actualizarCosteFabricacionEstandar(id, appConfig); // Pasar appConfig
            res.json({ mensaje: `Producto terminado ID ${id} actualizado con éxito.` });
        } else {
            res.status(404).json({ error: "Producto terminado no encontrado para actualizar." });
        }
    } catch (error) {
        console.error("Error en PUT /api/productos-terminados/:id:", error.message);
        if (error.message.includes("ya existe")) {
            return res.status(409).json({ error: error.message });
        }
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

app.delete('/api/productos-terminados/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    console.log('Node.js: DELETE /api/productos-terminados/:id', id);
    if (isNaN(id)) {
        return res.status(400).json({ error: "ID de producto no válido." });
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

// --- Recetas ---
app.post('/api/recetas', async (req, res) => {
    const recetaData = req.body;
    console.log('Node.js: POST /api/recetas', recetaData);
    if (!recetaData.producto_terminado_id || (!recetaData.material_id && !recetaData.componente_id)) {
        return res.status(400).json({ error: "Datos de receta incompletos: ID de producto y un material/componente son requeridos." });
    }
    try {
        const id = await insertarReceta(recetaData);
        // Recalcular coste de fabricación del producto terminado al añadir/actualizar receta
        await actualizarCosteFabricacionEstandar(recetaData.producto_terminado_id, appConfig); // Pasar appConfig
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
        // Recalcular coste de fabricación del producto terminado
        if (updates.producto_terminado_id) { // Asegurarse de que el ID del producto esté presente
            await actualizarCosteFabricacionEstandar(updates.producto_terminado_id, appConfig); // Pasar appConfig
        } else if (changes > 0) { // Si se actualizó y no se cambió el producto, buscar el producto original
            const recetaOriginal = await consultarRecetaPorId(id);
            if (recetaOriginal && recetaOriginal.producto_terminado_id) {
                await actualizarCosteFabricacionEstandar(recetaOriginal.producto_terminado_id, appConfig); // Pasar appConfig
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
        const receta = await consultarRecetaPorId(id); // Obtener la receta antes de borrar para recalcular
        const changes = await eliminarReceta(id);
        if (changes > 0) {
            if (receta && receta.producto_terminado_id) {
                await actualizarCosteFabricacionEstandar(receta.producto_terminado_id, appConfig); // Pasar appConfig
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

// --- ProcesosFabricacion ---
app.post('/api/procesos-fabricacion', async (req, res) => {
    const procesoData = req.body;
    console.log('Node.js: POST /api/procesos-fabricacion', procesoData);
    if (!procesoData.producto_terminado_id || !procesoData.maquinaria_id || !procesoData.nombre_proceso || !procesoData.tiempo_estimado_horas) {
        return res.status(400).json({ error: "Datos de proceso incompletos." });
    }
    try {
        const id = await insertarProcesoFabricacion(procesoData);
        // Recalcular coste de fabricación del producto terminado
        await actualizarCosteFabricacionEstandar(procesoData.producto_terminado_id, appConfig); // Pasar appConfig
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
        return res.status(400).json({ error: "ID de proceso no válido." });
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
        const changes = await actualizarProcesoFabricacion(id, updates);
        if (updates.producto_terminado_id) { // Asegurarse de que el ID del producto esté presente
            await actualizarCosteFabricacionEstandar(updates.producto_terminado_id, appConfig); // Pasar appConfig
        } else if (changes > 0) { // Si se actualizó y no se cambió el producto, buscar el producto original
            const procesoOriginal = await consultarProcesoFabricacionPorId(id);
            if (procesoOriginal && procesoOriginal.producto_terminado_id) {
                await actualizarCosteFabricacionEstandar(procesoOriginal.producto_terminado_id, appConfig); // Pasar appConfig
            }
        }
        res.json({ mensaje: `Proceso de fabricación ID ${id} actualizado con éxito.` });
    } catch (error) {
        console.error("Error en PUT /api/procesos-fabricacion/:id:", error.message);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

app.delete('/api/procesos-fabricacion/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    console.log('Node.js: DELETE /api/procesos-fabricacion/:id', id);
    if (isNaN(id)) {
        return res.status(400).json({ error: "ID de proceso no válido." });
    }
    try {
        const proceso = await consultarProcesoFabricacionPorId(id);
        const changes = await eliminarProcesoFabricacion(id);
        if (changes > 0) {
            if (proceso && proceso.producto_terminado_id) {
                await actualizarCosteFabricacionEstandar(proceso.producto_terminado_id, appConfig); // Pasar appConfig
            }
            res.json({ mensaje: `Proceso de fabricación ID ${id} eliminado con éxito.` });
        } else {
            res.status(404).json({ error: "Proceso de fabricación no encontrado para eliminar." });
        }
    } catch (error) {
        console.error("Error en DELETE /api/procesos-fabricacion/:id:", error.message);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

// --- OrdenesProduccion ---
app.post('/api/ordenes-produccion', async (req, res) => {
    const ordenData = req.body;
    console.log('Node.js: POST /api/ordenes-produccion', ordenData);
    if (!ordenData.producto_terminado_id || !ordenData.cantidad_a_producir || !ordenData.fecha) {
        return res.status(400).json({ error: "ID de producto, cantidad a producir y fecha son requeridos." });
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
        return res.status(400).json({ error: "ID de orden no válido o no se proporcionaron datos para actualizar." });
    }
    try {
        const changes = await actualizarOrdenProduccion(id, updates);
        res.json({ mensaje: `Orden de producción ID ${id} actualizada con éxito.` });
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

// --- Endpoint para procesar una orden de producción (consumir materiales, generar producto) ---
app.post('/api/ordenes-produccion/:id/procesar', async (req, res) => {
    const ordenId = parseInt(req.params.id, 10);
    console.log(`Node.js: POST /api/ordenes-produccion/${ordenId}/procesar`);
    if (isNaN(ordenId)) {
        return res.status(400).json({ error: "ID de orden de producción no válido." });
    }
    try {
        const resultado = await procesarOrdenProduccion(ordenId, appConfig); // Pasar appConfig
        res.status(200).json(resultado);
    } catch (error) {
        console.error(`Error procesando orden de producción ID ${ordenId}:`, error.message);
        res.status(500).json({ error: "Error al procesar la orden de producción.", detalle: error.message });
    }
});

// --- StockProductosTerminados (solo lectura y eliminación para gestión simple) ---
app.get('/api/stock-productos-terminados', async (req, res) => {
    const filtros = req.query;
    console.log('Node.js: GET /api/stock-productos-terminados', filtros);
    try {
        const stockPT = await consultarStockProductosTerminados(filtros);
        res.json(stockPT);
    } catch (error) {
        console.error("Error en GET /api/stock-productos-terminados:", error.message);
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
            res.json({ mensaje: `Stock de Producto Terminado ID ${id} eliminado con éxito.` });
        } else {
            res.status(404).json({ error: "Stock de Producto Terminado no encontrado para eliminar." });
        }
    } catch (error) {
        console.error("Error en DELETE /api/stock-productos-terminados/:id:", error.message);
        res.status(500).json({ error: "Error interno del servidor.", detalle: error.message });
    }
});

// --- NUEVO ENDPOINT para referencias de stock con último coste ---
app.get('/api/stock-referencias-ultimocoste', async (req, res) => {
    console.log('Node.js: Se ha solicitado GET /api/stock-referencias-ultimocoste');
    try {
        const referencias = await consultarReferenciasStockConUltimoCoste();
        res.json(referencias);
    } catch (error) {
        console.error("Error en GET /api/stock-referencias-ultimocoste:", error.message);
        res.status(500).json({ error: "Error interno del servidor al obtener referencias de stock.", detalle: error.message });
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
