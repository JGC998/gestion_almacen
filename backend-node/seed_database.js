// backend-node/seed_database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const almacenDir = path.resolve(__dirname, 'almacen');
const dbPath = path.resolve(almacenDir, 'almacen.db');

if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log("Base de datos anterior eliminada para una nueva siembra.");
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        return console.error("Error creando la base de datos:", err.message);
    }
    console.log("Nueva base de datos creada en", dbPath);
});

const TABLAS_SQL = `
    PRAGMA foreign_keys = ON;

    CREATE TABLE Familias ( id INTEGER PRIMARY KEY, nombre TEXT UNIQUE NOT NULL );
    CREATE TABLE Atributos ( id INTEGER PRIMARY KEY, nombre TEXT UNIQUE NOT NULL );
    CREATE TABLE ValoresAtributos ( id INTEGER PRIMARY KEY, atributo_id INTEGER NOT NULL, valor TEXT NOT NULL, FOREIGN KEY(atributo_id) REFERENCES Atributos(id), UNIQUE(atributo_id, valor) );
    CREATE TABLE Items ( id INTEGER PRIMARY KEY, sku TEXT UNIQUE, descripcion TEXT, familia_id INTEGER, tipo_item TEXT NOT NULL, FOREIGN KEY(familia_id) REFERENCES Familias(id) );
    CREATE TABLE ItemAtributos ( item_id INTEGER NOT NULL, valor_atributo_id INTEGER NOT NULL, PRIMARY KEY (item_id, valor_atributo_id), FOREIGN KEY(item_id) REFERENCES Items(id) ON DELETE CASCADE, FOREIGN KEY(valor_atributo_id) REFERENCES ValoresAtributos(id) ON DELETE CASCADE );

    CREATE TABLE PedidosProveedores ( id INTEGER PRIMARY KEY, numero_factura TEXT NOT NULL UNIQUE, proveedor TEXT, fecha_pedido TEXT, origen_tipo TEXT NOT NULL, valor_conversion REAL, status TEXT NOT NULL DEFAULT 'COMPLETADO', observaciones TEXT );
    CREATE TABLE LineasPedido ( id INTEGER PRIMARY KEY, pedido_id INTEGER NOT NULL, item_id INTEGER NOT NULL, cantidad_bobinas INTEGER NOT NULL, metros_por_bobina REAL NOT NULL, precio_unitario REAL NOT NULL, moneda TEXT NOT NULL, FOREIGN KEY(pedido_id) REFERENCES PedidosProveedores(id) ON DELETE CASCADE, FOREIGN KEY(item_id) REFERENCES Items(id) );
    CREATE TABLE GastosPedido ( id INTEGER PRIMARY KEY, pedido_id INTEGER NOT NULL, descripcion TEXT NOT NULL, coste_eur REAL NOT NULL, tipo_gasto TEXT NOT NULL, FOREIGN KEY(pedido_id) REFERENCES PedidosProveedores(id) ON DELETE CASCADE );

    CREATE TABLE OrdenesProduccion ( id INTEGER PRIMARY KEY, item_id INTEGER, cantidad_a_producir REAL, fecha TEXT, status TEXT DEFAULT 'PENDIENTE', coste_real_fabricacion REAL, FOREIGN KEY(item_id) REFERENCES Items(id) );
    CREATE TABLE Stock ( id INTEGER PRIMARY KEY, lote TEXT UNIQUE NOT NULL, item_id INTEGER NOT NULL, cantidad_inicial REAL NOT NULL, cantidad_actual REAL NOT NULL, coste_lote REAL NOT NULL, pedido_id INTEGER, orden_produccion_id INTEGER, fecha_entrada TEXT NOT NULL, status TEXT DEFAULT 'DISPONIBLE', FOREIGN KEY(item_id) REFERENCES Items(id) ON DELETE CASCADE, FOREIGN KEY(pedido_id) REFERENCES PedidosProveedores(id) ON DELETE SET NULL, FOREIGN KEY(orden_produccion_id) REFERENCES OrdenesProduccion(id) ON DELETE SET NULL );

    CREATE TABLE Maquinaria ( id INTEGER PRIMARY KEY, nombre TEXT UNIQUE NOT NULL, descripcion TEXT, coste_hora_operacion REAL );
    CREATE TABLE Recetas ( id INTEGER PRIMARY KEY, producto_id INTEGER, material_id INTEGER, FOREIGN KEY(producto_id) REFERENCES Items(id), FOREIGN KEY(material_id) REFERENCES Items(id) );
    CREATE TABLE ProcesosFabricacion ( id INTEGER PRIMARY KEY, producto_id INTEGER, maquinaria_id INTEGER, FOREIGN KEY(producto_id) REFERENCES Items(id), FOREIGN KEY(maquinaria_id) REFERENCES Maquinaria(id) );

    CREATE TABLE Tarifas ( item_id INTEGER NOT NULL, tipo_tarifa TEXT NOT NULL, precio_venta REAL NOT NULL, ultimo_coste_compra REAL NOT NULL, fecha_actualizacion TEXT NOT NULL, PRIMARY KEY (item_id, tipo_tarifa), FOREIGN KEY(item_id) REFERENCES Items(id) ON DELETE CASCADE );
`;

