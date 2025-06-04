const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'almacen', 'almacen.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        return console.error("Error al conectar a la base de datos para seeder:", err.message);
    }
    console.log("Conectado a la base de datos SQLite para seeder.");
    // Habilitar claves foráneas
    db.exec('PRAGMA foreign_keys = ON;', (err) => {
        if (err) console.error("Error al habilitar foreign keys en seeder:", err.message);
    });
});

// Helper para db.run con promesas
function runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) { // No usar arrow function para this.lastID
            if (err) {
                console.error('Error ejecutando SQL en seeder:', sql, params, err.message);
                return reject(err);
            }
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

// REMOVIDA: La función seedConfiguracion ya no es necesaria,
// ya que la configuración se gestiona en config.json.

async function seedData() {
    try {
        console.log("Iniciando siembra de datos...");
        await runAsync('BEGIN TRANSACTION;');

        // --- LIMPIAR TABLAS EXISTENTES (¡Solo para desarrollo!) ---
        // Limpiar en el orden inverso de dependencias para evitar errores de FK
        await runAsync('DELETE FROM StockProductosTerminados;');
        await runAsync('DELETE FROM OrdenesProduccion;');
        await runAsync('DELETE FROM ProcesosFabricacion;');
        await runAsync('DELETE FROM Recetas;');
        await runAsync('DELETE FROM Maquinaria;');
        await runAsync('DELETE FROM ProductosTerminados;');
        await runAsync('DELETE FROM StockMateriasPrimas;');
        await runAsync('DELETE FROM StockComponentes;');
        await runAsync('DELETE FROM GastosPedido;');
        await runAsync('DELETE FROM LineasPedido;');
        await runAsync('DELETE FROM PedidosProveedores;');
        // REMOVIDA: DELETE FROM Configuracion; ya que la tabla se elimina del esquema
        console.log("Tablas limpiadas.");

        // --- Pedido 1: Nacional PVC ---
        let result = await runAsync(
            `INSERT INTO PedidosProveedores (numero_factura, proveedor, fecha_pedido, fecha_llegada, origen_tipo, observaciones)
             VALUES (?, ?, ?, ?, ?, ?)`,
            ['FAC-N-001', 'PVC Nacional S.L.', '2025-05-01', '2025-05-05', 'NACIONAL', 'Pedido de planchas PVC']
        );
        const pedido1Id = result.lastID;
        await runAsync(
            `INSERT INTO GastosPedido (pedido_id, tipo_gasto, descripcion, coste_eur) VALUES (?, ?, ?, ?)`,
            [pedido1Id, 'SUPLIDOS', 'Transporte local', 50.00] // Gasto SUPLIDO
        );
        await runAsync(
            `INSERT INTO GastosPedido (pedido_id, tipo_gasto, descripcion, coste_eur) VALUES (?, ?, ?, ?)`,
            [pedido1Id, 'SUPLIDOS', 'Impuesto IVA', 10.00] // Gasto SUPLIDO con IVA (no debería repercutir)
        );
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
        const stock1_id = (await runAsync(
            `INSERT INTO StockMateriasPrimas (pedido_id, material_tipo, subtipo_material, referencia_stock, fecha_entrada_almacen, status, espesor, ancho, largo_inicial, largo_actual, unidad_medida, coste_unitario_final, color, ubicacion, origen_factura)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [pedido1Id, 'PVC', 'Rígido', 'PVC-R-0.5-BL', '2025-05-05', 'DISPONIBLE', '0.5mm', 1000, 100, 100, 'm2', 2.75, 'Blanco', 'Estante A1', 'FAC-N-001']
        )).lastID;
        const stock2_id = (await runAsync(
            `INSERT INTO StockMateriasPrimas (pedido_id, material_tipo, subtipo_material, referencia_stock, fecha_entrada_almacen, status, espesor, ancho, largo_inicial, largo_actual, unidad_medida, coste_unitario_final, color, ubicacion, origen_factura)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [pedido1Id, 'PVC', 'Flexible', 'PVC-F-1.0-TR', '2025-05-05', 'EMPEZADA', '1.0mm', 1200, 50, 30, 'm', 3.80, 'Transparente', 'Estante A2', 'FAC-N-001']
        )).lastID;
        console.log(`Pedido 1 (ID: ${pedido1Id}) y stock creado.`);


        // --- Pedido 2: Importación Goma ---
        result = await runAsync(
            `INSERT INTO PedidosProveedores (numero_factura, proveedor, fecha_pedido, fecha_llegada, origen_tipo, observaciones, valor_conversion)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            ['INV-I-777', 'Goma Global Co.', '2025-04-15', '2025-05-20', 'CONTENEDOR', 'Importación EPDM', 0.92]
        );
        const pedido2Id = result.lastID;
        await runAsync(
            `INSERT INTO GastosPedido (pedido_id, tipo_gasto, descripcion, coste_eur) VALUES (?, ?, ?, ?)`,
            [pedido2Id, 'SUPLIDOS', 'Flete Marítimo', 300.00]
        );
        await runAsync(
            `INSERT INTO GastosPedido (pedido_id, tipo_gasto, descripcion, coste_eur) VALUES (?, ?, ?, ?)`,
            [pedido2Id, 'SUJETO', 'Aranceles Aduana', 120.00]
        );
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
        const stock3_id = (await runAsync(
            `INSERT INTO StockMateriasPrimas (pedido_id, material_tipo, subtipo_material, referencia_stock, fecha_entrada_almacen, status, espesor, ancho, largo_inicial, largo_actual, unidad_medida, coste_unitario_final, color, ubicacion, origen_factura)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [pedido2Id, 'GOMA', 'EPDM', 'GOM-EPDM-3-NE', '2025-05-20', 'DISPONIBLE', '3mm', 1000, 200, 200, 'm', 5.10, 'Negro', 'Zona Goma R1', 'INV-I-777']
        )).lastID;
        const stock4_id = (await runAsync(
            `INSERT INTO StockMateriasPrimas (pedido_id, material_tipo, subtipo_material, referencia_stock, fecha_entrada_almacen, status, espesor, ancho, largo_inicial, largo_actual, unidad_medida, coste_unitario_final, color, ubicacion, origen_factura)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [pedido2Id, 'GOMA', 'EPDM', 'GOM-EPDM-5-NE', '2025-05-20', 'DISPONIBLE', '5mm', 1200, 150, 150, 'm', 7.75, 'Negro', 'Zona Goma R2', 'INV-I-777']
        )).lastID;
        console.log(`Pedido 2 (ID: ${pedido2Id}) y stock creado.`);

        // --- Pedido 3: Nacional FIELTRO (para probar el borrado quizás) ---
        result = await runAsync(
            `INSERT INTO PedidosProveedores (numero_factura, proveedor, fecha_pedido, fecha_llegada, origen_tipo, observaciones)
             VALUES (?, ?, ?, ?, ?, ?)`,
            ['FAC-N-002', 'Fieltros Nacionales', '2025-06-01', '2025-06-03', 'NACIONAL', 'Pedido fieltro adhesivo']
        );
        const pedido3Id = result.lastID;
        const stock5_id = (await runAsync(
            `INSERT INTO StockMateriasPrimas (pedido_id, material_tipo, subtipo_material, referencia_stock, fecha_entrada_almacen, status, espesor, ancho, largo_inicial, largo_actual, unidad_medida, coste_unitario_final, color, ubicacion, origen_factura)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [pedido3Id, 'FIELTRO', 'Adhesivo', 'FIE-ADH-2-GR', '2025-06-03', 'AGOTADO', '2mm', 1000, 50, 0, 'm', 1.50, 'Gris', 'Estante B3', 'FAC-N-002']
        )).lastID;
        console.log(`Pedido 3 (ID: ${pedido3Id}) y stock creado.`);

        // --- Componente de ejemplo (si no tienes un endpoint de componentes separado) ---
        const comp1_id = (await runAsync(
            `INSERT INTO StockComponentes (componente_ref, descripcion, cantidad_inicial, cantidad_actual, unidad_medida, coste_unitario_final, fecha_entrada_almacen, status, ubicacion, origen_factura)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['ADH-001', 'Adhesivo Industrial', 50, 50, 'kg', 12.50, '2025-05-10', 'DISPONIBLE', 'Almacén C1', 'COMP-FAC-001']
        )).lastID;
        const comp2_id = (await runAsync(
            `INSERT INTO StockComponentes (componente_ref, descripcion, cantidad_inicial, cantidad_actual, unidad_medida, coste_unitario_final, fecha_entrada_almacen, status, ubicacion, origen_factura)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['TORN-M8', 'Tornillo M8x20mm', 1000, 1000, 'ud', 0.05, '2025-05-15', 'DISPONIBLE', 'Almacén C2', 'COMP-FAC-002']
        )).lastID;
        console.log(`Componentes de ejemplo creados.`);

        // --- Productos Terminados de Ejemplo ---
        // Añadido coste_extra_unitario
        const prod1_id = (await runAsync(
            `INSERT INTO ProductosTerminados (referencia, nombre, descripcion, unidad_medida, coste_extra_unitario, fecha_creacion, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            ['PROD-GOM-001', 'Junta EPDM 3mm', 'Junta de estanqueidad de EPDM 3mm', 'unidad', 0.05, '2025-06-01', 'ACTIVO']
        )).lastID; // Coste extra de 0.05€ por unidad
        const prod2_id = (await runAsync(
            `INSERT INTO ProductosTerminados (referencia, nombre, descripcion, unidad_medida, coste_extra_unitario, fecha_creacion, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            ['PROD-PVC-001', 'Lámina PVC Flexible 1.2m', 'Lámina de PVC transparente de 1.2m de ancho', 'm', 0.00, '2025-06-02', 'ACTIVO']
        )).lastID;
        // Nuevo producto terminado para probar la selección por referencia de stock
        const prod_faldeta_id = (await runAsync(
            `INSERT INTO ProductosTerminados (referencia, nombre, descripcion, unidad_medida, coste_extra_unitario, fecha_creacion, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            ['FALDETA-ALDAMA-2MM', 'Faldeta Aldama 2mm', 'Faldeta de goma Aldama de 2mm', 'unidad', 0.02, '2025-06-07', 'ACTIVO']
        )).lastID;
        console.log(`Productos Terminados de ejemplo creados.`);

        // --- Maquinaria de Ejemplo ---
        // Se eliminan vida_util_horas y depreciacion_hora
        const maq1_id = (await runAsync(
            `INSERT INTO Maquinaria (nombre, descripcion, coste_adquisicion, coste_hora_operacion)
             VALUES (?, ?, ?, ?)`,
            ['Cortadora CNC', 'Máquina de corte por control numérico', 50000, 5.00]
        )).lastID;
        const maq2_id = (await runAsync(
            `INSERT INTO Maquinaria (nombre, descripcion, coste_adquisicion, coste_hora_operacion)
             VALUES (?, ?, ?, ?)`,
            ['Prensa Hidráulica', 'Prensa para moldeado de piezas', 30000, 3.50]
        )).lastID;
        const maq3_id = (await runAsync(
            `INSERT INTO Maquinaria (nombre, descripcion, coste_adquisicion, coste_hora_operacion)
             VALUES (?, ?, ?, ?)`,
            ['Máquina de Grabado Láser', 'Máquina para grabar logos en piezas', 15000, 2.00]
        )).lastID;
        console.log(`Maquinaria de ejemplo creada.`);

        // --- Recetas de Ejemplo ---
        // Se eliminan cantidad_requerida y unidad_medida_requerida
        // Receta para 'Junta EPDM 3mm' (PROD-GOM-001)
        await runAsync(
            `INSERT INTO Recetas (producto_terminado_id, material_id, notas)
             VALUES (?, ?, ?)`,
            [prod1_id, stock3_id, 'Referencia a GOM-EPDM-3-NE']
        );
        await runAsync(
            `INSERT INTO Recetas (producto_terminado_id, componente_id, notas)
             VALUES (?, ?, ?)`,
            [prod1_id, comp1_id, 'Referencia a Adhesivo Industrial']
        );
        // Receta para 'Lámina PVC Flexible 1.2m' (PROD-PVC-001)
        await runAsync(
            `INSERT INTO Recetas (producto_terminado_id, material_id, notas)
             VALUES (?, ?, ?)`,
            [prod2_id, stock2_id, 'Referencia a PVC-F-1.0-TR']
        );
        // Receta para 'Faldeta Aldama 2mm' (FALDETA-ALDAMA-2MM)
        await runAsync(
            `INSERT INTO Recetas (producto_terminado_id, material_id, notas)
             VALUES (?, ?, ?)`,
            [prod_faldeta_id, stock5_id, 'Referencia a FIE-ADH-2-GR (Fieltro)']
        );
        console.log(`Recetas de ejemplo creadas.`);

        // --- Procesos de Fabricación de Ejemplo ---
        // Se elimina coste_mano_obra_hora
        // Proceso para 'Junta EPDM 3mm' (PROD-GOM-001)
        await runAsync(
            `INSERT INTO ProcesosFabricacion (producto_terminado_id, maquinaria_id, nombre_proceso, tiempo_estimado_horas)
             VALUES (?, ?, ?, ?)`,
            [prod1_id, maq1_id, 'Corte de Junta', 0.1]
        );
        await runAsync(
            `INSERT INTO ProcesosFabricacion (producto_terminado_id, maquinaria_id, nombre_proceso, tiempo_estimado_horas)
             VALUES (?, ?, ?, ?)`,
            [prod1_id, maq2_id, 'Moldeado y Adhesivado', 0.05]
        );
        // Proceso para 'Lámina PVC Flexible 1.2m' (PROD-PVC-001)
        await runAsync(
            `INSERT INTO ProcesosFabricacion (producto_terminado_id, maquinaria_id, nombre_proceso, tiempo_estimado_horas)
             VALUES (?, ?, ?, ?)`,
            [prod2_id, maq1_id, 'Corte de Lámina', 0.05]
        );
        // Proceso para 'Faldeta Aldama 2mm' (FALDETA-ALDAMA-2MM)
        await runAsync(
            `INSERT INTO ProcesosFabricacion (producto_terminado_id, maquinaria_id, nombre_proceso, tiempo_estimado_horas)
             VALUES (?, ?, ?, ?)`,
            [prod_faldeta_id, maq1_id, 'Troquelado Faldeta', 0.0083] // 30 segundos = 0.0083 horas
        );
        await runAsync(
            `INSERT INTO ProcesosFabricacion (producto_terminado_id, maquinaria_id, nombre_proceso, tiempo_estimado_horas)
             VALUES (?, ?, ?, ?)`,
            [prod_faldeta_id, maq3_id, 'Grabado Logo', 0.0083] // 30 segundos = 0.0083 horas
        );
        console.log(`Procesos de Fabricación de ejemplo creados.`);

        // --- Órdenes de Producción de Ejemplo ---
        // Se usa un solo campo 'fecha'
        const op1_id = (await runAsync(
            `INSERT INTO OrdenesProduccion (producto_terminado_id, cantidad_a_producir, fecha, status, observaciones)
             VALUES (?, ?, ?, ?, ?)`,
            [prod1_id, 10, '2025-06-05', 'PENDIENTE', 'Primera tirada de juntas EPDM']
        )).lastID;
        const op2_id = (await runAsync(
            `INSERT INTO OrdenesProduccion (producto_terminado_id, cantidad_a_producir, fecha, status, observaciones)
             VALUES (?, ?, ?, ?, ?)`,
            [prod2_id, 5, '2025-06-06', 'PENDIENTE', 'Láminas para pedido especial']
        )).lastID;
        const op_faldeta_id = (await runAsync(
            `INSERT INTO OrdenesProduccion (producto_terminado_id, cantidad_a_producir, fecha, status, observaciones)
             VALUES (?, ?, ?, ?, ?)`,
            [prod_faldeta_id, 4, '2025-06-08', 'PENDIENTE', 'Faldetas para cliente final']
        )).lastID;
        console.log(`Órdenes de Producción de ejemplo creadas.`);


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

// Ejecutar las funciones de siembra
// Descomenta estas líneas para ejecutar la siembra de datos.
// Recuerda que esto borrará y re-creará los datos existentes en las tablas.
seedData(); // Comentado para evitar ejecución accidental
