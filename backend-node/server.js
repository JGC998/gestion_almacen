const express = require('express');
const cors = require('cors');
const path = require('path'); // Necesario para la ruta a la DB
const sqlite3 = require('sqlite3').verbose(); // verbose() para más detalles en errores

//Importaciones

// --- Importar funciones de db_operations.js ---
const { consultarStockMateriasPrimas, 
        consultarItemStockPorId, 
        procesarNuevoPedido,
        consultarListaPedidos,
        obtenerDetallesCompletosPedido,
        actualizarEstadoStockItem,
        eliminarPedidoCompleto,
        obtenerConfiguraciones
    } = require('./db_operations.js'); 


const app = express();
const PORT = process.env.PORT || 5002; // Usamos 5002 para evitar conflictos


// Middlewares
app.use(cors());    
app.use(express.json());


// --- NUEVO ENDPOINT PARA OBTENER DETALLES DE UN ÍTEM DE STOCK ESPECÍFICO ---
app.get('/api/stock-item/:tabla/:id', async (req, res) => {
    const tablaItem = req.params.tabla;
    const idItem = parseInt(req.params.id, 10); // Convertir el ID a número entero

    console.log(`Node.js: Se ha solicitado GET /api/stock-item/${tablaItem}/${idItem}`);

    // Validación básica de los parámetros
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
        // Revisar si el error ya fue por 'Tabla no válida' desde db_operations
        if (error.message && error.message.startsWith("Tabla no válida")) {
             return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: "Error interno del servidor al obtener el ítem de stock.", detalle: error.message });
    }
});


// --- Configuración de la Base de Datos SQLite ---
// Definimos la ruta a la base de datos. Asumimos que estará en backend-node/almacen/almacen.db
const dbPath = path.resolve(__dirname, 'almacen', 'almacen.db');
console.log(`Ruta a la base de datos: ${dbPath}`);

// Crear la carpeta 'almacen' si no existe (solo para asegurar)
const fs = require('fs');
const almacenDir = path.resolve(__dirname, 'almacen');
if (!fs.existsSync(almacenDir)){
    fs.mkdirSync(almacenDir, { recursive: true });
    console.log(`Directorio '${almacenDir}' creado.`);
}

