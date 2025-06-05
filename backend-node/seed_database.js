// backend-node/seed_database.js
const sqlite3 = require('sqlite3').verbose();
const pathModule = require('path'); // Renombrado para evitar conflicto y ser claro

// Ruta correcta a la base de datos
const dbPath = pathModule.resolve(__dirname, 'almacen', 'almacen.db');

// Conectar a la base de datos usando dbPath
const db = new sqlite3.Database(dbPath, (err) => { // CORREGIDO: Usar dbPath aquí
    if (err) {
        return console.error("Error al conectar a la base de datos para seeder:", err.message);
    }
    console.log("Conectado a la base de datos SQLite para seeder.");
    db.exec('PRAGMA foreign_keys = ON;', (fkErr) => { // Habilitar claves foráneas
        if (fkErr) console.error("Error al habilitar foreign keys en seeder:", fkErr.message);
    });
});

// Helper para ejecutar db.run como una Promesa
function runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        // Usar function() en lugar de arrow function para poder usar this.lastID
        db.run(sql, params, function(err) {
            if (err) {
                console.error('Error ejecutando SQL en seeder:', sql, params, err.message);
                reject(err);
            } else {
                resolve({ lastID: this.lastID, changes: this.changes });
            }
        });
    });
}

// Función principal para sembrar datos
async function seedData() {
    try {
        console.log("Iniciando siembra de datos...");
        await runAsync('BEGIN TRANSACTION;');

        // --- LIMPIAR TABLAS EXISTENTES ---
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
        console.log("Tablas relevantes limpiadas.");

        // --- Pedido 1: Nacional PVC ---
        let result = await runAsync(
            `INSERT INTO PedidosProveedores (numero_factura, proveedor, fecha_pedido, fecha_llegada, origen_tipo, observaciones)
             VALUES (?, ?, ?, ?, ?, ?)`,
            ['FAC-N-001', 'PVC Nacional S.L.', '2024-05-01', '2024-05-05', 'NACIONAL', 'Pedido de planchas PVC']
        );
        const pedido1Id = result.lastID;
        await runAsync(
            `INSERT INTO GastosPedido (pedido_id, tipo_gasto, descripcion, coste_eur) VALUES (?, ?, ?, ?)`,
            [pedido1Id, 'SUPLIDOS', 'Transporte local', 50.00]
        );
        // (El resto de los datos de ejemplo se mantienen igual que en la versión anterior que te di)
        // ... (StockMateriasPrimas para pedido1Id)
         await runAsync(
            `INSERT INTO StockMateriasPrimas (pedido_id, material_tipo, subtipo_material, referencia_stock, fecha_entrada_almacen, status, espesor, ancho, largo_inicial, largo_actual, unidad_medida, coste_unitario_final, color, ubicacion, origen_factura, peso_total_kg)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [pedido1Id, 'PVC', 'Rígido', 'PVC-R-0.5-BL', '2024-05-05', 'DISPONIBLE', '0.5mm', 1000, 100, 100, 'm2', 2.75, 'Blanco', 'Estante A1', 'FAC-N-001', 120.00]
        );
        await runAsync(
            `INSERT INTO StockMateriasPrimas (pedido_id, material_tipo, subtipo_material, referencia_stock, fecha_entrada_almacen, status, espesor, ancho, largo_inicial, largo_actual, unidad_medida, coste_unitario_final, color, ubicacion, origen_factura, peso_total_kg)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [pedido1Id, 'PVC', 'Flexible', 'PVC-F-1.0-TR', '2024-05-05', 'EMPEZADA', '1.0mm', 1200, 50, 30, 'm', 3.80, 'Transparente', 'Estante A2', 'FAC-N-001', 60.00]
        );


        // --- Pedido 2: Importación Goma ---
        result = await runAsync(
            `INSERT INTO PedidosProveedores (numero_factura, proveedor, fecha_pedido, fecha_llegada, origen_tipo, observaciones, valor_conversion)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            ['INV-I-777', 'Goma Global Co.', '2024-04-15', '2024-05-20', 'CONTENEDOR', 'Importación EPDM', 0.92]
        );
        const pedido2Id = result.lastID;
        // ... (StockMateriasPrimas para pedido2Id, incluyendo la goma de 6mm)
        await runAsync(
            `INSERT INTO StockMateriasPrimas (pedido_id, material_tipo, subtipo_material, referencia_stock, fecha_entrada_almacen, status, espesor, ancho, largo_inicial, largo_actual, unidad_medida, coste_unitario_final, color, ubicacion, origen_factura, peso_total_kg)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [pedido2Id, 'GOMA', 'EPDM', 'GOM-EPDM-3-NE', '2024-05-20', 'DISPONIBLE', '3mm', 1000, 200, 200, 'm', 5.10, 'Negro', 'Zona Goma R1', 'INV-I-777', 250.00]
        );
        await runAsync(
            `INSERT INTO StockMateriasPrimas (pedido_id, material_tipo, subtipo_material, referencia_stock, fecha_entrada_almacen, status, espesor, ancho, largo_inicial, largo_actual, unidad_medida, coste_unitario_final, color, ubicacion, origen_factura, peso_total_kg)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [pedido2Id, 'GOMA', 'EPDM', 'GOM-EPDM-6-NE', '2024-05-20', 'DISPONIBLE', '6mm', 1200, 150, 150, 'm', 7.75, 'Negro', 'Zona Goma R2', 'INV-I-777', 300.00]
        );

        // --- Pedido 3: Nacional FIELTRO ---
        result = await runAsync(
            `INSERT INTO PedidosProveedores (numero_factura, proveedor, fecha_pedido, fecha_llegada, origen_tipo, observaciones)
             VALUES (?, ?, ?, ?, ?, ?)`,
            ['FAC-N-002', 'Fieltros Nacionales', '2024-06-01', '2024-06-03', 'NACIONAL', 'Pedido fieltro adhesivo']
        );
        const pedido3Id = result.lastID;
        // ... (StockMateriasPrimas para pedido3Id)
        await runAsync(
            `INSERT INTO StockMateriasPrimas (pedido_id, material_tipo, subtipo_material, referencia_stock, fecha_entrada_almacen, status, espesor, ancho, largo_inicial, largo_actual, unidad_medida, coste_unitario_final, color, ubicacion, origen_factura, peso_total_kg)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [pedido3Id, 'FIELTRO', 'Adhesivo', 'FIE-ADH-F10-GR', '2024-06-03', 'DISPONIBLE', 'F10', 1000, 50, 50, 'm', 1.50, 'Gris', 'Estante B3', 'FAC-N-002', 15.00]
        );

        // --- Componentes de Ejemplo ---
        await runAsync(
            `INSERT INTO StockComponentes (componente_ref, descripcion, cantidad_inicial, cantidad_actual, unidad_medida, coste_unitario_final, fecha_entrada_almacen, status, ubicacion, origen_factura)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['ADH-001', 'Adhesivo Industrial XZ', 50, 50, 'kg', 12.50, '2024-05-10', 'DISPONIBLE', 'Almacén C1', 'COMP-FAC-001']
        );
        console.log("Pedidos y Stock de Materias Primas/Componentes sembrados.");

        // --- Productos Terminados (Plantillas) de Ejemplo ---
        const pt1Result = await runAsync(
            `INSERT INTO ProductosTerminados (referencia, nombre, unidad_medida, material_principal, espesor_principal, ancho_final, largo_final, coste_extra_unitario, fecha_creacion, status)
             VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['Junta EPDM Circular D20', 'unidad', 'GOMA', '3mm', 0.02, 0.02, 0.05, '2024-06-01', 'ACTIVO']
        );
        const prod1_id = pt1Result.lastID;
        await runAsync(`UPDATE ProductosTerminados SET referencia = ? WHERE id = ?`, [`PT-${String(prod1_id).padStart(5, '0')}`, prod1_id]);

        const pt2Result = await runAsync(
            `INSERT INTO ProductosTerminados (referencia, nombre, unidad_medida, material_principal, espesor_principal, ancho_final, largo_final, coste_extra_unitario, fecha_creacion, status)
             VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['FALDETA ALDAMA 6MM', 'unidad', 'GOMA', '6mm', 0.54, 0.5, 0.10, '2024-06-05', 'ACTIVO']
        );
        const prod_faldeta_id = pt2Result.lastID;
        await runAsync(`UPDATE ProductosTerminados SET referencia = ? WHERE id = ?`, [`PT-${String(prod_faldeta_id).padStart(5, '0')}`, prod_faldeta_id]);
        
        console.log(`Plantillas de Producto de ejemplo creadas.`);

        // --- Maquinaria de Ejemplo ---
        const maq1_id = (await runAsync(
            `INSERT INTO Maquinaria (nombre, descripcion, coste_adquisicion, coste_hora_operacion)
             VALUES (?, ?, ?, ?)`,
            ['Cortadora CNC Goma', 'Máquina de corte por control numérico para goma', 50000, 15.00]
        )).lastID;
        console.log(`Maquinaria de ejemplo creada.`);

        // --- Recetas de Ejemplo ---
        await runAsync(
            `INSERT INTO Recetas (producto_terminado_id, material_tipo_generico, espesor_generico, ancho_generico, cantidad_requerida, unidad_medida_requerida, unidades_por_ancho_material, peso_por_unidad_producto, notas)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [prod1_id, 'GOMA', '3mm', 0.02, 0.02, 'm', 50, 0.01, 'Consumo de material para junta D20. (ancho_generico es el ancho de la pieza)']
        );
        await runAsync(
            `INSERT INTO Recetas (producto_terminado_id, material_tipo_generico, espesor_generico, ancho_generico, cantidad_requerida, unidad_medida_requerida, unidades_por_ancho_material, peso_por_unidad_producto, notas)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [prod_faldeta_id, 'GOMA', '6mm', 0.54, 0.5, 'm', 1, 1.5, 'Material para 1 faldeta. 0.54m de ancho por 0.5m de largo de la bobina.']
        );
        console.log(`Recetas de ejemplo creadas.`);

        // --- Procesos de Fabricación de Ejemplo ---
        await runAsync(
            `INSERT INTO ProcesosFabricacion (producto_terminado_id, maquinaria_id, nombre_proceso, tiempo_estimado_horas, aplica_a_clientes)
             VALUES (?, ?, ?, ?, ?)`,
            [prod1_id, maq1_id, 'Corte de Junta D20', 0.02, 'ALL']
        );
        await runAsync(
            `INSERT INTO ProcesosFabricacion (producto_terminado_id, maquinaria_id, nombre_proceso, tiempo_estimado_horas, aplica_a_clientes)
             VALUES (?, ?, ?, ?, ?)`,
            [prod_faldeta_id, maq1_id, 'Corte Faldeta Aldama', 0.05, 'ALL']
        );
        console.log(`Procesos de Fabricación de ejemplo creados.`);

        // No insertamos Órdenes de Producción ni StockProductosTerminados aquí, se crearán por la app.
        // El coste_fabricacion_estandar de ProductosTerminados se calculará/actualizará cuando se modifiquen recetas/procesos en la app.

        await runAsync('COMMIT;');
        console.log("Siembra de datos completada exitosamente.");

    } catch (error) {
        console.error("Error durante la siembra de datos, revirtiendo:", error.message, error.stack);
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
seedData();
