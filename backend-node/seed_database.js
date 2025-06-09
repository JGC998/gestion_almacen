// backend-node/seed_database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'almacen', 'almacen.db');

// --- Funciones de Ayuda ---
function conectarDB() {
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) { console.error("Error al conectar a la base de datos:", err.message); throw err; }
    });
    db.exec('PRAGMA foreign_keys = ON;');
    return db;
}

function runAsync(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) { console.error('Error SQL:', sql, params, err.message); reject(err); }
            else { resolve({ lastID: this.lastID, changes: this.changes }); }
        });
    });
}

async function crearTablasSiNoExisten(db) {
    console.log("Verificando/Creando tablas en orden secuencial...");
    // Tablas sin dependencias
    await runAsync(db, `CREATE TABLE IF NOT EXISTS Items (id INTEGER PRIMARY KEY, sku TEXT UNIQUE, descripcion TEXT, tipo_item TEXT, familia TEXT, espesor TEXT, ancho REAL, unidad_medida TEXT, coste_estandar REAL)`);
    await runAsync(db, `CREATE TABLE IF NOT EXISTS PedidosProveedores (id INTEGER PRIMARY KEY, numero_factura TEXT UNIQUE, proveedor TEXT, fecha_pedido TEXT, fecha_llegada TEXT, origen_tipo TEXT, observaciones TEXT, valor_conversion REAL)`);
    await runAsync(db, `CREATE TABLE IF NOT EXISTS Maquinaria (id INTEGER PRIMARY KEY, nombre TEXT UNIQUE, descripcion TEXT, coste_hora_operacion REAL)`);

    // Tablas con dependencias de primer nivel
    await runAsync(db, `CREATE TABLE IF NOT EXISTS OrdenesProduccion (id INTEGER PRIMARY KEY, item_id INTEGER, cantidad_a_producir REAL, fecha TEXT, status TEXT, coste_real_fabricacion REAL, observaciones TEXT, FOREIGN KEY(item_id) REFERENCES Items(id))`);
    await runAsync(db, `CREATE TABLE IF NOT EXISTS GastosPedido (id INTEGER PRIMARY KEY, pedido_id INTEGER, tipo_gasto TEXT, descripcion TEXT, coste_eur REAL, FOREIGN KEY(pedido_id) REFERENCES PedidosProveedores(id) ON DELETE CASCADE)`);
    await runAsync(db, `CREATE TABLE IF NOT EXISTS LineasPedido (id INTEGER PRIMARY KEY, pedido_id INTEGER, item_id INTEGER, cantidad_original REAL, precio_unitario_original REAL, moneda_original TEXT, FOREIGN KEY(pedido_id) REFERENCES PedidosProveedores(id) ON DELETE CASCADE, FOREIGN KEY(item_id) REFERENCES Items(id))`);
    await runAsync(db, `CREATE TABLE IF NOT EXISTS ProcesosFabricacion (id INTEGER PRIMARY KEY, producto_id INTEGER, maquinaria_id INTEGER, nombre_proceso TEXT, tiempo_estimado_segundos INTEGER, aplica_a_clientes TEXT, FOREIGN KEY(producto_id) REFERENCES Items(id) ON DELETE CASCADE, FOREIGN KEY(maquinaria_id) REFERENCES Maquinaria(id))`);
    
    // Tablas con dependencias de segundo nivel
    await runAsync(db, `CREATE TABLE IF NOT EXISTS Recetas (id INTEGER PRIMARY KEY, producto_id INTEGER, material_id INTEGER, cantidad_requerida REAL, FOREIGN KEY(producto_id) REFERENCES Items(id) ON DELETE CASCADE, FOREIGN KEY(material_id) REFERENCES Items(id))`);
    await runAsync(db, `CREATE TABLE IF NOT EXISTS Stock (id INTEGER PRIMARY KEY, item_id INTEGER, lote TEXT UNIQUE, cantidad_inicial REAL, cantidad_actual REAL, coste_lote REAL, ubicacion TEXT, pedido_id INTEGER, orden_produccion_id INTEGER, fecha_entrada TEXT, status TEXT, FOREIGN KEY(item_id) REFERENCES Items(id), FOREIGN KEY(pedido_id) REFERENCES PedidosProveedores(id), FOREIGN KEY(orden_produccion_id) REFERENCES OrdenesProduccion(id))`);
    
    console.log("Creación de tablas completada.");
}


