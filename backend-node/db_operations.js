const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Ruta a la base de datos (relativa a este archivo, que está en backend-node/)
const dbPath = path.resolve(__dirname, 'almacen', 'almacen.db');


/**
 * Establece una conexión a la base de datos SQLite.
 * @returns {sqlite3.Database} Objeto de la base de datos.
 * @throws {Error} Si no se puede conectar a la base de datos.
 */


function conectarDB() {
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error("Error al conectar a la base de datos desde db_operations:", err.message);
            throw err; 
        }
    });
    return db;
}

function consultarStockMateriasPrimas(filtros = null) {
    return new Promise((resolve, reject) => {
        const db = conectarDB();
        
        let sql = `SELECT * FROM StockMateriasPrimas`; // O cualquier tabla de stock principal
        const params = [];
        const whereClauses = [];

        if (filtros) {
            if (filtros.material_tipo) {
                whereClauses.push(`material_tipo = ?`);
                params.push(filtros.material_tipo.toUpperCase());
            }
            if (filtros.status) {
                whereClauses.push(`status = ?`);
                params.push(filtros.status.toUpperCase());
            }
            if (filtros.buscar && filtros.buscar.trim() !== '') {
                const terminoBusqueda = `%${filtros.buscar.trim().toUpperCase()}%`;
                // Ajusta las columnas de búsqueda según tu tabla StockMateriasPrimas
                whereClauses.push(`(UPPER(referencia_stock) LIKE ? OR UPPER(origen_factura) LIKE ? OR UPPER(espesor) LIKE ? OR UPPER(subtipo_material) LIKE ?)`);
                params.push(terminoBusqueda, terminoBusqueda, terminoBusqueda, terminoBusqueda);
            }
        }

        if (whereClauses.length > 0) {
            sql += ` WHERE ${whereClauses.join(' AND ')}`;
        }
        
        sql += ` ORDER BY fecha_entrada_almacen DESC`;

        console.log(`SQL (StockMateriasPrimas con filtros): ${sql}`);
        console.log(`Params: ${JSON.stringify(params)}`);

        db.all(sql, params, (err, rows) => {
            db.close((closeErr) => { // Siempre intentar cerrar la DB
                if (closeErr) {
                    console.error("Error cerrando la DB después de consultar stock:", closeErr.message);
                }
            });
            if (err) {
                console.error("Error al consultar StockMateriasPrimas con filtros:", err.message);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

// --- NUEVA FUNCIÓN ---
/**
 * Consulta un único item de stock por su ID y tabla.
 * @param {number} idItem - El ID del item a buscar.
 * @param {string} tablaItem - El nombre de la tabla de stock ('StockMateriasPrimas' o 'StockComponentes').
 * @returns {Promise<object|null>} Promesa que resuelve al objeto del item o null si no se encuentra.
 */
function consultarItemStockPorId(idItem, tablaItem) {
    return new Promise((resolve, reject) => {
        // Validar tablaItem para seguridad básica
        const tablasPermitidas = ['StockMateriasPrimas', 'StockComponentes'];
        if (!tablasPermitidas.includes(tablaItem)) {
            console.error(`Intento de consulta a tabla no permitida: ${tablaItem}`);
            return reject(new Error(`Tabla no válida: ${tablaItem}`));
        }

        const db = conectarDB();
        const sql = `SELECT * FROM ${tablaItem} WHERE id = ?`; // Usamos el nombre de tabla validado

        console.log(`SQL (ItemStockPorId): ${sql} con ID: ${idItem}`);

        db.get(sql, [idItem], (err, row) => { // db.get() para una sola fila
            db.close((closeErr) => {
                if (closeErr) {
                    console.error(`Error cerrando la DB después de consultar item ${idItem} en ${tablaItem}:`, closeErr.message);
                }
            });
            if (err) {
                console.error(`Error al consultar item ${idItem} en ${tablaItem}:`, err.message);
                reject(err);
            } else {
                resolve(row || null); // Devuelve la fila (objeto) o null si no se encontró
            }
        });
    });
}

module.exports = {
    consultarStockMateriasPrimas,
    consultarItemStockPorId
};