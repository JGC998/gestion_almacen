const { app, BrowserWindow } = require('electron');
const path = require('path');

require(path.join(__dirname, '..', 'backend-node', 'server.js'));

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'resources/icon.ico'), // <--- AÑADE ESTA LÍNEA
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const startUrl = path.join(__dirname, 'dist', 'index.html');
  mainWindow.loadFile(startUrl);

  // Maximiza la ventana al iniciar
  mainWindow.maximize();

  // Elimina la barra de menú superior (File, Edit, etc.)
  mainWindow.setMenu(null);

  // Descomenta esta línea si necesitas depurar algo
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});