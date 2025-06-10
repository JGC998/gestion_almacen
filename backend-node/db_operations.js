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


// En backend-node/db_operations.js

async function consultarStock(filtros = {}) {
    let sql = `
        SELECT
            s.id,
            s.lote,
            s.cantidad_actual,
            s.coste_lote,
            s.ubicacion,
            s.status,
            i.sku,
            i.descripcion,
            i.familia,
            i.unidad_medida,
            i.ancho,      -- AÑADIDO
            i.espesor     -- AÑADIDO
        FROM Stock s
        JOIN Items i ON s.item_id = i.id
    `;
    const params = [];
    let whereClauses = [];

    if (filtros.familia) {
        whereClauses.push(`i.familia = ?`);
        params.push(filtros.familia.toUpperCase());
    }
    
    if (filtros.status) {
        const statusArray = filtros.status.split(',').map(st => st.trim().toUpperCase());
        if (statusArray.length > 0) {
            const placeholders = statusArray.map(() => '?').join(',');
            whereClauses.push(`s.status IN (${placeholders})`);
            params.push(...statusArray);
        }
    }

    if (whereClauses.length > 0) {
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    sql += ` ORDER BY i.familia, i.descripcion, s.lote`;
    return await allDB(sql, params);
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

// En backend-node/db_operations.js

async function insertarLineaPedido(dbInstance, lineaData) {
    const sql = `INSERT INTO LineasPedido (
        pedido_id, item_id, cantidad_original,
        precio_unitario_original, moneda_original
    ) VALUES (?, ?, ?, ?, ?)`;
    const params = [
        lineaData.pedido_id,
        lineaData.item_id,
        lineaData.cantidad_original,
        lineaData.precio_unitario_original,
        lineaData.moneda_original
    ];
    return await runAsync(dbInstance, sql, params);
}

// backend-node/db_operations.js

// AÑADIR esta nueva función auxiliar al archivo
async function findOrCreateItem(dbInstance, linea, familia) {
    // Generamos un SKU estándar para buscar o crear el item
    const sku = `${familia.toUpperCase()}-${(linea.espesor || 'NA').toUpperCase()}-${(linea.ancho || 'NA')}`;
    const descripcion = `${familia} ${linea.espesor || ''} Ancho ${linea.ancho || 'N/A'}mm`;

    let item = await getAsync(dbInstance, `SELECT id FROM Items WHERE sku = ?`, [sku]);

    if (item) {
        return item.id;
    } else {
        const result = await runAsync(dbInstance,
            `INSERT INTO Items (sku, descripcion, tipo_item, familia, espesor, ancho, unidad_medida) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [sku, descripcion, 'MATERIA_PRIMA', familia.toUpperCase(), linea.espesor, parseFloat(linea.ancho) || null, linea.unidad_medida || 'm']
        );
        return result.lastID;
    }
}


// REEMPLAZAR la función 'procesarNuevoPedido' existente por esta nueva versión
async function procesarNuevoPedido(datosCompletosPedido) {
    // La firma de la función ahora incluye 'material_tipo_general'
    const { pedido, lineas, gastos, material_tipo_general } = datosCompletosPedido;
    const db = conectarDB();

    try {
        await runAsync(db, 'BEGIN TRANSACTION;');

        const pedidoResult = await runAsync(db,
            `INSERT INTO PedidosProveedores (numero_factura, proveedor, fecha_pedido, origen_tipo, valor_conversion, observaciones) VALUES (?, ?, ?, ?, ?, ?)`,
            [pedido.numero_factura, pedido.proveedor, pedido.fecha_pedido, pedido.origen_tipo, pedido.valor_conversion, pedido.observaciones]
        );
        const pedidoId = pedidoResult.lastID;

        for (const gasto of gastos) {
            await runAsync(db, `INSERT INTO GastosPedido (pedido_id, tipo_gasto, descripcion, coste_eur) VALUES (?, ?, ?, ?)`,
                [pedidoId, gasto.tipo_gasto, gasto.descripcion, gasto.coste_eur]);
        }

        for (const linea of lineas) {
            // Usamos la nueva función para obtener el item_id, creándolo si es necesario
            const itemId = await findOrCreateItem(db, linea, material_tipo_general);

            await insertarLineaPedido(db, {
                ...linea,
                item_id: itemId, // Usamos el ID encontrado o recién creado
                pedido_id: pedidoId
            });
            
            // La lógica de cálculo de costes y creación de stock sigue siendo similar
            const costeUnitarioOriginal = parseFloat(linea.precio_unitario_original) || 0;
            const costeFinalConGastos = costeUnitarioOriginal * (1 + (pedido.porcentajeGastos || 0)); // Asumimos que el porcentaje de gastos se puede calcular antes
            
            // La referencia de la línea ahora es el identificador único de la bobina
            const lote = linea.referencia_bobina || `LOTE-${pedido.numero_factura}-${itemId}`;

            await runAsync(db,
                `INSERT INTO Stock (item_id, lote, cantidad_inicial, cantidad_actual, coste_lote, ubicacion, pedido_id, fecha_entrada) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [itemId, lote, linea.cantidad_original, linea.cantidad_original, costeFinalConGastos, linea.ubicacion, pedidoId, pedido.fecha_pedido]
            );
        }

        await runAsync(db, 'COMMIT;');
        return { pedidoId: pedidoId, mensaje: `Pedido ${pedido.numero_factura} procesado exitosamente.` };

    } catch (error) {
        console.error(`Error en la transacción de procesarNuevoPedido:`, error);
        await runAsync(db, 'ROLLBACK;');
        throw error;
    } finally {
        db.close();
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



async function consultarLineasPedidoPorPedidoId(dbInstance, pedidoId) {
    return allAsync(dbInstance, `SELECT cantidad_original, precio_unitario_original, moneda_original FROM LineasPedido WHERE pedido_id = ?`, [pedidoId]);
}


// En backend-node/db_operations.js

async function consultarStockPorPedidoId(dbInstance, pedidoId) {
    // Esta nueva función consulta las tablas correctas: Stock e Items
    return allAsync(dbInstance, `
        SELECT
            s.id,
            s.lote,
            s.cantidad_actual,
            s.coste_lote,
            i.sku,
            i.descripcion,
            i.unidad_medida
        FROM Stock s
        JOIN Items i ON s.item_id = i.id
        WHERE s.pedido_id = ?
        ORDER BY s.id`, [pedidoId]);
}

async function obtenerDetallesCompletosPedido(pedidoId) {
    const db = conectarDB();
    try {
        const pedidoInfo = await consultarInfoPedidoPorId(db, pedidoId);
        if (!pedidoInfo) {
            return null;
        }

        const [gastos, stockItems, lineasPedidoOriginales] = await Promise.all([
            consultarGastosPorPedidoId(db, pedidoId),
            consultarStockPorPedidoId(db, pedidoId), // Usamos la nueva función aquí
            consultarLineasPedidoPorPedidoId(db, pedidoId)
        ]);
        
        let costeTotalPedidoSinGastosEnMonedaOriginal = 0;
        // La lógica para calcular el porcentaje de gastos sigue siendo válida
        lineasPedidoOriginales.forEach(linea => {
            costeTotalPedidoSinGastosEnMonedaOriginal += (parseFloat(linea.cantidad_original) * parseFloat(linea.precio_unitario_original));
        });

        let totalGastosRepercutibles = 0;
        gastos.forEach(gasto => {
            const tipoGastoUpper = gasto.tipo_gasto?.toUpperCase();
            if (tipoGastoUpper === 'NACIONAL' || (tipoGastoUpper === 'SUPLIDOS' && !gasto.descripcion?.toUpperCase().includes('IVA'))) {
                totalGastosRepercutibles += (parseFloat(gasto.coste_eur) || 0);
            }
        });

        const porcentajeGastos = costeTotalPedidoSinGastosEnMonedaOriginal > 0 ? totalGastosRepercutibles / costeTotalPedidoSinGastosEnMonedaOriginal : 0;

        return { pedidoInfo, gastos, stockItems, porcentajeGastos };

    } catch (error) {
        console.error(`Error obteniendo detalles completos del pedido ${pedidoId}:`, error.message);
        throw error;
    } finally {
        if (db) db.close();
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


async function insertarProductoTerminado(dbInstance, productoData) {
    const { nombre, unidad_medida, coste_fabricacion_estandar, status, material_principal, espesor_principal, ancho_final } = productoData;
    
    // Se genera un SKU basado en el nombre para la búsqueda
    const sku = `PT-${nombre.toUpperCase().replace(/\s+/g, '-')}`;

    // Ahora inserta en la tabla 'Items'
    const query = `INSERT INTO Items (
        sku, descripcion, tipo_item, unidad_medida, coste_estandar, status,
        familia, espesor, ancho
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [
        sku,
        nombre,
        'PRODUCTO_TERMINADO',
        unidad_medida || 'unidad',
        parseFloat(coste_fabricacion_estandar) || 0,
        status || 'ACTIVO',
        material_principal,
        espesor_principal,
        parseFloat(ancho_final) || null
    ];

    try {
        const result = await runAsync(dbInstance, query, params);
        // La referencia ya no se actualiza en un segundo paso, se inserta directamente
        return result.lastID;
    } catch (err) {
        console.error("Error al insertar producto terminado (como item):", err.message);
        throw err;
    }
}


// backend-node/db_operations.js
// ...

// backend-node/db_operations.js
// ... (otras funciones como allDB)

async function consultarProductosTerminados(filtros = {}) {
    // Ahora consulta la tabla 'Items' filtrando por tipo
    let query = `SELECT 
                    id, 
                    sku as referencia, 
                    descripcion as nombre, 
                    unidad_medida, 
                    coste_estandar as coste_fabricacion_estandar, 
                    status,
                    familia as material_principal, 
                    espesor as espesor_principal, 
                    ancho as ancho_final
                 FROM Items 
                 WHERE tipo_item = 'PRODUCTO_TERMINADO'`;
    const params = [];
    // ... (la lógica de filtros se puede añadir aquí si es necesario)
    query += ` ORDER BY nombre ASC`;

    try {
        return await allDB(query, params);
    } catch (error) {
        console.error("Error al consultar productos terminados (ahora items):", error.message);
        throw error;
    }
}



async function consultarProductoTerminadoPorId(id) {
    const query = `SELECT id, referencia, nombre, unidad_medida, coste_fabricacion_estandar, status,
                       material_principal, espesor_principal, ancho_final, largo_final, coste_extra_unitario, fecha_creacion
                       FROM ProductosTerminados WHERE id = ?`; // 'descripcion' ya no está
    try {
        const row = await getDB(query, [id]);
        return row;
    } catch (error) {
        console.error("Error al consultar producto terminado por ID:", error.message, error.stack);
        throw error;
    }
}



async function actualizarProductoTerminado(id, updates) {
    const setParts = [];
    const params = [];
    const camposValidos = [
        'nombre', 'unidad_medida', 'status',
        'material_principal', 'espesor_principal', 
        'ancho_final', 'largo_final', 'coste_extra_unitario'
        // 'coste_fabricacion_estandar' no se actualiza directamente aquí, sino por su propia lógica
    ];
    
    for (const key in updates) {
        if (camposValidos.includes(key)) {
            setParts.push(`${key} = ?`);
            if (['ancho_final', 'largo_final', 'coste_extra_unitario'].includes(key)) {
                params.push(updates[key] !== null && updates[key] !== '' && !isNaN(parseFloat(updates[key])) ? parseFloat(updates[key]) : null);
            } else {
                params.push(updates[key]);
            }
        }
    }

    if (setParts.length === 0) {
        // Si no hay campos válidos, podríamos optar por no hacer nada o devolver un mensaje.
        // Por ahora, si se llama sin campos válidos, la query fallará o no hará cambios.
        // Considerar devolver un error o un mensaje si setParts está vacío.
        console.log("actualizarProductoTerminado: No hay campos válidos para actualizar.");
        return 0; // Indica que no se hicieron cambios
    }

    params.push(id);
    const query = `UPDATE ProductosTerminados SET ${setParts.join(', ')} WHERE id = ?`;
    
    try {
        const result = await runDB(query, params); // runDB maneja la conexión y cierre
        // No se considera un error si changes es 0, ya que los datos podrían ser iguales.
        // if (result.changes === 0) {
        // throw new Error("Producto terminado no encontrado para actualizar o datos sin cambios.");
        // }
        return result.changes; 
    } catch (err) {
        console.error("Error al actualizar producto terminado:", err.message, err.stack);
        if (err.message && err.message.toUpperCase().includes("UNIQUE CONSTRAINT FAILED") && err.message.includes("ProductosTerminados.nombre")) { // Ejemplo si nombre fuera UNIQUE
            throw new Error("El nombre de la plantilla de producto ya existe.");
        }
        throw err;
    }
}



// backend-node/db_operations.js
// ...
async function calcularCosteMaterialEspecifico(material_tipo, espesor, ancho_producto_m, largo_producto_m, appConfig) {
    // Ahora consulta las tablas correctas 'Stock' e 'Items'
    const queryMateriaPrima = `
        SELECT 
            s.coste_lote as coste_unitario_final, 
            i.unidad_medida, 
            i.ancho AS ancho_bobina_mm 
        FROM Stock s
        JOIN Items i ON s.item_id = i.id
        WHERE i.familia = ? AND i.espesor = ? AND i.tipo_item = 'MATERIA_PRIMA'
        ORDER BY s.fecha_entrada DESC, s.id DESC
        LIMIT 1
    `;
    const materiaPrima = await getDB(queryMateriaPrima, [material_tipo, espesor]);
    
    // El resto de la lógica interna de la función ya es correcta
    let costeTotalMaterial = 0;
    if (materiaPrima && materiaPrima.coste_unitario_final !== null && materiaPrima.ancho_bobina_mm !== null) {
        const costeUnitarioLinealBobina = parseFloat(materiaPrima.coste_unitario_final);
        const anchoBobinaMM = parseFloat(materiaPrima.ancho_bobina_mm);
        if (anchoBobinaMM > 0) {
            const anchoBobinaM = anchoBobinaMM / 1000.0;
            const costePorM2MateriaPrima = costeUnitarioLinealBobina / anchoBobinaM;
            const areaProductoM2 = ancho_producto_m * largo_producto_m;
            costeTotalMaterial = costePorM2MateriaPrima * areaProductoM2;
        }
    } else {
        console.warn(`No se encontró materia prima en stock para ${material_tipo} con espesor ${espesor}.`);
    }

    let costeManoObra = 0;
    if (appConfig && appConfig.coste_mano_obra_por_metro_metraje) {
         costeManoObra = (parseFloat(appConfig.coste_mano_obra_por_metro_metraje) || 0) * largo_producto_m;
    }

    const costeFinalCalculado = costeTotalMaterial + costeManoObra;
    return parseFloat(costeFinalCalculado.toFixed(4));
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


// En backend-node/db_operations.js

// REEMPLAZAR la función 'insertarMaquinaria' por esta versión:
async function insertarMaquinaria(maquinaData) {
    // Se elimina coste_adquisicion de la consulta
    const sql = `INSERT INTO Maquinaria (
        nombre, descripcion, coste_hora_operacion
    ) VALUES (?, ?, ?)`;
    const params = [
        maquinaData.nombre,
        maquinaData.descripcion || null,
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

//Maquinaria
async function actualizarMaquinaria(id, updates) {
    const setClauses = [];
    const params = [];

    // Se elimina 'coste_adquisicion' de los campos válidos para actualizar
    const camposValidos = ['nombre', 'descripcion', 'coste_hora_operacion'];

    for (const key in updates) {
        if (camposValidos.includes(key)) {
            setClauses.push(`${key} = ?`);
            if (key === 'coste_hora_operacion') {
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
        tiempo_estimado_segundos, aplica_a_clientes
    ) VALUES (?, ?, ?, ?, ?)`;
    const params = [
        procesoData.producto_terminado_id,
        procesoData.maquinaria_id,
        procesoData.nombre_proceso,
        parseInt(procesoData.tiempo_estimado_segundos) || 0,
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
    const camposValidos = [
        'producto_terminado_id',
        'maquinaria_id',
        'nombre_proceso',
        'tiempo_estimado_segundos',
        'aplica_a_clientes'
    ];
    for (const key in updates) {
        if (camposValidos.includes(key)) {
            setClauses.push(`${key} = ?`);
            if (['tiempo_estimado_horas', 'producto_terminado_id', 'maquinaria_id'].includes(key)) {
                params.push(parseFloat(updates[key]) || null);
            } else {
                params.push(updates[key]);
            }
        }
    }
    if (setClauses.length === 0) {
        console.warn("actualizarProcesoFabricacion: No se proporcionaron campos válidos para actualizar.");
        return 0;
    }
    params.push(id);
    const query = `UPDATE ProcesosFabricacion SET ${setClauses.join(', ')} WHERE id = ?`;
    try {
        const result = await runDB(query, params);
        return result.changes;
    } catch (err) {
        if (err.message.toUpperCase().includes("FOREIGN KEY CONSTRAINT FAILED")) {
            throw new Error(`Producto terminado o maquinaria no válida.`);
        }
        throw err;
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




async function obtenerUltimoCosteMaterialGenerico(receta) {
    // Si la receta especifica un material genérico (ej. GOMA 6mm)
    if (receta.material_tipo_generico) {
        const sql = `
            SELECT 
                s.coste_lote AS coste_unitario_final, 
                i.ancho AS ancho_bobina_mm
            FROM Stock s
            JOIN Items i ON s.item_id = i.id
            WHERE 
                i.familia = ? AND 
                i.espesor = ? AND
                i.tipo_item = 'MATERIA_PRIMA'
            ORDER BY s.fecha_entrada DESC, s.id DESC
            LIMIT 1`;
        // Busca en la tabla unificada por familia y espesor.
        return await getDB(sql, [receta.material_tipo_generico, receta.espesor_generico]);
    } 
    // Si la receta especifica un componente (ej. TORNILLO-X)
    else if (receta.componente_ref_generico) {
        const sql = `
            SELECT
                s.coste_lote AS coste_unitario_final,
                null AS ancho_bobina_mm
            FROM Stock s
            JOIN Items i ON s.item_id = i.id
            WHERE
                i.sku = ? AND
                i.tipo_item = 'COMPONENTE'
            ORDER BY s.fecha_entrada DESC, s.id DESC
            LIMIT 1`;
        // Busca en la tabla unificada por SKU (que es la referencia del componente).
        return await getDB(sql, [receta.componente_ref_generico]);
    }
    return null;
}

async function calcularCosteMateriales(productoTerminadoId, productoAnchoFinalM, productoLargoFinalM) {
    const recetas = await allDB(
        `SELECT * FROM Recetas WHERE producto_terminado_id = ?`,
        [productoTerminadoId]
    );

    let costeTotalMateriales = 0;
    for (const receta of recetas) {
        const cantidadRequerida = parseFloat(receta.cantidad_requerida) || 0;
        const materiaPrimaInfo = await obtenerUltimoCosteMaterialGenerico(receta);
        
        if (materiaPrimaInfo && materiaPrimaInfo.coste_unitario_final !== null) {
            let costeMaterialParaEstaReceta = 0;
            const costeUnitario = parseFloat(materiaPrimaInfo.coste_unitario_final);

            if (receta.material_tipo_generico) { // Es una bobina de materia prima
                const anchoBobinaMM = parseFloat(materiaPrimaInfo.ancho_bobina_mm);
                if (anchoBobinaMM > 0) {
                    const anchoBobinaM = anchoBobinaMM / 1000.0;
                    const costePorM2MateriaPrima = costeUnitario / anchoBobinaM;
                    // Usa las dimensiones reales de la plantilla de producto para calcular el área
                    const areaProductoM2 = (parseFloat(productoAnchoFinalM) || 0) * (parseFloat(productoLargoFinalM) || 0);
                    // El coste es el área de la pieza por el coste/m2, multiplicado por las veces que se usa esa pieza.
                    costeMaterialParaEstaReceta = costePorM2MateriaPrima * areaProductoM2 * cantidadRequerida;
                } else {
                    console.warn(`Ancho de bobina es 0 o nulo para la materia prima encontrada para la receta del producto ID ${productoTerminadoId}. Coste de este material será 0.`);
                }
            } else if (receta.componente_ref_generico) { // Es un componente
                costeMaterialParaEstaReceta = costeUnitario * cantidadRequerida;
            }
            costeTotalMateriales += costeMaterialParaEstaReceta;
        } else {
             console.warn(`No se encontró coste en stock para el material de la receta del producto ID ${productoTerminadoId}. Material: ${receta.material_tipo_generico || receta.componente_ref_generico}`);
        }
    }
    return costeTotalMateriales;
}


async function calcularCosteProcesos(productoTerminadoId, configuraciones) {
    // CAMBIO: Se selecciona la nueva columna y se ajusta el cálculo
    const procesos = await allDB(
        `SELECT pf.tiempo_estimado_segundos, m.coste_hora_operacion
         FROM ProcesosFabricacion pf JOIN Maquinaria m ON pf.maquinaria_id = m.id
         WHERE pf.producto_terminado_id = ?`,
        [productoTerminadoId]
    );
    const costeManoObraDefault = parseFloat(configuraciones.coste_mano_obra_default || 0);
    let costeTotalProcesos = 0;
    for (const proceso of procesos) {
        const tiempoSegundos = parseInt(proceso.tiempo_estimado_segundos) || 0;
        const tiempoHoras = tiempoSegundos / 3600.0; // Se convierte a horas para el cálculo
        const costeMaquinaOperacion = parseFloat(proceso.coste_hora_operacion) || 0;
        costeTotalProcesos += tiempoHoras * (costeManoObraDefault + costeMaquinaOperacion);
    }
    return costeTotalProcesos;
}

// Ajustar actualizarCosteFabricacionEstandar para obtener ancho_final y largo_final del producto
async function actualizarCosteFabricacionEstandar(productoTerminadoId, configuraciones) {
    // Esta función ahora es autónoma y no necesita recibir una instancia de BD
    try {
        const producto = await getDB(
            `SELECT coste_extra_unitario, ancho_final, largo_final 
             FROM ProductosTerminados WHERE id = ?`,
            [productoTerminadoId]
        );

        if (!producto) {
            throw new Error(`Producto terminado con ID ${productoTerminadoId} no encontrado para calcular coste.`);
        }
        
        const costeExtra = parseFloat(producto.coste_extra_unitario) || 0;
        
        const costeMateriales = await calcularCosteMateriales(productoTerminadoId, producto.ancho_final, producto.largo_final);
        const costeProcesos = await calcularCosteProcesos(productoTerminadoId, configuraciones);
        
        let costeTotal = costeMateriales + costeProcesos + costeExtra;

        // CORREGIDO: Asegurarse de que nunca se guarde NaN
        if (isNaN(costeTotal)) {
            console.error(`Cálculo de coste resultó en NaN para producto ID ${productoTerminadoId}. Se guardará como 0.`);
            costeTotal = 0;
        }

        await runDB(
            `UPDATE ProductosTerminados SET coste_fabricacion_estandar = ? WHERE id = ?`, 
            [costeTotal.toFixed(4), productoTerminadoId]
        );
        
        console.log(`Coste de fabricación estándar para producto ${productoTerminadoId} actualizado a ${costeTotal.toFixed(4)}`);
        return parseFloat(costeTotal.toFixed(4));

    } catch (error) {
        console.error(`Error al actualizar coste de fabricación estándar para producto ${productoTerminadoId}:`, error.message, error.stack);
        throw error; // Relanza el error para que el endpoint que lo llamó lo capture
    }
}

/**
 * Calcula el coste de materiales para un producto terminado basado en su receta genérica.
 * Usa el último coste conocido de los materiales genéricos.
 * @param {sqlite3.Database} dbInstance - Instancia de la base de datos.
 * @param {number} productoTerminadoId - ID del producto terminado.
 * @returns {Promise<number>} Coste total de materiales.
 */
async function calcularCosteMateriales(productoTerminadoId, productoAnchoFinalM, productoLargoFinalM) {
    // La función interna `obtenerUltimoCosteMaterialGenerico` ahora usa `getDB` que maneja su conexión.
    const recetas = await allDB(`
        SELECT r.cantidad_requerida, r.unidades_por_ancho_material, r.material_tipo_generico,
               r.subtipo_material_generico, r.espesor_generico, r.ancho_generico AS ancho_generico_receta, 
               r.color_generico, r.componente_ref_generico
        FROM Recetas r WHERE r.producto_terminado_id = ?`, 
        [productoTerminadoId]
    );

    let costeTotalMateriales = 0;
    for (const receta of recetas) {
        const cantidadRequerida = parseFloat(receta.cantidad_requerida) || 0;
        const materiaPrimaInfo = await obtenerUltimoCosteMaterialGenerico(receta); // Ya no necesita dbInstance
        
        if (materiaPrimaInfo && materiaPrimaInfo.coste_unitario_final !== null) {
            let costeMaterialParaEstaReceta = 0;
            const costeUnitario = parseFloat(materiaPrimaInfo.coste_unitario_final);

            if (receta.material_tipo_generico) {
                const anchoBobinaMM = parseFloat(materiaPrimaInfo.ancho_bobina_mm);
                if (anchoBobinaMM > 0) {
                    const anchoBobinaM = anchoBobinaMM / 1000.0;
                    const costePorM2MateriaPrima = costeUnitario / anchoBobinaM;
                    const areaProductoM2 = (parseFloat(productoAnchoFinalM) || 0) * (parseFloat(productoLargoFinalM) || 0);
                    costeMaterialParaEstaReceta = costePorM2MateriaPrima * areaProductoM2 * cantidadRequerida;
                }
            } else if (receta.componente_ref_generico) {
                costeMaterialParaEstaReceta = costeUnitario * cantidadRequerida;
            }
            costeTotalMateriales += costeMaterialParaEstaReceta;
        }
    }
    return costeTotalMateriales;
}



// También `calcularCosteMateriales` y `calcularCosteProcesos` deben aceptar `dbInstance`
async function calcularCosteMateriales(dbInstance, productoTerminadoId, configuraciones) { /* ...usar getAsync(dbInstance, ...) y allAsync(dbInstance, ...) ... */ }
async function calcularCosteProcesos(dbInstance, productoTerminadoId, configuraciones) { /* ...usar allAsync(dbInstance, ...) ... */ }
// Y `obtenerUltimoCosteMaterialGenerico` también
async function obtenerUltimoCosteMaterialGenerico(dbInstance, materialGenerico) { /* ...usar getAsync(dbInstance, ...) ... */ }

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
    // Ahora consulta las tablas correctas 'Stock' e 'Items'
    const sql = `
        SELECT
            s.id,
            i.sku,
            i.descripcion,
            i.familia,
            i.espesor,
            i.ancho,
            i.unidad_medida,
            s.coste_lote AS coste_unitario_final
        FROM Stock s
        JOIN Items i ON s.item_id = i.id
        WHERE i.tipo_item = 'MATERIA_PRIMA' AND s.id IN (
            SELECT MAX(s2.id)
            FROM Stock s2
            JOIN Items i2 ON s2.item_id = i2.id
            GROUP BY i2.sku
        )
        ORDER BY i.sku;
    `;
    return await allDB(sql);
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


// En backend-node/db_operations.js

async function consultarItems(filtros = {}) {
    let sql = `SELECT * FROM Items`;
    const params = [];
    let whereClauses = [];

    if (filtros.tipo_item) {
        whereClauses.push(`tipo_item = ?`);
        params.push(filtros.tipo_item.toUpperCase());
    }

    if (whereClauses.length > 0) {
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    sql += ` ORDER BY sku`;
    return await allDB(sql, params);
}

// En backend-node/db_operations.js

async function crearItem(itemData) {
    const sql = `INSERT INTO Items (sku, descripcion, tipo_item, familia, espesor, ancho, unidad_medida) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    const params = [
        itemData.sku,
        itemData.descripcion,
        itemData.tipo_item,
        itemData.familia || null,
        itemData.espesor || null,
        itemData.ancho || null,
        itemData.unidad_medida
    ];
    try {
        const result = await runDB(sql, params);
        return { id: result.lastID };
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT' && error.message.includes('Items.sku')) {
            throw new Error(`El SKU '${itemData.sku}' ya existe.`);
        }
        throw error;
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
    consultarStock,
    consultarStockPorPedidoId,
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

    actualizarCosteFabricacionEstandar,

    consultarReferenciasStockConUltimoCoste,
    obtenerMaterialesGenericos,
    calcularPresupuestoProductoTerminado,
    calcularCosteMaterialEspecifico, // Asegúrate de exportar esta nueva función de cálculo

    obtenerConfiguracion,
    actualizarConfiguracion,

    calcularCosteProcesos,
    obtenerUltimoCosteMaterialGenerico,

    insertarPedidoProveedor,

    crearItem,

    consultarItems,

    conectarDB,
    runAsync,
    getAsync,
    allAsync
};
