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
    // Habilitar claves foráneas (importante para la integridad referencial)
    db.exec('PRAGMA foreign_keys = ON;', (err) => {
        if (err) {
            console.error("Error al habilitar foreign keys:", err.message);
        }
    });
    return db;
}

/**
 * Helper para ejecutar una query dentro de una transacción.
 * No cierra la DB.
 * @param {sqlite3.Database} db - La instancia de la base de datos.
 * @param {string} sql - La consulta SQL.
 * @param {Array} params - Los parámetros de la consulta.
 * @returns {Promise<object>} Objeto con lastID y changes.
 */
function runAsync(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                console.error('Error ejecutando SQL:', sql, params, err.message);
                return reject(err);
            }
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

/**
 * Helper para ejecutar una consulta ALL dentro de una transacción.
 * No cierra la DB.
 * @param {sqlite3.Database} db - La instancia de la base de datos.
 * @param {string} sql - La consulta SQL.
 * @param {Array} params - Los parámetros de la consulta.
 * @returns {Promise<Array>} Array de filas.
 */
function allAsync(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error('Error ejecutando SQL (all):', sql, params, err.message);
                return reject(err);
            }
            resolve(rows);
        });
    });
}

/**
 * Helper para ejecutar una consulta GET dentro de una transacción.
 * No cierra la DB.
 * @param {sqlite3.Database} db - La instancia de la base de datos.
 * @param {string} sql - La consulta SQL.
 * @param {Array} params - Los parámetros de la consulta.
 * @returns {Promise<object|null>} Una fila o null.
 */
function getAsync(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                console.error('Error ejecutando SQL (get):', sql, params, err.message);
                return reject(err);
            }
            resolve(row || null);
        });
    });
}


// --- FUNCIONES EXISTENTES (Mantenidas o ligeramente modificadas para usar db.close() en finally) ---

