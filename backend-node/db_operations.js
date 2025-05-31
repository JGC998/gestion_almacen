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
            // Es importante manejar este error, quizás la aplicación no debería continuar.
            throw err; // Lanzar el error para que el llamador lo maneje
        }
        // Opcional: console.log("Conexión a DB establecida desde db_operations para una operación.");
    });
    return db;
}

/**
 * Consulta todos los items de la tabla StockMateriasPrimas.
 * @param {object} [filtros=null] - Objeto con filtros a aplicar (para implementaciones futuras).
 * @returns {Promise<Array<object>>} Promesa que resuelve a un array de objetos (filas).
 */
function consultarStockMateriasPrimas(filtros = null) {
    return new Promise((resolve, reject) => {
        const db = conectarDB(); // Abre una conexión

        // TODO: Implementar lógica de filtros más adelante basada en el objeto 'filtros'
        // Por ahora, seleccionamos todo y ordenamos.
        let sql = `SELECT * FROM StockMateriasPrimas ORDER BY fecha_entrada_almacen DESC`;
        const params = [];

        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error("Error al consultar StockMateriasPrimas:", err.message);
                db.close(); // Asegúrate de cerrar la conexión en caso de error
                reject(err);
            } else {
                db.close((closeErr) => { // Cierra la conexión después de una consulta exitosa
                    if (closeErr) {
                        // Registrar el error pero no rechazar la promesa si los datos ya se obtuvieron
                        console.error("Error cerrando la DB después de consultar stock:", closeErr.message);
                    }
                });
                resolve(rows); // `rows` es un array de objetos (cada objeto es una fila)
            }
        });
    });
}

// Exportamos las funciones para que puedan ser usadas en otros archivos (ej: server.js)
module.exports = {
    consultarStockMateriasPrimas
    // Aquí exportaremos más funciones a medida que las creemos (ej: insertarPedido, etc.)
};