// --- Lógica Principal del Seeder ---
async function seedDatabase() {
    const db = conectarDB();
    console.log("Iniciando seeder con datos de prueba completos...");

    try {
        
        await crearTablasSiNoExisten(db);

        await runAsync(db, 'BEGIN TRANSACTION;');


        // 1. LIMPIAR TABLAS
        console.log("Limpiando datos existentes...");
        const tablesToDelete = ['Stock', 'Recetas', 'GastosPedido', 'LineasPedido', 'Items', 'PedidosProveedores'];
        for (const table of tablesToDelete) {
            // Usamos un try/catch por si alguna tabla no existe, para que no detenga el script
            try {
                await runAsync(db, `DELETE FROM ${table};`);
                await runAsync(db, `DELETE FROM sqlite_sequence WHERE name='${table}';`);
            } catch (e) {
                // Ignoramos el error si la tabla no existe
                if (!e.message.includes("no such table")) {
                    throw e; // Lanzamos otros errores
                }
            }
        }

        // 2. POBLAR ITEMS (Catálogo de todos los artículos)
        console.log("Poblando catálogo de Items...");
        const items = [
            { sku: 'GOM-EPDM-6-1000', desc: 'Goma EPDM 6mm Ancho 1000mm', tipo: 'MATERIA_PRIMA', fam: 'GOMA', um: 'm' },
            { sku: 'GOM-EPDM-8-1200', desc: 'Goma EPDM 8mm Ancho 1200mm', tipo: 'MATERIA_PRIMA', fam: 'GOMA', um: 'm' },
            { sku: 'PVC-AZUL-3-1200', desc: 'PVC Azul 3mm Ancho 1200mm', tipo: 'MATERIA_PRIMA', fam: 'PVC', um: 'm' },
            { sku: 'FIE-ADH-F10-1800', desc: 'Fieltro Adhesivo F10 Ancho 1800mm', tipo: 'MATERIA_PRIMA', fam: 'FIELTRO', um: 'm' },
            { sku: 'VERDE-LONA-5-1500', desc: 'Lona Verde 5mm Ancho 1500mm', tipo: 'MATERIA_PRIMA', fam: 'VERDE', um: 'm' },
            { sku: 'CARAM-PVC-2-1200', desc: 'PVC Caramelo 2mm Ancho 1200mm', tipo: 'MATERIA_PRIMA', fam: 'CARAMELO', um: 'm' },
            { sku: 'PT-FALD-GOMA-STD', desc: 'Faldeta Estándar de Goma 6mm', tipo: 'PRODUCTO_TERMINADO', fam: 'FALDETA', um: 'unidad' }
        ];
        const itemIds = {};
        for (const item of items) {
            const res = await runAsync(db, `INSERT INTO Items (sku, descripcion, tipo_item, familia, unidad_medida) VALUES (?, ?, ?, ?, ?)`,
                [item.sku, item.desc, item.tipo, item.fam, item.um]);
            itemIds[item.sku] = res.lastID;
        }

        // 3. CREAR PEDIDOS CON GASTOS Y STOCK
        console.log("Creando pedidos, gastos y lotes de stock...");
        const today = new Date().toISOString().split('T')[0];

        // Pedido GOMA
        const pedGoma = await runAsync(db, `INSERT INTO PedidosProveedores (numero_factura, proveedor, origen_tipo, fecha_llegada) VALUES (?, ?, ?, ?)`, ['PED-GOMA-01', 'Gomasur', 'NACIONAL', today]);
        await runAsync(db, `INSERT INTO GastosPedido (pedido_id, tipo_gasto, descripcion, coste_eur) VALUES (?, ?, ?, ?)`, [pedGoma.lastID, 'NACIONAL', 'Transporte Goma', 75.00]);
        await runAsync(db, `INSERT INTO LineasPedido (pedido_id, item_id, cantidad_original, precio_unitario_original) VALUES (?, ?, ?, ?)`, [pedGoma.lastID, itemIds['GOM-EPDM-6-1000'], 200, 12.50]);
        await runAsync(db, `INSERT INTO Stock (item_id, lote, cantidad_inicial, cantidad_actual, coste_lote, pedido_id, fecha_entrada) VALUES (?, ?, ?, ?, ?, ?, ?)`, [itemIds['GOM-EPDM-6-1000'], 'LOTE-GOM-01', 200, 200, 13.00, pedGoma.lastID, today]);

        // Pedido PVC
        const pedPvc = await runAsync(db, `INSERT INTO PedidosProveedores (numero_factura, proveedor, origen_tipo, fecha_llegada) VALUES (?, ?, ?, ?)`, ['PED-PVC-01', 'Plásticos Levante', 'NACIONAL', today]);
        await runAsync(db, `INSERT INTO GastosPedido (pedido_id, tipo_gasto, descripcion, coste_eur) VALUES (?, ?, ?, ?)`, [pedPvc.lastID, 'NACIONAL', 'Envío Urgente', 45.00]);
        await runAsync(db, `INSERT INTO LineasPedido (pedido_id, item_id, cantidad_original, precio_unitario_original) VALUES (?, ?, ?, ?)`, [pedPvc.lastID, itemIds['PVC-AZUL-3-1200'], 150, 9.75]);
        await runAsync(db, `INSERT INTO Stock (item_id, lote, cantidad_inicial, cantidad_actual, coste_lote, pedido_id, fecha_entrada) VALUES (?, ?, ?, ?, ?, ?, ?)`, [itemIds['PVC-AZUL-3-1200'], 'LOTE-PVC-01', 150, 150, 10.14, pedPvc.lastID, today]);
        
        // Pedido FIELTRO
        const pedFieltro = await runAsync(db, `INSERT INTO PedidosProveedores (numero_factura, proveedor, origen_tipo, fecha_llegada) VALUES (?, ?, ?, ?)`, ['PED-FIELTRO-01', 'Fieltros del Norte', 'NACIONAL', today]);
        await runAsync(db, `INSERT INTO GastosPedido (pedido_id, tipo_gasto, descripcion, coste_eur) VALUES (?, ?, ?, ?)`, [pedFieltro.lastID, 'NACIONAL', 'Portes', 90.00]);
        await runAsync(db, `INSERT INTO LineasPedido (pedido_id, item_id, cantidad_original, precio_unitario_original) VALUES (?, ?, ?, ?)`, [pedFieltro.lastID, itemIds['FIE-ADH-F10-1800'], 100, 19.80]);
        await runAsync(db, `INSERT INTO Stock (item_id, lote, cantidad_inicial, cantidad_actual, coste_lote, pedido_id, fecha_entrada) VALUES (?, ?, ?, ?, ?, ?, ?)`, [itemIds['FIE-ADH-F10-1800'], 'LOTE-FIELTRO-01', 100, 100, 20.70, pedFieltro.lastID, today]);

        // Contenedor CARAMELO
        const pedCaramelo = await runAsync(db, `INSERT INTO PedidosProveedores (numero_factura, proveedor, origen_tipo, valor_conversion, fecha_llegada) VALUES (?, ?, ?, ?, ?)`, ['CONT-CARAM-01', 'Caramel Corp', 'CONTENEDOR', 1.08, today]);
        await runAsync(db, `INSERT INTO GastosPedido (pedido_id, tipo_gasto, descripcion, coste_eur) VALUES (?, ?, ?, ?)`, [pedCaramelo.lastID, 'SUPLIDOS', 'Flete y Aranceles', 1650.00]);
        await runAsync(db, `INSERT INTO LineasPedido (pedido_id, item_id, cantidad_original, precio_unitario_original, moneda_original) VALUES (?, ?, ?, ?, ?)`, [pedCaramelo.lastID, itemIds['CARAM-PVC-2-1200'], 500, 8.75, 'USD']);
        await runAsync(db, `INSERT INTO Stock (item_id, lote, cantidad_inicial, cantidad_actual, coste_lote, pedido_id, fecha_entrada) VALUES (?, ?, ?, ?, ?, ?, ?)`, [itemIds['CARAM-PVC-2-1200'], 'LOTE-CARAM-01', 500, 500, 12.75, pedCaramelo.lastID, today]);
        
        await runAsync(db, 'COMMIT;');
        console.log("\n¡Base de datos poblada con éxito!");

    } catch (error) {
        console.error("Error poblando la base de datos, revirtiendo cambios.", error);
        await runAsync(db, 'ROLLBACK;');
    } finally {
        if (db) db.close(() => console.log("Conexión a la base de datos cerrada."));
    }
}

seedDatabase();