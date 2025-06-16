// backend-node/db_operations.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, 'almacen', 'almacen.db');

const conectarDB = () => {
    const db = new sqlite3.Database(dbPath, (err) => { if (err) console.error("Error conectando a la DB:", err.message); });
    db.exec('PRAGMA foreign_keys = ON;');
    return db;
};
const runAsync = (db, sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function (err) { if (err) reject(err); else resolve({ lastID: this.lastID, changes: this.changes }); }));
const getAsync = (db, sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row); }));
const allAsync = (db, sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows); }));



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

// AÑADE esta nueva función en db_operations.js
async function consultarFamilias() {
    const db = conectarDB();
    try {
        return await allAsync(db, `SELECT * FROM Familias ORDER BY nombre`);
    } finally {
        db.close();
    }
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

async function findOrCreateItem(db, itemInfo) {
    const { familia, tipo_item, descripcion, sku, atributos } = itemInfo;
    const familiaRow = await getAsync(db, `SELECT id FROM Familias WHERE nombre = ?`, [familia]);
    if (!familiaRow) throw new Error(`La familia '${familia}' no existe.`);

    // Creamos el Item
    const itemResult = await runAsync(db, `INSERT INTO Items (sku, descripcion, familia_id, tipo_item) VALUES (?, ?, ?, ?)`, [sku, descripcion, familiaRow.id, tipo_item]);
    const itemId = itemResult.lastID;

    for (const attr of atributos) {
        let atributoRow = await getAsync(db, `SELECT id FROM Atributos WHERE nombre = ?`, [attr.nombre]);
        if (!atributoRow) {
            const attrResult = await runAsync(db, `INSERT INTO Atributos (nombre) VALUES (?)`, [attr.nombre]);
            atributoRow = { id: attrResult.lastID };
        }
        let valorRow = await getAsync(db, `SELECT id FROM ValoresAtributos WHERE atributo_id = ? AND valor = ?`, [atributoRow.id, attr.valor]);
        if (!valorRow) {
            const valorResult = await runAsync(db, `INSERT INTO ValoresAtributos (atributo_id, valor) VALUES (?, ?)`, [atributoRow.id, attr.valor]);
            valorRow = { id: valorResult.lastID };
        }
        await runAsync(db, `INSERT INTO ItemAtributos (item_id, valor_atributo_id) VALUES (?, ?)`, [itemId, valorRow.id]);
    }
    console.log(`Item '${descripcion}' creado con éxito con ID: ${itemId}`);
    return itemId;
}



async function procesarNuevoPedido(datosCompletosPedido) {
    // La función sigue recibiendo todo el payload
    const { pedido, lineas, gastos, status, material_tipo_general } = datosCompletosPedido;
    const db = conectarDB();

    // --- LÍNEA DE DEFENSA ---
    // Aseguramos que el estado siempre sea un valor válido, sin importar lo que envíe el frontend.
    const estadoFinal = (status === 'BORRADOR') ? 'BORRADOR' : 'COMPLETADO';

    try {
        await runAsync(db, 'BEGIN TRANSACTION;');

        // Usamos la variable segura 'estadoFinal' en el INSERT
        const pedidoResult = await runAsync(db,
            `INSERT INTO PedidosProveedores (numero_factura, proveedor, fecha_pedido, origen_tipo, valor_conversion, status, observaciones) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [pedido.numero_factura, pedido.proveedor, pedido.fecha_pedido, pedido.origen_tipo, pedido.valor_conversion, estadoFinal, pedido.observaciones]
        );
        const pedidoId = pedidoResult.lastID;
        
        // El resto de la lógica para gastos, líneas y stock se mantiene igual...
        for (const gasto of gastos) {
            await runAsync(db, `INSERT INTO GastosPedido (pedido_id, descripcion, coste_eur, tipo_gasto) VALUES (?, ?, ?, ?)`, 
                [pedidoId, gasto.descripcion, parseFloat(gasto.coste_eur) || 0, gasto.tipo_gasto]);
        }
        
        if (estadoFinal !== 'BORRADOR') {
            const valorConversion = parseFloat(pedido.valor_conversion) || 1.0;
            let costeTotalBaseEnEuros = 0;
            lineas.forEach(linea => {
                const precioEnEuros = (pedido.origen_tipo === 'IMPORTACION' ? linea.precio_unitario * valorConversion : linea.precio_unitario);
                costeTotalBaseEnEuros += linea.metros_por_bobina * linea.cantidad_bobinas * precioEnEuros;
            });
            const totalGastosRepercutibles = gastos.reduce((acc, g) => (g.tipo_gasto || '').toUpperCase() !== 'SUJETO' ? acc + g.coste_eur : acc, 0);
            const porcentajeGastos = costeTotalBaseEnEuros > 0 ? totalGastosRepercutibles / costeTotalBaseEnEuros : 0;

            for (const linea of lineas) {
                const itemId = await findOrCreateItem(db, linea.item);
                await runAsync(db, `INSERT INTO LineasPedido (pedido_id, item_id, cantidad_bobinas, metros_por_bobina, precio_unitario, moneda) VALUES (?, ?, ?, ?, ?, ?)`,
                    [pedidoId, itemId, linea.cantidad_bobinas, linea.metros_por_bobina, linea.precio_unitario, linea.moneda]);
                
                const costeUnitarioEnEuros = (pedido.origen_tipo === 'IMPORTACION' ? linea.precio_unitario * valorConversion : linea.precio_unitario);
                const costeFinalConGastos = costeUnitarioEnEuros * (1 + porcentajeGastos);
                
                for (let i = 1; i <= linea.cantidad_bobinas; i++) {
                    const proveedorLimpio = (pedido.proveedor || 'S-P').trim().toUpperCase().replace(/\s+/g, '-');
                    const lote = `${proveedorLimpio}-${linea.referencia_bobina || `IT${itemId}`}-P${pedidoId}-${i}`;

                    await runAsync(db, `INSERT INTO Stock (lote, item_id, cantidad_inicial, cantidad_actual, coste_lote, pedido_id, fecha_entrada) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [lote, itemId, linea.metros_por_bobina, linea.metros_por_bobina, costeFinalConGastos, pedidoId, pedido.fecha_pedido]);
                    
                    await actualizarTarifaSiNecesario(db, itemId, costeFinalConGastos);
                }
            }
        }
        
        await runAsync(db, 'COMMIT;');
        return { pedidoId, mensaje: `Pedido ${pedido.numero_factura} guardado como ${estadoFinal}.` };
    } catch (error) {
        await runAsync(db, 'ROLLBACK;');
        console.error("Error en procesarNuevoPedido:", error);
        throw error;
    } finally {
        db.close();
    }
}

