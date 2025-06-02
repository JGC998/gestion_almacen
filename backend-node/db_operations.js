const sqlite3 = require('sqlite3').verbose();
const path = require('path');
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
function insertarPedidoProveedor(db, pedidoData) {
    // ... (tu función insertarPedidoProveedor existente y modificada para valor_conversion) ...
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
            pedidoData.valor_conversion
        ];
        db.run(sql, params, function(err) {
            if (err) {
                console.error("Error al insertar en PedidosProveedores:", err.message);
                if (err.message.includes("UNIQUE constraint failed: PedidosProveedores.numero_factura")) {
                    return reject(new Error(`El número de factura '${pedidoData.numero_factura}' ya existe.`));
                }
                return reject(err);
            }
            resolve(this.lastID);
        });
    });
}


// --- AÑADE ESTAS DOS FUNCIONES AQUÍ ---

/**
 * Inserta una línea de gasto en GastosPedido.
 * @param {sqlite3.Database} db - La instancia de la base de datos.
 * @param {object} gastoData - Datos del gasto { pedido_id, tipo_gasto, descripcion, coste_eur }
 * @returns {Promise<number>} ID del gasto insertado.
 */
function insertarGastoPedido(db, gastoData) {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO GastosPedido (pedido_id, tipo_gasto, descripcion, coste_eur)
                     VALUES (?, ?, ?, ?)`;
        const params = [
            gastoData.pedido_id,
            gastoData.tipo_gasto,
            gastoData.descripcion,
            gastoData.coste_eur
        ];
        db.run(sql, params, function(err) {
            if (err) {
                console.error("Error al insertar en GastosPedido:", err.message);
                return reject(err);
            }
            resolve(this.lastID);
        });
    });
}

/**
 * Inserta un ítem de materia prima en StockMateriasPrimas.
 * @param {sqlite3.Database} db - La instancia de la base de datos.
 * @param {object} stockData - Datos del ítem de stock.
 * @returns {Promise<number>} ID del ítem de stock insertado.
 */
function insertarStockMateriaPrima(db, stockData) {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO StockMateriasPrimas (
                        pedido_id, material_tipo, subtipo_material, referencia_stock, 
                        fecha_entrada_almacen, status, espesor, ancho, 
                        largo_inicial, largo_actual, unidad_medida, coste_unitario_final, 
                        color, ubicacion, notas, origen_factura
                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const params = [
            stockData.pedido_id,
            stockData.material_tipo,
            stockData.subtipo_material,
            stockData.referencia_stock,
            stockData.fecha_entrada_almacen,
            stockData.status,
            stockData.espesor,
            stockData.ancho,
            stockData.largo_inicial,
            stockData.largo_actual,
            stockData.unidad_medida,
            stockData.coste_unitario_final,
            stockData.color,
            stockData.ubicacion,
            stockData.notas,
            stockData.origen_factura
        ];
        db.run(sql, params, function(err) {
            if (err) {
                console.error("Error al insertar en StockMateriasPrimas:", err.message);
                if (err.message.includes("UNIQUE constraint failed: StockMateriasPrimas.referencia_stock")) {
                    return reject(new Error(`La referencia de stock '${stockData.referencia_stock}' ya existe.`));
                }
                return reject(err);
            }
            resolve(this.lastID);
        });
    });
}

function buscarStockItemExistente(db, itemKey) {
    return new Promise((resolve, reject) => {
        const { referencia_stock, subtipo_material, espesor, ancho, color } = itemKey;
        // Es importante manejar los NULLs correctamente en la comparación SQL.
        // Si alguno de estos campos puede ser NULL y quieres que NULL = NULL, la consulta se complica.
        // Por simplicidad, asumimos que estos campos clave no serán NULL o que la comparación directa funciona para tu caso.
        // Si pueden ser NULL y deben coincidir, usarías "columna IS ?" en lugar de "columna = ?" para esos campos.
        const sql = `SELECT * FROM StockMateriasPrimas 
                     WHERE referencia_stock = ? AND subtipo_material = ? AND 
                           espesor = ? AND ancho = ? AND color = ?`;
        const params = [referencia_stock, subtipo_material, espesor, ancho, color];
        
        db.get(sql, params, (err, row) => {
            if (err) {
                console.error("Error buscando ítem de stock existente:", err.message);
                return reject(err);
            }
            resolve(row || null); // Devuelve la fila encontrada o null
        });
    });
}

// --- NUEVA FUNCIÓN AUXILIAR para actualizar ítem de stock existente ---
function actualizarStockItemExistente(db, idStockItem, datosActualizacion) {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE StockMateriasPrimas 
                     SET largo_actual = largo_actual + ?, 
                         largo_inicial = largo_inicial + ?, 
                         coste_unitario_final = ?, 
                         fecha_entrada_almacen = ?, 
                         pedido_id = ?, 
                         origen_factura = ?,
                         status = 'DISPONIBLE' -- Asegurarse de que esté disponible si se añade stock
                     WHERE id = ?`;
        const params = [
            datosActualizacion.cantidad_nueva,
            datosActualizacion.cantidad_nueva, // Sumamos también a largo_inicial
            datosActualizacion.nuevo_coste_unitario_final,
            datosActualizacion.nueva_fecha_entrada_almacen,
            datosActualizacion.nuevo_pedido_id,
            datosActualizacion.nueva_origen_factura,
            idStockItem
        ];
        db.run(sql, params, function(err) {
            if (err) {
                console.error("Error actualizando ítem de stock existente:", err.message);
                return reject(err);
            }
            resolve(this.changes); // Devuelve el número de filas actualizadas
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

        const pedidoId = await insertarPedidoProveedor(db, pedido);

        for (const gasto of gastos) {
            await insertarGastoPedido(db, { ...gasto, pedido_id: pedidoId });
        }

        for (const linea of lineas) {
            const itemKey = {
                referencia_stock: linea.referencia_stock,
                subtipo_material: linea.subtipo_material,
                espesor: linea.espesor,
                ancho: linea.ancho,
                color: linea.color
                // material_tipo_general NO es parte de la clave de búsqueda aquí, ya que la línea lo define
            };

            const itemExistente = await buscarStockItemExistente(db, itemKey);

            if (itemExistente) {
                // El ítem ya existe, actualizarlo
                const datosActualizacion = {
                    cantidad_nueva: parseFloat(linea.cantidad_original) || 0,
                    nuevo_coste_unitario_final: linea.coste_unitario_final_calculado,
                    nueva_fecha_entrada_almacen: pedido.fecha_llegada,
                    nuevo_pedido_id: pedidoId,
                    nueva_origen_factura: pedido.numero_factura,
                };
                await actualizarStockItemExistente(db, itemExistente.id, datosActualizacion);
                console.log(`Stock actualizado para ID: ${itemExistente.id}, Ref: ${itemKey.referencia_stock}`);
            } else {
                // El ítem no existe, insertarlo como nuevo
                const stockDataParaDB = {
                    pedido_id: pedidoId,
                    material_tipo: material_tipo_general.toUpperCase(),
                    subtipo_material: linea.subtipo_material,
                    referencia_stock: linea.referencia_stock,
                    fecha_entrada_almacen: pedido.fecha_llegada,
                    status: 'DISPONIBLE',
                    espesor: linea.espesor,
                    ancho: linea.ancho,
                    largo_inicial: parseFloat(linea.cantidad_original) || 0,
                    largo_actual: parseFloat(linea.cantidad_original) || 0,
                    unidad_medida: linea.unidad_medida || 'm',
                    coste_unitario_final: linea.coste_unitario_final_calculado,
                    color: linea.color,
                    ubicacion: linea.ubicacion,
                    notas: linea.notas_linea,
                    origen_factura: pedido.numero_factura
                };
                const nuevoStockId = await insertarStockMateriaPrima(db, stockDataParaDB);
                console.log(`Nuevo stock insertado con ID: ${nuevoStockId}, Ref: ${itemKey.referencia_stock}`);
            }
        }

        await new Promise((resolve, reject) => {
            db.run('COMMIT;', (err) => err ? reject(err) : resolve());
        });

        return { pedidoId, mensaje: `Pedido de ${material_tipo_general} (${pedido.origen_tipo}) procesado exitosamente.` };

    } catch (error) {
        console.error(`Error en la transacción de procesarNuevoPedido (${material_tipo_general}, ${pedido.origen_tipo}), revirtiendo:`, error.message);
        await new Promise((resolve, reject) => { db.run('ROLLBACK;', (rbErr) => rbErr ? reject(rbErr) : resolve()); }); // Manejar error de rollback si ocurre
        throw error; 
    } finally {
        db.close((closeErr) => {
            if (closeErr) console.error("Error cerrando la DB después de transacción en procesarNuevoPedido:", closeErr.message);
        });
    }
}

// backend-node/db_operations.js

// ... (tu código existente: conectarDB, consultarStockMateriasPrimas, etc.) ...

/**
 * Consulta la lista de pedidos/contenedores con filtros opcionales.
 * @param {object} filtros - Objeto con filtros opcionales (ej: { origen_tipo, proveedor_like, factura_like, fecha_desde, fecha_hasta })
 * @returns {Promise<Array>} Promesa que resuelve a un array de objetos de pedido.
 */
function consultarListaPedidos(filtros = {}) {
    return new Promise((resolve, reject) => {
        const db = conectarDB();
        let sql = `SELECT id, numero_factura, proveedor, fecha_pedido, fecha_llegada, origen_tipo, observaciones, valor_conversion 
                   FROM PedidosProveedores`;
        const params = [];
        const whereClauses = [];

        if (filtros.origen_tipo) {
            whereClauses.push(`origen_tipo = ?`);
            params.push(filtros.origen_tipo.toUpperCase());
        }
        if (filtros.proveedor_like) {
            whereClauses.push(`proveedor LIKE ?`);
            params.push(`%${filtros.proveedor_like}%`);
        }
        if (filtros.factura_like) {
            whereClauses.push(`numero_factura LIKE ?`);
            params.push(`%${filtros.factura_like}%`);
        }
        // Ejemplo básico para rango de fechas de pedido. SQLite guarda fechas como TEXT.
        // Para comparaciones de fechas robustas, asegúrate de que el formato sea 'YYYY-MM-DD'.
        if (filtros.fecha_pedido_desde) {
            whereClauses.push(`fecha_pedido >= ?`);
            params.push(filtros.fecha_pedido_desde); // Formato YYYY-MM-DD
        }
        if (filtros.fecha_pedido_hasta) {
            whereClauses.push(`fecha_pedido <= ?`);
            params.push(filtros.fecha_pedido_hasta); // Formato YYYY-MM-DD
        }
        // Podrías añadir más filtros para fecha_llegada, etc.

        if (whereClauses.length > 0) {
            sql += ` WHERE ${whereClauses.join(' AND ')}`;
        }
        
        sql += ` ORDER BY fecha_pedido DESC, id DESC`; // Ordenar por fecha de pedido más reciente

        console.log(`SQL (consultarListaPedidos): ${sql}`);
        console.log(`Params: ${JSON.stringify(params)}`);

        db.all(sql, params, (err, rows) => {
            db.close((closeErr) => {
                if (closeErr) {
                    console.error("Error cerrando la DB después de consultar lista de pedidos:", closeErr.message);
                }
            });
            if (err) {
                console.error("Error al consultar Lista de Pedidos:", err.message);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

// backend-node/db_operations.js

// ... (tu código existente: conectarDB, consultarStockMateriasPrimas, procesarNuevoPedido, consultarListaPedidos, etc.) ...

/**
 * Consulta los datos principales de un pedido por su ID.
 * @param {sqlite3.Database} db - Instancia de la base de datos.
 * @param {number} pedidoId - El ID del pedido.
 * @returns {Promise<object|null>}
 */
function consultarInfoPedidoPorId(db, pedidoId) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM PedidosProveedores WHERE id = ?`;
        db.get(sql, [pedidoId], (err, row) => {
            if (err) {
                console.error(`Error consultando info del pedido ${pedidoId}:`, err.message);
                return reject(err);
            }
            resolve(row || null);
        });
    });
}

/**
 * Consulta todos los gastos asociados a un pedidoId.
 * @param {sqlite3.Database} db - Instancia de la base de datos.
 * @param {number} pedidoId - El ID del pedido.
 * @returns {Promise<Array>}
 */
function consultarGastosPorPedidoId(db, pedidoId) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT id, tipo_gasto, descripcion, coste_eur FROM GastosPedido WHERE pedido_id = ? ORDER BY id`;
        db.all(sql, [pedidoId], (err, rows) => {
            if (err) {
                console.error(`Error consultando gastos para el pedido ${pedidoId}:`, err.message);
                return reject(err);
            }
            resolve(rows);
        });
    });
}

/**
 * Consulta todas las bobinas de stock asociadas a un pedidoId.
 * @param {sqlite3.Database} db - Instancia de la base de datos.
 * @param {number} pedidoId - El ID del pedido.
 * @returns {Promise<Array>}
 */
function consultarStockItemsPorPedidoId(db, pedidoId) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT id, referencia_stock, material_tipo, subtipo_material, espesor, ancho, color, 
                            largo_inicial, largo_actual, unidad_medida, coste_unitario_final, status, 
                            fecha_entrada_almacen, ubicacion, notas
                     FROM StockMateriasPrimas 
                     WHERE pedido_id = ? 
                     ORDER BY id`;
        db.all(sql, [pedidoId], (err, rows) => {
            if (err) {
                console.error(`Error consultando stock items para el pedido ${pedidoId}:`, err.message);
                return reject(err);
            }
            resolve(rows);
        });
    });
}

/**
 * Obtiene todos los detalles de un pedido: información principal, gastos y bobinas de stock.
 * @param {number} pedidoId - El ID del pedido a consultar.
 * @returns {Promise<object|null>} Objeto con pedidoInfo, gastos y stockItems, o null si el pedido no se encuentra.
 */
async function obtenerDetallesCompletosPedido(pedidoId) {
    const db = conectarDB();
    try {
        const pedidoInfo = await consultarInfoPedidoPorId(db, pedidoId);
        if (!pedidoInfo) {
            db.close((closeErr) => { // Cerrar DB si el pedido no se encuentra antes de retornar
                if (closeErr) console.error("Error cerrando DB (pedido no encontrado):", closeErr.message);
            });
            return null; // Pedido no encontrado
        }

        // Usar Promise.all para ejecutar consultas en paralelo
        const [gastos, stockItems] = await Promise.all([
            consultarGastosPorPedidoId(db, pedidoId),
            consultarStockItemsPorPedidoId(db, pedidoId)
        ]);

        return {
            pedidoInfo,
            gastos,
            stockItems
        };
    } catch (error) {
        console.error(`Error obteniendo detalles completos del pedido ${pedidoId}:`, error.message);
        // El 'finally' se encargará de cerrar la DB si se lanza una excepción aquí
        throw error; 
    } finally {
        // Asegurarse de cerrar la conexión a la base de datos en todos los casos
        // (excepto si ya se cerró porque el pedido no se encontró).
        // Si pedidoInfo fue null, la db ya se cerró. Si no, se cierra aquí.
        // Para evitar doble cierre, podrías manejar el cierre solo aquí
        // o añadir una bandera, pero `db.close()` es idempotente a errores de doble cierre.
        if (db && db.open) { // db.open es una propiedad que indica si la base de datos está abierta
            db.close((closeErr) => {
                if (closeErr) {
                    console.error("Error cerrando la DB después de obtenerDetallesCompletosPedido:", closeErr.message);
                }
            });
        }
    }
}


module.exports = {
    consultarStockMateriasPrimas,
    consultarItemStockPorId,
    procesarNuevoPedido,
    consultarListaPedidos,
    obtenerDetallesCompletosPedido
};