// Conectar a la base de datos (o crearla si no existe)
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error al conectar/crear la base de datos SQLite:", err.message);
    } else {
        console.log("Conectado a la base de datos SQLite.");
        // Aquí podríamos llamar a una función para crear tablas si no existen
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

        // --- Tabla: LineasPedido ---
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

        // --- Tabla: GastosPedido ---
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

        // --- Tabla: StockMateriasPrimas ---
        // (Asegúrate de que esta definición coincida exactamente con lo que necesitas y tu versión anterior)
        // He mantenido la Foreign Key comentada como en tu database.py original.
        // Si la quieres habilitar, descoméntala y asegúrate que PRAGMA foreign_keys = ON; se ejecute al conectar a la DB.
        db.run(`CREATE TABLE IF NOT EXISTS StockMateriasPrimas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER,
            material_tipo TEXT NOT NULL CHECK(material_tipo IN ('GOMA', 'PVC', 'FIELTRO', 'MAQUINARIA')),
            subtipo_material TEXT,
            referencia_stock TEXT,
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
            /* FOREIGN KEY(pedido_id) REFERENCES PedidosProveedores(id) ON DELETE SET NULL */
            UNIQUE (referencia_stock, subtipo_material, espesor, ancho, color)
        )`, (err) => {
            if (err) {
                console.error("Error creando tabla StockMateriasPrimas:", err.message); // Este mensaje te ayudará a ver el error si persiste
            } else {
                console.log("Tabla StockMateriasPrimas verificada/creada con nueva UNIQUE constraint.");
            }
        });


        // --- Tabla: StockComponentes ---
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
            origen_factura TEXT
            /* FOREIGN KEY(pedido_id) REFERENCES PedidosProveedores(id) ON DELETE SET NULL */
        )`, (err) => {
            if (err) console.error("Error creando tabla StockComponentes:", err.message);
            else console.log("Tabla StockComponentes verificada/creada.");
        });

        // --- Tabla Configuracion ---
        db.run(`CREATE TABLE IF NOT EXISTS Configuracion (
            clave TEXT PRIMARY KEY,
            valor TEXT
        )`, (err) => {
            if (err) console.error("Error creando tabla Configuracion:", err.message);
            else console.log("Tabla Configuracion verificada/creada.");
        });

        // Crear índices (opcional pero recomendado para rendimiento en tablas grandes)
        // No los incluyo todos aquí para brevedad, pero puedes añadirlos si lo deseas
        // Ejemplo: db.run("CREATE INDEX IF NOT EXISTS idx_pp_numero_factura ON PedidosProveedores (numero_factura);");
        
        console.log("Verificación/Creación de todas las tablas esenciales completada.");
    });
}




// --- Rutas de la API ---
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

// --- NUEVO ENDPOINT PARA OBTENER DETALLES DE UN ÍTEM DE STOCK ESPECÍFICO ---
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
        // Los filtros vendrán como query parameters, ej: /api/pedidos?origen_tipo=NACIONAL&proveedor_like=MiProveedor
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
        const detallesPedido = await obtenerDetallesCompletosPedido(pedidoId);
        
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

// --- LÓGICA DE CÁLCULO DE COSTES AUXILIAR ---
function calcularCostesLinea(lineasItems, gastosItems, valorConversion = 1) {
    let costeTotalPedidoSinGastosEnMonedaOriginal = 0;
    
    const lineasConPrecioBase = lineasItems.map(linea => {
        const cantidad = parseFloat(linea.cantidad_original) || 0;
        const precioUnitarioOriginal = parseFloat(linea.precio_unitario_original) || 0;
        
        // Convertir a EUR si hay valor de conversión y la moneda no es EUR explícitamente
        // (Si es nacional, valorConversion será 1 y moneda_original debería ser EUR)
        // Si moneda_original es, por ejemplo, USD, y valorConversion es la tasa USD->EUR.
        let precioUnitarioEur = precioUnitarioOriginal;
        if (linea.moneda_original && linea.moneda_original.toUpperCase() !== 'EUR' && valorConversion !== 1) {
            precioUnitarioEur = precioUnitarioOriginal * valorConversion;
        } else if (valorConversion !== 1 && (!linea.moneda_original || linea.moneda_original.toUpperCase() === 'EUR')) {
            // Si hay valor de conversión pero la moneda es EUR o no se especifica, asumimos que el precio ya está en EUR y no aplicamos conversión.
            // O podrías lanzar un error si esto es una inconsistencia.
            // Para simplificar, si es EUR, no se convierte. Si no hay moneda, y hay VC, se asume que es foreign.
             // Si no se define moneda_original pero hay valor de conversión, asumimos que el precio está en la moneda extranjera
            if (!linea.moneda_original) {
                 precioUnitarioEur = precioUnitarioOriginal * valorConversion;
            }
        }


        const precioTotalBaseLineaEur = cantidad * precioUnitarioEur;
        costeTotalPedidoSinGastosEnMonedaOriginal += precioTotalBaseLineaEur; // Acumulamos en EUR
        return { ...linea, precio_total_euro_base: precioTotalBaseLineaEur, precio_unitario_eur: precioUnitarioEur };
    });

    let totalGastosPedidoEur = 0;
    gastosItems.forEach(gasto => {
        // Asumimos que gasto.coste_eur ya está en EUR.
        totalGastosPedidoEur += (parseFloat(gasto.coste_eur) || 0);
    });

    const porcentajeGastos = costeTotalPedidoSinGastosEnMonedaOriginal > 0 
        ? totalGastosPedidoEur / costeTotalPedidoSinGastosEnMonedaOriginal
        : 0;

    return lineasConPrecioBase.map(linea => {
        const gastosAsignadosLinea = linea.precio_total_euro_base * porcentajeGastos;
        const precioTotalConGastosLinea = linea.precio_total_euro_base + gastosAsignadosLinea;
        const costeUnitarioFinalCalculado = linea.cantidad_original > 0
            ? precioTotalConGastosLinea / linea.cantidad_original
            : 0;
        return { ...linea, coste_unitario_final_calculado: costeUnitarioFinalCalculado };
    });
}


// --- ENDPOINT PARA NUEVOS PEDIDOS NACIONALES (GOMA, PVC, FIELTRO) ---
app.post('/api/pedidos-nacionales', async (req, res) => {
    const { pedido, lineas, gastos, material_tipo } = req.body; // material_tipo: GOMA, PVC, FIELTRO

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
    // Aquí más validaciones específicas...

    try {
        const lineasConCostes = calcularCostesLinea(lineas, gastos); // Para nacional, valorConversion es 1 (implícito)

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

// --- ENDPOINT PARA NUEVOS PEDIDOS DE IMPORTACIÓN (CONTENEDORES) ---
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
    // Validar estructura de gastos de importación (SUPLIDOS, EXENTO, SUJETO)
    const tiposGastoImportacionValidos = ['SUPLIDOS', 'EXENTO', 'SUJETO'];
    if (gastos.some(g => !tiposGastoImportacionValidos.includes(g.tipo_gasto?.toUpperCase()))) {
        return res.status(400).json({ error: `Tipos de gasto para importación deben ser ${tiposGastoImportacionValidos.join(', ')}`});
    }
    // Aquí más validaciones...

    try {
        // La moneda_original de las líneas puede ser USD, y valor_conversion es la tasa USD a EUR.
        // calcularCostesLinea se encargará de la conversión si moneda_original no es EUR.
        const lineasConCostes = calcularCostesLinea(lineas, gastos, vc);

        const datosParaDB = {
            pedido: { ...pedido, origen_tipo: 'CONTENEDOR', valor_conversion: vc },
            lineas: lineasConCostes,
            gastos: gastos.map(g => ({...g, tipo_gasto: g.tipo_gasto.toUpperCase()})), // Asegurar mayúsculas
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
    const { status: nuevoEstado } = req.body; // Esperamos { "status": "NUEVO_ESTADO" }

    console.log(`Node.js: Se ha solicitado PATCH /api/stock-items/${stockItemId}/estado con nuevo estado: ${nuevoEstado}`);

    if (isNaN(stockItemId) || stockItemId <= 0) {
        return res.status(400).json({ error: "ID de ítem de stock no válido." });
    }
    if (!nuevoEstado || typeof nuevoEstado !== 'string') {
        return res.status(400).json({ error: "Nuevo estado no proporcionado o en formato incorrecto. Se espera { \"status\": \"NUEVO_ESTADO\" }." });
    }

    // Podrías añadir validación aquí para los estados específicos que permite esta acción
    // por ejemplo, si solo se puede pasar a EMPEZADA o AGOTADO desde aquí.
    // La función de db_operations ya valida contra todos los estados permitidos en la DB.

    try {
        const cambios = await actualizarEstadoStockItem(stockItemId, nuevoEstado);
        
        if (cambios > 0) {
            console.log(`Node.js: Estado del ítem de stock ID ${stockItemId} actualizado a ${nuevoEstado}.`);
            res.json({ mensaje: `Estado del ítem de stock ID ${stockItemId} actualizado a ${nuevoEstado}.` });
        } else {
            // Esto no debería ocurrir si actualizarEstadoStockItem ya rechaza si no hay cambios.
            // Pero es una doble verificación.
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
        res.json(resultado); // Devuelve el objeto con el resumen de eliminaciones
    } catch (error) {
        console.error(`Error en DELETE /api/pedidos/${pedidoId}:`, error.message);
        if (error.message.includes("no encontrado")) {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: "Error interno del servidor al eliminar el pedido.", detalle: error.message });
    }
});



// --- ENDPOINT PARA TARIFA DE VENTA (Fase 4.1) ---


app.get('/api/tarifa-venta', async (req, res) => {
    const { tipo_cliente } = req.query; // Ej: 'final', 'fabricante', 'metrajes'

    console.log(`Node.js: Se ha solicitado GET /api/tarifa-venta para tipo_cliente: ${tipo_cliente}`);

    if (!tipo_cliente) {
        return res.status(400).json({ error: "El parámetro 'tipo_cliente' es requerido." });
    }
    // Normalizar el tipo_cliente a minúsculas para que coincida con las claves de configuración
    const tipoClienteNormalizado = tipo_cliente.toLowerCase(); 
    
    // Validar que el tipo_cliente sea uno de los esperados
    const tiposClienteValidos = ['final', 'fabricante', 'metrajes'];
    if (!tiposClienteValidos.includes(tipoClienteNormalizado)) {
        return res.status(400).json({ error: `Valor de 'tipo_cliente' no válido. Valores permitidos: ${tiposClienteValidos.join(', ')}.` });
    }

    try {
        const configuraciones = await obtenerConfiguraciones();
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
            const claveGrupo = `${material}-${subtipo}-${espesor}`;
            
            if (!gruposDeStock[claveGrupo]) {
                gruposDeStock[claveGrupo] = {
                    material_tipo: material,
                    subtipo_material: subtipo,
                    espesor: espesor,
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
            
            // --- SECCIÓN MODIFICADA PARA SELECCIÓN DE MARGEN ---
            // Usaremos solo los márgenes por defecto para el tipo de cliente especificado.
            // Ej: 'margen_default_final', 'margen_default_fabricante', 'margen_default_metrajes'
            const claveMargenCliente = `margen_default_${tipoClienteNormalizado}`;
            
            let margenAplicado = configuraciones[claveMargenCliente];
            
            // Si no se encuentra un margen específico para ese tipo de cliente, usamos 0 como fallback.
            if (margenAplicado === undefined) {
                console.warn(`Margen no encontrado para la clave '${claveMargenCliente}'. Usando 0.`);
                margenAplicado = 0;
            }
            
            margenAplicado = parseFloat(margenAplicado);
            if (isNaN(margenAplicado)) {
                console.warn(`Margen para '${claveMargenCliente}' no es numérico ('${configuraciones[claveMargenCliente]}'). Usando 0.`);
                margenAplicado = 0;
            }
            // --- FIN DE SECCIÓN MODIFICADA ---

            const precioVenta = maxCost * (1 + margenAplicado);

            tarifaVenta.push({
                material_tipo: grupo.material_tipo,
                subtipo_material: grupo.subtipo_material,
                espesor: grupo.espesor,
                tipo_cliente_aplicado: tipoClienteNormalizado,
                coste_maximo_grupo: parseFloat(maxCost.toFixed(4)),
                margen_aplicado: parseFloat(margenAplicado.toFixed(4)),
                precio_venta_calculado: parseFloat(precioVenta.toFixed(4))
            });
        }
        
        console.log(`Tarifa de venta generada para tipo_cliente: ${tipoClienteNormalizado}`);
        res.json(tarifaVenta);

    } catch (error) {
        console.error("Error en el endpoint /api/tarifa-venta:", error.message, error.stack);
        res.status(500).json({ error: "Error interno del servidor al generar la tarifa de venta.", detalle: error.message });
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