function consultarStockMateriasPrimas(filtros = null) {
    return new Promise((resolve, reject) => {
        const db = conectarDB();
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

        db.all(sql, params, (err, rows) => {
            db.close();
            if (err) {
                console.error("Error al consultar StockMateriasPrimas con filtros:", err.message);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

function consultarItemStockPorId(idItem, tablaItem) {
    return new Promise((resolve, reject) => {
        const tablasPermitidas = ['StockMateriasPrimas', 'StockComponentes'];
        if (!tablasPermitidas.includes(tablaItem)) {
            return reject(new Error(`Tabla no válida: ${tablaItem}`));
        }
        const db = conectarDB();
        const sql = `SELECT * FROM ${tablaItem} WHERE id = ?`;
        db.get(sql, [idItem], (err, row) => {
            db.close();
            if (err) {
                console.error(`Error al consultar item ${idItem} en ${tablaItem}:`, err.message);
                reject(err);
            } else {
                resolve(row || null);
            }
        });
    });
}

function insertarPedidoProveedor(dbInstance, pedidoData) {
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
        dbInstance.run(sql, params, function(err) {
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

function insertarGastoPedido(dbInstance, gastoData) {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO GastosPedido (pedido_id, tipo_gasto, descripcion, coste_eur)
                     VALUES (?, ?, ?, ?)`;
        const params = [
            gastoData.pedido_id,
            gastoData.tipo_gasto,
            gastoData.descripcion,
            gastoData.coste_eur
        ];
        dbInstance.run(sql, params, function(err) {
            if (err) {
                console.error("Error al insertar en GastosPedido:", err.message);
                return reject(err);
            }
            resolve(this.lastID);
        });
    });
}

function insertarStockMateriaPrima(dbInstance, stockData) {
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
        dbInstance.run(sql, params, function(err) {
            if (err) {
                console.error("Error al insertar en StockMateriasPrimas:", err.message);
                // La restricción UNIQUE es (referencia_stock, subtipo_material, espesor, ancho, color)
                if (err.message.includes("UNIQUE constraint failed")) {
                    return reject(new Error(`Ya existe un ítem de stock con la misma combinación de Referencia, Subtipo, Espesor, Ancho y Color: '${stockData.referencia_stock}'.`));
                }
                return reject(err);
            }
            resolve(this.lastID);
        });
    });
}

function buscarStockItemExistente(dbInstance, itemKey) {
    return new Promise((resolve, reject) => {
        const { referencia_stock, subtipo_material, espesor, ancho, color } = itemKey;
        const sql = `SELECT id, largo_actual, largo_inicial, coste_unitario_final FROM StockMateriasPrimas
                     WHERE referencia_stock = ?
                     AND (subtipo_material = ? OR (subtipo_material IS NULL AND ? IS NULL))
                     AND (espesor = ? OR (espesor IS NULL AND ? IS NULL))
                     AND (ancho = ? OR (ancho IS NULL AND ? IS NULL))
                     AND (color = ? OR (color IS NULL AND ? IS NULL))`;
        const params = [
            referencia_stock,
            subtipo_material, subtipo_material, // Para el OR (columna IS NULL AND ? IS NULL)
            espesor, espesor,
            ancho, ancho,
            color, color
        ];

        dbInstance.get(sql, params, (err, row) => {
            if (err) {
                console.error("Error buscando ítem de stock existente:", err.message);
                return reject(err);
            }
            resolve(row || null);
        });
    });
}

function actualizarStockItemExistente(dbInstance, idStockItem, datosActualizacion) {
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
            datosActualizacion.cantidad_nueva, // Sumamos también a largo_inicial para mantener la consistencia
            datosActualizacion.nuevo_coste_unitario_final,
            datosActualizacion.nueva_fecha_entrada_almacen,
            datosActualizacion.nuevo_pedido_id,
            datosActualizacion.nueva_origen_factura,
            idStockItem
        ];
        dbInstance.run(sql, params, function(err) {
            if (err) {
                console.error("Error actualizando ítem de stock existente:", err.message);
                return reject(err);
            }
            resolve(this.changes);
        });
    });
}

async function procesarNuevoPedido(datosCompletosPedido) {
    const { pedido, lineas, gastos, material_tipo_general } = datosCompletosPedido;
    const db = conectarDB();

    try {
        await runAsync(db, 'BEGIN TRANSACTION;');

        const pedidoId = await insertarPedidoProveedor(db, pedido);

        for (const gasto of gastos) {
            await insertarGastoPedido(db, { ...gasto, pedido_id: pedidoId });
        }

        for (const linea of lineas) {
            // Normalizar valores para la clave de búsqueda (manejar nulls y vacíos)
            const itemKey = {
                referencia_stock: linea.referencia_stock,
                subtipo_material: linea.subtipo_material || null,
                espesor: linea.espesor || null,
                ancho: linea.ancho ? parseFloat(linea.ancho) : null,
                color: linea.color || null
            };

            const itemExistente = await buscarStockItemExistente(db, itemKey);

            if (itemExistente) {
                const datosActualizacion = {
                    cantidad_nueva: parseFloat(linea.cantidad_original) || 0,
                    nuevo_coste_unitario_final: parseFloat(linea.coste_unitario_final_calculado) || 0,
                    nueva_fecha_entrada_almacen: pedido.fecha_llegada,
                    nuevo_pedido_id: pedidoId,
                    nueva_origen_factura: pedido.numero_factura,
                };
                await actualizarStockItemExistente(db, itemExistente.id, datosActualizacion);
                console.log(`Stock actualizado para ID: ${itemExistente.id}, Ref: ${itemKey.referencia_stock}`);
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
                    origen_factura: pedido.numero_factura
                };
                const nuevoStockId = await insertarStockMateriaPrima(db, stockDataParaDB);
                console.log(`Nuevo stock insertado con ID: ${nuevoStockId}, Ref: ${itemKey.referencia_stock}`);
            }
        }

        await runAsync(db, 'COMMIT;');
        return { pedidoId, mensaje: `Pedido de ${material_tipo_general} (${pedido.origen_tipo}) procesado exitosamente.` };

    } catch (error) {
        console.error(`Error en la transacción de procesarNuevoPedido (${material_tipo_general}, ${pedido.origen_tipo}), revirtiendo:`, error.message);
        await runAsync(db, 'ROLLBACK;');
        throw error;
    } finally {
        db.close();
    }
}

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

        db.all(sql, params, (err, rows) => {
            db.close();
            if (err) {
                console.error("Error al consultar Lista de Pedidos:", err.message);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

function consultarInfoPedidoPorId(dbInstance, pedidoId) {
    return getAsync(dbInstance, `SELECT * FROM PedidosProveedores WHERE id = ?`, [pedidoId]);
}

function consultarGastosPorPedidoId(dbInstance, pedidoId) {
    return allAsync(dbInstance, `SELECT id, tipo_gasto, descripcion, coste_eur FROM GastosPedido WHERE pedido_id = ? ORDER BY id`, [pedidoId]);
}

function consultarStockItemsPorPedidoId(dbInstance, pedidoId) {
    return allAsync(dbInstance, `SELECT id, referencia_stock, material_tipo, subtipo_material, espesor, ancho, color,
                            largo_inicial, largo_actual, unidad_medida, coste_unitario_final, status,
                            fecha_entrada_almacen, ubicacion, notas
                     FROM StockMateriasPrimas
                     WHERE pedido_id = ?
                     ORDER BY id`, [pedidoId]);
}

function consultarLineasPedidoPorPedidoId(dbInstance, pedidoId) {
    return allAsync(dbInstance, `SELECT cantidad_original, precio_unitario_original, moneda_original FROM LineasPedido WHERE pedido_id = ?`, [pedidoId]);
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
        db.close();
    }
}

function actualizarEstadoStockItem(stockItemId, nuevoEstado) {
    return new Promise((resolve, reject) => {
        const db = conectarDB();
        const estadosPermitidos = ['DISPONIBLE', 'AGOTADO', 'EMPEZADA', 'DESCATALOGADO'];
        if (!estadosPermitidos.includes(nuevoEstado.toUpperCase())) {
            db.close();
            return reject(new Error(`Estado '${nuevoEstado}' no válido.`));
        }

        const sql = `UPDATE StockMateriasPrimas SET status = ? WHERE id = ?`;
        const params = [nuevoEstado.toUpperCase(), stockItemId];

        db.run(sql, params, function(err) {
            db.close();
            if (err) {
                console.error(`Error al actualizar estado del ítem de stock ${stockItemId}:`, err.message);
                return reject(err);
            }
            if (this.changes === 0) {
                return reject(new Error(`No se encontró el ítem de stock con ID ${stockItemId} para actualizar.`));
            }
            resolve(this.changes);
        });
    });
}

async function eliminarPedidoCompleto(pedidoId) {
    const db = conectarDB();
    try {
        await runAsync(db, 'BEGIN TRANSACTION;');

        const stockChanges = await runAsync(db, 'DELETE FROM StockMateriasPrimas WHERE pedido_id = ?', [pedidoId]);
        console.log(`StockMateriasPrimas eliminadas para pedido ID ${pedidoId}: ${stockChanges} filas`);

        const gastosChanges = await runAsync(db, 'DELETE FROM GastosPedido WHERE pedido_id = ?', [pedidoId]);
        console.log(`GastosPedido eliminados para pedido ID ${pedidoId}: ${gastosChanges} filas`);

        const lineasPedidoChanges = await runAsync(db, 'DELETE FROM LineasPedido WHERE pedido_id = ?', [pedidoId]);
        console.log(`LineasPedido eliminadas para pedido ID ${pedidoId}: ${lineasPedidoChanges} filas`);

        const pedidoPrincipalChanges = await runAsync(db, 'DELETE FROM PedidosProveedores WHERE id = ?', [pedidoId]);
        console.log(`PedidosProveedores eliminado para ID ${pedidoId}: ${pedidoPrincipalChanges} filas`);

        if (pedidoPrincipalChanges === 0) {
            await runAsync(db, 'ROLLBACK;');
            throw new Error(`Pedido con ID ${pedidoId} no encontrado.`);
        }

        await runAsync(db, 'COMMIT;');
        return {
            pedidoPrincipalEliminado: pedidoPrincipalChanges,
            gastosEliminados: gastosChanges,
            lineasPedidoEliminadas: lineasPedidoChanges,
            stockItemsEliminados: stockChanges,
            mensaje: `Pedido ID ${pedidoId} y datos asociados eliminados.`
        };

    } catch (error) {
        console.error(`Error en la transacción de eliminarPedidoCompleto para ID ${pedidoId}, revirtiendo:`, error.message);
        await runAsync(db, 'ROLLBACK;');
        throw error;
    } finally {
        db.close();
    }
}

function obtenerConfiguraciones() {
    return new Promise((resolve, reject) => {
        const db = conectarDB();
        const sql = `SELECT clave, valor FROM Configuracion`;

        db.all(sql, [], (err, rows) => {
            db.close();
            if (err) {
                console.error("Error al obtener configuraciones:", err.message);
                return reject(err);
            }
            const configuraciones = {};
            rows.forEach(row => {
                try {
                    configuraciones[row.clave] = JSON.parse(row.valor);
                } catch (e) {
                    const num = parseFloat(row.valor);
                    if (!isNaN(num) && isFinite(row.valor)) {
                        configuraciones[row.clave] = num;
                    } else {
                        configuraciones[row.clave] = row.valor;
                    }
                }
            });
            resolve(configuraciones);
        });
    });
}

// --- NUEVAS FUNCIONES PARA LA FASE 5 ---

// --- ProductosTerminados ---
async function insertarProductoTerminado(productoData) {
    const db = conectarDB();
    try {
        const result = await runAsync(db, `INSERT INTO ProductosTerminados (
            referencia, nombre, descripcion, unidad_medida,
            coste_fabricacion_estandar, margen_venta_default, precio_venta_sugerido,
            fecha_creacion, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            productoData.referencia,
            productoData.nombre,
            productoData.descripcion || null,
            productoData.unidad_medida || 'unidad',
            parseFloat(productoData.coste_fabricacion_estandar) || 0,
            parseFloat(productoData.margen_venta_default) || 0,
            parseFloat(productoData.precio_venta_sugerido) || 0,
            new Date().toISOString().split('T')[0],
            productoData.status || 'ACTIVO'
        ]);
        return result.lastID;
    } catch (error) {
        if (error.message.includes("UNIQUE constraint failed: ProductosTerminados.referencia")) {
            throw new Error(`La referencia de producto '${productoData.referencia}' ya existe.`);
        }
        throw error;
    } finally {
        db.close();
    }
}

async function consultarProductosTerminados(filtros = {}) {
    const db = conectarDB();
    try {
        let sql = `SELECT * FROM ProductosTerminados`;
        const params = [];
        const whereClauses = [];

        if (filtros.referencia_like) {
            whereClauses.push(`referencia LIKE ?`);
            params.push(`%${filtros.referencia_like}%`);
        }
        if (filtros.nombre_like) {
            whereClauses.push(`nombre LIKE ?`);
            params.push(`%${filtros.nombre_like}%`);
        }
        if (filtros.status) {
            whereClauses.push(`status = ?`);
            params.push(filtros.status.toUpperCase());
        }

        if (whereClauses.length > 0) {
            sql += ` WHERE ${whereClauses.join(' AND ')}`;
        }
        sql += ` ORDER BY nombre ASC`;

        return await allAsync(db, sql, params);
    } finally {
        db.close();
    }
}

async function consultarProductoTerminadoPorId(id) {
    const db = conectarDB();
    try {
        return await getAsync(db, `SELECT * FROM ProductosTerminados WHERE id = ?`, [id]);
    } finally {
        db.close();
    }
}

async function actualizarProductoTerminado(id, updates) {
    const db = conectarDB();
    try {
        const setClauses = [];
        const params = [];

        for (const key in updates) {
            if (updates.hasOwnProperty(key) && key !== 'id') { // No permitimos actualizar el ID
                setClauses.push(`${key} = ?`);
                // Asegurar que los valores numéricos se parseen
                if (['coste_fabricacion_estandar', 'margen_venta_default', 'precio_venta_sugerido'].includes(key)) {
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
        const result = await runAsync(db, `UPDATE ProductosTerminados SET ${setClauses.join(', ')} WHERE id = ?`, params);
        if (result.changes === 0) {
            throw new Error(`No se encontró ProductoTerminado con ID ${id} para actualizar.`);
        }
        return result.changes;
    } catch (error) {
        if (error.message.includes("UNIQUE constraint failed: ProductosTerminados.referencia")) {
            throw new Error(`La referencia de producto ya existe.`);
        }
        throw error;
    } finally {
        db.close();
    }
}

async function eliminarProductoTerminado(id) {
    const db = conectarDB();
    try {
        const result = await runAsync(db, `DELETE FROM ProductosTerminados WHERE id = ?`, [id]);
        if (result.changes === 0) {
            throw new Error(`No se encontró ProductoTerminado con ID ${id} para eliminar.`);
        }
        return result.changes;
    } finally {
        db.close();
    }
}

// --- Maquinaria ---
async function insertarMaquinaria(maquinaData) {
    const db = conectarDB();
    try {
        const result = await runAsync(db, `INSERT INTO Maquinaria (
            nombre, descripcion, coste_adquisicion, coste_hora_operacion
        ) VALUES (?, ?, ?, ?)`, [
            maquinaData.nombre,
            maquinaData.descripcion || null,
            parseFloat(maquinaData.coste_adquisicion) || 0,
            parseFloat(maquinaData.coste_hora_operacion) || 0
        ]);
        return result.lastID;
    } catch (error) {
        if (error.message.includes("UNIQUE constraint failed: Maquinaria.nombre")) {
            throw new Error(`El nombre de la máquina '${maquinaData.nombre}' ya existe.`);
        }
        throw error;
    } finally {
        db.close();
    }
}

async function consultarMaquinaria(filtros = {}) {
    const db = conectarDB();
    try {
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

        return await allAsync(db, sql, params);
    } finally {
        db.close();
    }
}

async function consultarMaquinariaPorId(id) {
    const db = conectarDB();
    try {
        return await getAsync(db, `SELECT * FROM Maquinaria WHERE id = ?`, [id]);
    } finally {
        db.close();
    }
}

async function actualizarMaquinaria(id, updates) {
    const db = conectarDB();
    try {
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
        const result = await runAsync(db, `UPDATE Maquinaria SET ${setClauses.join(', ')} WHERE id = ?`, params);
        if (result.changes === 0) {
            throw new Error(`No se encontró Maquinaria con ID ${id} para actualizar.`);
        }
        return result.changes;
    } catch (error) {
        if (error.message.includes("UNIQUE constraint failed: Maquinaria.nombre")) {
            throw new Error(`El nombre de la máquina ya existe.`);
        }
        throw error;
    } finally {
        db.close();
    }
}

async function eliminarMaquinaria(id) {
    const db = conectarDB();
    try {
        const result = await runAsync(db, `DELETE FROM Maquinaria WHERE id = ?`, [id]);
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
    } finally {
        db.close();
    }
}

// --- Recetas (Lista de Materiales - BOM) ---
async function insertarReceta(recetaData) {
    const db = conectarDB();
    try {
        const result = await runAsync(db, `INSERT INTO Recetas (
            producto_terminado_id, material_id, componente_id, notas
        ) VALUES (?, ?, ?, ?)`, [
            recetaData.producto_terminado_id,
            recetaData.material_id || null,
            recetaData.componente_id || null,
            recetaData.notas || null
        ]);
        return result.lastID;
    } catch (error) {
        if (error.message.includes("FOREIGN KEY constraint failed")) {
            throw new Error(`Producto terminado o material/componente no válido.`);
        }
        if (error.message.includes("UNIQUE constraint failed")) {
            throw new Error(`Ya existe una entrada de receta para este producto y material/componente.`);
        }
        throw error;
    } finally {
        db.close();
    }
}

async function consultarRecetas(filtros = {}) {
    const db = conectarDB();
    try {
        let sql = `SELECT r.*, pt.nombre AS producto_nombre, pt.referencia AS producto_referencia,
                          sm.referencia_stock AS material_referencia_stock, sm.material_tipo AS material_tipo,
                          sc.componente_ref AS componente_referencia_stock
                   FROM Recetas r
                   JOIN ProductosTerminados pt ON r.producto_terminado_id = pt.id
                   LEFT JOIN StockMateriasPrimas sm ON r.material_id = sm.id
                   LEFT JOIN StockComponentes sc ON r.componente_id = sc.id`;
        const params = [];
        const whereClauses = [];

        if (filtros.producto_terminado_id) {
            whereClauses.push(`r.producto_terminado_id = ?`);
            params.push(filtros.producto_terminado_id);
        }
        if (filtros.material_id) {
            whereClauses.push(`r.material_id = ?`);
            params.push(filtros.material_id);
        }
        if (filtros.componente_id) {
            whereClauses.push(`r.componente_id = ?`);
            params.push(filtros.componente_id);
        }

        if (whereClauses.length > 0) {
            sql += ` WHERE ${whereClauses.join(' AND ')}`;
        }
        sql += ` ORDER BY pt.nombre, r.id ASC`;

        return await allAsync(db, sql, params);
    } finally {
        db.close();
    }
}

async function consultarRecetaPorId(id) {
    const db = conectarDB();
    try {
        let sql = `SELECT r.*, pt.nombre AS producto_nombre, pt.referencia AS producto_referencia,
                          sm.referencia_stock AS material_referencia_stock, sm.material_tipo AS material_tipo,
                          sc.componente_ref AS componente_referencia_stock
                   FROM Recetas r
                   JOIN ProductosTerminados pt ON r.producto_terminado_id = pt.id
                   LEFT JOIN StockMateriasPrimas sm ON r.material_id = sm.id
                   LEFT JOIN StockComponentes sc ON r.componente_id = sc.id
                   WHERE r.id = ?`;
        return await getAsync(db, sql, [id]);
    } finally {
        db.close();
    }
}

async function actualizarReceta(id, updates) {
    const db = conectarDB();
    try {
        const setClauses = [];
        const params = [];

        for (const key in updates) {
            if (updates.hasOwnProperty(key) && key !== 'id') {
                setClauses.push(`${key} = ?`);
                params.push(updates[key]); // No hay campos numéricos específicos aquí ahora
            }
        }

        if (setClauses.length === 0) {
            throw new Error("No hay campos para actualizar.");
        }

        params.push(id);
        const result = await runAsync(db, `UPDATE Recetas SET ${setClauses.join(', ')} WHERE id = ?`, params);
        if (result.changes === 0) {
            throw new Error(`No se encontró Receta con ID ${id} para actualizar.`);
        }
        return result.changes;
    } catch (error) {
        if (error.message.includes("UNIQUE constraint failed")) {
            throw new Error(`Ya existe una entrada de receta para este producto y material/componente.`);
        }
        throw error;
    } finally {
        db.close();
    }
}

async function eliminarReceta(id) {
    const db = conectarDB();
    try {
        const result = await runAsync(db, `DELETE FROM Recetas WHERE id = ?`, [id]);
        if (result.changes === 0) {
            throw new Error(`No se encontró Receta con ID ${id} para eliminar.`);
        }
        return result.changes;
    } finally {
        db.close();
    }
}

// --- ProcesosFabricacion ---
async function insertarProcesoFabricacion(procesoData) {
    const db = conectarDB();
    try {
        const result = await runAsync(db, `INSERT INTO ProcesosFabricacion (
            producto_terminado_id, maquinaria_id, nombre_proceso,
            tiempo_estimado_horas
        ) VALUES (?, ?, ?, ?)`, [
            procesoData.producto_terminado_id,
            procesoData.maquinaria_id,
            procesoData.nombre_proceso,
            parseFloat(procesoData.tiempo_estimado_horas) || 0
        ]);
        return result.lastID;
    } catch (error) {
        if (error.message.includes("FOREIGN KEY constraint failed")) {
            throw new Error(`Producto terminado o maquinaria no válida.`);
        }
        throw error;
    } finally {
        db.close();
    }
}

async function consultarProcesosFabricacion(filtros = {}) {
    const db = conectarDB();
    try {
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

        if (whereClauses.length > 0) {
            sql += ` WHERE ${whereClauses.join(' AND ')}`;
        }
        sql += ` ORDER BY pt.nombre, pf.nombre_proceso ASC`;

        return await allAsync(db, sql, params);
    } finally {
        db.close();
    }
}

async function consultarProcesoFabricacionPorId(id) {
    const db = conectarDB();
    try {
        let sql = `SELECT pf.*, pt.nombre AS producto_nombre, pt.referencia AS producto_referencia,
                          m.nombre AS maquinaria_nombre
                   FROM ProcesosFabricacion pf
                   JOIN ProductosTerminados pt ON pf.producto_terminado_id = pt.id
                   JOIN Maquinaria m ON pf.maquinaria_id = m.id
                   WHERE pf.id = ?`;
        return await getAsync(db, sql, [id]);
    } finally {
        db.close();
    }
}

async function actualizarProcesoFabricacion(id, updates) {
    const db = conectarDB();
    try {
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
        const result = await runAsync(db, `UPDATE ProcesosFabricacion SET ${setClauses.join(', ')} WHERE id = ?`, params);
        if (result.changes === 0) {
            throw new Error(`No se encontró Proceso de Fabricación con ID ${id} para actualizar.`);
        }
        return result.changes;
    } catch (error) {
        if (error.message.includes("FOREIGN KEY constraint failed")) {
            throw new Error(`Producto terminado o maquinaria no válida.`);
        }
        throw error;
    } finally {
        db.close();
    }
}

async function eliminarProcesoFabricacion(id) {
    const db = conectarDB();
    try {
        const result = await runAsync(db, `DELETE FROM ProcesosFabricacion WHERE id = ?`, [id]);
        if (result.changes === 0) {
            throw new Error(`No se encontró Proceso de Fabricación con ID ${id} para eliminar.`);
        }
        return result.changes;
    } finally {
        db.close();
    }
}

// --- OrdenesProduccion ---
async function insertarOrdenProduccion(ordenData) {
    const db = conectarDB();
    try {
        const result = await runAsync(db, `INSERT INTO OrdenesProduccion (
            producto_terminado_id, cantidad_a_producir, fecha, observaciones
        ) VALUES (?, ?, ?, ?)`, [
            ordenData.producto_terminado_id,
            parseFloat(ordenData.cantidad_a_producir) || 0,
            ordenData.fecha || new Date().toISOString().split('T')[0], // Usar 'fecha' en lugar de 'fecha_inicio'
            ordenData.observaciones || null
        ]);
        return result.lastID;
    } catch (error) {
        if (error.message.includes("FOREIGN KEY constraint failed")) {
            throw new Error(`Producto terminado no válido.`);
        }
        throw error;
    } finally {
        db.close();
    }
}

async function consultarOrdenesProduccion(filtros = {}) {
    const db = conectarDB();
    try {
        let sql = `SELECT op.*, pt.nombre AS producto_nombre, pt.referencia AS producto_referencia
                   FROM OrdenesProduccion op
                   JOIN ProductosTerminados pt ON op.producto_terminado_id = pt.id`;
        const params = [];
        const whereClauses = [];

        if (filtros.producto_id) {
            whereClauses.push(`op.producto_terminado_id = ?`);
            params.push(filtros.producto_id);
        }
        // No hay filtro por status ya que el campo status se elimina de la UI
        if (filtros.fecha_desde) { // Usar 'fecha' en lugar de 'fecha_inicio_desde'
            whereClauses.push(`op.fecha >= ?`);
            params.push(filtros.fecha_desde);
        }
        if (filtros.fecha_hasta) { // Usar 'fecha' en lugar de 'fecha_inicio_hasta'
            whereClauses.push(`op.fecha <= ?`);
            params.push(filtros.fecha_hasta);
        }

        if (whereClauses.length > 0) {
            sql += ` WHERE ${whereClauses.join(' AND ')}`;
        }
        sql += ` ORDER BY op.fecha DESC, op.id DESC`; // Ordenar por 'fecha'

        return await allAsync(db, sql, params);
    } finally {
        db.close();
    }
}

async function consultarOrdenProduccionPorId(id) {
    const db = conectarDB();
    try {
        let sql = `SELECT op.*, pt.nombre AS producto_nombre, pt.referencia AS producto_referencia
                   FROM OrdenesProduccion op
                   JOIN ProductosTerminados pt ON op.producto_terminado_id = pt.id
                   WHERE op.id = ?`;
        return await getAsync(db, sql, [id]);
    } finally {
        db.close();
    }
}

async function actualizarOrdenProduccion(id, updates) {
    const db = conectarDB();
    try {
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
        const result = await runAsync(db, `UPDATE OrdenesProduccion SET ${setClauses.join(', ')} WHERE id = ?`, params);
        if (result.changes === 0) {
            throw new Error(`No se encontró Orden de Producción con ID ${id} para actualizar.`);
        }
        return result.changes;
    } catch (error) {
        throw error;
    } finally {
        db.close();
    }
}

async function eliminarOrdenProduccion(id) {
    const db = conectarDB();
    try {
        const result = await runAsync(db, `DELETE FROM OrdenesProduccion WHERE id = ?`, [id]);
        if (result.changes === 0) {
            throw new Error(`No se encontró Orden de Producción con ID ${id} para eliminar.`);
        }
        return result.changes;
    } finally {
        db.close();
    }
}

// --- StockProductosTerminados ---
async function insertarStockProductoTerminado(dbInstance, stockData) { // Asegúrate de que dbInstance se pasa
    try {
        const result = await runAsync(dbInstance, `INSERT INTO StockProductosTerminados (
            producto_id, orden_produccion_id, cantidad_actual, unidad_medida,
            coste_unitario_final, fecha_entrada_almacen, status, ubicacion, notas
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            stockData.producto_id,
            stockData.orden_produccion_id || null,
            parseFloat(stockData.cantidad_actual) || 0,
            stockData.unidad_medida || 'unidad',
            parseFloat(stockData.coste_unitario_final) || 0,
            stockData.fecha_entrada_almacen || new Date().toISOString().split('T')[0],
            stockData.status || 'DISPONIBLE',
            stockData.ubicacion || null,
            stockData.notas || null
        ]);
        return result.lastID;
    } catch (error) {
        if (error.message.includes("FOREIGN KEY constraint failed")) {
            throw new Error(`Producto o Orden de Producción no válidos.`);
        }
        throw error;
    }
    // No db.close() aquí, ya que se usa dentro de una transacción
}

async function consultarStockProductosTerminados(filtros = {}) {
    const db = conectarDB();
    try {
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

        return await allAsync(db, sql, params);
    } finally {
        db.close();
    }
}

async function consultarStockProductoTerminadoPorId(id) {
    const db = conectarDB();
    try {
        let sql = `SELECT spt.*, pt.nombre AS producto_nombre, pt.referencia AS producto_referencia
                   FROM StockProductosTerminados spt
                   JOIN ProductosTerminados pt ON spt.producto_id = pt.id
                   WHERE spt.id = ?`;
        return await getAsync(db, sql, [id]);
    } finally {
        db.close();
    }
}

async function actualizarStockProductoTerminado(id, updates) {
    const db = conectarDB();
    try {
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
        const result = await runAsync(db, `UPDATE StockProductosTerminados SET ${setClauses.join(', ')} WHERE id = ?`, params);
        if (result.changes === 0) {
            throw new Error(`No se encontró Stock de Producto Terminado con ID ${id} para actualizar.`);
        }
        return result.changes;
    } catch (error) {
        throw error;
    } finally {
        db.close();
    }
}

async function eliminarStockProductoTerminado(id) {
    const db = conectarDB();
    try {
        const result = await runAsync(db, `DELETE FROM StockProductosTerminados WHERE id = ?`, [id]);
        if (result.changes === 0) {
            throw new Error(`No se encontró Stock de Producto Terminado con ID ${id} para eliminar.`);
        }
        return result.changes;
    } finally {
        db.close();
    }
}

// --- LÓGICA DE CÁLCULO DE COSTES DE FABRICACIÓN ---

/**
 * Calcula el coste de materiales para un producto terminado basado en su receta.
 * @param {sqlite3.Database} dbInstance - Instancia de la base de datos.
 * @param {number} productoTerminadoId - ID del producto terminado.
 * @returns {Promise<number>} Coste total de materiales.
 */
async function calcularCosteMateriales(dbInstance, productoTerminadoId) {
    const recetas = await allAsync(dbInstance, `
        SELECT r.material_id, r.componente_id,
               sm.coste_unitario_final AS material_coste_unitario, sm.unidad_medida AS material_unidad_medida,
               sc.coste_unitario_final AS componente_coste_unitario, sc.unidad_medida AS componente_unidad_medida
        FROM Recetas r
        LEFT JOIN StockMateriasPrimas sm ON r.material_id = sm.id
        LEFT JOIN StockComponentes sc ON r.componente_id = sc.id
        WHERE r.producto_terminado_id = ?
    `, [productoTerminadoId]);

    let costeTotalMateriales = 0;
    for (const receta of recetas) {
        let costeUnitario = 0;
        // Si no se especifica cantidad requerida en la receta, asumimos 1 para el cálculo del coste estándar
        // Esto es porque la receta es "teórica" y no tiene cantidad requerida
        const cantidadTeorica = 1;

        if (receta.material_coste_unitario !== null) {
            costeUnitario = parseFloat(receta.material_coste_unitario);
        } else if (receta.componente_coste_unitario !== null) {
            costeUnitario = parseFloat(receta.componente_coste_unitario);
        }
        costeTotalMateriales += cantidadTeorica * costeUnitario;
    }
    return costeTotalMateriales;
}

/**
 * Calcula el coste de los procesos de fabricación para un producto terminado.
 * @param {sqlite3.Database} dbInstance - Instancia de la base de datos.
 * @param {number} productoTerminadoId - ID del producto terminado.
 * @returns {Promise<number>} Coste total de procesos (maquinaria + mano de obra).
 */
async function calcularCosteProcesos(dbInstance, productoTerminadoId) {
    const procesos = await allAsync(dbInstance, `
        SELECT pf.tiempo_estimado_horas,
               m.coste_hora_operacion, m.depreciacion_hora
        FROM ProcesosFabricacion pf
        JOIN Maquinaria m ON pf.maquinaria_id = m.id
        WHERE pf.producto_terminado_id = ?
    `, [productoTerminadoId]);

    const configuraciones = await obtenerConfiguraciones(); // Obtener configuraciones aquí
    const costeManoObraDefault = parseFloat(configuraciones.coste_mano_obra_default || 0); // Usar default de config

    let costeTotalProcesos = 0;
    for (const proceso of procesos) {
        const tiempoHoras = parseFloat(proceso.tiempo_estimado_horas) || 0;
        const costeMaquinaOperacion = parseFloat(proceso.coste_hora_operacion) || 0;
        // La depreciación por hora se ha eliminado de la tabla de Maquinaria, así que no se usa aquí.
        // const costeMaquinaDepreciacion = parseFloat(proceso.depreciacion_hora) || 0;

        // Coste de mano de obra ahora es fijo de configuración, no por proceso
        costeTotalProcesos += tiempoHoras * (costeManoObraDefault + costeMaquinaOperacion);
    }
    return costeTotalProcesos;
}

/**
 * Calcula y actualiza el coste de fabricación estándar de un producto terminado.
 * @param {number} productoTerminadoId - ID del producto terminado.
 * @returns {Promise<number>} El coste de fabricación estándar calculado.
 */
async function actualizarCosteFabricacionEstandar(productoTerminadoId) {
    const db = conectarDB();
    try {
        const costeMateriales = await calcularCosteMateriales(db, productoTerminadoId);
        const costeProcesos = await calcularCosteProcesos(db, productoTerminadoId);
        const costeTotal = costeMateriales + costeProcesos;

        await runAsync(db, `UPDATE ProductosTerminados SET coste_fabricacion_estandar = ? WHERE id = ?`, [costeTotal, productoTerminadoId]);
        console.log(`Coste de fabricación estándar para producto ${productoTerminadoId} actualizado a ${costeTotal}`);
        return costeTotal;
    } catch (error) {
        console.error(`Error al actualizar coste de fabricación estándar para producto ${productoTerminadoId}:`, error.message);
        throw error;
    } finally {
        db.close();
    }
}

// --- LÓGICA DE PROCESAMIENTO DE ÓRDENES DE PRODUCCIÓN ---

/**
 * Procesa una Orden de Producción, descontando materiales y añadiendo producto terminado.
 * @param {number} ordenProduccionId - ID de la orden de producción a procesar.
 * @returns {Promise<object>} Resumen de la operación.
 */
async function procesarOrdenProduccion(ordenProduccionId) {
    const db = conectarDB();
    try {
        await runAsync(db, 'BEGIN TRANSACTION;');

        const orden = await getAsync(db, `SELECT * FROM OrdenesProduccion WHERE id = ?`, [ordenProduccionId]);
        if (!orden) {
            throw new Error(`Orden de Producción con ID ${ordenProduccionId} no encontrada.`);
        }
        if (orden.status === 'COMPLETADA') { // Mantener status interno para lógica
            throw new Error(`La Orden de Producción ID ${ordenProduccionId} ya está completada.`);
        }
        if (orden.status === 'CANCELADA') { // Mantener status interno para lógica
            throw new Error(`La Orden de Producción ID ${ordenProduccionId} está cancelada.`);
        }
        if (parseFloat(orden.cantidad_a_producir) <= 0) {
            throw new Error(`La cantidad a producir para la Orden de Producción ID ${ordenProduccionId} debe ser mayor que cero.`);
        }

        const productoTerminado = await getAsync(db, `SELECT * FROM ProductosTerminados WHERE id = ?`, [orden.producto_terminado_id]);
        if (!productoTerminado) {
            throw new Error(`Producto terminado ID ${orden.producto_terminado_id} no encontrado para la orden.`);
        }

        const recetas = await allAsync(db, `
            SELECT r.material_id, r.componente_id,
                   sm.largo_actual AS material_largo_actual, sm.unidad_medida AS material_unidad_medida, sm.id AS material_stock_id, sm.coste_unitario_final AS material_coste_unitario,
                   sc.cantidad_actual AS componente_cantidad_actual, sc.unidad_medida AS componente_unidad_medida, sc.id AS componente_stock_id, sc.coste_unitario_final AS componente_coste_unitario
            FROM Recetas r
            LEFT JOIN StockMateriasPrimas sm ON r.material_id = sm.id
            LEFT JOIN StockComponentes sc ON r.componente_id = sc.id
            WHERE r.producto_terminado_id = ?
        `, [orden.producto_terminado_id]);

        let totalCosteMaterialesReal = 0;
        let totalCosteProcesosReal = 0;

        const configuraciones = await obtenerConfiguraciones();
        const costeManoObraDefault = parseFloat(configuraciones.coste_mano_obra_default || 0);

        // 1. Verificar stock y calcular coste real de materiales
        for (const receta of recetas) {
            // Asumimos que la cantidad requerida para la producción real es la cantidad a producir de la OP
            // multiplicada por el coste unitario del material/componente en stock.
            // Si la receta es "teórica" sin cantidad, esto es un punto de decisión.
            // Para que el coste tenga sentido, necesitamos una "cantidad_requerida_por_unidad_de_producto"
            // en la tabla de Recetas, o asumimos 1 unidad de material por 1 unidad de producto.
            // Dada la petición de "cantidad requerida tampoco, puesto que siempre va a ser todo mas teorico",
            // vamos a asumir que para la producción, la cantidad requerida es 1 unidad de material por cada unidad de producto.
            // Esto es una simplificación y puede necesitar ajuste si las recetas son más complejas.
            const cantidadNecesariaPorUnidadProducto = 1; // Asunción: 1 unidad de material por 1 unidad de producto
            const cantidadTotalNecesaria = cantidadNecesariaPorUnidadProducto * parseFloat(orden.cantidad_a_producir);

            let stockActual = 0;
            let stockItemId = null;
            let costeUnitarioStock = 0;

            if (receta.material_id) {
                stockActual = parseFloat(receta.material_largo_actual) || 0;
                stockItemId = receta.material_stock_id;
                costeUnitarioStock = parseFloat(receta.material_coste_unitario) || 0;
            } else if (receta.componente_id) {
                stockActual = parseFloat(receta.componente_cantidad_actual) || 0;
                stockItemId = receta.componente_stock_id;
                costeUnitarioStock = parseFloat(receta.componente_coste_unitario) || 0;
            } else {
                console.warn(`Receta ID ${receta.id} no tiene material_id ni componente_id. Ignorando.`);
                continue; // Saltar esta receta si no apunta a nada
            }

            if (stockActual < cantidadTotalNecesaria) {
                throw new Error(`Stock insuficiente para material/componente ID ${stockItemId}. Necesario: ${cantidadTotalNecesaria}, Disponible: ${stockActual}.`);
            }
            totalCosteMaterialesReal += cantidadTotalNecesaria * costeUnitarioStock;
        }

        // 2. Descontar stock de materias primas/componentes
        for (const receta of recetas) {
            const cantidadConsumir = 1 * parseFloat(orden.cantidad_a_producir); // Asunción: 1 unidad de material por 1 unidad de producto
            if (receta.material_id) {
                await runAsync(db, `UPDATE StockMateriasPrimas SET largo_actual = largo_actual - ? WHERE id = ?`, [cantidadConsumir, receta.material_stock_id]);
                console.log(`Consumido ${cantidadConsumir} de StockMateriaPrima ID ${receta.material_stock_id}`);
            } else if (receta.componente_id) {
                await runAsync(db, `UPDATE StockComponentes SET cantidad_actual = cantidad_actual - ? WHERE id = ?`, [cantidadConsumir, receta.componente_stock_id]);
                console.log(`Consumido ${cantidadConsumir} de StockComponente ID ${receta.componente_stock_id}`);
            }
        }

        // 3. Calcular coste de procesos (usando el estándar por ahora)
        const procesos = await allAsync(db, `
            SELECT pf.tiempo_estimado_horas,
                   m.coste_hora_operacion, m.depreciacion_hora
            FROM ProcesosFabricacion pf
            JOIN Maquinaria m ON pf.maquinaria_id = m.id
            WHERE pf.producto_terminado_id = ?
        `, [orden.producto_terminado_id]);

        for (const proceso of procesos) {
            const tiempoHoras = parseFloat(proceso.tiempo_estimado_horas) || 0;
            const costeMaquinaOperacion = parseFloat(proceso.coste_hora_operacion) || 0;
            totalCosteProcesosReal += tiempoHoras * (costeManoObraDefault + costeMaquinaOperacion);
        }
        // Multiplicar el coste total de procesos por la cantidad a producir
        totalCosteProcesosReal *= parseFloat(orden.cantidad_a_producir);


        const costeFabricacionReal = totalCosteMaterialesReal + totalCosteProcesosReal;
        const costeUnitarioProductoFinal = parseFloat(orden.cantidad_a_producir) > 0
            ? costeFabricacionReal / parseFloat(orden.cantidad_a_producir)
            : 0;

        // 4. Insertar producto terminado en StockProductosTerminados
        const stockProductoTerminadoData = {
            producto_id: orden.producto_terminado_id, // Asegurar que este ID es correcto
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
        await runAsync(db, `UPDATE OrdenesProduccion SET status = 'COMPLETADA', fecha_fin = ?, coste_real_fabricacion = ? WHERE id = ?`, [new Date().toISOString().split('T')[0], costeFabricacionReal, orden.id]);
        console.log(`Orden de Producción ID ${orden.id} marcada como COMPLETADA.`);

        await runAsync(db, 'COMMIT;');
        return {
            mensaje: `Orden de Producción ID ${orden.id} completada. ${orden.cantidad_a_producir} unidades de ${productoTerminado.nombre} producidas.`,
            costeFabricacionReal: costeFabricacionReal,
            costeUnitarioProductoFinal: costeUnitarioProductoFinal
        };

    } catch (error) {
        console.error(`Error procesando Orden de Producción ID ${ordenProduccionId}, revirtiendo:`, error.message, error.stack);
        await runAsync(db, 'ROLLBACK;');
        throw error;
    } finally {
        db.close();
    }
}


// --- EXPORTACIONES ---
module.exports = {
    consultarStockMateriasPrimas,
    consultarItemStockPorId,
    procesarNuevoPedido,
    consultarListaPedidos,
    obtenerDetallesCompletosPedido,
    actualizarEstadoStockItem,
    eliminarPedidoCompleto,
    obtenerConfiguraciones,

    // Nuevas exportaciones para la Fase 5
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
    procesarOrdenProduccion, // Función clave para la producción

    insertarStockProductoTerminado,
    consultarStockProductosTerminados,
    consultarStockProductoTerminadoPorId,
    actualizarStockProductoTerminado,
    eliminarStockProductoTerminado,

    actualizarCosteFabricacionEstandar // Para recalcular el coste estándar
};
