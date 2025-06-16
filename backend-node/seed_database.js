// backend-node/seed_database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const almacenDir = path.resolve(__dirname, 'almacen');
const dbPath = path.resolve(almacenDir, 'almacen.db');

// Borramos la base de datos anterior para asegurar una creación limpia
if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log("Base de datos anterior eliminada.");
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("Creando la nueva estructura de base de datos...");
    // Copiamos la misma lógica de creación de tablas de server.js para ser autocontenido
    db.exec(`
        PRAGMA foreign_keys = ON;

        CREATE TABLE Familias ( id INTEGER PRIMARY KEY, nombre TEXT UNIQUE NOT NULL );
        CREATE TABLE Atributos ( id INTEGER PRIMARY KEY, nombre TEXT UNIQUE NOT NULL );
        CREATE TABLE ValoresAtributos ( id INTEGER PRIMARY KEY, atributo_id INTEGER NOT NULL, valor TEXT NOT NULL, FOREIGN KEY(atributo_id) REFERENCES Atributos(id), UNIQUE(atributo_id, valor) );
        CREATE TABLE Items ( id INTEGER PRIMARY KEY, sku TEXT UNIQUE, descripcion TEXT, familia_id INTEGER, tipo_item TEXT NOT NULL, FOREIGN KEY(familia_id) REFERENCES Familias(id) );
        CREATE TABLE ItemAtributos ( item_id INTEGER NOT NULL, valor_atributo_id INTEGER NOT NULL, PRIMARY KEY (item_id, valor_atributo_id), FOREIGN KEY(item_id) REFERENCES Items(id), FOREIGN KEY(valor_atributo_id) REFERENCES ValoresAtributos(id) );
        CREATE TABLE Maquinaria ( id INTEGER PRIMARY KEY, nombre TEXT UNIQUE NOT NULL );
        CREATE TABLE OrdenesProduccion ( id INTEGER PRIMARY KEY, item_id INTEGER, FOREIGN KEY(item_id) REFERENCES Items(id) );
        CREATE TABLE PedidosProveedores ( id INTEGER PRIMARY KEY, numero_factura TEXT NOT NULL UNIQUE, proveedor TEXT, fecha_pedido TEXT, origen_tipo TEXT NOT NULL, valor_conversion REAL, status TEXT NOT NULL DEFAULT 'COMPLETADO', observaciones TEXT );
        CREATE TABLE LineasPedido ( id INTEGER PRIMARY KEY, pedido_id INTEGER NOT NULL, item_id INTEGER NOT NULL, cantidad_bobinas INTEGER NOT NULL, metros_por_bobina REAL NOT NULL, precio_unitario REAL NOT NULL, moneda TEXT NOT NULL, FOREIGN KEY(pedido_id) REFERENCES PedidosProveedores(id), FOREIGN KEY(item_id) REFERENCES Items(id) );
        CREATE TABLE GastosPedido ( id INTEGER PRIMARY KEY, pedido_id INTEGER NOT NULL, descripcion TEXT NOT NULL, coste_eur REAL NOT NULL, tipo_gasto TEXT NOT NULL, FOREIGN KEY(pedido_id) REFERENCES PedidosProveedores(id) );
        CREATE TABLE Stock ( id INTEGER PRIMARY KEY, lote TEXT UNIQUE NOT NULL, item_id INTEGER NOT NULL, cantidad_inicial REAL NOT NULL, cantidad_actual REAL NOT NULL, coste_lote REAL NOT NULL, pedido_id INTEGER, orden_produccion_id INTEGER, fecha_entrada TEXT NOT NULL, FOREIGN KEY(item_id) REFERENCES Items(id), FOREIGN KEY(pedido_id) REFERENCES PedidosProveedores(id), FOREIGN KEY(orden_produccion_id) REFERENCES OrdenesProduccion(id) );
        CREATE TABLE Tarifas ( item_id INTEGER PRIMARY KEY, precio_venta REAL NOT NULL, ultimo_coste_compra REAL NOT NULL, fecha_actualizacion TEXT NOT NULL, FOREIGN KEY(item_id) REFERENCES Items(id) );
    `, (err) => {
        if (err) return console.error("Error creando tablas base:", err.message);
        console.log("Estructura de 14 tablas creada con éxito.");
        
        // --- Helpers para la base de datos ---
        const run = (sql, params = []) => new Promise((resolve, reject) => {
            db.run(sql, params, function (err) { if (err) reject(err); else resolve({ lastID: this.lastID }); });
        });
        const get = (sql, params = []) => new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row); });
        });

        // --- Lógica principal del Seeder ---
        const seed = async () => {
            try {
                await run('BEGIN TRANSACTION');
                console.log("Poblando catálogos...");
                await run(`INSERT INTO Familias (nombre) VALUES ('GOMA'), ('PVC'), ('FIELTRO')`);
                await run(`INSERT INTO Atributos (nombre) VALUES ('Espesor'), ('Ancho'), ('Color')`);
                const { id: espesorId } = await get(`SELECT id FROM Atributos WHERE nombre = 'Espesor'`);
                const { id: anchoId } = await get(`SELECT id FROM Atributos WHERE nombre = 'Ancho'`);
                await run(`INSERT INTO ValoresAtributos (atributo_id, valor) VALUES (?, '6mm'), (?, '8mm'), (?, '1000mm'), (?, '1200mm')`, [espesorId, espesorId, anchoId, anchoId]);

                console.log("Creando artículos maestros de ejemplo...");
                const { lastID: itemGomaId } = await run(`INSERT INTO Items (sku, descripcion, familia_id, tipo_item) VALUES (?, ?, ?, ?)`, ['GOM-6-1000', 'Goma EPDM 6mm 1000mm', 1, 'MATERIA_PRIMA']);
                const { id: valEspesor6 } = await get(`SELECT id FROM ValoresAtributos WHERE valor = '6mm'`);
                const { id: valAncho1000 } = await get(`SELECT id FROM ValoresAtributos WHERE valor = '1000mm'`);
                await run(`INSERT INTO ItemAtributos (item_id, valor_atributo_id) VALUES (?, ?), (?, ?)`, [itemGomaId, valEspesor6, itemGomaId, valAncho1000]);

                console.log("¡Base de datos poblada con éxito!");
                await run('COMMIT');
            } catch (error) {
                await run('ROLLBACK');
                console.error("Error poblando la base de datos, se revirtieron los cambios.", error);
            } finally {
                db.close(() => console.log("Conexión a la base de datos cerrada."));
            }
        };
        seed();
    });
});