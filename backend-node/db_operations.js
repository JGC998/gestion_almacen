// backend-node/db_operations.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Rutas
const almacenDir = path.resolve(__dirname, 'almacen');
const dbPath = path.resolve(almacenDir, 'almacen.db');
const configFilePath = path.resolve(__dirname, 'config.json');

// Asegúrate de que el directorio 'almacen' existe
if (!fs.existsSync(almacenDir)){
    fs.mkdirSync(almacenDir, { recursive: true });
}

/**
 * Establece una conexión a la base de datos SQLite.
 * Cada llamada a esta función abre una nueva conexión.
 * Es responsabilidad de la función que la llama cerrar la conexión.
 * @returns {sqlite3.Database} Objeto de la base de datos.
 * @throws {Error} Si no se puede conectar a la base de datos.
 */
function conectarDB() {
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error("Error al conectar a la base de datos desde db_operations:", err.message);
            // No lanzar error aquí, solo loguear. El Promise de la función principal lo manejará.
        }
    });
    // Habilitar claves foráneas (importante para la integridad referencial)
    db.exec('PRAGMA foreign_keys = ON;', (err) => {
        if (err) {
            console.error("Error al habilitar foreign keys en db_operations:", err.message);
        }
    });
    return db;
}

/**
 * Helper para ejecutar una query INSERT/UPDATE/DELETE.
 * Cierra la DB al finalizar.
 * @param {string} sql - La consulta SQL.
 * @param {Array} params - Los parámetros de la consulta.
 * @returns {Promise<object>} Objeto con lastID y changes.
 */
function runDB(sql, params = []) {
    const db = conectarDB();
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) { // No usar arrow function para this.lastID/changes
            db.close(); // Cerrar la conexión después de la operación
            if (err) {
                console.error('Error ejecutando SQL (run):', sql, params, err.message);
                return reject(err);
            }
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

/**
 * Helper para ejecutar una consulta ALL (seleccionar múltiples filas).
 * Cierra la DB al finalizar.
 * @param {string} sql - La consulta SQL.
 * @param {Array} params - Los parámetros de la consulta.
 * @returns {Promise<Array>} Array de filas.
 */
function allDB(sql, params = []) {
    const db = conectarDB();
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            db.close(); // Cerrar la conexión después de la operación
            if (err) {
                console.error('Error ejecutando SQL (all):', sql, params, err.message);
                return reject(err);
            }
            resolve(rows);
        });
    });
}

/**
 * Helper para ejecutar una consulta GET (seleccionar una sola fila).
 * Cierra la DB al finalizar.
 * @param {string} sql - La consulta SQL.
 * @param {Array} params - Los parámetros de la consulta.
 * @returns {Promise<object|null>} Una fila o null.
 */
function getDB(sql, params = []) {
    const db = conectarDB();
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            db.close(); // Cerrar la conexión después de la operación
            if (err) {
                console.error('Error ejecutando SQL (get):', sql, params, err.message);
                return reject(err);
            }
            resolve(row || null);
        });
    });
}

// --- Funciones para transacciones (no cierran la DB, la instancia se pasa) ---
// Estas son útiles cuando necesitas múltiples operaciones dentro de una única transacción.
// La función que inicia la transacción es responsable de cerrar la DB.

