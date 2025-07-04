// backend-node/limpiar_datos.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'almacen', 'almacen.db');

// Creamos una función asíncrona para poder usar await
async function limpiarBaseDeDatos() {
    console.log("Iniciando proceso de limpieza...");

    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            return console.error("Error al conectar con la base de datos:", err.message);
        }
        console.log("Conectado a la base de datos SQLite para limpieza.");
    });

    // Helper para ejecutar una query con async/await
    const runAsync = (sql, params = []) => new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes });
        });
    });

    const tablas_a_limpiar = [
        'TarifaReferencias',
        'Stock',
        'LineasPedido',
        'GastosPedido',
        'PedidosProveedores',
        'OrdenesProduccion'
    ];

    try {
        await runAsync('PRAGMA foreign_keys = ON;');
        
        // Usamos un bucle for...of que funciona bien con await
        for (const tabla of tablas_a_limpiar) {
            const result = await runAsync(`DELETE FROM ${tabla};`);
            console.log(`- Tabla '${tabla}' limpiada. Filas afectadas: ${result.changes}`);
        }

    } catch (err) {
        console.error("Ha ocurrido un error durante la limpieza:", err.message);
    } finally {
        // Nos aseguramos de cerrar la conexión solo al final
        db.close((err) => {
            if (err) {
                return console.error("Error al cerrar la base de datos:", err.message);
            }
            console.log("\nProceso de limpieza completado. La base de datos está lista.");
        });
    }
}


async function limpiarReferenciasDeTarifa() {
    console.log("Iniciando limpieza de referencias de precios...");

    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) return console.error("Error al conectar:", err.message);
        console.log("Conectado a la base de datos.");
    });

    const runAsync = (sql) => new Promise((resolve, reject) => {
        db.run(sql, function(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes });
        });
    });

    try {
        const result = await runAsync(`DELETE FROM TarifaReferencias;`);
        console.log(`- Tabla 'TarifaReferencias' limpiada. Filas eliminadas: ${result.changes}`);
    } catch (err) {
        console.error("Error al limpiar la tabla:", err.message);
    } finally {
        db.close((err) => {
            if (err) return console.error("Error al cerrar la DB:", err.message);
            console.log("\nLimpieza de referencias completada.");
        });
    }
}

limpiarReferenciasDeTarifa();

// Ejecutamos la función principal
limpiarBaseDeDatos();