db.exec(TABLAS_SQL, async (err) => {
    if (err) return console.error("Error creando tablas:", err.message);
    console.log("Estructura de tablas creada con éxito.");

    // Helpers para DB
    const run = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function (err) { if (err) reject(err); else resolve({ lastID: this.lastID, changes: this.changes }); }));
    const get = (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row); }));

    // --- INICIO DE LA LÓGICA DE SIEMBRA ---
    try {
        await run('BEGIN TRANSACTION');

        console.log("Poblando catálogos...");
        const familias = ['GOMA', 'PVC', 'FIELTRO', 'CARAMELO', 'VERDE', 'NEGRA'];
        for (const f of familias) { await run(`INSERT INTO Familias (nombre) VALUES (?)`, [f]); }
        const atributos = ['Espesor', 'Ancho', 'Color', 'Acabado'];
        for (const a of atributos) { await run(`INSERT INTO Atributos (nombre) VALUES (?)`, [a]); }

        const findOrCreateItem = async (itemData) => {
            const { sku, descripcion, familia, tipo_item, atributos } = itemData;
            const famRow = await get(`SELECT id FROM Familias WHERE nombre = ?`, [familia]);
            let itemRow = await get(`SELECT id FROM Items WHERE sku = ?`, [sku]);
            if (itemRow) return itemRow.id;

            const itemResult = await run(`INSERT INTO Items (sku, descripcion, familia_id, tipo_item) VALUES (?, ?, ?, ?)`, [sku, descripcion, famRow.id, tipo_item]);
            const itemId = itemResult.lastID;

            for (const attr of atributos) {
                const attrRow = await get(`SELECT id FROM Atributos WHERE nombre = ?`, [attr.nombre]);
                let valRow = await get(`SELECT id FROM ValoresAtributos WHERE atributo_id = ? AND valor = ?`, [attrRow.id, attr.valor]);
                if (!valRow) {
                    const valResult = await run(`INSERT INTO ValoresAtributos (atributo_id, valor) VALUES (?, ?)`, [attrRow.id, attr.valor]);
                    valRow = { id: valResult.lastID };
                }
                await run(`INSERT INTO ItemAtributos (item_id, valor_atributo_id) VALUES (?, ?)`, [itemId, valRow.id]);
            }
            return itemId;
        };

        const crearPedidoYStock = async (pedido) => {
            const pedidoResult = await run(`INSERT INTO PedidosProveedores (numero_factura, proveedor, fecha_pedido, origen_tipo, valor_conversion, status) VALUES (?, ?, ?, ?, ?, ?)`, 
                [pedido.numero_factura, pedido.proveedor, pedido.fecha_pedido, pedido.origen_tipo, pedido.valor_conversion, 'COMPLETADO']);
            const pedidoId = pedidoResult.lastID;

            for(const gasto of pedido.gastos) {
                await run(`INSERT INTO GastosPedido (pedido_id, descripcion, coste_eur, tipo_gasto) VALUES (?, ?, ?, ?)`, [pedidoId, gasto.descripcion, gasto.coste_eur, gasto.tipo_gasto]);
            }

            let costeTotalBaseEnEuros = 0;
            pedido.lineas.forEach(l => {
                const precioEnEuros = (pedido.origen_tipo === 'IMPORTACION' ? l.precio_unitario * pedido.valor_conversion : l.precio_unitario);
                costeTotalBaseEnEuros += l.metros_por_bobina * l.cantidad_bobinas * precioEnEuros;
            });
            const totalGastosRepercutibles = pedido.gastos.reduce((acc, g) => (g.tipo_gasto || '').toUpperCase() !== 'SUJETO' ? acc + g.coste_eur : acc, 0);
            const porcentajeGastos = costeTotalBaseEnEuros > 0 ? totalGastosRepercutibles / costeTotalBaseEnEuros : 0;

            for (const linea of pedido.lineas) {
                const itemId = await findOrCreateItem(linea.item);
                const lineaResult = await run(`INSERT INTO LineasPedido (pedido_id, item_id, cantidad_bobinas, metros_por_bobina, precio_unitario, moneda) VALUES (?, ?, ?, ?, ?, ?)`,
                    [pedidoId, itemId, linea.cantidad_bobinas, linea.metros_por_bobina, linea.precio_unitario, linea.moneda]);
                const lineaId = lineaResult.lastID;

                const costeUnitarioEnEuros = (pedido.origen_tipo === 'IMPORTACION' ? linea.precio_unitario * pedido.valor_conversion : linea.precio_unitario);
                const costeFinalConGastos = costeUnitarioEnEuros * (1 + porcentajeGastos);

                for (let i = 1; i <= linea.cantidad_bobinas; i++) {
                    const lote = `P${pedidoId}-L${lineaId}-B${i}`;
                    await run(`INSERT INTO Stock (lote, item_id, cantidad_inicial, cantidad_actual, coste_lote, pedido_id, fecha_entrada) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [lote, itemId, linea.metros_por_bobina, linea.metros_por_bobina, costeFinalConGastos, pedidoId, pedido.fecha_pedido]);
                }
            }
             console.log(`Pedido ${pedido.numero_factura} creado con éxito.`);
        };

        // --- DEFINICIÓN DE DATOS DE PRUEBA ---
        const pedidos = [
            // GOMA
            { numero_factura: 'G-NAC-001', proveedor: 'Gomas Pymar', fecha_pedido: '2025-01-10', origen_tipo: 'NACIONAL', valor_conversion: 1.0, gastos: [{descripcion: 'Transporte', coste_eur: 120, tipo_gasto: 'NACIONAL'}], lineas: [
                { item: { sku: 'GOM-6-1000', descripcion: 'Goma EPDM 6mm', familia: 'GOMA', tipo_item: 'MATERIA_PRIMA', atributos: [{nombre: 'Espesor', valor: '6mm'}, {nombre: 'Ancho', valor: '1000mm'}]}, cantidad_bobinas: 2, metros_por_bobina: 50, precio_unitario: 4.5, moneda: 'EUR' },
                { item: { sku: 'GOM-8-1200', descripcion: 'Goma EPDM 8mm', familia: 'GOMA', tipo_item: 'MATERIA_PRIMA', atributos: [{nombre: 'Espesor', valor: '8mm'}, {nombre: 'Ancho', valor: '1200mm'}]}, cantidad_bobinas: 1, metros_por_bobina: 30, precio_unitario: 5.8, moneda: 'EUR' }
            ]},
            // Añade 3 pedidos más para GOMA, 4 para PVC, 4 para FIELTRO...
            { numero_factura: 'G-IMP-002', proveedor: 'Rubber King', fecha_pedido: '2025-02-15', origen_tipo: 'IMPORTACION', valor_conversion: 0.92, gastos: [{descripcion: 'Flete', coste_eur: 800, tipo_gasto: 'SUPLIDOS'}, {descripcion: 'Aranceles', coste_eur: 350, tipo_gasto: 'SUJETO'}], lineas: [
                { item: { sku: 'GOM-6-1000', descripcion: 'Goma EPDM 6mm', familia: 'GOMA', tipo_item: 'MATERIA_PRIMA', atributos: [{nombre: 'Espesor', valor: '6mm'}, {nombre: 'Ancho', valor: '1000mm'}]}, cantidad_bobinas: 10, metros_por_bobina: 50, precio_unitario: 3.8, moneda: 'USD' }
            ]},
             { numero_factura: 'P-NAC-001', proveedor: 'Plásticos Iberia', fecha_pedido: '2025-03-05', origen_tipo: 'NACIONAL', valor_conversion: 1.0, gastos: [{descripcion: 'Portes', coste_eur: 90, tipo_gasto: 'NACIONAL'}], lineas: [
                { item: { sku: 'PVC-2-1400', descripcion: 'PVC Transparente 2mm', familia: 'PVC', tipo_item: 'MATERIA_PRIMA', atributos: [{nombre: 'Espesor', valor: '2mm'}, {nombre: 'Ancho', valor: '1400mm'}]}, cantidad_bobinas: 5, metros_por_bobina: 100, precio_unitario: 2.1, moneda: 'EUR' }
            ]},
             { numero_factura: 'F-NAC-001', proveedor: 'Fieltros del Norte', fecha_pedido: '2025-04-20', origen_tipo: 'NACIONAL', valor_conversion: 1.0, gastos: [{descripcion: 'Envío Urgente', coste_eur: 150, tipo_gasto: 'NACIONAL'}], lineas: [
                { item: { sku: 'FIE-3-1000-GR', descripcion: 'Fieltro Gris 3mm', familia: 'FIELTRO', tipo_item: 'MATERIA_PRIMA', atributos: [{nombre: 'Espesor', valor: '3mm'}, {nombre: 'Ancho', valor: '1000mm'}, {nombre: 'Color', valor: 'Gris'}]}, cantidad_bobinas: 8, metros_por_bobina: 25, precio_unitario: 3.2, moneda: 'EUR' }
            ]},
        ];

        console.log("Creando pedidos de prueba...");
        for(const pedido of pedidos) {
            await crearPedidoYStock(pedido);
        }

        await run('COMMIT');
        console.log("¡Base de datos poblada con éxito!");

    } catch (error) {
        console.error("Error en la siembra de datos. Reversión de la transacción.", error);
        await run('ROLLBACK');
    } finally {
        db.close((err) => {
            if(err) console.error("Error cerrando la DB", err);
            else console.log("Conexión a la base de datos cerrada.");
        });
    }
});