// frontend-react/src/App.jsx
import { useState, useEffect, useCallback } from 'react';
import './App.css';
import FormularioPedidoNacional from './components/FormularioPedidoNacional.jsx';
import FormularioPedidoImportacion from './components/FormularioPedidoImportacion.jsx';
import ListaPedidos from './ListaPedidos.jsx';
import TarifaVenta from './components/TarifaVenta.jsx';
import GestionProductosRecetas from './components/GestionProductosRecetas.jsx';
import GestionMaquinaria from './components/GestionMaquinaria.jsx';
import GestionProcesosFabricacion from './components/GestionProcesosFabricacion.jsx';
import GestionOrdenesProduccion from './components/GestionOrdenesProduccion.jsx';
import FormularioConfiguracion from './components/FormularioConfiguracion.jsx';
import CalculadoraPresupuestos from './components/CalculadoraPresupuestos.jsx';

// --- Modal de Detalles para la nueva estructura de Stock ---
function DetalleStockModal({ item, onClose }) {
  if (!item) return null;

   return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Detalles del Lote: {item.lote} (Ref: {item.sku})</h2>
        <div className="modal-details-grid">
            <p><strong>Referencia:</strong> {item.sku || 'N/A'}</p>
            <p><strong>Descripción:</strong> {item.descripcion || 'N/A'}</p>
            <p><strong>Familia:</strong> {item.familia || 'N/A'}</p>
            {/* --- CAMPOS AÑADIDOS --- */}
            <p><strong>Espesor:</strong> {item.espesor || 'N/A'}</p>
            <p><strong>Ancho:</strong> {item.ancho ? `${item.ancho} mm` : 'N/A'}</p>
            {/* --- FIN DE CAMPOS AÑADIDOS --- */}
            <p><strong>Lote:</strong> {item.lote || 'N/A'}</p>
            <p><strong>Cantidad Actual:</strong> {parseFloat(item.cantidad_actual || 0).toFixed(2)} {item.unidad_medida}</p>
            <p><strong>Coste del Lote:</strong> {parseFloat(item.coste_lote || 0).toFixed(4)} €/{item.unidad_medida}</p>
            <p><strong>Ubicación:</strong> {item.ubicacion || 'N/A'}</p>
            <p><strong>Estado:</strong> {item.status || 'N/A'}</p>
        </div>
        <button onClick={onClose} className="modal-close-button">Cerrar</button>
      </div>
    </div>
  );
}


