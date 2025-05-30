const express = require('express');
const cors = require('cors');
const path = require('path'); // Necesario para la ruta a la DB
const sqlite3 = require('sqlite3').verbose(); // verbose() para más detalles en errores

const app = express();
const PORT = process.env.PORT || 5002; // Usamos 5002 para evitar conflictos

// Middlewares
app.use(cors());
app.use(express.json());

// --- Configuración de la Base de Datos SQLite ---
// Definimos la ruta a la base de datos. Asumimos que estará en backend-node/almacen/almacen.db
const dbPath = path.resolve(__dirname, 'almacen', 'almacen.db');
console.log(`Ruta a la base de datos: ${dbPath}`);

// Crear la carpeta 'almacen' si no existe (solo para asegurar)
const fs = require('fs');
const almacenDir = path.resolve(__dirname, 'almacen');
if (!fs.existsSync(almacenDir)){
    fs.mkdirSync(almacenDir, { recursive: true });
    console.log(`Directorio '${almacenDir}' creado.`);
}

// Conectar a la base de datos (o crearla si no existe)
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error al conectar/crear la base de datos SQLite:", err.message);
    } else {
        console.log("Conectado a la base de datos SQLite.");
        // Aquí podríamos llamar a una función para crear tablas si no existen
        // crearTablasSiNoExisten();
    }
});

// Función para crear tablas (similar a tu database.py inicial)
// La adaptaremos más adelante con tu esquema completo
function crearTablasSiNoExisten() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS PedidosProveedores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero_factura TEXT NOT NULL UNIQUE,
            proveedor TEXT,
            fecha_pedido TEXT,
            fecha_llegada TEXT,
            origen_tipo TEXT NOT NULL CHECK(origen_tipo IN ('CONTENEDOR', 'NACIONAL')),
            observaciones TEXT,
            valor_conversion REAL
        )`, (err) => {
            if (err) console.error("Error creando tabla PedidosProveedores:", err.message);
            else console.log("Tabla PedidosProveedores verificada/creada.");
        });

        // ... Aquí añadirías la creación del resto de tus tablas ...
        // StockMateriasPrimas, GastosPedido, Configuracion, etc.
        // Por ahora, dejamos solo una para el ejemplo.
    });
}

// Llamar a la función para asegurar que las tablas existen al iniciar
crearTablasSiNoExisten();


// --- Rutas de la API ---
app.get('/api/estado', (req, res) => {
    console.log('Node.js: Se ha solicitado /api/estado');
    res.json({ estado: 'Servidor Backend Node.js funcionando correctamente!' });
});

// Aquí añadiremos más rutas (endpoints) para interactuar con la base de datos
// y la lógica de negocio.

app.listen(PORT, () => {
    console.log(`Servidor Node.js API escuchando en http://localhost:${PORT}`);
});

// Cerrar la conexión a la base de datos cuando la aplicación se cierra
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            return console.error(err.message);
        }
        console.log('Conexión a la base de datos SQLite cerrada.');
        process.exit(0);
    });
});