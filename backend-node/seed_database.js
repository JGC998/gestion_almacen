// backend-node/seed_database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'almacen', 'almacen.db');

function conectarDB() {
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err.message);
            throw err;
        }
    });
    db.exec('PRAGMA foreign_keys = ON;', (err) => {
        if (err) console.error("Error al habilitar foreign keys:", err.message);
    });
    return db;
}

function runAsync(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                console.error('Error SQL:', sql, params, err.message);
                reject(err);
            } else {
                resolve({ lastID: this.lastID, changes: this.changes });
            }
        });
    });
}

function getAsync(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row || null);
        });
    });
}

function crearTablasSiNoExisten(db) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            console.log("Verificando/Creando tablas...");
            const queries = [
                `CREATE TABLE IF NOT EXISTS Items (id INTEGER PRIMARY KEY AUTOINCREMENT, sku TEXT UNIQUE NOT NULL, descripcion TEXT NOT NULL, tipo_item TEXT NOT NULL CHECK(tipo_item IN ('MATERIA_PRIMA', 'COMPONENTE', 'PRODUCTO_TERMINADO')), familia TEXT, espesor TEXT, ancho REAL, unidad_medida TEXT NOT NULL, coste_estandar REAL DEFAULT 0)`,
                `CREATE TABLE IF NOT EXISTS PedidosProveedores (id INTEGER PRIMARY KEY AUTOINCREMENT, numero_factura TEXT NOT NULL UNIQUE, proveedor TEXT, fecha_pedido TEXT, fecha_llegada TEXT, origen_tipo TEXT NOT NULL, observaciones TEXT, valor_conversion REAL)`,
                `CREATE TABLE IF NOT EXISTS GastosPedido (id INTEGER PRIMARY KEY AUTOINCREMENT, pedido_id INTEGER NOT NULL, tipo_gasto TEXT, descripcion TEXT NOT NULL, coste_eur REAL NOT NULL, FOREIGN KEY(pedido_id) REFERENCES PedidosProveedores(id) ON DELETE CASCADE)`,
                `CREATE TABLE IF NOT EXISTS LineasPedido (id INTEGER PRIMARY KEY AUTOINCREMENT, pedido_id INTEGER NOT NULL, item_id INTEGER NOT NULL, cantidad_original REAL NOT NULL, precio_unitario_original REAL NOT NULL, moneda_original TEXT, FOREIGN KEY(pedido_id) REFERENCES PedidosProveedores(id) ON DELETE CASCADE, FOREIGN KEY(item_id) REFERENCES Items(id) ON DELETE RESTRICT)`,
                `CREATE TABLE IF NOT EXISTS OrdenesProduccion (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL, cantidad_a_producir REAL NOT NULL, fecha TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDIENTE', coste_real_fabricacion REAL, observaciones TEXT, FOREIGN KEY(item_id) REFERENCES Items(id) ON DELETE RESTRICT)`,
                `CREATE TABLE IF NOT EXISTS Stock (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL, lote TEXT NOT NULL UNIQUE, cantidad_actual REAL NOT NULL, coste_lote REAL NOT NULL, ubicacion TEXT, pedido_id INTEGER, orden_produccion_id INTEGER, fecha_entrada TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'DISPONIBLE', FOREIGN KEY(item_id) REFERENCES Items(id) ON DELETE CASCADE, FOREIGN KEY(pedido_id) REFERENCES PedidosProveedores(id) ON DELETE SET NULL, FOREIGN KEY(orden_produccion_id) REFERENCES OrdenesProduccion(id) ON DELETE SET NULL)`,
                `CREATE TABLE IF NOT EXISTS Maquinaria (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL UNIQUE, descripcion TEXT, coste_hora_operacion REAL)`,
                `CREATE TABLE IF NOT EXISTS Recetas (id INTEGER PRIMARY KEY AUTOINCREMENT, producto_id INTEGER NOT NULL, material_id INTEGER NOT NULL, cantidad_requerida REAL NOT NULL, FOREIGN KEY(producto_id) REFERENCES Items(id) ON DELETE CASCADE, FOREIGN KEY(material_id) REFERENCES Items(id) ON DELETE RESTRICT)`,
                `CREATE TABLE IF NOT EXISTS ProcesosFabricacion (id INTEGER PRIMARY KEY AUTOINCREMENT, producto_id INTEGER NOT NULL, maquinaria_id INTEGER NOT NULL, nombre_proceso TEXT NOT NULL, tiempo_estimado_segundos INTEGER NOT NULL, aplica_a_clientes TEXT, FOREIGN KEY(producto_id) REFERENCES Items(id) ON DELETE CASCADE, FOREIGN KEY(maquinaria_id) REFERENCES Maquinaria(id) ON DELETE RESTRICT)`
            ];
            
            Promise.all(queries.map(q => runAsync(db, q)))
                .then(() => {
                    console.log("Creación de tablas completada.");
                    resolve();
                })
                .catch(reject);
        });
    });
}

async function seedDatabase() {
    const db = conectarDB();
    try {
        await crearTablasSiNoExisten(db);
        
        await runAsync(db, 'BEGIN TRANSACTION;');
        console.log("Limpiando datos existentes...");
        await runAsync(db, `DELETE FROM Stock;`);
        await runAsync(db, `DELETE FROM Recetas;`);
        await runAsync(db, `DELETE FROM GastosPedido;`);
        await runAsync(db, `DELETE FROM LineasPedido;`);
        await runAsync(db, `DELETE FROM OrdenesProduccion;`);
        await runAsync(db, `DELETE FROM ProcesosFabricacion;`);
        await runAsync(db, `DELETE FROM Items;`);
        await runAsync(db, `DELETE FROM PedidosProveedores;`);
        
        console.log("Poblando tabla Items...");
        const items = [ { sku: 'GOM-EPDM-6-1000', desc: 'Goma EPDM 6mm Ancho 1000mm', tipo: 'MATERIA_PRIMA', fam: 'GOMA', esp: '6mm', ancho: 1000, um: 'm' } ];
        const itemIds = {};
        for (const item of items) {
            const res = await runAsync(db, `INSERT INTO Items (sku, descripcion, tipo_item, familia, espesor, ancho, unidad_medida) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [item.sku, item.desc, item.tipo, item.fam, item.esp, item.ancho, item.um]);
            itemIds[item.sku] = res.lastID;
        }

        console.log("Base de datos poblada con éxito.");
        await runAsync(db, 'COMMIT;');

    } catch (error) {
        console.error("Error poblando la base de datos, revirtiendo cambios.", error);
        await runAsync(db, 'ROLLBACK;');
    } finally {
        if (db) db.close(() => console.log("Conexión cerrada."));
    }
}

seedDatabase();