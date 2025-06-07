// backend-node/seed_database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'almacen', 'almacen.db');

function conectarDB() {
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err.message);
            throw err;
        }
    });
    db.exec('PRAGMA foreign_keys = ON;', (err) => {
        if (err) console.error("Error al habilitar foreign keys:", err.message);
    });
    return db;
}

function runAsync(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                console.error('Error SQL:', sql, params, err.message);
                reject(err);
            } else {
                resolve({ lastID: this.lastID, changes: this.changes });
            }
        });
    });
}

async function main() {
    const db = conectarDB();
    console.log("Conectado a la base de datos para poblar con nueva estructura.");

    try {
        await runAsync(db, 'BEGIN TRANSACTION;');

        // 1. LIMPIAR TODAS LAS TABLAS EN EL ORDEN CORRECTO
        console.log("Limpiando tablas antiguas...");
        await runAsync(db, `DELETE FROM Stock;`);
        await runAsync(db, `DELETE FROM Recetas;`);
        await runAsync(db, `DELETE FROM GastosPedido;`);
        await runAsync(db, `DELETE FROM LineasPedido;`);
        await runAsync(db, `DELETE FROM OrdenesProduccion;`);
        await runAsync(db, `DELETE FROM ProcesosFabricacion;`);
        await runAsync(db, `DELETE FROM Items;`);
        await runAsync(db, `DELETE FROM PedidosProveedores;`);
        await runAsync(db, `DELETE FROM Maquinaria;`);
        
        console.log("Poblando tablas maestras...");

        // 2. POBLAR TABLA MAESTRA DE ITEMS
        /**const items = [
            // Materias Primas - Goma
            { sku: 'GOM-EPDM-6-1000', desc: 'Goma EPDM 6mm Ancho 1000mm', tipo: 'MATERIA_PRIMA', fam: 'GOMA', esp: '6mm', ancho: 1000, um: 'm' },
            { sku: 'GOM-EPDM-8-1000', desc: 'Goma EPDM 8mm Ancho 1000mm', tipo: 'MATERIA_PRIMA', fam: 'GOMA', esp: '8mm', ancho: 1000, um: 'm' },
            { sku: 'GOM-EPDM-10-1000', desc: 'Goma EPDM 10mm Ancho 1000mm', tipo: 'MATERIA_PRIMA', fam: 'GOMA', esp: '10mm', ancho: 1000, um: 'm' },
            // Materias Primas - Fieltro
            { sku: 'FIE-ADH-F15-1200', desc: 'Fieltro Adhesivo F15 Ancho 1200mm', tipo: 'MATERIA_PRIMA', fam: 'FIELTRO', esp: 'F15', ancho: 1200, um: 'm' },
            { sku: 'FIE-ADH-F10-1800', desc: 'Fieltro Adhesivo F10 Ancho 1800mm', tipo: 'MATERIA_PRIMA', fam: 'FIELTRO', esp: 'F10', ancho: 1800, um: 'm' },
            // Productos Terminados
            { sku: 'PT-FALD-STD', desc: 'Faldeta Estándar de Goma 6mm', tipo: 'PRODUCTO_TERMINADO', fam: 'FALDETA', esp: '6mm', ancho: 500, um: 'unidad' }
        ];

        const itemIds = {};
        for (const item of items) {
            const res = await runAsync(db, `INSERT INTO Items (sku, descripcion, tipo_item, familia, espesor, ancho, unidad_medida) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [item.sku, item.desc, item.tipo, item.fam, item.esp, item.ancho, item.um]);
            itemIds[item.sku] = res.lastID;
        }
        console.log(`${items.length} artículos insertados en la tabla Items.`);

        // 3. POBLAR PEDIDOS Y STOCK
        console.log("Poblando pedidos y stock...");
        const pedido = await runAsync(db, `INSERT INTO PedidosProveedores (numero_factura, proveedor, fecha_pedido, fecha_llegada, origen_tipo) VALUES (?, ?, ?, ?, ?)`,
            ['PED-2025-001', 'Proveedor General', '2025-06-01', '2025-06-05', 'NACIONAL']);
            
        const stockLotes = [
            { sku: 'GOM-EPDM-6-1000', lote: 'LOTE-001', cant: 150, coste: 12.50 },
            { sku: 'GOM-EPDM-8-1000', lote: 'LOTE-002', cant: 180, coste: 16.00 },
            { sku: 'FIE-ADH-F15-1200', lote: 'LOTE-003', cant: 50, coste: 16.50 },
            { sku: 'FIE-ADH-F10-1800', lote: 'LOTE-004', cant: 75, coste: 19.80 },
        ];

        for (const lote of stockLotes) {
            await runAsync(db, `INSERT INTO Stock (item_id, lote, cantidad_inicial, cantidad_actual, coste_lote, ubicacion, pedido_id, fecha_entrada) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [itemIds[lote.sku], lote.lote, lote.cant, lote.cant, lote.coste, 'Pasillo A', pedido.lastID, '2025-06-05']);
        }
        console.log(`${stockLotes.length} lotes de stock insertados.`);

        // 4. POBLAR RECETAS
        console.log("Poblando recetas...");
        await runAsync(db, `INSERT INTO Recetas (producto_id, material_id, cantidad_requerida) VALUES (?, ?, ?)`,
            [itemIds['PT-FALD-STD'], itemIds['GOM-EPDM-6-1000'], 0.5]); // 0.5 metros de goma para 1 faldeta
        console.log("Recetas de ejemplo insertadas.");

        await runAsync(db, 'COMMIT;');
        console.log("Base de datos poblada con la nueva estructura exitosamente.");**/

        // En backend-node/seed_database.js, dentro de la función seedDatabase

// --- INICIO: Bloque para añadir contenedor de Caramelo ---

        // 1. Crear el nuevo Item de tipo "Caramelo" si no existe
        console.log("Creando item de Caramelo...");
        const carameloItem = { sku: 'CARAM-PVC-3-1200', desc: 'PVC Color Caramelo 3mm Ancho 1200mm', tipo: 'MATERIA_PRIMA', fam: 'CARAMELO', esp: '3mm', ancho: 1200, um: 'm' };
        const resCaramelo = await runAsync(db, `INSERT OR IGNORE INTO Items (sku, descripcion, tipo_item, familia, espesor, ancho, unidad_medida) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [carameloItem.sku, carameloItem.desc, carameloItem.tipo, carameloItem.fam, carameloItem.esp, carameloItem.ancho, carameloItem.um]);
        const carameloItemId = resCaramelo.lastID || (await getDB(db, `SELECT id FROM Items WHERE sku = ?`, [carameloItem.sku])).id;


        // 2. Crear el Pedido de tipo CONTENEDOR y sus gastos asociados
        console.log("Creando contenedor de importación...");
        const pedidoContenedor = await runAsync(db, `INSERT INTO PedidosProveedores (numero_factura, proveedor, fecha_pedido, fecha_llegada, origen_tipo, valor_conversion) VALUES (?, ?, ?, ?, ?, ?)`,
            ['CONT-2025-001', 'Caramelo Corp', '2025-05-20', '2025-06-25', 'CONTENEDOR', 1.08]);

        await runAsync(db, `INSERT INTO GastosPedido (pedido_id, tipo_gasto, descripcion, coste_eur) VALUES (?, ?, ?, ?)`,
            [pedidoContenedor.lastID, 'SUPLIDOS', 'Transporte Marítimo', 1200.00]);
        await runAsync(db, `INSERT INTO GastosPedido (pedido_id, tipo_gasto, descripcion, coste_eur) VALUES (?, ?, ?, ?)`,
            [pedidoContenedor.lastID, 'SUJETO', 'Aranceles de importación', 450.00]);


        // 3. Crear el lote de Stock para el material Caramelo, asociado al contenedor
        console.log("Poblando stock del contenedor...");
        await runAsync(db, `INSERT INTO Stock (item_id, lote, cantidad_inicial, cantidad_actual, coste_lote, ubicacion, pedido_id, fecha_entrada) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [carameloItemId, 'LOTE-CARAM-001', 500, 500, 8.75, 'Pasillo B', pedidoContenedor.lastID, '2025-06-25']);

// --- FIN: Bloque para añadir contenedor de Caramelo ---

    } catch (error) {
        console.error("Error poblando la base de datos, revirtiendo cambios.", error);
        await runAsync(db, 'ROLLBACK;');
    } finally {
        db.close((err) => {
            if (err) console.error("Error al cerrar la base de datos.", err.message);
            else console.log("Conexión a la base de datos cerrada.");
        });
    }
}

main();