async function generarStockParaPedido(db, pedidoId) {
    const pedido = await getAsync(db, `SELECT * FROM PedidosProveedores WHERE id = ?`, [pedidoId]);
    const lineas = await allAsync(db, `SELECT * FROM LineasPedido WHERE pedido_id = ?`, [pedidoId]);
    const gastos = await allAsync(db, `SELECT * FROM GastosPedido WHERE pedido_id = ?`, [pedidoId]);

    const valorConversion = parseFloat(pedido.valor_conversion) || 1.0;
    let costeTotalBaseEnEuros = 0;
    lineas.forEach(linea => {
        const precioEnEuros = (pedido.origen_tipo === 'IMPORTACION' ? linea.precio_unitario * valorConversion : linea.precio_unitario);
        costeTotalBaseEnEuros += linea.metros_por_bobina * linea.cantidad_bobinas * precioEnEuros;
    });

    const totalGastosRepercutibles = gastos.reduce((acc, g) => (g.tipo_gasto || '').toUpperCase() !== 'SUJETO' ? acc + g.coste_eur : acc, 0);
    const porcentajeGastos = costeTotalBaseEnEuros > 0 ? totalGastosRepercutibles / costeTotalBaseEnEuros : 0;

    for (const linea of lineas) {
        const costeUnitarioEnEuros = (pedido.origen_tipo === 'IMPORTACION' ? linea.precio_unitario * valorConversion : linea.precio_unitario);
        const costeFinalConGastos = costeUnitarioEnEuros * (1 + porcentajeGastos);

        for (let i = 1; i <= linea.cantidad_bobinas; i++) {
            const proveedorLimpio = (pedido.proveedor || 'S-P').trim().toUpperCase().replace(/\s+/g, '-');
            const lote = `${proveedorLimpio}-P${pedidoId}-I${linea.item_id}-${i}`;

            await runAsync(db, `INSERT INTO Stock (lote, item_id, cantidad_inicial, cantidad_actual, coste_lote, pedido_id, fecha_entrada) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [lote, linea.item_id, linea.metros_por_bobina, linea.metros_por_bobina, costeFinalConGastos, pedidoId, pedido.fecha_pedido]);
            
            await actualizarTarifaSiNecesario(db, linea.item_id, costeFinalConGastos);
        }
    }
}


// REEMPLAZA esta función en db_operations.js

async function actualizarTarifaSiNecesario(db, itemId, nuevoCosteCompra) {
    // Leemos los márgenes desde el archivo de configuración
    const configuraciones = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
    const tiposDeTarifa = [
        { key: 'FINAL', margen: configuraciones.margen_default_final },
        { key: 'FABRICANTE', margen: configuraciones.margen_default_fabricante },
        { key: 'INTERMEDIARIO', margen: configuraciones.margen_default_intermediario },
        { key: 'METRAJES', margen: configuraciones.margen_default_metrajes }
    ];

    for (const tarifa of tiposDeTarifa) {
        const tarifaActual = await getAsync(db, `SELECT ultimo_coste_compra FROM Tarifas WHERE item_id = ? AND tipo_tarifa = ?`, [itemId, tarifa.key]);
        
        // Solo actualizamos si el nuevo coste es mayor, o si la tarifa no existe
        if (!tarifaActual || nuevoCosteCompra > tarifaActual.ultimo_coste_compra) {
            const nuevoPrecioVenta = nuevoCosteCompra * (1 + tarifa.margen);
            
            // Usamos INSERT OR REPLACE (UPSERT) para insertar si no existe, o reemplazar si ya existe.
            await runAsync(db, 
                `INSERT OR REPLACE INTO Tarifas (item_id, tipo_tarifa, precio_venta, ultimo_coste_compra, fecha_actualizacion) 
                 VALUES (?, ?, ?, ?, ?)`,
                [itemId, tarifa.key, nuevoPrecioVenta, nuevoCosteCompra, new Date().toISOString()]
            );
            console.log(`Tarifa [${tarifa.key}] para Item ${itemId} actualizada a ${nuevoPrecioVenta.toFixed(2)}€`);
        }
    }
}




// REEMPLAZA la función 'consultarLineasPedidoPorPedidoId' existente
async function consultarLineasPedidoPorPedidoId(dbInstance, pedidoId) {
    // Unimos con la tabla Items para obtener la descripción
    const sql = `
        SELECT 
            lp.cantidad_original, 
            lp.precio_unitario_original, 
            lp.moneda_original,
            i.descripcion
        FROM LineasPedido lp
        JOIN Items i ON lp.item_id = i.id
        WHERE lp.pedido_id = ?
    `;
    return allAsync(dbInstance, sql, [pedidoId]);
}
// En backend-node/db_operations.js

// REEMPLAZA esta función en db_operations.js

async function consultarStockPorPedidoId(dbInstance, pedidoId) {
    // Esta nueva consulta agrupa los items de stock idénticos y los cuenta.
    const sql = `
        SELECT
            i.sku,
            i.descripcion,
            i.unidad_medida,
            s.coste_lote,
            COUNT(s.id) AS numero_bobinas,
            SUM(s.cantidad_actual) AS cantidad_total_agrupada
        FROM Stock s
        JOIN Items i ON s.item_id = i.id
        WHERE s.pedido_id = ?
        GROUP BY i.sku, i.descripcion, i.unidad_medida, s.coste_lote
        ORDER BY i.sku
    `;
    return allAsync(dbInstance, sql, [pedidoId]);
}

// AÑADE esta nueva función en db_operations.js

// REEMPLAZA esta función en db_operations.js
// En db_operations.js, REEMPLAZA la función consultarStockAgrupado

async function consultarStockAgrupado(filtros = {}) {
    const db = conectarDB();
    try {
        let sql = `
            SELECT
                i.id AS item_id,
                i.sku,
                i.descripcion,
                f.nombre AS familia,
                SUM(s.cantidad_actual) AS cantidad_total,
                COUNT(s.id) AS numero_lotes,
                (
                    SELECT GROUP_CONCAT(a.nombre || ': ' || va.valor, '; ')
                    FROM ItemAtributos ia
                    JOIN ValoresAtributos va ON ia.valor_atributo_id = va.id
                    JOIN Atributos a ON va.atributo_id = a.id
                    WHERE ia.item_id = i.id
                ) as atributos
            FROM Stock s
            JOIN Items i ON s.item_id = i.id
            JOIN Familias f ON i.familia_id = f.id
            WHERE s.cantidad_actual > 0 AND i.tipo_item = 'MATERIA_PRIMA'
        `;
        const params = [];

        if (filtros.familia) {
            sql += ` AND f.nombre = ?`;
            params.push(filtros.familia.toUpperCase());
        }

        sql += ` GROUP BY i.id, i.sku, i.descripcion, f.nombre ORDER BY f.nombre, i.descripcion`;
        
        return await allAsync(db, sql, params);
    } finally {
        db.close();
    }
}
// REEMPLAZA esta función en db_operations.js

// En db_operations.js, REEMPLAZA estas dos funciones.
// Si ya existen, bórralas y pega estas en su lugar.

async function consultarListaPedidos(filtros = {}) {
    const db = conectarDB();
    try {
        let sql = `SELECT * FROM PedidosProveedores`;
        const params = [];
        let whereClauses = [];

        if (filtros.status) {
            whereClauses.push(`status = ?`);
            params.push(filtros.status.toUpperCase());
        }

        if (filtros.origen_tipo) {
            whereClauses.push(`origen_tipo = ?`);
            params.push(filtros.origen_tipo.toUpperCase());
        }
        if (filtros.proveedor_like) {
            whereClauses.push(`proveedor LIKE ?`);
            params.push(`%${filtros.proveedor_like}%`);
        }
        
        if (whereClauses.length > 0) {
            sql += ` WHERE ${whereClauses.join(' AND ')}`;
        }
        sql += ` ORDER BY fecha_pedido DESC, id DESC`;
        return await allAsync(db, sql, params);
    } finally {
        db.close();
    }
}

async function obtenerDetallesCompletosPedido(pedidoId) {
    const db = conectarDB();
    try {
        const pedidoInfo = await getAsync(db, `SELECT * FROM PedidosProveedores WHERE id = ?`, [pedidoId]);
        if (!pedidoInfo) return null;

        const gastos = await allAsync(db, `SELECT * FROM GastosPedido WHERE pedido_id = ?`, [pedidoId]);
        
        const lineasConDetalles = await allAsync(db, `
            SELECT
                lp.cantidad_bobinas,
                lp.metros_por_bobina,
                lp.precio_unitario,
                lp.moneda,
                i.descripcion,
                f.nombre as familia,
                (
                    SELECT GROUP_CONCAT(va.valor, '; ')
                    FROM ItemAtributos ia
                    JOIN ValoresAtributos va ON ia.valor_atributo_id = va.id
                    JOIN Atributos a ON va.atributo_id = a.id
                    WHERE ia.item_id = lp.item_id
                ) as atributos
            FROM LineasPedido lp
            JOIN Items i ON lp.item_id = i.id
            JOIN Familias f ON i.familia_id = f.id
            WHERE lp.pedido_id = ?
        `, [pedidoId]);

        // Lógica de cálculo de costes
        const valorConversion = parseFloat(pedidoInfo.valor_conversion) || 1.0;
        let costeTotalBaseEnEuros = 0;
        lineasConDetalles.forEach(linea => {
            const precioEnEuros = (pedidoInfo.origen_tipo === 'IMPORTACION' ? linea.precio_unitario * valorConversion : linea.precio_unitario);
            costeTotalBaseEnEuros += linea.metros_por_bobina * linea.cantidad_bobinas * precioEnEuros;
        });
        const totalGastosRepercutibles = gastos.reduce((acc, g) => (g.tipo_gasto || '').toUpperCase() !== 'SUJETO' ? acc + g.coste_eur : acc, 0);
        const porcentajeGastos = costeTotalBaseEnEuros > 0 ? totalGastosRepercutibles / costeTotalBaseEnEuros : 0;

        lineasConDetalles.forEach(linea => {
            const precioEnEuros = (pedidoInfo.origen_tipo === 'IMPORTACION' ? linea.precio_unitario * valorConversion : linea.precio_unitario);
            linea.precio_sin_gastos = precioEnEuros;
            linea.precio_con_gastos = precioEnEuros * (1 + porcentajeGastos);
        });

        return {
            pedidoInfo,
            gastos,
            lineasDetalladas: lineasConDetalles,
            porcentajeGastos
        };

    } catch (error) {
        console.error(`Error obteniendo detalles completos del pedido ${pedidoId}:`, error.message);
        throw error;
    } finally {
        if (db) db.close();
    }
}
// AÑADE estas dos nuevas funciones en db_operations.js

/**
 * Busca en el stock los lotes de materia prima que son compatibles con un producto base.
 * La compatibilidad se basa en la familia del material.
 * @param {number} productoBaseId - El ID del Item (producto base) que se quiere fabricar.
 * @returns {Promise<Array>} Una lista de lotes de stock compatibles.
 */
async function consultarStockCompatible(productoBaseId) {
    const db = conectarDB();
    try {
        // 1. Obtenemos la familia del producto base que queremos fabricar.
        const productoBase = await getAsync(db, `SELECT familia_id FROM Items WHERE id = ?`, [productoBaseId]);
        if (!productoBase) throw new Error("Producto base no encontrado.");

        // 2. Buscamos todos los lotes en stock que pertenezcan a esa misma familia y tengan stock.
        const sql = `
            SELECT
                s.id,
                s.lote,
                s.cantidad_actual,
                s.coste_lote,
                i.descripcion,
                (
                    SELECT GROUP_CONCAT(a.nombre || ': ' || va.valor, '; ')
                    FROM ItemAtributos ia
                    JOIN ValoresAtributos va ON ia.valor_atributo_id = va.id
                    JOIN Atributos a ON va.atributo_id = a.id
                    WHERE ia.item_id = s.item_id
                ) as atributos
            FROM Stock s
            JOIN Items i ON s.item_id = i.id
            WHERE i.familia_id = ? AND s.cantidad_actual > 0 AND i.tipo_item = 'MATERIA_PRIMA'
            ORDER BY s.fecha_entrada;
        `;
        return await allAsync(db, sql, [productoBase.familia_id]);
    } finally {
        db.close();
    }
}


/**
 * Crea una nueva orden de producción, calcula costes y descuenta el material del stock.
 * @param {object} ordenData - Los datos de la orden enviados desde el frontend.
 * @returns {Promise<object>} El resultado de la operación.
 */
async function crearOrdenProduccion(ordenData) {
    const { producto_base_id, lote_materia_prima_id, ancho_producido, largo_producido, cantidad_producida, observaciones } = ordenData;
    const db = conectarDB();
    try {
        await runAsync(db, 'BEGIN TRANSACTION;');

        // 1. Obtener datos de la bobina de materia prima que vamos a usar.
        const loteMateriaPrima = await getAsync(db, `SELECT * FROM Stock WHERE id = ?`, [lote_materia_prima_id]);
        if (!loteMateriaPrima) throw new Error("El lote de materia prima seleccionado no existe.");

        const itemMateriaPrima = await getAsync(db, `SELECT * FROM ItemAtributos ia JOIN ValoresAtributos va ON ia.valor_atributo_id = va.id JOIN Atributos a ON va.atributo_id = a.id WHERE ia.item_id = ? AND a.nombre = 'Ancho'`, [loteMateriaPrima.item_id]);
        const anchoBobinaMM = itemMateriaPrima ? parseInt(itemMateriaPrima.valor, 10) : 0;
        if (anchoBobinaMM === 0) throw new Error("No se pudo determinar el ancho de la bobina de materia prima.");

        // 2. Calcular el consumo de material.
        const anchoBobinaMetros = anchoBobinaMM / 1000;
        const metrosCuadradosPorPieza = (ancho_producido / 1000) * (largo_producido / 1000);
        const metrosLinealesConsumidosPorPieza = metrosCuadradosPorPieza / anchoBobinaMetros;
        const totalMetrosLinealesAConsumir = metrosLinealesConsumidosPorPieza * cantidad_producida;

        if (loteMateriaPrima.cantidad_actual < totalMetrosLinealesAConsumir) {
            throw new Error(`Stock insuficiente en el lote ${loteMateriaPrima.lote}. Necesario: ${totalMetrosLinealesAConsumir.toFixed(2)}m, Disponible: ${loteMateriaPrima.cantidad_actual.toFixed(2)}m.`);
        }

        // 3. Calcular el coste de la producción.
        const costeMaterial = totalMetrosLinealesAConsumir * loteMateriaPrima.coste_lote;
        // Aquí se añadiría el coste de procesos si fuera necesario. Por ahora, es solo el material.
        const costeTotalProduccion = costeMaterial;
        
        // 4. Actualizar (descontar) el stock de la materia prima.
        const nuevaCantidad = loteMateriaPrima.cantidad_actual - totalMetrosLinealesAConsumir;
        await runAsync(db, `UPDATE Stock SET cantidad_actual = ? WHERE id = ?`, [nuevaCantidad, lote_materia_prima_id]);

        // 5. Insertar el registro de la nueva orden de producción.
        const result = await runAsync(db,
            `INSERT INTO OrdenesProduccion (producto_base_id, lote_materia_prima_id, ancho_producido, largo_producido, cantidad_producida, coste_total_produccion, fecha_creacion, observaciones) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [producto_base_id, lote_materia_prima_id, ancho_producido, largo_producido, cantidad_producida, costeTotalProduccion, new Date().toISOString(), observaciones]
        );

        await runAsync(db, 'COMMIT;');
        return { id: result.lastID, mensaje: `Orden de producción #${result.lastID} creada con éxito.` };

    } catch (error) {
        await runAsync(db, 'ROLLBACK;');
        console.error("Error creando orden de producción:", error);
        throw error;
    } finally {
        db.close();
    }
}


// REEMPLAZA la función consultarTarifas en db_operations.js

async function consultarTarifas() {
    const db = conectarDB();
    try {
        // 1. Leemos los márgenes de configuración
        const configuraciones = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'config.json'), 'utf8'));
        const margenes = {
            FINAL: configuraciones.margen_default_final || 0,
            FABRICANTE: configuraciones.margen_default_fabricante || 0,
            INTERMEDIARIO: configuraciones.margen_default_intermediario || 0,
            METRAJES: configuraciones.margen_default_metrajes || 0,
        };

        // 2. Obtenemos todos los items de materia prima con su último coste de stock
        const itemsConCoste = await allAsync(db, `
            SELECT
                i.id,
                i.sku,
                i.descripcion,
                (SELECT coste_lote FROM Stock WHERE item_id = i.id ORDER BY fecha_entrada DESC, id DESC LIMIT 1) as ultimo_coste_compra,
                (
                    SELECT GROUP_CONCAT(a.nombre || ': ' || va.valor, '; ')
                    FROM ItemAtributos ia
                    JOIN ValoresAtributos va ON ia.valor_atributo_id = va.id
                    JOIN Atributos a ON va.atributo_id = a.id
                    WHERE ia.item_id = i.id
                ) as atributos
            FROM Items i
            WHERE i.tipo_item = 'MATERIA_PRIMA' AND EXISTS (SELECT 1 FROM Stock s WHERE s.item_id = i.id);
        `);

        // 3. Calculamos todos los precios para cada item
        const tarifasCompletas = itemsConCoste.map(item => {
            const coste = item.ultimo_coste_compra || 0;
            return {
                id: item.id,
                sku: item.sku,
                descripcion: item.descripcion,
                atributos: item.atributos,
                precio_final: coste * (1 + margenes.FINAL),
                precio_fabricante: coste * (1 + margenes.FABRICANTE),
                precio_intermediario: coste * (1 + margenes.INTERMEDIARIO),
                precio_metrajes: coste * (1 + margenes.METRAJES),
            };
        });

        return tarifasCompletas;

    } finally {
        db.close();
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

// REEMPLAZA esta función en db_operations.js
async function eliminarPedidoCompleto(pedidoId) {
    const db = conectarDB(); // Conexión para la transacción
    try {
        await runAsync(db, 'BEGIN TRANSACTION;');

        // CORREGIDO: Ahora apunta a la tabla unificada 'Stock'
        const stockChanges = await runAsync(db, 'DELETE FROM Stock WHERE pedido_id = ?', [pedidoId]);
        console.log(`Stock eliminado para pedido ID ${pedidoId}: ${stockChanges.changes} filas`);

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
        // Lanza el error para que el endpoint lo capture y lo envíe al frontend
        throw error;
    } finally {
        db.close(); // Cerrar la conexión al finalizar la transacción
    }
}


// --- Lógica de Artículos (Productos Terminados) ---
async function insertarProductoTerminado(datosItem) {
    const db = conectarDB();
    try {
        await runAsync(db, 'BEGIN TRANSACTION;');
        const itemId = await findOrCreateItem(db, { ...datosItem, tipo_item: 'PRODUCTO_TERMINADO' });
        await runAsync(db, 'COMMIT;');
        return itemId;
    } catch (error) {
        await runAsync(db, 'ROLLBACK;');
        throw error;
    } finally {
        db.close();
    }
}


async function consultarProductosTerminados() {
    const db = conectarDB();
    try {
        const sql = `
            SELECT i.id, i.sku, i.descripcion, f.nombre as familia,
                   (SELECT GROUP_CONCAT(a.nombre || ': ' || va.valor, '; ') FROM ItemAtributos ia JOIN ValoresAtributos va ON ia.valor_atributo_id = va.id JOIN Atributos a ON va.atributo_id = a.id WHERE ia.item_id = i.id) as atributos
            FROM Items i
            JOIN Familias f ON i.familia_id = f.id
            WHERE i.tipo_item = 'PRODUCTO_TERMINADO'
            GROUP BY i.id ORDER BY i.sku;
        `;
        return await allAsync(db, sql);
    } finally {
        db.close();
    }
}

/**
 * Elimina un producto terminado (Item).
 */
async function eliminarProductoTerminado(id) {
    const db = conectarDB();
    try {
        const result = await runAsync(db, `DELETE FROM Items WHERE id = ? AND tipo_item = 'PRODUCTO_TERMINADO'`, [id]);
        if (result.changes === 0) throw new Error('Producto terminado no encontrado.');
        return result.changes;
    } catch (error) {
        console.error("Error eliminando producto terminado:", error);
        throw error;
    } finally {
        db.close();
    }
}

// No olvides añadir/actualizar estas funciones en tu module.exports
// module.exports = {
//     ...,
//     insertarProductoTerminado,
//     consultarProductosTerminados,
//     eliminarProductoTerminado,
//     ...
// }



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


// AÑADE esta nueva función en db_operations.js

async function consultarStockParaTarifa() {
    const sql = `
        SELECT
            i.familia,
            i.espesor,
            i.ancho,
            AVG(s.coste_lote) AS coste_promedio
        FROM Stock s
        JOIN Items i ON s.item_id = i.id
        WHERE i.tipo_item = 'MATERIA_PRIMA' 
          AND s.cantidad_actual > 0
        GROUP BY i.familia, i.espesor, i.ancho
        ORDER BY i.familia, i.espesor, i.ancho;
    `;
    return await allDB(sql);
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
// En db_operations.js
// REEMPLAZA la función 'procesarOrdenProduccion' entera
async function procesarOrdenProduccion(ordenProduccionId, stockAssignments, configuraciones) {
    const db = conectarDB();
    try {
        await runAsync(db, 'BEGIN TRANSACTION;');

        const orden = await getAsync(db, `SELECT * FROM OrdenesProduccion WHERE id = ?`, [ordenProduccionId]);
        if (!orden || orden.status !== 'PENDIENTE') {
            throw new Error(`Orden ID ${ordenProduccionId} no encontrada o no está en estado PENDIENTE.`);
        }

        const productoTerminado = await getAsync(db, `SELECT * FROM Items WHERE id = ?`, [orden.item_id]);
        if (!productoTerminado) throw new Error(`Producto terminado ID ${orden.item_id} no encontrado.`);

        let costeTotalMaterialesReal = 0;

        for (const assignment of stockAssignments) {
            const recetaItem = await getAsync(db, `SELECT * FROM Recetas WHERE id = ?`, [assignment.recetaId]);
            if (!recetaItem) throw new Error(`Item de receta con ID ${assignment.recetaId} no encontrado.`);

            const stockItem = await getAsync(db, `SELECT * FROM Stock WHERE id = ?`, [assignment.stockId]);
            if (!stockItem) throw new Error(`Lote de stock con ID ${assignment.stockId} no encontrado.`);
            
            const cantidadNecesaria = (recetaItem.cantidad_requerida || 0) * (orden.cantidad_a_producir || 0);

            if (stockItem.cantidad_actual < cantidadNecesaria) {
                throw new Error(`Stock insuficiente para el lote ${stockItem.lote}. Necesario: ${cantidadNecesaria}, Disponible: ${stockItem.cantidad_actual}.`);
            }

            // Descontar stock
            const nuevaCantidad = stockItem.cantidad_actual - cantidadNecesaria;
            const nuevoStatus = nuevaCantidad > 0 ? 'EMPEZADA' : 'AGOTADO';
            await runAsync(db, `UPDATE Stock SET cantidad_actual = ?, status = ? WHERE id = ?`, [nuevaCantidad, nuevoStatus, stockItem.id]);
            
            // Acumular coste real
            costeTotalMaterialesReal += cantidadNecesaria * (stockItem.coste_lote || 0);
        }

        // Calcular coste de procesos (esta lógica no cambia)
        const costeProcesos = await calcularCosteProcesos(db, orden.item_id, configuraciones);
        const costeTotalProcesos = costeProcesos * orden.cantidad_a_producir;
        
        const costeFabricacionReal = costeTotalMaterialesReal + costeTotalProcesos;
        const costeUnitarioFinal = orden.cantidad_a_producir > 0 ? costeFabricacionReal / orden.cantidad_a_producir : 0;
        
        // Añadir producto terminado al stock
        const lotePT = `PROD-OP${ordenProduccionId}`;
        await runAsync(db, `
            INSERT INTO Stock (item_id, lote, cantidad_inicial, cantidad_actual, coste_lote, orden_produccion_id, fecha_entrada, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [orden.item_id, lotePT, orden.cantidad_a_producir, orden.cantidad_a_producir, costeUnitarioFinal, orden.id, new Date().toISOString().split('T')[0], 'DISPONIBLE']
        );

        // Actualizar la orden
        await runAsync(db, `UPDATE OrdenesProduccion SET status = 'COMPLETADA', coste_real_fabricacion = ? WHERE id = ?`, [costeFabricacionReal, orden.id]);

        await runAsync(db, 'COMMIT;');
        return {
            mensaje: `Orden ID ${ordenProduccionId} completada. ${orden.cantidad_a_producir} uds. de '${productoTerminado.descripcion}' añadidas al stock.`,
            costeFabricacionReal,
        };
    } catch (error) {
        console.error(`Error en transacción procesarOrdenProduccion para ID ${ordenProduccionId}:`, error);
        await runAsync(db, 'ROLLBACK;');
        throw error;
    } finally {
        db.close();
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


async function findOrCreateAtributo(db, nombre) {
    let row = await getAsync(db, `SELECT id FROM Atributos WHERE nombre = ?`, [nombre]);
    if (row) return row.id;
    const result = await runAsync(db, `INSERT INTO Atributos (nombre) VALUES (?)`, [nombre]);
    return result.lastID;
}

async function findOrCreateValorAtributo(db, atributo_id, valor) {
    let row = await getAsync(db, `SELECT id FROM ValoresAtributos WHERE atributo_id = ? AND valor = ?`, [atributo_id, valor]);
    if (row) return row.id;
    const result = await runAsync(db, `INSERT INTO ValoresAtributos (atributo_id, valor) VALUES (?, ?)`, [atributo_id, valor]);
    return result.lastID;
}

async function crearItem(db, datosItem) {
    const { sku, descripcion, familia, tipo_item, atributos } = datosItem;
    
    const familiaRow = await getAsync(db, `SELECT id FROM Familias WHERE nombre = ?`, [familia]);
    if (!familiaRow) throw new Error(`Familia '${familia}' no encontrada.`);

    const result = await runAsync(db, 
        `INSERT INTO Items (sku, descripcion, familia_id, tipo_item) VALUES (?, ?, ?, ?)`,
        [sku, descripcion, familiaRow.id, tipo_item]
    );
    const itemId = result.lastID;

    for (const attr of atributos) {
        const atributoId = await findOrCreateAtributo(db, attr.nombre);
        const valorId = await findOrCreateValorAtributo(db, atributoId, attr.valor);
        await runAsync(db, `INSERT INTO ItemAtributos (item_id, valor_atributo_id) VALUES (?, ?)`, [itemId, valorId]);
    }

    return itemId;
}


// AÑADIR esta nueva función en db_operations.js
async function consultarFamiliasYEspesores() {
    // Consultamos los items de materia prima que tienen al menos un lote en stock
    const sql = `
        SELECT DISTINCT
            i.familia,
            i.espesor
        FROM Items i
        WHERE i.tipo_item = 'MATERIA_PRIMA'
          AND EXISTS (SELECT 1 FROM Stock s WHERE s.item_id = i.id)
        ORDER BY i.familia, i.espesor;
    `;
    const rows = await allDB(sql);

    // Procesamos el resultado para agrupar espesores por familia
    const familias = rows.reduce((acc, row) => {
        if (!row.familia || !row.espesor) return acc; // Ignorar si no tienen datos
        if (!acc[row.familia]) {
            acc[row.familia] = [];
        }
        if (!acc[row.familia].includes(row.espesor)) {
            acc[row.familia].push(row.espesor);
        }
        return acc;
    }, {});

    return familias;
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


// AÑADE esta nueva función en db_operations.js
async function consultarProveedoresUnicos() {
    const sql = `SELECT DISTINCT proveedor FROM PedidosProveedores WHERE proveedor IS NOT NULL AND proveedor != '' ORDER BY proveedor ASC`;
    return await allDB(sql);
}


// AÑADE esta nueva función en db_operations.js
// AÑADE esta nueva función en db_operations.js (y elimina finalizarPedidoBorrador)

async function actualizarYFinalizarPedido(pedidoId, datosNuevos) {
    const { gastos } = datosNuevos;
    const db = conectarDB();
    try {
        await runAsync(db, 'BEGIN TRANSACTION;');

        // 1. Borramos los gastos viejos para reemplazarlos por los nuevos
        await runAsync(db, `DELETE FROM GastosPedido WHERE pedido_id = ?`, [pedidoId]);

        // 2. Insertamos los gastos actualizados que vienen del formulario
        for (const gasto of gastos) {
            await runAsync(db, `INSERT INTO GastosPedido (pedido_id, tipo_gasto, descripcion, coste_eur) VALUES (?, ?, ?, ?)`,
                [pedidoId, gasto.tipo_gasto, gasto.descripcion, gasto.coste_eur]);
        }
        
        // 3. Obtenemos toda la información necesaria para procesar el stock
        const pedido = await getAsync(db, `SELECT * FROM PedidosProveedores WHERE id = ?`, [pedidoId]);
        if (!pedido) throw new Error(`Pedido con ID ${pedidoId} no encontrado.`);

        const lineas = await allAsync(db, `SELECT lp.*, i.referencia_bobina FROM LineasPedido lp JOIN Items i ON lp.item_id = i.id WHERE lp.pedido_id = ?`, [pedidoId]);
        const item = await getAsync(db, `SELECT i.familia FROM Items i JOIN LineasPedido lp ON i.id = lp.item_id WHERE lp.pedido_id = ? LIMIT 1`, [pedidoId]);
        const material_tipo_general = item.familia;
        
        // 4. Re-calculamos costes con los nuevos gastos y generamos el stock (misma lógica que antes)
        // (Esta sección es idéntica a la que teníamos en finalizarPedidoBorrador)
        const valorConversion = parseFloat(pedido.valor_conversion) || 1.0;
        let costeTotalPedidoSinGastosEnEuros = 0;
        lineas.forEach(linea => {
            costeTotalPedidoSinGastosEnEuros += (parseFloat(linea.cantidad_original) * parseFloat(linea.precio_unitario_original) * valorConversion);
        });
        const totalGastosRepercutibles = gastos.reduce((acc, g) => acc + (parseFloat(g.coste_eur) || 0), 0);
        const porcentajeGastos = costeTotalPedidoSinGastosEnEuros > 0 ? totalGastosRepercutibles / costeTotalPedidoSinGastosEnEuros : 0;
        
        for (const linea of lineas) {
             const costeUnitarioEnEuros = (parseFloat(linea.precio_unitario_original) || 0) * valorConversion;
             const costeFinalConGastos = costeUnitarioEnEuros * (1 + porcentajeGastos);
             const proveedorLimpio = (pedido.proveedor || 'SIN-PROV').trim().toUpperCase().replace(/\s+/g, '-');
             const lote = `${proveedorLimpio}-${(linea.referencia_bobina || 'SIN-REF').trim()}-P${pedidoId}-I${linea.item_id}`;

             await runAsync(db, `INSERT INTO Stock (item_id, lote, cantidad_inicial, cantidad_actual, coste_lote, pedido_id, fecha_entrada) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [linea.item_id, lote, linea.cantidad_original, linea.cantidad_original, costeFinalConGastos, pedidoId, pedido.fecha_pedido]);
        }
        
        // 5. Actualizamos el estado del pedido a COMPLETADO
        await runAsync(db, `UPDATE PedidosProveedores SET status = 'COMPLETADO' WHERE id = ?`, [pedidoId]);

        await runAsync(db, 'COMMIT;');
        return { success: true };
    } catch (error) {
        await runAsync(db, 'ROLLBACK;');
        throw error;
    } finally {
        db.close();
    }
}

// --- EXPORTACIONES ---
module.exports = {
    consultarStock,
    consultarStockPorPedidoId,
    consultarListaPedidos,
    obtenerDetallesCompletosPedido,
    actualizarEstadoStockItem,
    eliminarPedidoCompleto,
    actualizarYFinalizarPedido,

    consultarFamiliasYEspesores,

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
    actualizarYFinalizarPedido,

    actualizarCosteFabricacionEstandar,

    consultarReferenciasStockConUltimoCoste,
    obtenerMaterialesGenericos,
    calcularPresupuestoProductoTerminado,
    calcularCosteMaterialEspecifico, // Asegúrate de exportar esta nueva función de cálculo

    obtenerConfiguracion,
    actualizarConfiguracion,

    calcularCosteProcesos,
    obtenerUltimoCosteMaterialGenerico,
    consultarStockAgrupado,
    consultarStockParaTarifa,
    insertarPedidoProveedor,

    consultarStockCompatible,
    crearOrdenProduccion,

    findOrCreateItem,
    procesarNuevoPedido,
    

    crearItem,
    procesarNuevoPedido,
    consultarTarifas,

        
    consultarProveedoresUnicos,
    consultarFamilias,

    consultarItems,

    conectarDB,
    runAsync,
    getAsync,
    allAsync
};
