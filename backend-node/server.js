const express = require('express');
const cors = require('cors');
const path = require('path'); // Necesario para la ruta a la DB
const sqlite3 = require('sqlite3').verbose(); // verbose() para más detalles en errores

//Importaciones

// --- Importar funciones de db_operations.js ---
const { consultarStockMateriasPrimas, consultarItemStockPorId } = require('./db_operations.js'); 


const app = express();
const PORT = process.env.PORT || 5002; // Usamos 5002 para evitar conflictos


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

// Middlewares
app.use(cors());
app.use(express.json());

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
            material_tipo TEXT NOT NULL CHECK(material_tipo IN ('GOMA', 'PVC', 'FIELTRO', 'MAQUINARIA')), /* MAQUINARIA añadido por si acaso */
            subtipo_material TEXT,
            referencia_stock TEXT UNIQUE,
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
            origen_factura TEXT 
            /* FOREIGN KEY(pedido_id) REFERENCES PedidosProveedores(id) ON DELETE SET NULL */
        )`, (err) => {
            if (err) console.error("Error creando tabla StockMateriasPrimas:", err.message);
            else console.log("Tabla StockMateriasPrimas verificada/creada.");
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