function App() {
  const [stockList, setStockList] = useState([]);
  const [loadingStock, setLoadingStock] = useState(true);
  const [errorStock, setErrorStock] = useState(null);

  const [filtroFamilia, setFiltroFamilia] = useState('');
  const [filtroBusqueda, setFiltroBusqueda] = useState('');

  const [itemSeleccionadoParaModal, setItemSeleccionadoParaModal] = useState(null);
  const [mostrarModalDetalles, setMostrarModalDetalles] = useState(false);
  
  const [vistaActual, setVistaActual] = useState('STOCK');

  const fetchStockAndProcess = useCallback(async () => {
    setLoadingStock(true);
    setErrorStock(null);

    const params = new URLSearchParams();
    if (filtroFamilia) params.append('familia', filtroFamilia);
    if (filtroBusqueda) params.append('buscar', filtroBusqueda);

    const queryString = params.toString();
    const apiUrl = `http://localhost:5002/api/stock${queryString ? `?${queryString}` : ''}`;
    
    console.log("Llamando a la API de stock con nueva estructura:", apiUrl);

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);
      const data = await response.json();
      setStockList(data);
    } catch (err) {
      console.error("Error al obtener y procesar el stock:", err);
      setErrorStock(err.message);
      setStockList([]);
    } finally {
      setLoadingStock(false);
    }
  }, [filtroFamilia, filtroBusqueda]);

  useEffect(() => {
    fetchStockAndProcess();
  }, [fetchStockAndProcess]);

  const handleVerDetalles = (lote) => {
    setItemSeleccionadoParaModal(lote);
    setMostrarModalDetalles(true);
  };

  const renderVista = () => {
    switch (vistaActual) {
      case 'NACIONAL': return <FormularioPedidoNacional />;
      case 'LISTA_PEDIDOS': return <ListaPedidos />;
      case 'IMPORTACION': return <FormularioPedidoImportacion />;
      case 'TARIFA_VENTA': return <TarifaVenta />;
      case 'PRODUCTOS_RECETAS': return <GestionProductosRecetas />;
      case 'MAQUINARIA': return <GestionMaquinaria />;
      case 'PRODUCCION': return <GestionProduccion />; // NUEVO
      case 'CONFIGURACION': return <FormularioConfiguracion />;
      case 'CALCULADORA_PRESUPUESTOS': return <CalculadoraPresupuestos />;
      case 'STOCK':
      default:
        if (loadingStock) return <p>Cargando stock...</p>;
        if (errorStock) return <p className="error-backend">Error al cargar lista de stock: {errorStock}</p>;

        // En frontend-react/src/App.jsx

// Reemplazar el return dentro del 'case 'STOCK':' en la función 'renderVista' con esto:
        return (
            <>
              <h2>Stock Actual</h2>
              <div className="filtros-container">
                <div className="filtro-item">
                  <label htmlFor="filtro-familia">Familia:</label>
                  {/* CORRECCIÓN: Añadidas todas las familias al filtro */}
                  <select id="filtro-familia" value={filtroFamilia} onChange={(e) => setFiltroFamilia(e.target.value)}>
                      <option value="">Todas</option>
                      <option value="GOMA">GOMA</option>
                      <option value="FIELTRO">FIELTRO</option>
                      <option value="PVC">PVC</option>
                      <option value="VERDE">VERDE</option>
                      <option value="CARAMELO">CARAMELO</option>
                      <option value="NEGRA">NEGRA</option>
                  </select>
                </div>
                {/* Podríamos añadir más filtros aquí en el futuro */}
              </div>

              {stockList.length === 0 && <p>No hay lotes de stock que coincidan con los filtros.</p>}

              {stockList.length > 0 && (
                <table>
                  {/* CORRECCIÓN: Cabeceras de tabla actualizadas */}
                  <thead>
                    <tr>
                      <th>Referencia</th>
                      <th>Descripción</th>
                      <th>Espesor</th>
                      <th>Ancho (mm)</th>
                      <th>Lote</th>
                      <th>Cantidad Actual</th>
                      <th>Unidad</th>
                      <th>Ubicación</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockList.map((lote) => (
                      <tr key={lote.id}>
                        {/* CORRECCIÓN: Se muestra 'sku' como Referencia y se añaden los nuevos campos */}
                        <td>{lote.sku}</td>
                        <td>{lote.descripcion}</td>
                        <td>{lote.espesor || '-'}</td>
                        <td>{lote.ancho || '-'}</td>
                        <td>{lote.lote}</td>
                        <td>{parseFloat(lote.cantidad_actual || 0).toFixed(2)}</td>
                        <td>{lote.unidad_medida}</td>
                        <td>{lote.ubicacion || '-'}</td>
                        <td>{lote.status}</td>
                        <td>
                          <button
                            className="details-button"
                            onClick={() => handleVerDetalles(lote)}
                          >
                            Detalles
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
        );
    }
  };

  return (
    <div className="app-layout">
      <nav className="sidebar">
        <h1 className="app-title">Gestión de Almacén</h1>
        <div className="sidebar-section">
            <h3>Materias Primas y Stock</h3>
            <button onClick={() => setVistaActual('STOCK')} disabled={vistaActual === 'STOCK'}>Ver Stock</button>
            <button onClick={() => setVistaActual('LISTA_PEDIDOS')} disabled={vistaActual === 'LISTA_PEDIDOS'}>Ver Pedidos</button>
            <button onClick={() => setVistaActual('TARIFA_VENTA')} disabled={vistaActual === 'TARIFA_VENTA'}>Ver Tarifa Venta</button>
            <button onClick={() => setVistaActual('NACIONAL')} disabled={vistaActual === 'NACIONAL'}>Nuevo Pedido Nacional</button>
            <button onClick={() => setVistaActual('IMPORTACION')} disabled={vistaActual === 'IMPORTACION'}>Nuevo Pedido Importación</button>
        </div>
        <div className="sidebar-section">
     <h3>Fabricación</h3>
     <button onClick={() => setVistaActual('PRODUCTOS_RECETAS')} disabled={vistaActual === 'PRODUCTOS_RECETAS'}>Gestión de Artículos</button>
     <button onClick={() => setVistaActual('MAQUINARIA')} disabled={vistaActual === 'MAQUINARIA'}>Gestión Maquinaria</button>
     <button onClick={() => setVistaActual('PRODUCCION')} disabled={vistaActual === 'PRODUCCION'}>Producción</button>
 </div>
        <div className="sidebar-section">
            <h3>Herramientas</h3>
            <button onClick={() => setVistaActual('CALCULADORA_PRESUPUESTOS')} disabled={vistaActual === 'CALCULADORA_PRESUPUESTOS'}>Calculadora Presupuestos</button>
            <button onClick={() => setVistaActual('CONFIGURACION')} disabled={vistaActual === 'CONFIGURACION'}>Configuración</button>
        </div>
      </nav>
      <div className="main-content-area">
        <div className="container">
          {renderVista()}
        </div>
      </div>
      {mostrarModalDetalles && (
        <DetalleStockModal
          item={itemSeleccionadoParaModal}
          onClose={() => setMostrarModalDetalles(false)}
        />
      )}
    </div>
  );
}

export default App;