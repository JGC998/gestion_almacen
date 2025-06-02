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

// backend-node/db_operations.js

// ... (código existente: conectarDB, consultarStockMateriasPrimas, consultarItemStockPorId) ...
// ... (código existente: insertarPedidoProveedor, insertarGastoPedido, insertarStockMateriaPrima) ...
// Asegúrate de que las funciones insertarPedidoProveedor, insertarGastoPedido, 
// y insertarStockMateriaPrima que te di antes estén aquí.
// Haremos una pequeña modificación en insertarPedidoProveedor para manejar valor_conversion.

/**
 * Inserta un nuevo pedido en PedidosProveedores.
 * @param {sqlite3.Database} db - La instancia de la base de datos.
 * @param {object} pedidoData - Datos del pedido { numero_factura, proveedor, fecha_pedido, fecha_llegada, origen_tipo, observaciones, valor_conversion? }
 * @returns {Promise<number>} ID del pedido insertado.
 */
function insertarPedidoProveedor(db, pedidoData) { // Modificada para incluir valor_conversion
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO PedidosProveedores (
                        numero_factura, proveedor, fecha_pedido, fecha_llegada, 
                        origen_tipo, observaciones, valor_conversion
                     ) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const params = [
            pedidoData.numero_factura,
            pedidoData.proveedor,
            pedidoData.fecha_pedido,
            pedidoData.fecha_llegada,
            pedidoData.origen_tipo,
            pedidoData.observaciones,
            pedidoData.valor_conversion // Puede ser null para pedidos nacionales
        ];
        db.run(sql, params, function(err) {
            if (err) {
                console.error("Error al insertar en PedidosProveedores:", err.message);
                // Revisar si es por factura duplicada
                if (err.message.includes("UNIQUE constraint failed: PedidosProveedores.numero_factura")) {
                    return reject(new Error(`El número de factura '${pedidoData.numero_factura}' ya existe.`));
                }
                return reject(err);
            }
            resolve(this.lastID);
        });
    });
}

/**
 * Procesa y crea un nuevo pedido (Nacional o Importación), incluyendo su cabecera, gastos y líneas de stock.
 * Utiliza una transacción para asegurar la atomicidad de las operaciones.
 * @param {object} datosCompletosPedido - Objeto con { pedido, lineas, gastos, material_tipo_general }
 * - pedido: { numero_factura, proveedor, fecha_pedido, fecha_llegada, origen_tipo, observaciones, valor_conversion? }
 * - lineas: Array de objetos de línea, cada uno debe tener 'coste_unitario_final_calculado' y otros campos para StockMateriasPrimas.
 * - gastos: Array de objetos de gasto.
 * - material_tipo_general: 'GOMA', 'PVC', 'FIELTRO' (usado para StockMateriasPrimas.material_tipo)
 * @returns {Promise<object>} Objeto con el ID del pedido creado y un mensaje.
 */
async function procesarNuevoPedido(datosCompletosPedido) {
    const { pedido, lineas, gastos, material_tipo_general } = datosCompletosPedido;
    const db = conectarDB();

    try {
        await new Promise((resolve, reject) => {
            db.run('BEGIN TRANSACTION;', (err) => err ? reject(err) : resolve());
        });

        // Insertar cabecera del pedido
        const pedidoId = await insertarPedidoProveedor(db, pedido);

        // Insertar gastos
        for (const gasto of gastos) {
            const gastoDataParaDB = {
                ...gasto, // tipo_gasto, descripcion, coste_eur
                pedido_id: pedidoId,
            };
            await insertarGastoPedido(db, gastoDataParaDB);
        }

        // Insertar líneas de stock
        for (const linea of lineas) {
            const stockDataParaDB = {
                pedido_id: pedidoId,
                material_tipo: material_tipo_general, // GOMA, PVC, FIELTRO
                subtipo_material: linea.subtipo_material,
                referencia_stock: linea.referencia_stock,
                fecha_entrada_almacen: pedido.fecha_llegada,
                status: 'DISPONIBLE',
                espesor: linea.espesor,
                ancho: linea.ancho,
                largo_inicial: linea.cantidad_original, // Asumimos que cantidad_original es el largo para estos materiales
                largo_actual: linea.cantidad_original,
                unidad_medida: linea.unidad_medida || 'm', // 'm' por defecto, pero puede venir de la línea
                coste_unitario_final: linea.coste_unitario_final_calculado,
                color: linea.color,
                ubicacion: linea.ubicacion,
                notas: linea.notas_linea,
                origen_factura: pedido.numero_factura
            };
            await insertarStockMateriaPrima(db, stockDataParaDB);
        }

        await new Promise((resolve, reject) => {
            db.run('COMMIT;', (err) => err ? reject(err) : resolve());
        });

        return { pedidoId, mensaje: `Pedido de ${material_tipo_general} (${pedido.origen_tipo}) creado exitosamente.` };

    } catch (error) {
        console.error(`Error en la transacción de procesarNuevoPedido (${material_tipo_general}, ${pedido.origen_tipo}), revirtiendo:`, error.message);
        await new Promise((resolve, reject) => {
            db.run('ROLLBACK;', (err) => err ? reject(err) : resolve());
        });
        throw error; 
    } finally {
        db.close((closeErr) => {
            if (closeErr) console.error("Error cerrando la DB después de transacción en procesarNuevoPedido:", closeErr.message);
        });
    }
}

module.exports = {
    consultarStockMateriasPrimas,
    consultarItemStockPorId,
    procesarNuevoPedido // Reemplaza crearNuevoPedidoNacionalGoma
};