function runAsync(dbInstance, sql, params = []) {
    return new Promise((resolve, reject) => {
        dbInstance.run(sql, params, function(err) {
            if (err) {
                console.error('Error ejecutando SQL (transacción run):', sql, params, err.message);
                return reject(err);
            }
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function allAsync(dbInstance, sql, params = []) {
    return new Promise((resolve, reject) => {
        dbInstance.all(sql, params, (err, rows) => {
            if (err) {
                console.error('Error ejecutando SQL (transacción all):', sql, params, err.message);
                return reject(err);
            }
            resolve(rows);
        });
    });
}

function getAsync(dbInstance, sql, params = []) {
    return new Promise((resolve, reject) => {
        dbInstance.get(sql, params, (err, row) => {
            if (err) {
                console.error('Error ejecutando SQL (transacción get):', sql, params, err.message);
                return reject(err);
            }
            resolve(row || null);
        });
    });
}


// --- FUNCIONES EXISTENTES (Mantenidas o ligeramente modificadas) ---

async function consultarStockMateriasPrimas(filtros = null) {
    let sql = `SELECT * FROM StockMateriasPrimas`;
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
            whereClauses.push(`(UPPER(referencia_stock) LIKE ? OR UPPER(origen_factura) LIKE ? OR UPPER(espesor) LIKE ? OR UPPER(subtipo_material) LIKE ? OR UPPER(color) LIKE ? OR UPPER(ubicacion) LIKE ?)`);
            params.push(terminoBusqueda, terminoBusqueda, terminoBusqueda, terminoBusqueda, terminoBusqueda, terminoBusqueda);
        }
    }

    if (whereClauses.length > 0) {
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    
    sql += ` ORDER BY fecha_entrada_almacen DESC`;

    return await allDB(sql, params);
}

// NUEVA FUNCIÓN: Consultar StockComponentes
async function consultarStockComponentes(filtros = {}) {
    let sql = `SELECT * FROM StockComponentes`;
    const params = [];
    const whereClauses = [];

    if (filtros.componente_ref_like) {
        whereClauses.push(`componente_ref LIKE ?`);
        params.push(`%${filtros.componente_ref_like}%`);
    }
    if (filtros.status) {
        whereClauses.push(`status = ?`);
        params.push(filtros.status.toUpperCase());
    }

    if (whereClauses.length > 0) {
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    sql += ` ORDER BY fecha_entrada_almacen DESC`;

    return await allDB(sql, params);
}

async function consultarItemStockPorId(idItem, tablaItem) {
    const tablasPermitidas = ['StockMateriasPrimas', 'StockComponentes'];
    if (!tablasPermitidas.includes(tablaItem)) {
        throw new Error(`Tabla no válida: ${tablaItem}`);
    }
    const sql = `SELECT * FROM ${tablaItem} WHERE id = ?`;
    return await getDB(sql, [idItem]);
}

async function insertarPedidoProveedor(dbInstance, pedidoData) {
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
    try {
        const result = await runAsync(dbInstance, sql, params);
        return result.lastID;
    } catch (err) {
        if (err.message.includes("UNIQUE constraint failed: PedidosProveedores.numero_factura")) {
            throw new Error(`El número de factura '${pedidoData.numero_factura}' ya existe.`);
        }
        throw err;
    }
}

async function insertarGastoPedido(dbInstance, gastoData) {
    const sql = `INSERT INTO GastosPedido (pedido_id, tipo_gasto, descripcion, coste_eur)
                            VALUES (?, ?, ?, ?)`;
    const params = [
        gastoData.pedido_id,
        gastoData.tipo_gasto,
        gastoData.descripcion,
        gastoData.coste_eur
    ];
    const result = await runAsync(dbInstance, sql, params);
    return result.lastID;
}

// MODIFICADA: insertarStockMateriaPrima para incluir peso_total_kg
async function insertarStockMateriaPrima(dbInstance, stockData) {
    const sql = `INSERT INTO StockMateriasPrimas (
                            pedido_id, material_tipo, subtipo_material, referencia_stock,
                            fecha_entrada_almacen, status, espesor, ancho,
                            largo_inicial, largo_actual, unidad_medida, coste_unitario_final,
                            color, ubicacion, notas, origen_factura, peso_total_kg
                           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
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
        stockData.origen_factura,
        stockData.peso_total_kg
    ];
    try {
        const result = await runAsync(dbInstance, sql, params);
        return result.lastID;
    } catch (err) {
        if (err.message.includes("UNIQUE constraint failed: StockMateriasPrimas.referencia_stock")) {
            throw new Error(`La referencia de stock '${stockData.referencia_stock}' ya existe.`);
        }
        throw err;
    }
}

// MODIFICADA: buscarStockItemExistente - Ahora solo busca por referencia_stock (que es UNIQUE)
async function buscarStockItemExistente(dbInstance, referencia_stock) {
    const sql = `SELECT id, largo_actual, largo_inicial, coste_unitario_final, peso_total_kg FROM StockMateriasPrimas
                            WHERE referencia_stock = ?`;
    return await getAsync(dbInstance, sql, [referencia_stock]);
}

// MODIFICADA: actualizarStockItemExistente para incluir peso_total_kg
async function actualizarStockItemExistente(dbInstance, idStockItem, datosActualizacion) {
    const sql = `UPDATE StockMateriasPrimas
                            SET largo_actual = largo_actual + ?,
                                largo_inicial = largo_inicial + ?,
                                coste_unitario_final = ?,
                                fecha_entrada_almacen = ?,
                                pedido_id = ?,
                                origen_factura = ?,
                                peso_total_kg = peso_total_kg + ?,
                                status = 'DISPONIBLE'
                            WHERE id = ?`;
    const params = [
        datosActualizacion.cantidad_nueva,
        datosActualizacion.cantidad_nueva,
        datosActualizacion.nuevo_coste_unitario_final,
        datosActualizacion.nueva_fecha_entrada_almacen,
        datosActualizacion.nuevo_pedido_id,
        datosActualizacion.nueva_origen_factura,
        datosActualizacion.peso_nuevo_kg,
        idStockItem
    ];
    const result = await runAsync(dbInstance, sql, params);
    return result.changes;
}

async function procesarNuevoPedido(datosCompletosPedido) {
    const { pedido, lineas, gastos, material_tipo_general } = datosCompletosPedido;
    const db = conectarDB(); // Conexión para la transacción

    try {
        await runAsync(db, 'BEGIN TRANSACTION;');

        const pedidoId = await insertarPedidoProveedor(db, pedido);

        for (const gasto of gastos) {
            await insertarGastoPedido(db, { ...gasto, pedido_id: pedidoId });
        }

        for (const linea of lineas) {
            // Ahora se busca solo por referencia_stock, que es UNIQUE
            const itemExistente = await buscarStockItemExistente(db, linea.referencia_stock);

            if (itemExistente) {
                const datosActualizacion = {
                    cantidad_nueva: parseFloat(linea.cantidad_original) || 0,
                    nuevo_coste_unitario_final: parseFloat(linea.coste_unitario_final_calculado) || 0,
                    nueva_fecha_entrada_almacen: pedido.fecha_llegada,
                    nuevo_pedido_id: pedidoId,
                    nueva_origen_factura: pedido.numero_factura,
                    peso_nuevo_kg: parseFloat(linea.peso_total_kg) || 0
                };
                await actualizarStockItemExistente(db, itemExistente.id, datosActualizacion);
                console.log(`Stock actualizado para ID: ${itemExistente.id}, Ref: ${linea.referencia_stock}`);
            } else {
                const stockDataParaDB = {
                    pedido_id: pedidoId,
                    material_tipo: material_tipo_general.toUpperCase(),
                    subtipo_material: linea.subtipo_material || null,
                    referencia_stock: linea.referencia_stock,
                    fecha_entrada_almacen: pedido.fecha_llegada,
                    status: 'DISPONIBLE',
                    espesor: linea.espesor || null,
                    ancho: linea.ancho ? parseFloat(linea.ancho) : null,
                    largo_inicial: parseFloat(linea.cantidad_original) || 0,
                    largo_actual: parseFloat(linea.cantidad_original) || 0,
                    unidad_medida: linea.unidad_medida || 'm',
                    coste_unitario_final: parseFloat(linea.coste_unitario_final_calculado) || 0,
                    color: linea.color || null,
                    ubicacion: linea.ubicacion || null,
                    notas: linea.notas_linea || null,
                    origen_factura: pedido.numero_factura,
                    peso_total_kg: parseFloat(linea.peso_total_kg) || 0
                };
                const nuevoStockId = await insertarStockMateriaPrima(db, stockDataParaDB);
                console.log(`Nuevo stock insertado con ID: ${nuevoStockId}, Ref: ${linea.referencia_stock}`);
            }
        }

        await runAsync(db, 'COMMIT;');
        return { pedidoId, mensaje: `Pedido de ${material_tipo_general} (${pedido.origen_tipo}) procesado exitosamente.` };

    } catch (error) {
        console.error(`Error en la transacción de procesarNuevoPedido (${material_tipo_general}, ${pedido.origen_tipo}), revirtiendo:`, error.message);
        await runAsync(db, 'ROLLBACK;');
        throw error;
    } finally {
        db.close(); // Cerrar la conexión al finalizar la transacción
    }
}

async function consultarListaPedidos(filtros = {}) {
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
    if (filtros.fecha_pedido_desde) {
        whereClauses.push(`fecha_pedido >= ?`);
        params.push(filtros.fecha_pedido_desde);
    }
    if (filtros.fecha_pedido_hasta) {
        whereClauses.push(`fecha_pedido <= ?`);
        params.push(filtros.fecha_pedido_hasta);
    }

    if (whereClauses.length > 0) {
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    
    sql += ` ORDER BY fecha_pedido DESC, id DESC`;

    return await allDB(sql, params);
}

async function consultarInfoPedidoPorId(dbInstance, pedidoId) {
    return getAsync(dbInstance, `SELECT * FROM PedidosProveedores WHERE id = ?`, [pedidoId]);
}

async function consultarGastosPorPedidoId(dbInstance, pedidoId) {
    return allAsync(dbInstance, `SELECT id, tipo_gasto, descripcion, coste_eur FROM GastosPedido WHERE pedido_id = ? ORDER BY id`, [pedidoId]);
}

async function consultarStockItemsPorPedidoId(dbInstance, pedidoId) {
    return allAsync(dbInstance, `SELECT id, referencia_stock, material_tipo, subtipo_material, espesor, ancho, color,
                                 largo_inicial, largo_actual, unidad_medida, coste_unitario_final, status,
                                 fecha_entrada_almacen, ubicacion, notas, peso_total_kg
                           FROM StockMateriasPrimas
                           WHERE pedido_id = ?
                           ORDER BY id`, [pedidoId]);
}

async function consultarLineasPedidoPorPedidoId(dbInstance, pedidoId) {
    return allAsync(dbInstance, `SELECT cantidad_original, precio_unitario_original, moneda_original FROM LineasPedido WHERE pedido_id = ?`, [pedidoId]);
}

async function obtenerDetallesCompletosPedido(pedidoId) {
    const db = conectarDB(); // Conexión para la transacción
    try {
        const pedidoInfo = await consultarInfoPedidoPorId(db, pedidoId);
        if (!pedidoInfo) {
            return null;
        }

        const [gastos, stockItems, lineasPedidoOriginales] = await Promise.all([
            consultarGastosPorPedidoId(db, pedidoId),
            consultarStockItemsPorPedidoId(db, pedidoId),
            consultarLineasPedidoPorPedidoId(db, pedidoId)
        ]);

        let costeTotalPedidoSinGastosEnMonedaOriginal = 0;
        let valorConversion = 1;

        if (pedidoInfo.origen_tipo === 'CONTENEDOR' && pedidoInfo.valor_conversion !== null) {
            const parsedConversion = parseFloat(pedidoInfo.valor_conversion);
            if (!isNaN(parsedConversion) && parsedConversion > 0) {
                valorConversion = parsedConversion;
            } else {
                console.warn(`Pedido ID ${pedidoId}: Invalid valor_conversion '${pedidoInfo.valor_conversion}'. Defaulting to 1.`);
            }
        }

        lineasPedidoOriginales.forEach(linea => {
            const cantidad = parseFloat(linea.cantidad_original) || 0;
            const precioUnitarioOriginal = parseFloat(linea.precio_unitario_original) || 0;

            let precioUnitarioEur = precioUnitarioOriginal;
            if (pedidoInfo.origen_tipo === 'CONTENEDOR' && linea.moneda_original && linea.moneda_original.toUpperCase() !== 'EUR' && valorConversion !== 1) {
                precioUnitarioEur = precioUnitarioOriginal * valorConversion;
            }
            costeTotalPedidoSinGastosEnMonedaOriginal += (cantidad * precioUnitarioEur);
        });

        let totalGastosRepercutibles = 0;
        gastos.forEach(gasto => {
            // Solo incluir gastos SUPLIDOS que NO contengan la palabra "IVA" en la descripción
            if (gasto.tipo_gasto && gasto.tipo_gasto.toUpperCase() === 'SUPLIDOS' &&
                gasto.descripcion && !gasto.descripcion.toUpperCase().includes('IVA')) {
                totalGastosRepercutibles += (parseFloat(gasto.coste_eur) || 0);
            }
            // Si hay otros tipos de gasto que también deben repercutirse, se añadiría aquí
        });

        const porcentajeGastos = costeTotalPedidoSinGastosEnMonedaOriginal > 0
            ? totalGastosRepercutibles / costeTotalPedidoSinGastosEnMonedaOriginal
            : 0;

        return {
            pedidoInfo,
            gastos,
            stockItems,
            porcentajeGastos: porcentajeGastos
        };
    } catch (error) {
        console.error(`Error obteniendo detalles completos del pedido ${pedidoId}:`, error.message, error.stack);
        throw error;
    } finally {
        db.close(); // Cerrar la conexión al finalizar la transacción
    }
}

async function actualizarEstadoStockItem(stockItemId, nuevoEstado) {
    const estadosPermitidos = ['DISPONIBLE', 'AGOTADO', 'EMPEZADA', 'DESCATALOGADO'];
    if (!estadosPermitidos.includes(nuevoEstado.toUpperCase())) {
        throw new Error(`Estado '${nuevoEstado}' no válido.`);
    }

    const sql = `UPDATE StockMateriasPrimas SET status = ? WHERE id = ?`;
    const params = [nuevoEstado.toUpperCase(), stockItemId];

    try {
        const result = await runDB(sql, params);
        if (result.changes === 0) {
            throw new Error(`No se encontró el ítem de stock con ID ${stockItemId} para actualizar.`);
        }
        return result.changes;
    } catch (err) {
        console.error(`Error al actualizar estado del ítem de stock ${stockItemId}:`, err.message);
        throw err;
    }
}

async function eliminarPedidoCompleto(pedidoId) {
    const db = conectarDB(); // Conexión para la transacción
    try {
        await runAsync(db, 'BEGIN TRANSACTION;');

        const stockChanges = await runAsync(db, 'DELETE FROM StockMateriasPrimas WHERE pedido_id = ?', [pedidoId]);
        console.log(`StockMateriasPrimas eliminadas para pedido ID ${pedidoId}: ${stockChanges.changes} filas`);

        const gastosChanges = await runAsync(db, 'DELETE FROM GastosPedido WHERE pedido_id = ?', [pedidoId]);
        console.log(`GastosPedido eliminados para pedido ID ${pedidoId}: ${gastosChanges.changes} filas`);

        const lineasPedidoChanges = await runAsync(db, 'DELETE FROM LineasPedido WHERE pedido_id = ?', [pedidoId]);
        console.log(`LineasPedido eliminadas para pedido ID ${pedidoId}: ${lineasPedidoChanges.changes} filas`);

        const pedidoPrincipalChanges = await runAsync(db, 'DELETE FROM PedidosProveedores WHERE id = ?', [pedidoId]);
        console.log(`PedidosProveedores eliminado para ID ${pedidoId}: ${pedidoPrincipalChanges.changes} filas`);

        if (pedidoPrincipalChanges.changes === 0) {
            await runAsync(db, 'ROLLBACK;');
            throw new Error(`Pedido con ID ${pedidoId} no encontrado.`);
        }

        await runAsync(db, 'COMMIT;');
        return {
            pedidoPrincipalEliminado: pedidoPrincipalChanges.changes,
            gastosEliminados: gastosChanges.changes,
            lineasPedidoEliminadas: lineasPedidoChanges.changes,
            stockItemsEliminados: stockChanges.changes,
            mensaje: `Pedido ID ${pedidoId} y datos asociados eliminados.`
        };

    } catch (error) {
        console.error(`Error en la transacción de eliminarPedidoCompleto para ID ${pedidoId}, revirtiendo:`, error.message);
        await runAsync(db, 'ROLLBACK;');
        throw error;
    } finally {
        db.close(); // Cerrar la conexión al finalizar la transacción
    }
}


async function insertarProductoTerminado(productoData) {
    const { referencia, nombre, descripcion, unidad_medida, coste_fabricacion_estandar, status, material_principal, espesor_principal, ancho_final, largo_final } = productoData;
    const fecha_creacion = new Date().toISOString().split('T')[0];

    const query = `INSERT INTO ProductosTerminados (
        referencia, nombre, descripcion, unidad_medida, coste_fabricacion_estandar, fecha_creacion, status,
        material_principal, espesor_principal, ancho_final, largo_final
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [
        referencia,
        nombre,
        descripcion,
        unidad_medida || 'unidad', // Valor por defecto si no se provee
        parseFloat(coste_fabricacion_estandar) || 0, // Asegurar que es un número
        fecha_creacion,
        status || 'ACTIVO', // Valor por defecto
        material_principal,
        espesor_principal,
        parseFloat(ancho_final) || null, // Asegurar que es un número o null
        parseFloat(largo_final) || null  // Asegurar que es un número o null
    ];

    try {
        // Usar el helper runDB que maneja la conexión y el cierre
        const result = await runDB(query, params);
        return result.lastID;
    } catch (err) {
        console.error("Error al insertar producto terminado:", err.message);
        if (err.message.includes("UNIQUE constraint failed: ProductosTerminados.referencia")) {
            // Es importante relanzar para que el endpoint pueda manejar el error HTTP correcto
            throw new Error("La referencia del producto terminado ya existe.");
        }
        throw err; // Relanzar otros errores
    }
}

// Modificada para seleccionar los nuevos campos
async function consultarProductosTerminados(filtros = {}) {
    let query = `SELECT id, referencia, nombre, descripcion, unidad_medida, coste_fabricacion_estandar, status,
                         material_principal, espesor_principal, ancho_final, largo_final
                         FROM ProductosTerminados`;
    const params = [];
    const conditions = [];

    if (filtros.status) {
        conditions.push(`status = ?`);
        params.push(filtros.status);
    }
    // Puedes añadir más filtros aquí si los necesitas

    if (conditions.length > 0) {
        query += ` WHERE ` + conditions.join(' AND ');
    }

    // Utiliza la función helper allDB que maneja la conexión y cierre
    try {
        const rows = await allDB(query, params);
        return rows;
    } catch (error) {
        console.error("Error al consultar productos terminados:", error.message);
        // Lanza el error para que sea capturado por el endpoint en server.js
        throw error;
    }
}

// Modificada para seleccionar los nuevos campos
async function consultarProductoTerminadoPorId(id) {
    return new Promise((resolve, reject) => {
        const query = `SELECT id, referencia, nombre, descripcion, unidad_medida, coste_fabricacion_estandar, status,
                       material_principal, espesor_principal, ancho_final, largo_final
                       FROM ProductosTerminados WHERE id = ?`;
        db.get(query, [id], (err, row) => {
            if (err) {
                console.error("Error al consultar producto terminado por ID:", err.message);
                return reject(err);
            }
            resolve(row);
        });
    });
}

// Modificada para permitir la actualización de los nuevos campos
async function actualizarProductoTerminado(id, updates) {
    return new Promise((resolve, reject) => {
        const setParts = [];
        const params = [];
        for (const key in updates) {
            // Asegúrate de que solo actualizas campos válidos
            if (['referencia', 'nombre', 'descripcion', 'unidad_medida', 'coste_fabricacion_estandar', 'status',
                 'material_principal', 'espesor_principal', 'ancho_final', 'largo_final'].includes(key)) {
                setParts.push(`${key} = ?`);
                params.push(updates[key]);
            }
        }
        if (setParts.length === 0) {
            return reject(new Error("No se proporcionaron campos válidos para actualizar."));
        }
        params.push(id);
        const query = `UPDATE ProductosTerminados SET ${setParts.join(', ')} WHERE id = ?`;
        db.run(query, params, function(err) {
            if (err) {
                console.error("Error al actualizar producto terminado:", err.message);
                if (err.message.includes("UNIQUE constraint failed: ProductosTerminados.referencia")) {
                    return reject(new Error("La referencia del producto terminado ya existe."));
                }
                return reject(err);
            }
            resolve(this.changes);
        });
    });
}

// ... (tu función eliminarProductoTerminado se mantiene igual)

// --- NUEVA FUNCIÓN PARA CALCULAR COSTE DE MATERIAL ESPECÍFICO ---
// Esta función es un ejemplo y debe ser adaptada a tu lógica de negocio
// y a la estructura de tu tabla StockMateriasPrimas.
async function calcularCosteMaterialEspecifico(material_tipo, espesor, ancho, largo, appConfig) {
    try {
        const queryMateriaPrima = `
            SELECT coste_unitario_final, unidad_medida
            FROM StockMateriasPrimas
            WHERE material_tipo = ? AND espesor = ?
            ORDER BY fecha_entrada_almacen DESC, id DESC
            LIMIT 1
        `;
        // Usar el helper getDB que maneja la conexión y el cierre
        const materiaPrima = await getDB(queryMateriaPrima, [material_tipo, espesor]);

        let costeBaseUnitarioMaterial = 0;
        let unidadMedidaMaterial = 'm'; // Asumir metros por defecto para bobinas

        if (materiaPrima) {
            costeBaseUnitarioMaterial = parseFloat(materiaPrima.coste_unitario_final) || 0;
            unidadMedidaMaterial = materiaPrima.unidad_medida || 'm';
        } else {
            // Lógica de fallback si no se encuentra la materia prima (puedes ajustarla)
            console.warn(`No se encontró materia prima en stock para ${material_tipo} con espesor ${espesor}. Usando coste por defecto simulado.`);
            if (material_tipo === 'Goma') {
                if (espesor === '6mm') costeBaseUnitarioMaterial = 5.0;
                else if (espesor === '8mm') costeBaseUnitarioMaterial = 6.5;
                else if (espesor === '10mm') costeBaseUnitarioMaterial = 8.0;
                else if (espesor === '12mm') costeBaseUnitarioMaterial = 9.5;
                else if (espesor === '15mm') costeBaseUnitarioMaterial = 11.0;
            } else if (material_tipo === 'PVC') {
                if (espesor === '2mm') costeBaseUnitarioMaterial = 3.0;
                else if (espesor === '3mm') costeBaseUnitarioMaterial = 4.0;
            } else if (material_tipo === 'Fieltro') {
                if (espesor === 'F10') costeBaseUnitarioMaterial = 2.5;
                else if (espesor === 'F15') costeBaseUnitarioMaterial = 3.5;
            }
        }

        let costeTotalMaterial = 0;
        if (unidadMedidaMaterial.toLowerCase() === 'm' || unidadMedidaMaterial.toLowerCase() === 'm2') { // Asumir m2 o m lineal donde el ancho es relevante
            // Si el coste es por m2, y el producto usa largo * ancho de ese material:
            // costeTotalMaterial = costeBaseUnitarioMaterial * ancho * largo;
            // Si el coste es por m lineal de un ancho estándar y el producto requiere un ancho diferente, se complica.
            // Por ahora, si es 'm', asumimos que es coste por m lineal de ese ancho específico si 'ancho' es el del producto.
            // Si costeBaseUnitarioMaterial es por metro lineal de un ancho de bobina X, y el producto es de ancho Y, largo Z:
            // (costeBaseUnitarioMaterial / X_bobina) * Y_producto * Z_producto
            // Para simplificar, si la unidad es 'm', asumimos que el coste unitario es por m de la pieza de ancho 'ancho'
            costeTotalMaterial = costeBaseUnitarioMaterial * largo; // Simplificación: coste por metro lineal de la pieza
                                                                // Si ancho se refiere al ancho de la materia prima original y coste es por m2:
                                                                // costeTotalMaterial = costeBaseUnitarioMaterial * ancho_MP_para_pieza * largo;
                                                                // Es importante definir bien qué significa coste_unitario_final
        } else if (unidadMedidaMaterial.toLowerCase() === 'ud') {
            costeTotalMaterial = costeBaseUnitarioMaterial; // Asumimos que la cantidad es 1 ud. para el cálculo temporal
        }
        // Añadir más lógica para otras unidades si es necesario

        let costeManoObra = 0;
        if (appConfig && appConfig.coste_mano_obra_por_metro_metraje) { // Verificar que appConfig y la propiedad existan
             costeManoObra = (parseFloat(appConfig.coste_mano_obra_por_metro_metraje) || 0) * largo;
        }

        const costeFinalCalculado = costeTotalMaterial + costeManoObra;
        return costeFinalCalculado;

    } catch (error) {
        console.error("Error en calcularCosteMaterialEspecifico:", error.message, error.stack);
        throw error; // Relanzar para que el endpoint lo capture
    }
}


async function eliminarProductoTerminado(id) {
    const sql = `DELETE FROM ProductosTerminados WHERE id = ?`;
    try {
        const result = await runDB(sql, [id]);
        if (result.changes === 0) {
            throw new Error(`No se encontró ProductoTerminado con ID ${id} para eliminar.`);
        }
        return result.changes;
    } catch (error) {
        throw error;
    }
}

// --- Maquinaria ---
async function insertarMaquinaria(maquinaData) {
    const sql = `INSERT INTO Maquinaria (
        nombre, descripcion, coste_adquisicion, coste_hora_operacion
    ) VALUES (?, ?, ?, ?)`;
    const params = [
        maquinaData.nombre,
        maquinaData.descripcion || null,
        parseFloat(maquinaData.coste_adquisicion) || 0,
        parseFloat(maquinaData.coste_hora_operacion) || 0
    ];
    try {
        const result = await runDB(sql, params);
        return result.lastID;
    } catch (error) {
        if (error.message.includes("UNIQUE constraint failed: Maquinaria.nombre")) {
            throw new Error(`El nombre de la máquina '${maquinaData.nombre}' ya existe.`);
        }
        throw error;
    }
}

async function consultarMaquinaria(filtros = {}) {
    let sql = `SELECT * FROM Maquinaria`;
    const params = [];
    const whereClauses = [];

    if (filtros.nombre_like) {
        whereClauses.push(`nombre LIKE ?`);
        params.push(`%${filtros.nombre_like}%`);
    }
    if (whereClauses.length > 0) {
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    sql += ` ORDER BY nombre ASC`;

    return await allDB(sql, params);
}

async function consultarMaquinariaPorId(id) {
    const sql = `SELECT * FROM Maquinaria WHERE id = ?`;
    return await getDB(sql, [id]);
}

async function actualizarMaquinaria(id, updates) {
    const setClauses = [];
    const params = [];

    for (const key in updates) {
        if (updates.hasOwnProperty(key) && key !== 'id') {
            setClauses.push(`${key} = ?`);
            if (['coste_adquisicion', 'coste_hora_operacion'].includes(key)) {
                params.push(parseFloat(updates[key]) || 0);
            } else {
                params.push(updates[key]);
            }
        }
    }

    if (setClauses.length === 0) {
        throw new Error("No hay campos para actualizar.");
    }

    params.push(id);
    const sql = `UPDATE Maquinaria SET ${setClauses.join(', ')} WHERE id = ?`;
    try {
        const result = await runDB(sql, params);
        if (result.changes === 0) {
            throw new Error(`No se encontró Maquinaria con ID ${id} para actualizar.`);
        }
        return result.changes;
    } catch (error) {
        if (error.message.includes("UNIQUE constraint failed: Maquinaria.nombre")) {
            throw new Error(`El nombre de la máquina ya existe.`);
        }
        throw error;
    }
}

async function eliminarMaquinaria(id) {
    const sql = `DELETE FROM Maquinaria WHERE id = ?`;
    try {
        const result = await runDB(sql, [id]);
        if (result.changes === 0) {
            throw new Error(`No se encontró Maquinaria con ID ${id} para eliminar.`);
        }
        return result.changes;
    } catch (error) {
        // Manejar error de restricción de clave foránea si la máquina está en uso
        if (error.message.includes("FOREIGN KEY constraint failed")) {
            throw new Error(`No se puede eliminar la máquina ID ${id} porque está asociada a un proceso de fabricación.`);
        }
        throw error;
    }
}

// --- Recetas (Lista de Materiales - BOM) ---
// MODIFICADA: insertarReceta para usar campos genéricos
async function insertarReceta(recetaData) {
    const sql = `INSERT INTO Recetas (
        producto_terminado_id, 
        material_tipo_generico, subtipo_material_generico, espesor_generico, ancho_generico, color_generico,
        componente_ref_generico,
        cantidad_requerida, unidad_medida_requerida, unidades_por_ancho_material, peso_por_unidad_producto, notas
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
        recetaData.producto_terminado_id,
        recetaData.material_tipo_generico || null,
        recetaData.subtipo_material_generico || null,
        recetaData.espesor_generico || null,
        recetaData.ancho_generico ? parseFloat(recetaData.ancho_generico) : null,
        recetaData.color_generico || null,
        recetaData.componente_ref_generico || null,
        parseFloat(recetaData.cantidad_requerida) || 0,
        recetaData.unidad_medida_requerida || 'unidad',
        parseFloat(recetaData.unidades_por_ancho_material) || null,
        parseFloat(recetaData.peso_por_unidad_producto) || null,
        recetaData.notas || null
    ];
    try {
        const result = await runDB(sql, params);
        return result.lastID;
    } catch (error) {
        if (error.message.includes("FOREIGN KEY constraint failed")) {
            throw new Error(`Producto terminado no válido.`);
        }
        if (error.message.includes("CHECK constraint failed")) {
            throw new Error(`Debe especificar un material genérico O un componente genérico, no ambos.`);
        }
        throw error;
    }
}

// MODIFICADA: consultarRecetas para usar campos genéricos
async function consultarRecetas(filtros = {}) {
    let sql = `SELECT r.*, pt.nombre AS producto_nombre, pt.referencia AS producto_referencia
                    FROM Recetas r
                    JOIN ProductosTerminados pt ON r.producto_terminado_id = pt.id`;
    const params = [];
    const whereClauses = [];

    if (filtros.producto_terminado_id) {
        whereClauses.push(`r.producto_terminado_id = ?`);
        params.push(filtros.producto_terminado_id);
    }
    // Filtros por campos genéricos (si se necesitan)
    if (filtros.material_tipo_generico) {
        whereClauses.push(`r.material_tipo_generico = ?`);
        params.push(filtros.material_tipo_generico);
    }
    if (filtros.componente_ref_generico) {
        whereClauses.push(`r.componente_ref_generico = ?`);
        params.push(filtros.componente_ref_generico);
    }

    if (whereClauses.length > 0) {
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    sql += ` ORDER BY pt.nombre, r.id ASC`;

    return await allDB(sql, params);
}

// MODIFICADA: consultarRecetaPorId para usar campos genéricos
async function consultarRecetaPorId(id) {
    let sql = `SELECT r.*, pt.nombre AS producto_nombre, pt.referencia AS producto_referencia
                    FROM Recetas r
                    JOIN ProductosTerminados pt ON r.producto_terminado_id = pt.id
                    WHERE r.id = ?`;
    return await getDB(sql, [id]);
}

// MODIFICADA: actualizarReceta para usar campos genéricos
async function actualizarReceta(id, updates) {
    const setClauses = [];
    const params = [];

    for (const key in updates) {
        if (updates.hasOwnProperty(key) && key !== 'id') {
            setClauses.push(`${key} = ?`);
            if (['cantidad_requerida', 'unidades_por_ancho_material', 'peso_por_unidad_producto', 'ancho_generico'].includes(key)) {
                params.push(parseFloat(updates[key]) || null);
            } else {
                params.push(updates[key]);
            }
        }
    }

    if (setClauses.length === 0) {
        throw new Error("No hay campos para actualizar.");
    }

    params.push(id);
    const sql = `UPDATE Recetas SET ${setClauses.join(', ')} WHERE id = ?`;
    try {
        const result = await runDB(sql, params);
        if (result.changes === 0) {
            throw new Error(`No se encontró Receta con ID ${id} para actualizar.`);
        }
        return result.changes;
    } catch (error) {
        if (error.message.includes("CHECK constraint failed")) {
            throw new Error(`Debe especificar un material genérico O un componente genérico, no ambos.`);
        }
        throw error;
    }
}

async function eliminarReceta(id) {
    const sql = `DELETE FROM Recetas WHERE id = ?`;
    try {
        const result = await runDB(sql, [id]);
        if (result.changes === 0) {
            throw new Error(`No se encontró Receta con ID ${id} para eliminar.`);
        }
        return result.changes;
    } catch (error) {
        throw error;
    }
}

// --- ProcesosFabricacion ---
// MODIFICADA: insertarProcesoFabricacion para incluir aplica_a_clientes
async function insertarProcesoFabricacion(procesoData) {
    const sql = `INSERT INTO ProcesosFabricacion (
        producto_terminado_id, maquinaria_id, nombre_proceso,
        tiempo_estimado_horas, aplica_a_clientes
    ) VALUES (?, ?, ?, ?, ?)`;
    const params = [
        procesoData.producto_terminado_id,
        procesoData.maquinaria_id,
        procesoData.nombre_proceso,
        parseFloat(procesoData.tiempo_estimado_horas) || 0,
        procesoData.aplica_a_clientes || 'ALL' // Por defecto 'ALL'
    ];
    try {
        const result = await runDB(sql, params);
        return result.lastID;
    } catch (error) {
        if (error.message.includes("FOREIGN KEY constraint failed")) {
            throw new Error(`Producto terminado o maquinaria no válida.`);
        }
        throw error;
    }
}

// MODIFICADA: consultarProcesosFabricacion para incluir aplica_a_clientes
async function consultarProcesosFabricacion(filtros = {}) {
    let sql = `SELECT pf.*, pt.nombre AS producto_nombre, pt.referencia AS producto_referencia,
                         m.nombre AS maquinaria_nombre
                    FROM ProcesosFabricacion pf
                    JOIN ProductosTerminados pt ON pf.producto_terminado_id = pt.id
                    JOIN Maquinaria m ON pf.maquinaria_id = m.id`;
    const params = [];
    const whereClauses = [];

    if (filtros.producto_terminado_id) {
        whereClauses.push(`pf.producto_terminado_id = ?`);
        params.push(filtros.producto_terminado_id);
    }
    if (filtros.maquinaria_id) {
        whereClauses.push(`pf.maquinaria_id = ?`);
        params.push(filtros.maquinaria_id);
    }
    if (filtros.aplica_a_clientes) { // Filtro por el nuevo campo
        whereClauses.push(`pf.aplica_a_clientes LIKE ?`);
        params.push(`%${filtros.aplica_a_clientes}%`);
    }

    if (whereClauses.length > 0) {
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    sql += ` ORDER BY pt.nombre, pf.nombre_proceso ASC`;

    return await allDB(sql, params);
}

// MODIFICADA: consultarProcesoFabricacionPorId para incluir aplica_a_clientes
async function consultarProcesoFabricacionPorId(id) {
    let sql = `SELECT pf.*, pt.nombre AS producto_nombre, pt.referencia AS producto_referencia,
                         m.nombre AS maquinaria_nombre
                    FROM ProcesosFabricacion pf
                    JOIN ProductosTerminados pt ON pf.producto_terminado_id = pt.id
                    JOIN Maquinaria m ON pf.maquinaria_id = m.id
                    WHERE pf.id = ?`;
    return await getDB(sql, [id]);
}

// MODIFICADA: actualizarProcesoFabricacion para incluir aplica_a_clientes
async function actualizarProcesoFabricacion(id, updates) {
    const setClauses = [];
    const params = [];

    for (const key in updates) {
        if (updates.hasOwnProperty(key) && key !== 'id') {
            setClauses.push(`${key} = ?`);
            if (key === 'tiempo_estimado_horas') {
                params.push(parseFloat(updates[key]) || 0);
            } else {
                params.push(updates[key]);
            }
        }
    }

    if (setClauses.length === 0) {
        throw new Error("No hay campos para actualizar.");
    }

    params.push(id);
    const sql = `UPDATE ProcesosFabricacion SET ${setClauses.join(', ')} WHERE id = ?`;
    try {
        const result = await runDB(sql, params);
        if (result.changes === 0) {
            throw new Error(`No se encontró Proceso de Fabricación con ID ${id} para actualizar.`);
        }
        return result.changes;
    } catch (error) {
        if (error.message.includes("FOREIGN KEY constraint failed")) {
            throw new Error(`Producto terminado o maquinaria no válida.`);
        }
        throw error;
    }
}

async function eliminarProcesoFabricacion(id) {
    const sql = `DELETE FROM ProcesosFabricacion WHERE id = ?`;
    try {
        const result = await runDB(sql, [id]);
        if (result.changes === 0) {
            throw new Error(`No se encontró Proceso de Fabricación con ID ${id} para eliminar.`);
        }
        return result.changes;
    } catch (error) {
        throw error;
    }
}

// --- OrdenesProduccion ---
async function insertarOrdenProduccion(ordenData) {
    const sql = `INSERT INTO OrdenesProduccion (
        producto_terminado_id, cantidad_a_producir, fecha, observaciones
    ) VALUES (?, ?, ?, ?)`;
    const params = [
        ordenData.producto_terminado_id,
        parseFloat(ordenData.cantidad_a_producir) || 0,
        ordenData.fecha || new Date().toISOString().split('T')[0],
        ordenData.observaciones || null
    ];
    try {
        const result = await runDB(sql, params);
        return result.lastID;
    } catch (error) {
        if (error.message.includes("FOREIGN KEY constraint failed")) {
            throw new Error(`Producto terminado no válido.`);
        }
        throw error;
    }
}

async function consultarOrdenesProduccion(filtros = {}) {
    let sql = `SELECT op.*, pt.nombre AS producto_nombre, pt.referencia AS producto_referencia
                    FROM OrdenesProduccion op
                    JOIN ProductosTerminados pt ON op.producto_terminado_id = pt.id`;
    const params = [];
    const whereClauses = [];

    if (filtros.producto_id) {
        whereClauses.push(`op.producto_terminado_id = ?`);
        params.push(filtros.producto_id);
    }
    if (filtros.fecha_desde) {
        whereClauses.push(`op.fecha >= ?`);
        params.push(filtros.fecha_desde);
    }
    if (filtros.fecha_hasta) {
        whereClauses.push(`op.fecha <= ?`);
        params.push(filtros.fecha_hasta);
    }

    if (whereClauses.length > 0) {
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    sql += ` ORDER BY op.fecha DESC, op.id DESC`;

    return await allDB(sql, params);
}

async function consultarOrdenProduccionPorId(id) {
    let sql = `SELECT op.*, pt.nombre AS producto_nombre, pt.referencia AS producto_referencia
                    FROM OrdenesProduccion op
                    JOIN ProductosTerminados pt ON op.producto_terminado_id = pt.id
                    WHERE op.id = ?`;
    return await getDB(sql, [id]);
}

async function actualizarOrdenProduccion(id, updates) {
    const setClauses = [];
    const params = [];

    for (const key in updates) {
        if (updates.hasOwnProperty(key) && key !== 'id') {
            setClauses.push(`${key} = ?`);
            if (key === 'cantidad_a_producir' || key === 'coste_real_fabricacion') {
                params.push(parseFloat(updates[key]) || 0);
            } else {
                params.push(updates[key]);
            }
        }
    }

    if (setClauses.length === 0) {
        throw new Error("No hay campos para actualizar.");
    }

    params.push(id);
    const sql = `UPDATE OrdenesProduccion SET ${setClauses.join(', ')} WHERE id = ?`;
    try {
        const result = await runDB(sql, params);
        if (result.changes === 0) {
            throw new Error(`No se encontró Orden de Producción con ID ${id} para actualizar.`);
        }
        return result.changes;
    } catch (error) {
        throw error;
    }
}

async function eliminarOrdenProduccion(id) {
    const sql = `DELETE FROM OrdenesProduccion WHERE id = ?`;
    try {
        const result = await runDB(sql, [id]);
        if (result.changes === 0) {
            throw new Error(`No se encontró Orden de Producción con ID ${id} para eliminar.`);
        }
        return result.changes;
    } catch (error) {
        throw error;
    }
}

// --- StockProductosTerminados ---
async function insertarStockProductoTerminado(dbInstance, stockData) {
    const sql = `INSERT INTO StockProductosTerminados (
        producto_id, orden_produccion_id, cantidad_actual, unidad_medida,
        coste_unitario_final, fecha_entrada_almacen, status, ubicacion, notas
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
        stockData.producto_id,
        stockData.orden_produccion_id || null,
        parseFloat(stockData.cantidad_actual) || 0,
        stockData.unidad_medida || 'unidad',
        parseFloat(stockData.coste_unitario_final) || 0,
        stockData.fecha_entrada_almacen || new Date().toISOString().split('T')[0],
        stockData.status || 'DISPONIBLE',
        stockData.ubicacion || null,
        stockData.notas || null
    ];
    try {
        const result = await runAsync(dbInstance, sql, params);
        return result.lastID;
    } catch (error) {
        if (error.message.includes("FOREIGN KEY constraint failed")) {
            throw new Error(`Producto o Orden de Producción no válidos.`);
        }
        throw error;
    }
}

async function consultarStockProductosTerminados(filtros = {}) {
    let sql = `SELECT spt.*, pt.nombre AS producto_nombre, pt.referencia AS producto_referencia
                    FROM StockProductosTerminados spt
                    JOIN ProductosTerminados pt ON spt.producto_id = pt.id`;
    const params = [];
    const whereClauses = [];

    if (filtros.producto_id) {
        whereClauses.push(`spt.producto_id = ?`);
        params.push(filtros.producto_id);
    }
    if (filtros.status) {
        whereClauses.push(`spt.status = ?`);
        params.push(filtros.status.toUpperCase());
    }
    if (filtros.referencia_like) {
        whereClauses.push(`pt.referencia LIKE ?`);
        params.push(`%${filtros.referencia_like}%`);
    }

    if (whereClauses.length > 0) {
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    sql += ` ORDER BY pt.nombre, spt.fecha_entrada_almacen DESC`;

    return await allDB(sql, params);
}

async function consultarStockProductoTerminadoPorId(id) {
    let sql = `SELECT spt.*, pt.nombre AS producto_nombre, pt.referencia AS producto_referencia
                    FROM StockProductosTerminados spt
                    JOIN ProductosTerminados pt ON spt.producto_id = pt.id
                    WHERE spt.id = ?`;
    return await getDB(sql, [id]);
}

async function actualizarStockProductoTerminado(id, updates) {
    const setClauses = [];
    const params = [];

    for (const key in updates) {
        if (updates.hasOwnProperty(key) && key !== 'id') {
            setClauses.push(`${key} = ?`);
            if (key === 'cantidad_actual' || key === 'coste_unitario_final') {
                params.push(parseFloat(updates[key]) || 0);
            } else {
                params.push(updates[key]);
            }
        }
    }

    if (setClauses.length === 0) {
        throw new Error("No hay campos para actualizar.");
    }

    params.push(id);
    const sql = `UPDATE StockProductosTerminados SET ${setClauses.join(', ')} WHERE id = ?`;
    try {
        const result = await runDB(sql, params);
        if (result.changes === 0) {
            throw new Error(`No se encontró Stock de Producto Terminado con ID ${id} para actualizar.`);
        }
        return result.changes;
    } catch (error) {
        throw error;
    }
}

async function eliminarStockProductoTerminado(id) {
    const sql = `DELETE FROM StockProductosTerminados WHERE id = ?`;
    try {
        const result = await runDB(sql, [id]);
        if (result.changes === 0) {
            throw new Error(`No se encontró Stock de Producto Terminado con ID ${id} para eliminar.`);
        }
        return result.changes;
    } catch (error) {
        throw error;
    }
}

// --- LÓGICA DE CÁLCULO DE COSTES DE FABRICACIÓN ---

/**
 * Obtiene el último coste unitario de un material genérico (materia prima o componente).
 * @param {sqlite3.Database} dbInstance - Instancia de la base de datos.
 * @param {object} materialGenerico - Objeto con las características genéricas del material.
 * @returns {Promise<number>} El último coste unitario conocido.
 */
async function obtenerUltimoCosteMaterialGenerico(dbInstance, materialGenerico) {
    if (materialGenerico.material_tipo_generico) {
        const sql = `
            SELECT coste_unitario_final
            FROM StockMateriasPrimas
            WHERE material_tipo = ?
              AND (subtipo_material = ? OR (subtipo_material IS NULL AND ? IS NULL))
              AND (espesor = ? OR (espesor IS NULL AND ? IS NULL))
              AND (ancho = ? OR (ancho IS NULL AND ? IS NULL))
              AND (color = ? OR (color IS NULL AND ? IS NULL))
            ORDER BY fecha_entrada_almacen DESC, id DESC
            LIMIT 1
        `;
        const params = [
            materialGenerico.material_tipo_generico,
            materialGenerico.subtipo_material_generico, materialGenerico.subtipo_material_generico,
            materialGenerico.espesor_generico, materialGenerico.espesor_generico,
            materialGenerico.ancho_generico, materialGenerico.ancho_generico,
            materialGenerico.color_generico, materialGenerico.color_generico
        ];
        const row = await getAsync(dbInstance, sql, params);
        return row ? parseFloat(row.coste_unitario_final) : 0;
    } else if (materialGenerico.componente_ref_generico) {
        const sql = `
            SELECT coste_unitario_final
            FROM StockComponentes
            WHERE componente_ref = ?
            ORDER BY fecha_entrada_almacen DESC, id DESC
            LIMIT 1
        `;
        const row = await getAsync(dbInstance, sql, [materialGenerico.componente_ref_generico]);
        return row ? parseFloat(row.coste_unitario_final) : 0;
    }
    return 0;
}

/**
 * Calcula el coste de materiales para un producto terminado basado en su receta genérica.
 * Usa el último coste conocido de los materiales genéricos.
 * @param {sqlite3.Database} dbInstance - Instancia de la base de datos.
 * @param {number} productoTerminadoId - ID del producto terminado.
 * @returns {Promise<number>} Coste total de materiales.
 */
async function calcularCosteMateriales(dbInstance, productoTerminadoId) {
    const recetas = await allAsync(dbInstance, `
        SELECT r.cantidad_requerida, r.unidades_por_ancho_material,
               r.material_tipo_generico, r.subtipo_material_generico, r.espesor_generico, r.ancho_generico, r.color_generico,
               r.componente_ref_generico
        FROM Recetas r
        WHERE r.producto_terminado_id = ?
    `, [productoTerminadoId]);

    let costeTotalMateriales = 0;
    for (const receta of recetas) {
        const cantidadRequerida = parseFloat(receta.cantidad_requerida) || 0;
        const unidadesPorAncho = parseFloat(receta.unidades_por_ancho_material) || 1;

        const costeUnitarioGenerico = await obtenerUltimoCosteMaterialGenerico(dbInstance, receta);
        
        let costeMaterialPorUnidadPT = costeUnitarioGenerico;
        if (receta.material_tipo_generico) { // Si es materia prima (bobina), aplicar aprovechamiento de ancho
            // Si el coste unitario es por metro lineal y la receta requiere un ancho, ajustar.
            // Esto es una simplificación. La lógica real depende de cómo se almacena el coste unitario.
            // Si coste_unitario_final es por metro cuadrado, entonces:
            // costeMaterialPorUnidadPT = costeUnitarioGenerico * (receta.ancho_generico || 1);
            // Si es por metro lineal y el producto consume un ancho específico:
            costeMaterialPorUnidadPT = (costeUnitarioGenerico / unidadesPorAncho); // Coste por unidad de producto terminado
        }
        costeTotalMateriales += cantidadRequerida * costeMaterialPorUnidadPT;
    }
    return costeTotalMateriales;
}

/**
 * Calcula el coste de los procesos de fabricación para un producto terminado.
 * Para el coste estándar, suma todos los procesos.
 * @param {sqlite3.Database} dbInstance - Instancia de la base de datos.
 * @param {number} productoTerminadoId - ID del producto terminado.
 * @param {object} configuraciones - Objeto con las configuraciones cargadas (ej. coste_mano_obra_default).
 * @returns {Promise<number>} Coste total de procesos (maquinaria + mano de obra).
 */
async function calcularCosteProcesos(dbInstance, productoTerminadoId, configuraciones) {
    const procesos = await allAsync(dbInstance, `
        SELECT pf.tiempo_estimado_horas,
               m.coste_hora_operacion
        FROM ProcesosFabricacion pf
        JOIN Maquinaria m ON pf.maquinaria_id = m.id
        WHERE pf.producto_terminado_id = ?
    `, [productoTerminadoId]);

    const costeManoObraDefault = parseFloat(configuraciones.coste_mano_obra_default || 0);

    let costeTotalProcesos = 0;
    for (const proceso of procesos) {
        const tiempoHoras = parseFloat(proceso.tiempo_estimado_horas) || 0;
        const costeMaquinaOperacion = parseFloat(proceso.coste_hora_operacion) || 0;
        
        costeTotalProcesos += tiempoHoras * (costeManoObraDefault + costeMaquinaOperacion);
    }
    return costeTotalProcesos;
}

/**
 * Calcula y actualiza el coste de fabricación estándar de un producto terminado.
 * @param {number} productoTerminadoId - ID del producto terminado.
 * @param {object} configuraciones - Objeto con las configuraciones cargadas (ej. coste_mano_obra_default).
 * @returns {Promise<number>} El coste de fabricación estándar calculado.
 */
async function actualizarCosteFabricacionEstandar(productoTerminadoId, configuraciones) {
    const db = conectarDB(); // Conexión para la transacción
    try {
        const producto = await getAsync(db, `SELECT coste_extra_unitario FROM ProductosTerminados WHERE id = ?`, [productoTerminadoId]);
        if (!producto) {
            throw new Error(`Producto terminado con ID ${productoTerminadoId} no encontrado para calcular coste estándar.`);
        }
        const costeExtra = parseFloat(producto.coste_extra_unitario) || 0;

        const costeMateriales = await calcularCosteMateriales(db, productoTerminadoId);
        const costeProcesos = await calcularCosteProcesos(db, productoTerminadoId, configuraciones);
        const costeTotal = costeMateriales + costeProcesos + costeExtra;

        await runAsync(db, `UPDATE ProductosTerminados SET coste_fabricacion_estandar = ? WHERE id = ?`, [costeTotal, productoTerminadoId]);
        console.log(`Coste de fabricación estándar para producto ${productoTerminadoId} actualizado a ${costeTotal}`);
        return costeTotal;
    } catch (error) {
        console.error(`Error al actualizar coste de fabricación estándar para producto ${productoTerminadoId}:`, error.message);
        throw error;
    } finally {
        db.close(); // Cerrar la conexión al finalizar la transacción
    }
}

// --- LÓGICA DE PROCESAMIENTO DE ÓRDENES DE PRODUCCIÓN ---

/**
 * Procesa una Orden de Producción, descontando materiales y añadiendo producto terminado.
 * Ahora busca y consume stock específico basado en la receta genérica.
 * @param {number} ordenProduccionId - ID de la orden de producción a procesar.
 * @param {object} configuraciones - Objeto con las configuraciones cargadas.
 * @returns {Promise<object>} Resumen de la operación.
 */
async function procesarOrdenProduccion(ordenProduccionId, configuraciones) {
    const db = conectarDB(); // Conexión para la transacción
    try {
        await runAsync(db, 'BEGIN TRANSACTION;');

        const orden = await getAsync(db, `SELECT * FROM OrdenesProduccion WHERE id = ?`, [ordenProduccionId]);
        if (!orden) {
            throw new Error(`Orden de Producción con ID ${ordenProduccionId} no encontrada.`);
        }
        if (orden.status === 'COMPLETADA') {
            throw new Error(`La Orden de Producción ID ${ordenProduccionId} ya está completada.`);
        }
        if (orden.status === 'CANCELADA') {
            throw new Error(`La Orden de Producción ID ${ordenProduccionId} está cancelada.`);
        }
        if (parseFloat(orden.cantidad_a_producir) <= 0) {
            throw new Error(`La cantidad a producir para la Orden de Producción ID ${ordenProduccionId} debe ser mayor que cero.`);
        }

        const productoTerminado = await getAsync(db, `SELECT * FROM ProductosTerminados WHERE id = ?`, [orden.producto_terminado_id]);
        if (!productoTerminado) {
            throw new Error(`Producto terminado asociado a la orden ID ${ordenProduccionId} no encontrado.`);
        }

        const recetas = await allAsync(db, `
            SELECT r.cantidad_requerida, r.unidades_por_ancho_material, r.peso_por_unidad_producto,
                   r.material_tipo_generico, r.subtipo_material_generico, r.espesor_generico, r.ancho_generico, r.color_generico,
                   r.componente_ref_generico
            FROM Recetas r
            WHERE r.producto_terminado_id = ?
        `, [orden.producto_terminado_id]);

        let totalCosteMaterialesReal = 0;
        let totalCosteProcesosReal = 0;
        let totalPesoProductosTerminados = 0;

        const costeManoObraDefault = parseFloat(configuraciones.coste_mano_obra_default || 0);

        // --- Lógica para buscar y consumir stock real ---
        for (const receta of recetas) {
            const cantidadRequeridaPorUnidadPT = parseFloat(receta.cantidad_requerida) || 0;
            const unidadesPorAncho = parseFloat(receta.unidades_por_ancho_material) || 1;
            const cantidadTotalNecesariaParaOrden = cantidadRequeridaPorUnidadPT * parseFloat(orden.cantidad_a_producir);

            let stockItemConsumido = null; // Para almacenar el ítem de stock real que se va a consumir
            let cantidadRealAConsumirDeStock = 0;
            let costeUnitarioRealDeStock = 0;
            let stockTable = '';
            let stockIdField = '';
            let stockQuantityField = '';

            if (receta.material_tipo_generico) {
                // Buscar materia prima disponible que coincida con las características genéricas
                const availableMaterialStock = await allAsync(db, `
                    SELECT id, largo_actual, coste_unitario_final
                    FROM StockMateriasPrimas
                    WHERE material_tipo = ?
                      AND (subtipo_material = ? OR (subtipo_material IS NULL AND ? IS NULL))
                      AND (espesor = ? OR (espesor IS NULL AND ? IS NULL))
                      AND (ancho = ? OR (ancho IS NULL AND ? IS NULL))
                      AND (color = ? OR (color IS NULL AND ? IS NULL))
                      AND status IN ('DISPONIBLE', 'EMPEZADA')
                    ORDER BY fecha_entrada_almacen ASC, id ASC -- FIFO
                `, [
                    receta.material_tipo_generico,
                    receta.subtipo_material_generico, receta.subtipo_material_generico,
                    receta.espesor_generico, receta.espesor_generico,
                    receta.ancho_generico, receta.ancho_generico,
                    receta.color_generico, receta.color_generico
                ]);

                if (availableMaterialStock.length === 0) {
                    throw new Error(`Stock insuficiente: No hay materia prima genérica '${receta.material_tipo_generico} ${receta.espesor_generico} ${receta.ancho_generico}mm' disponible para la orden.`);
                }

                // Determinar la cantidad a consumir de la bobina real (considerando aprovechamiento de ancho)
                cantidadRealAConsumirDeStock = cantidadTotalNecesariaParaOrden / unidadesPorAncho;
                
                // Consumir del primer ítem de stock disponible que tenga suficiente cantidad
                let consumedFromThisItem = false;
                for (const item of availableMaterialStock) {
                    if (item.largo_actual >= cantidadRealAConsumirDeStock) {
                        stockItemConsumido = item;
                        costeUnitarioRealDeStock = parseFloat(item.coste_unitario_final) || 0;
                        stockTable = 'StockMateriasPrimas';
                        stockIdField = 'id';
                        stockQuantityField = 'largo_actual';
                        consumedFromThisItem = true;
                        break;
                    }
                }
                if (!consumedFromThisItem) {
                    throw new Error(`Stock insuficiente: No hay una única bobina con suficiente largo de materia prima genérica '${receta.material_tipo_generico} ${receta.espesor_generico} ${receta.ancho_generico}mm' para la orden. Necesario: ${cantidadRealAConsumirDeStock.toFixed(2)}.`);
                }

            } else if (receta.componente_ref_generico) {
                // Buscar componente disponible
                const availableComponentStock = await allAsync(db, `
                    SELECT id, cantidad_actual, coste_unitario_final
                    FROM StockComponentes
                    WHERE componente_ref = ?
                    AND status IN ('DISPONIBLE', 'RESERVADO')
                    ORDER BY fecha_entrada_almacen ASC, id ASC -- FIFO
                `, [receta.componente_ref_generico]);

                if (availableComponentStock.length === 0) {
                    throw new Error(`Stock insuficiente: No hay componente genérico '${receta.componente_ref_generico}' disponible para la orden.`);
                }

                cantidadRealAConsumirDeStock = cantidadTotalNecesariaParaOrden; // No hay aprovechamiento de ancho para componentes

                let consumedFromThisItem = false;
                for (const item of availableComponentStock) {
                    if (item.cantidad_actual >= cantidadRealAConsumirDeStock) {
                        stockItemConsumido = item;
                        costeUnitarioRealDeStock = parseFloat(item.coste_unitario_final) || 0;
                        stockTable = 'StockComponentes';
                        stockIdField = 'id';
                        stockQuantityField = 'cantidad_actual';
                        consumedFromThisItem = true;
                        break;
                    }
                }
                if (!consumedFromThisItem) {
                    throw new Error(`Stock insuficiente: No hay suficiente cantidad de componente genérico '${receta.componente_ref_generico}' para la orden. Necesario: ${cantidadRealAConsumirDeStock.toFixed(2)}.`);
                }
            } else {
                console.warn(`Receta ID ${receta.id} no tiene material genérico ni componente genérico. Ignorando.`);
                continue;
            }

            // Actualizar el stock consumido
            if (stockItemConsumido) {
                await runAsync(db, `UPDATE ${stockTable} SET ${stockQuantityField} = ${stockQuantityField} - ? WHERE ${stockIdField} = ?`, [cantidadRealAConsumirDeStock, stockItemConsumido.id]);
                console.log(`Consumido ${cantidadRealAConsumirDeStock.toFixed(2)} de ${stockTable} ID ${stockItemConsumido.id}`);
                totalCosteMaterialesReal += cantidadRealAConsumirDeStock * costeUnitarioRealDeStock;
            }

            // Sumar el peso de los productos terminados
            const pesoPorUnidadPT = parseFloat(receta.peso_por_unidad_producto) || 0;
            totalPesoProductosTerminados += pesoPorUnidadPT * parseFloat(orden.cantidad_a_producir);
        }

        // 3. Calcular coste de procesos
        const procesos = await allAsync(db, `
            SELECT pf.tiempo_estimado_horas,
                   m.coste_hora_operacion
            FROM ProcesosFabricacion pf
            JOIN Maquinaria m ON pf.maquinaria_id = m.id
            WHERE pf.producto_terminado_id = ?
        `, [orden.producto_terminado_id]);

        for (const proceso of procesos) {
            const tiempoHoras = parseFloat(proceso.tiempo_estimado_horas) || 0;
            const costeMaquinaOperacion = parseFloat(proceso.coste_hora_operacion) || 0;
            totalCosteProcesosReal += tiempoHoras * (costeManoObraDefault + costeMaquinaOperacion);
        }
        totalCosteProcesosReal *= parseFloat(orden.cantidad_a_producir);


        const costeFabricacionReal = totalCosteMaterialesReal + totalCosteProcesosReal + (parseFloat(productoTerminado.coste_extra_unitario) || 0) * parseFloat(orden.cantidad_a_producir);
        const costeUnitarioProductoFinal = parseFloat(orden.cantidad_a_producir) > 0
            ? costeFabricacionReal / parseFloat(orden.cantidad_a_producir)
            : 0;

        // 4. Insertar producto terminado en StockProductosTerminados
        const stockProductoTerminadoData = {
            producto_id: orden.producto_terminado_id,
            orden_produccion_id: orden.id,
            cantidad_actual: parseFloat(orden.cantidad_a_producir),
            unidad_medida: productoTerminado.unidad_medida,
            coste_unitario_final: costeUnitarioProductoFinal,
            fecha_entrada_almacen: new Date().toISOString().split('T')[0],
            status: 'DISPONIBLE',
            ubicacion: 'ALMACEN_PT',
            notas: `Producido por OP ${orden.id}`
        };
        await insertarStockProductoTerminado(db, stockProductoTerminadoData);
        console.log(`Producto terminado ID ${orden.producto_terminado_id} añadido al stock.`);

        // 5. Actualizar estado de la Orden de Producción
        await runAsync(db, `UPDATE OrdenesProduccion SET status = 'COMPLETADA', coste_real_fabricacion = ? WHERE id = ?`, [costeFabricacionReal, orden.id]);
        console.log(`Orden de Producción ID ${orden.id} marcada como COMPLETADA.`);

        await runAsync(db, 'COMMIT;');
        return {
            mensaje: `Orden de Producción ID ${orden.id} completada. ${orden.cantidad_a_producir} unidades de ${productoTerminado.nombre} producidas.`,
            costeFabricacionReal: costeFabricacionReal,
            costeUnitarioProductoFinal: costeUnitarioProductoFinal,
            pesoTotalProductosTerminados: totalPesoProductosTerminados
        };

    } catch (error) {
        console.error(`Error procesando Orden de Producción ID ${ordenProduccionId}, revirtiendo:`, error.message, error.stack);
        await runAsync(db, 'ROLLBACK;');
        throw error;
    } finally {
        db.close(); // Cerrar la conexión al finalizar la transacción
    }
}

// --- NUEVA FUNCIÓN: Obtener materiales genéricos con su último coste ---
async function obtenerMaterialesGenericos() {
    // Obtener la última entrada de cada referencia_stock de materias primas
    const materiasPrimas = await allDB(`
        SELECT
            s.id,
            s.referencia_stock,
            s.material_tipo,
            s.subtipo_material,
            s.espesor,
            s.ancho,
            s.color,
            s.unidad_medida,
            s.coste_unitario_final,
            s.peso_total_kg
        FROM StockMateriasPrimas s
        WHERE s.id IN (
            SELECT MAX(s2.id)
            FROM StockMateriasPrimas s2
            GROUP BY s2.referencia_stock
        )
        ORDER BY s.referencia_stock;
    `);

    const materiales = materiasPrimas.map(mp => ({
        type: 'materia_prima',
        id: mp.id, // ID del ítem de stock específico (para selección en presupuesto)
        referencia_stock: mp.referencia_stock,
        material_tipo: mp.material_tipo,
        subtipo_material: mp.subtipo_material,
        espesor: mp.espesor,
        ancho: mp.ancho,
        color: mp.color,
        unidad_medida: mp.unidad_medida,
        coste_unitario_final: mp.coste_unitario_final,
        peso_total_kg: mp.peso_total_kg,
        display: `${mp.referencia_stock} (${mp.material_tipo} ${mp.espesor || ''} ${mp.ancho || ''}mm ${mp.color || ''}) - Último Coste: ${parseFloat(mp.coste_unitario_final || 0).toFixed(4)}€`
    }));

    // Obtener la última entrada de cada componente_ref de componentes
    const componentes = await allDB(`
        SELECT
            c.id,
            c.componente_ref,
            c.descripcion,
            c.unidad_medida,
            c.coste_unitario_final
        FROM StockComponentes c
        WHERE c.id IN (
            SELECT MAX(c2.id)
            FROM StockComponentes c2
            GROUP BY c2.componente_ref
        )
        ORDER BY c.componente_ref;
    `);

    componentes.forEach(comp => {
        materiales.push({
            type: 'componente',
            id: comp.id, // ID del ítem de stock específico (para selección en presupuesto)
            componente_ref: comp.componente_ref,
            descripcion: comp.descripcion,
            unidad_medida: comp.unidad_medida,
            coste_unitario_final: comp.coste_unitario_final,
            display: `${comp.componente_ref} (${comp.descripcion}) - Último Coste: ${parseFloat(comp.coste_unitario_final || 0).toFixed(4)}€`
        });
    });

    return materiales;
}

// MODIFICADA: consultarReferenciasStockConUltimoCoste - ahora es un alias de obtenerMaterialesGenericos
// Se mantiene para compatibilidad con el frontend de ProductosTerminados
async function consultarReferenciasStockConUltimoCoste() {
    return await obtenerMaterialesGenericos();
}


// --- NUEVA FUNCIÓN: Calcular presupuesto para un producto terminado ---
/**
 * Calcula un presupuesto detallado para una cantidad de un producto terminado,
 * considerando stock específico y tipo de cliente para costes de proceso.
 * @param {number} productoId - ID del producto terminado.
 * @param {number} cantidad - Cantidad de productos a presupuestar.
 * @param {string} tipoCliente - Tipo de cliente ('final', 'fabricante', 'metrajes', 'intermediario').
 * @param {Array<object>} materialesSeleccionadosStock - Array de { id: stockItemId, type: 'materia_prima'/'componente' }
 * @param {object} configuraciones - Objeto con las configuraciones cargadas.
 * @returns {Promise<object>} Objeto con el desglose del presupuesto.
 */
async function calcularPresupuestoProductoTerminado(productoId, cantidad, tipoCliente, materialesSeleccionadosStock, configuraciones) {
    const db = conectarDB(); // Conexión para la transacción
    try {
        const producto = await getAsync(db, `SELECT * FROM ProductosTerminados WHERE id = ?`, [productoId]);
        if (!producto) {
            throw new Error(`Producto terminado con ID ${productoId} no encontrado.`);
        }

        const recetas = await allAsync(db, `
            SELECT r.cantidad_requerida, r.unidades_por_ancho_material, r.peso_por_unidad_producto,
                   r.material_tipo_generico, r.subtipo_material_generico, r.espesor_generico, r.ancho_generico, r.color_generico,
                   r.componente_ref_generico
            FROM Recetas r
            WHERE r.producto_terminado_id = ?
        `, [productoId]);

        let costeTotalMateriales = 0;
        const desgloseMateriales = [];
        let pesoTotalEstimado = 0;

        // Calcular costes de materiales usando los ítems de stock seleccionados
        for (const receta of recetas) {
            const cantidadRequeridaPorUnidadPT = parseFloat(receta.cantidad_requerida) || 0;
            const unidadesPorAncho = parseFloat(receta.unidades_por_ancho_material) || 1;
            const cantidadTotalNecesariaParaPresupuesto = cantidadRequeridaPorUnidadPT * cantidad;

            let stockItemSeleccionado = null;
            let costeUnitarioRealDeStock = 0;
            let cantidadConsumirSimulada = 0;

            if (receta.material_tipo_generico) {
                // Buscar el ID de stock de materia prima seleccionado por el usuario para esta receta
                const selectedStockItemData = materialesSeleccionadosStock.find(m => 
                    m.type === 'materia_prima' && 
                    m.material_tipo === receta.material_tipo_generico &&
                    (m.espesor === receta.espesor_generico || (m.espesor === null && receta.espesor_generico === null)) &&
                    (m.ancho === receta.ancho_generico || (m.ancho === null && receta.ancho_generico === null)) &&
                    (m.color === receta.color_generico || (m.color === null && receta.color_generico === null))
                );

                if (!selectedStockItemData || !selectedStockItemData.id) {
                    throw new Error(`No se seleccionó una bobina específica para la materia prima genérica: ${receta.material_tipo_generico} ${receta.espesor_generico} ${receta.ancho_generico}mm.`);
                }
                const stockItem = await getAsync(db, `SELECT * FROM StockMateriasPrimas WHERE id = ?`, [selectedStockItemData.id]);
                if (!stockItem) {
                    throw new Error(`Bobina seleccionada con ID ${selectedStockItemData.id} no encontrada en stock.`);
                }
                stockItemSeleccionado = stockItem;
                costeUnitarioRealDeStock = parseFloat(stockItem.coste_unitario_final) || 0;
                cantidadConsumirSimulada = cantidadTotalNecesariaParaPresupuesto / unidadesPorAncho;

            } else if (receta.componente_ref_generico) {
                // Buscar el ID de stock de componente seleccionado por el usuario para esta receta
                const selectedStockItemData = materialesSeleccionadosStock.find(m => 
                    m.type === 'componente' && 
                    m.componente_ref === receta.componente_ref_generico
                );

                if (!selectedStockItemData || !selectedStockItemData.id) {
                    throw new Error(`No se seleccionó un componente específico para el componente genérico: ${receta.componente_ref_generico}.`);
                }
                const stockItem = await getAsync(db, `SELECT * FROM StockComponentes WHERE id = ?`, [selectedStockItemData.id]);
                if (!stockItem) {
                    throw new Error(`Componente seleccionado con ID ${selectedStockItemData.id} no encontrado en stock.`);
                }
                stockItemSeleccionado = stockItem;
                costeUnitarioRealDeStock = parseFloat(stockItem.coste_unitario_final) || 0;
                cantidadConsumirSimulada = cantidadTotalNecesariaParaPresupuesto; // No hay aprovechamiento de ancho para componentes
            } else {
                console.warn(`Receta ID ${receta.id} no tiene material genérico ni componente genérico. Ignorando.`);
                continue;
            }

            if (stockItemSeleccionado) {
                const costeMaterialReceta = cantidadConsumirSimulada * costeUnitarioRealDeStock;
                costeTotalMateriales += costeMaterialReceta;
                desgloseMateriales.push({
                    receta_id: receta.id,
                    material_generico: receta.material_tipo_generico ? `${receta.material_tipo_generico} ${receta.espesor_generico || ''} ${receta.ancho_generico || ''}mm` : receta.componente_ref_generico,
                    stock_item_id_seleccionado: stockItemSeleccionado.id,
                    referencia_stock_real: stockItemSeleccionado.referencia_stock || stockItemSeleccionado.componente_ref,
                    cantidad_simulada_consumir: cantidadConsumirSimulada,
                    unidad_consumo: receta.material_tipo_generico ? stockItemSeleccionado.unidad_medida : stockItemSeleccionado.unidad_medida,
                    coste_unitario_stock_real: costeUnitarioRealDeStock,
                    coste_total_material_receta: costeMaterialReceta
                });
            }

            const pesoPorUnidadPT = parseFloat(receta.peso_por_unidad_producto) || 0;
            pesoTotalEstimado += pesoPorUnidadPT * cantidad;
        }

        let costeTotalProcesos = 0;
        const desgloseProcesos = [];
        const procesos = await allAsync(db, `
            SELECT pf.nombre_proceso, pf.tiempo_estimado_horas, pf.aplica_a_clientes,
                   m.coste_hora_operacion
            FROM ProcesosFabricacion pf
            JOIN Maquinaria m ON pf.maquinaria_id = m.id
            WHERE pf.producto_terminado_id = ?
        `, [productoId]);

        const costeManoObraDefault = parseFloat(configuraciones.coste_mano_obra_default || 0);

        for (const proceso of procesos) {
            // Determinar si el proceso aplica a este tipo de cliente
            const aplicaAClientesArray = (proceso.aplica_a_clientes || 'ALL').toUpperCase().split(',').map(s => s.trim());
            const aplicaEsteCliente = aplicaAClientesArray.includes('ALL') || aplicaAClientesArray.includes(tipoCliente.toUpperCase());

            let costeProcesoUnitario = 0;
            if (aplicaEsteCliente) {
                const tiempoHoras = parseFloat(proceso.tiempo_estimado_horas) || 0;
                const costeMaquinaOperacion = parseFloat(proceso.coste_hora_operacion) || 0;
                costeProcesoUnitario = tiempoHoras * (costeManoObraDefault + costeMaquinaOperacion);
            }
            costeTotalProcesos += costeProcesoUnitario * cantidad;
            desgloseProcesos.push({
                nombre_proceso: proceso.nombre_proceso,
                tiempo_estimado_horas: proceso.tiempo_estimado_horas,
                coste_hora_maquina: proceso.coste_hora_operacion,
                aplica_a_clientes: proceso.aplica_a_clientes,
                aplica_a_este_cliente: aplicaEsteCliente,
                coste_unitario_proceso: costeProcesoUnitario,
                coste_total_proceso: costeProcesoUnitario * cantidad
            });
        }

        const costeExtraUnitario = parseFloat(producto.coste_extra_unitario) || 0;
        const costeTotalExtra = costeExtraUnitario * cantidad;

        const costeTotalFabricacion = costeTotalMateriales + costeTotalProcesos + costeTotalExtra;
        const costeUnitarioFabricacion = costeTotalFabricacion / cantidad;

        // Aplicar margen de venta
        const claveMargen = `margen_default_${tipoCliente.toLowerCase()}`;
        let margenAplicado = configuraciones[claveMargen];
        if (margenAplicado === undefined || isNaN(parseFloat(margenAplicado))) {
            console.warn(`Margen no encontrado o no numérico para '${tipoCliente}'. Usando 0.`);
            margenAplicado = 0;
        } else {
            margenAplicado = parseFloat(margenAplicado);
        }

        const precioVentaTotal = costeTotalFabricacion * (1 + margenAplicado);
        const precioVentaUnitario = precioVentaTotal / cantidad;

        return {
            producto: {
                id: producto.id,
                referencia: producto.referencia,
                nombre: producto.nombre,
                unidad_medida: producto.unidad_medida
            },
            cantidad_presupuestada: cantidad,
            tipo_cliente: tipoCliente,
            coste_unitario_fabricacion: costeUnitarioFabricacion,
            coste_total_fabricacion: costeTotalFabricacion,
            margen_aplicado_porcentaje: margenAplicado,
            precio_venta_unitario: precioVentaUnitario,
            precio_venta_total: precioVentaTotal,
            peso_total_estimado_kg: pesoTotalEstimado,
            desglose_materiales: desgloseMateriales,
            desglose_procesos: desgloseProcesos,
            coste_extra_unitario: costeExtraUnitario,
            coste_total_extra: costeTotalExtra
        };

    } catch (error) {
        console.error(`Error al calcular presupuesto para producto ${productoId}:`, error.message);
        throw error;
    } finally {
        db.close(); // Cerrar la conexión al finalizar la transacción
    }
}




// --- Funciones para la configuración (leer/escribir config.json) ---
async function obtenerConfiguracion() {
    try {
        const configFile = fs.readFileSync(configFilePath, 'utf8');
        return JSON.parse(configFile);
    } catch (error) {
        console.error("Error al leer config.json:", error.message);
        throw new Error("No se pudo cargar la configuración.");
    }
}

async function actualizarConfiguracion(newConfig) {
    try {
        fs.writeFileSync(configFilePath, JSON.stringify(newConfig, null, 2), 'utf8');
        return { mensaje: "Configuración actualizada en archivo." };
    } catch (error) {
        console.error("Error al escribir en config.json:", error.message);
        throw new Error("No se pudo guardar la configuración.");
    }
}


// --- EXPORTACIONES ---
module.exports = {
    consultarStockMateriasPrimas,
    consultarStockComponentes,
    consultarItemStockPorId,
    procesarNuevoPedido,
    consultarListaPedidos,
    obtenerDetallesCompletosPedido,
    actualizarEstadoStockItem,
    eliminarPedidoCompleto,

    insertarProductoTerminado,
    consultarProductosTerminados,
    consultarProductoTerminadoPorId,
    actualizarProductoTerminado,
    eliminarProductoTerminado,

    insertarMaquinaria,
    consultarMaquinaria,
    consultarMaquinariaPorId,
    actualizarMaquinaria,
    eliminarMaquinaria,

    insertarReceta,
    consultarRecetas,
    consultarRecetaPorId,
    actualizarReceta,
    eliminarReceta,

    insertarProcesoFabricacion,
    consultarProcesosFabricacion,
    consultarProcesoFabricacionPorId,
    actualizarProcesoFabricacion,
    eliminarProcesoFabricacion,

    insertarOrdenProduccion,
    consultarOrdenesProduccion,
    consultarOrdenProduccionPorId,
    actualizarOrdenProduccion,
    eliminarOrdenProduccion,
    procesarOrdenProduccion,

    insertarStockProductoTerminado,
    consultarStockProductosTerminados,
    consultarStockProductoTerminadoPorId,
    actualizarStockProductoTerminado,
    eliminarStockProductoTerminado,

    actualizarCosteFabricacionEstandar,

    consultarReferenciasStockConUltimoCoste,
    obtenerMaterialesGenericos,
    calcularPresupuestoProductoTerminado,
    calcularCosteMaterialEspecifico, // Asegúrate de exportar esta nueva función de cálculo

    obtenerConfiguracion,
    actualizarConfiguracion
};
