const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'almacen', 'almacen.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        return console.error("Error al conectar a la base de datos para seeder:", err.message);
    }
    console.log("Conectado a la base de datos SQLite para seeder.");
});

// Helper para db.run con promesas
function runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) { // No usar arrow function para this.lastID
            if (err) {
                console.error('Error ejecutando SQL:', sql, params);
                return reject(err);
            }
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

async function seedConfiguracion() {
    console.log("Sembrando datos de configuración (márgenes)...");
    // Usamos INSERT OR IGNORE para evitar errores si las claves ya existen.
    // Si quieres que se actualicen, podrías usar INSERT OR REPLACE o hacer un DELETE previo.
    // Dentro de seedConfiguracion() en seed_database.js
    await runAsync(`INSERT OR IGNORE INTO Configuracion (clave, valor) VALUES (?, ?)`, ['margen_default_final', '0.50']); // Ejemplo 50%
    await runAsync(`INSERT OR IGNORE INTO Configuracion (clave, valor) VALUES (?, ?)`, ['margen_default_fabricante', '0.30']); // Ejemplo 30%
    await runAsync(`INSERT OR IGNORE INTO Configuracion (clave, valor) VALUES (?, ?)`, ['margen_default_metrajes', '0.60']); // Ejemplo 60%
// Elimina o comenta las otras claves de margen más específicas si ya no las vas a usar por ahora.
    console.log("Datos de configuración (márgenes) sembrados/verificados.");
}

async function seedData() {
    try {
        console.log("Iniciando siembra de datos...");
        await runAsync('BEGIN TRANSACTION;');

        // --- Pedido 1: Nacional PVC ---
        let result = await runAsync(
            `INSERT INTO PedidosProveedores (numero_factura, proveedor, fecha_pedido, fecha_llegada, origen_tipo, observaciones)
             VALUES (?, ?, ?, ?, ?, ?)`,
            ['FAC-N-001', 'PVC Nacional S.L.', '2025-05-01', '2025-05-05', 'NACIONAL', 'Pedido de planchas PVC']
        );
        const pedido1Id = result.lastID;
        console.log(`Pedido 1 (ID: ${pedido1Id}) creado.`);

        await runAsync(
            `INSERT INTO GastosPedido (pedido_id, tipo_gasto, descripcion, coste_eur) VALUES (?, ?, ?, ?)`,
            [pedido1Id, 'NACIONAL', 'Transporte local', 50.00]
        );
        console.log(`Gasto para Pedido 1 creado.`);

        // Líneas de Pedido Originales para Pedido 1
        await runAsync(
            `INSERT INTO LineasPedido (pedido_id, descripcion_original, cantidad_original, unidad_original, precio_unitario_original, moneda_original)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [pedido1Id, 'Plancha PVC Blanca 0.5mm', 100, 'm2', 2.50, 'EUR']
        );
        await runAsync(
            `INSERT INTO LineasPedido (pedido_id, descripcion_original, cantidad_original, unidad_original, precio_unitario_original, moneda_original)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [pedido1Id, 'Rollo PVC Flexible Transp. 1mm', 50, 'm', 3.50, 'EUR']
        );
        console.log(`LineasPedido para Pedido 1 creadas.`);

        // Stock para Pedido 1 (bobinas/items individuales)
        await runAsync(
            `INSERT INTO StockMateriasPrimas (pedido_id, material_tipo, subtipo_material, referencia_stock, fecha_entrada_almacen, status, espesor, ancho, largo_inicial, largo_actual, unidad_medida, coste_unitario_final, color, ubicacion, origen_factura)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [pedido1Id, 'PVC', 'Rígido', 'PVC-R-0.5-BL', '2025-05-05', 'DISPONIBLE', '0.5mm', 1000, 100, 100, 'm2', 2.75, 'Blanco', 'Estante A1', 'FAC-N-001']
        );
        await runAsync(
            `INSERT INTO StockMateriasPrimas (pedido_id, material_tipo, subtipo_material, referencia_stock, fecha_entrada_almacen, status, espesor, ancho, largo_inicial, largo_actual, unidad_medida, coste_unitario_final, color, ubicacion, origen_factura)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [pedido1Id, 'PVC', 'Flexible', 'PVC-F-1.0-TR', '2025-05-05', 'EMPEZADA', '1.0mm', 1200, 50, 30, 'm', 3.80, 'Transparente', 'Estante A2', 'FAC-N-001']
        );
        console.log(`StockMateriasPrimas para Pedido 1 creado.`);


        // --- Pedido 2: Importación Goma ---
        result = await runAsync(
            `INSERT INTO PedidosProveedores (numero_factura, proveedor, fecha_pedido, fecha_llegada, origen_tipo, observaciones, valor_conversion)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            ['INV-I-777', 'Goma Global Co.', '2025-04-15', '2025-05-20', 'CONTENEDOR', 'Importación EPDM', 0.92]
        );
        const pedido2Id = result.lastID;
        console.log(`Pedido 2 (ID: ${pedido2Id}) creado.`);

        await runAsync(
            `INSERT INTO GastosPedido (pedido_id, tipo_gasto, descripcion, coste_eur) VALUES (?, ?, ?, ?)`,
            [pedido2Id, 'SUPLIDOS', 'Flete Marítimo', 300.00]
        );
        await runAsync(
            `INSERT INTO GastosPedido (pedido_id, tipo_gasto, descripcion, coste_eur) VALUES (?, ?, ?, ?)`,
            [pedido2Id, 'SUJETO', 'Aranceles Aduana', 120.00]
        );
        console.log(`Gastos para Pedido 2 creados.`);
        
        // Líneas de Pedido Originales para Pedido 2
        await runAsync(
            `INSERT INTO LineasPedido (pedido_id, descripcion_original, cantidad_original, unidad_original, precio_unitario_original, moneda_original)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [pedido2Id, 'Goma EPDM 3mm x 1m', 200, 'm', 5.00, 'USD']
        );
         await runAsync(
            `INSERT INTO LineasPedido (pedido_id, descripcion_original, cantidad_original, unidad_original, precio_unitario_original, moneda_original)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [pedido2Id, 'Goma EPDM 5mm x 1.2m', 150, 'm', 7.50, 'USD']
        );
        console.log(`LineasPedido para Pedido 2 creadas.`);

        // Stock para Pedido 2
        await runAsync(
            `INSERT INTO StockMateriasPrimas (pedido_id, material_tipo, subtipo_material, referencia_stock, fecha_entrada_almacen, status, espesor, ancho, largo_inicial, largo_actual, unidad_medida, coste_unitario_final, color, ubicacion, origen_factura)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [pedido2Id, 'GOMA', 'EPDM', 'GOM-EPDM-3-NE', '2025-05-20', 'DISPONIBLE', '3mm', 1000, 200, 200, 'm', 5.10, 'Negro', 'Zona Goma R1', 'INV-I-777']
        );
        await runAsync(
            `INSERT INTO StockMateriasPrimas (pedido_id, material_tipo, subtipo_material, referencia_stock, fecha_entrada_almacen, status, espesor, ancho, largo_inicial, largo_actual, unidad_medida, coste_unitario_final, color, ubicacion, origen_factura)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [pedido2Id, 'GOMA', 'EPDM', 'GOM-EPDM-5-NE', '2025-05-20', 'DISPONIBLE', '5mm', 1200, 150, 150, 'm', 7.75, 'Negro', 'Zona Goma R2', 'INV-I-777']
        );
        console.log(`StockMateriasPrimas para Pedido 2 creado.`);

        // --- Pedido 3: Nacional FIELTRO (para probar el borrado quizás) ---
        result = await runAsync(
            `INSERT INTO PedidosProveedores (numero_factura, proveedor, fecha_pedido, fecha_llegada, origen_tipo, observaciones)
             VALUES (?, ?, ?, ?, ?, ?)`,
            ['FAC-N-002', 'Fieltros Nacionales', '2025-06-01', '2025-06-03', 'NACIONAL', 'Pedido fieltro adhesivo']
        );
        const pedido3Id = result.lastID;
        console.log(`Pedido 3 (ID: ${pedido3Id}) creado.`);
        await runAsync(
            `INSERT INTO StockMateriasPrimas (pedido_id, material_tipo, subtipo_material, referencia_stock, fecha_entrada_almacen, status, espesor, ancho, largo_inicial, largo_actual, unidad_medida, coste_unitario_final, color, ubicacion, origen_factura)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [pedido3Id, 'FIELTRO', 'Adhesivo', 'FIE-ADH-2-GR', '2025-06-03', 'AGOTADO', '2mm', 1000, 50, 0, 'm', 1.50, 'Gris', 'Estante B3', 'FAC-N-002']
        );
        console.log(`StockMateriasPrimas para Pedido 3 creado.`);

        

        await runAsync('COMMIT;');
        console.log("Siembra de datos completada exitosamente.");

    } catch (error) {
        console.error("Error durante la siembra de datos, revirtiendo:", error.message);
        try {
            await runAsync('ROLLBACK;');
        } catch (rollbackError) {
            console.error("Error al intentar hacer ROLLBACK:", rollbackError.message);
        }
    } finally {
        db.close((err) => {
            if (err) {
                return console.error("Error al cerrar la conexión de la base de datos del seeder:", err.message);
            }
            console.log("Conexión a la base de datos del seeder cerrada.");
        });
    }
}

// Ejecutar la función de siembra
//Descomentar para usar las funciones
//seedData();
//seedConfiguracion();