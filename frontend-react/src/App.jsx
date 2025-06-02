// frontend-react/src/App.jsx
import { useState, useEffect, useCallback } from 'react';
import './App.css';
// import FormularioPedidoNacionalGoma from './components/FormularioPedidoNacionalGoma'; // Ya no se usa directamente
import FormularioPedidoNacional from './components/FormularioPedidoNacional.jsx'; // CORREGIDO
import FormularioPedidoImportacion from './components/FormularioPedidoImportacion.jsx'; // CORREGIDO

// --- Componente Modal Simple para Detalles del Stock ---
function DetalleStockModal({ item, onClose, isLoading, error }) {
  if (!item && !isLoading && !error) return null;

  let fechaEntradaFormateada = 'N/A';
  if (item && item.fecha_entrada_almacen) {
    try {
      fechaEntradaFormateada = new Date(item.fecha_entrada_almacen).toLocaleDateString('es-ES', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
      });
    } catch (e) {
      console.warn("Error formateando fecha_entrada_almacen:", e);
      fechaEntradaFormateada = item.fecha_entrada_almacen;
    }
  }
  
  const unidad = item?.unidad_medida || 'ud';

return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {isLoading && <p>Cargando detalles del ítem...</p>}
        {error && <p className="error-backend">Error al cargar detalles: {error}</p>}
        {item && !isLoading && !error && (
          <>
            <h2>Detalles del Ítem de Stock (ID: {item.id})</h2>
            <div className="modal-details-grid">
              <p><strong>Referencia:</strong> {item.referencia_stock || item.componente_ref || 'N/A'}</p>
              <p><strong>Material Principal:</strong> {item.material_tipo || 'N/A'}</p>
              {item.subtipo_material && <p><strong>Subtipo/Variante:</strong> {item.subtipo_material}</p>}
              {item.espesor && <p><strong>Espesor:</strong> {item.espesor}</p>}
              {item.ancho !== null && item.ancho !== undefined && <p><strong>Ancho (mm):</strong> {parseFloat(item.ancho).toFixed(0)}</p>}
              {item.color && <p><strong>Color:</strong> {item.color}</p>}
              <p><strong>Estado:</strong> {item.status || 'N/A'}</p>
              
              {item.largo_inicial !== null && item.largo_inicial !== undefined && 
                <p><strong>Largo Inicial:</strong> {parseFloat(item.largo_inicial).toFixed(2)} {unidad}</p>}
              {item.largo_actual !== null && item.largo_actual !== undefined && 
                <p><strong>Largo Actual:</strong> {parseFloat(item.largo_actual).toFixed(2)} {unidad}</p>}
              
              {item.cantidad_inicial !== null && item.cantidad_inicial !== undefined && 
                <p><strong>Cantidad Inicial:</strong> {parseFloat(item.cantidad_inicial).toFixed(0)} {unidad}</p>}
              {item.cantidad_actual !== null && item.cantidad_actual !== undefined && 
                <p><strong>Cantidad Actual:</strong> {parseFloat(item.cantidad_actual).toFixed(0)} {unidad}</p>}

              <p><strong>Unidad Medida:</strong> {unidad}</p>
              <p><strong>Coste Unitario Final:</strong> {item.coste_unitario_final !== null && item.coste_unitario_final !== undefined ? parseFloat(item.coste_unitario_final).toFixed(4) + ` €/${unidad}` : 'N/A'}</p>
              <p><strong>Fecha Entrada:</strong> {fechaEntradaFormateada}</p>
              <p><strong>Factura Origen:</strong> {item.origen_factura || 'N/A'}</p>
              <p><strong>Ubicación:</strong> {item.ubicacion || 'N/A'}</p>
              <p><strong>Notas:</strong> {item.notas || 'N/A'}</p>
            </div>
          </>
        )}
        <button onClick={onClose} className="modal-close-button">Cerrar</button>
      </div>
    </div>
  );
}


function App() {
  const [stock, setStock] = useState([]);
  const [loadingStock, setLoadingStock] = useState(true);
  const [errorStock, setErrorStock] = useState(null);

  const [filtroMaterial, setFiltroMaterial] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroBusqueda, setFiltroBusqueda] = useState('');

  const [itemSeleccionado, setItemSeleccionado] = useState(null);
  const [mostrarModalDetalles, setMostrarModalDetalles] = useState(false);
  const [loadingDetalles, setLoadingDetalles] = useState(false);
  const [errorDetalles, setErrorDetalles] = useState(null);

  const opcionesMaterial = ["", "GOMA", "PVC", "FIELTRO", "MAQUINARIA", "COMPONENTE"];
  const opcionesEstado = ["", "DISPONIBLE", "EMPEZADA", "AGOTADO", "DESCATALOGADO", "RESERVADO"];

  const fetchStock = useCallback(async () => {
    setLoadingStock(true);
    setErrorStock(null);
    const params = new URLSearchParams();
    if (filtroMaterial) params.append('material_tipo', filtroMaterial);
    if (filtroEstado) params.append('status', filtroEstado);
    if (filtroBusqueda.trim() !== '') params.append('buscar', filtroBusqueda.trim());
    const queryString = params.toString();
    const apiUrl = `http://localhost:5002/api/stock${queryString ? `?${queryString}` : ''}`;
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);
      const data = await response.json();
      setStock(data);
    } catch (err) {
      setErrorStock(err.message);
      setStock([]);
    } finally {
      setLoadingStock(false);
    }
  }, [filtroMaterial, filtroEstado, filtroBusqueda]);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  const handleMaterialChange = (event) => setFiltroMaterial(event.target.value);
  const handleEstadoChange = (event) => setFiltroEstado(event.target.value);
  const handleBusquedaChange = (event) => setFiltroBusqueda(event.target.value);

  const handleVerDetalles = async (idItem, esComponente = false) => {
    const tablaItem = esComponente ? 'StockComponentes' : 'StockMateriasPrimas';
    setLoadingDetalles(true);
    setErrorDetalles(null);
    setItemSeleccionado(null); 
    setMostrarModalDetalles(true); 
    try {
      const response = await fetch(`http://localhost:5002/api/stock-item/${tablaItem}/${idItem}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error('Ítem no encontrado en el backend.');
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error del servidor: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      setItemSeleccionado(data);
    } catch (err) {
      setErrorDetalles(err.message);
    } finally {
      setLoadingDetalles(false);
    }
  };

  const cerrarModalDetalles = () => {
    setMostrarModalDetalles(false);
    setItemSeleccionado(null);
    setErrorDetalles(null);
    setLoadingDetalles(false);
  };

  const [vistaActual, setVistaActual] = useState('STOCK'); // STOCK, NACIONAL, IMPORTACION

  // Renderizado principal
  const renderVista = () => {
    switch (vistaActual) {
      case 'NACIONAL':
        return <FormularioPedidoNacional />;
      case 'IMPORTACION':
        return <FormularioPedidoImportacion />;
      case 'STOCK':
      default:
        if (loadingStock && stock.length === 0) {
          return <p>Cargando stock...</p>;
        }
        return (
          <>
            <h2>Stock Actual</h2>
            <div className="filtros-container">
              {/* ... tus filtros ... */}
              <div className="filtro-item">
                <label htmlFor="filtro-material">Material: </label>
                <select id="filtro-material" value={filtroMaterial} onChange={handleMaterialChange}>
                  {opcionesMaterial.map(opcion => (
                    <option key={opcion} value={opcion}>{opcion === "" ? "Todos" : opcion}</option>
                  ))}
                </select>
              </div>
              <div className="filtro-item">
                <label htmlFor="filtro-estado">Estado: </label>
                <select id="filtro-estado" value={filtroEstado} onChange={handleEstadoChange}>
                  {opcionesEstado.map(opcion => (
                    <option key={opcion} value={opcion}>{opcion === "" ? "Todos" : opcion}</option>
                  ))}
                </select>
              </div>
              <div className="filtro-item">
                <label htmlFor="filtro-busqueda">Buscar (Ref/Fact): </label>
                <input type="text" id="filtro-busqueda" value={filtroBusqueda} onChange={handleBusquedaChange} placeholder="Escribe para buscar..."/>
              </div>
            </div>
            
            {errorStock && !loadingStock && <p className="error-backend">Error al cargar lista de stock: {errorStock}</p>}
            {stock.length === 0 && !loadingStock && !errorStock && <p>No hay items de stock que coincidan con los filtros.</p>}
            {!errorStock && stock.length > 0 && (
              <table>
                {/* ... tu tabla de stock ... */}
                <thead>
                <tr>
                  <th>ID</th><th>Referencia</th><th>Material</th><th>Subtipo</th><th>Espesor</th>
                  <th>Ancho (mm)</th><th>Largo/Cant. Actual</th><th>Coste (€/ud)</th><th>Estado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {stock.map((item) => {
                  const esComponente = item.componente_ref || (item.material_tipo && item.material_tipo.toUpperCase() === 'COMPONENTE');
                  return (
                    <tr key={item.id} onDoubleClick={() => handleVerDetalles(item.id, esComponente)} title="Doble clic para ver detalles" style={{cursor: 'pointer'}}>
                      <td>{item.id}</td>
                      <td>{item.referencia_stock || item.componente_ref || 'N/A'}</td>
                      <td>{item.material_tipo}</td>
                      <td>{item.subtipo_material || '-'}</td>
                      <td>{item.espesor || '-'}</td>
                      <td>{item.ancho !== null && item.ancho !== undefined ? parseFloat(item.ancho).toFixed(0) : '-'}</td>
                      <td>
                        {item.largo_actual !== null && item.largo_actual !== undefined 
                          ? parseFloat(item.largo_actual).toFixed(2) + ` ${item.unidad_medida || 'm'}`
                          : (item.cantidad_actual !== null && item.cantidad_actual !== undefined 
                              ? parseFloat(item.cantidad_actual).toFixed(0) + ` ${item.unidad_medida || 'ud'}`
                              : '-')}
                      </td>
                      <td>{item.coste_unitario_final !== null && item.coste_unitario_final !== undefined ? parseFloat(item.coste_unitario_final).toFixed(4) : 'N/A'}</td>
                      <td>{item.status}</td>
                      <td>
                        <button className="details-button" onClick={() => handleVerDetalles(item.id, esComponente)}>
                          Ver Detalles
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            )}
          </>
        );
    }
  };

  return (
    <div className="container">
      <h1>Gestión de Almacén</h1>
      <nav className="app-nav">
        <button onClick={() => setVistaActual('STOCK')} disabled={vistaActual === 'STOCK'}>Ver Stock</button>
        <button onClick={() => setVistaActual('NACIONAL')} disabled={vistaActual === 'NACIONAL'}>Nuevo Pedido Nacional</button>
        <button onClick={() => setVistaActual('IMPORTACION')} disabled={vistaActual === 'IMPORTACION'}>Nuevo Pedido Importación</button>
      </nav>
      
      <div className="vista-contenido">
        {renderVista()}
      </div>

      {mostrarModalDetalles && (
        <DetalleStockModal 
          item={itemSeleccionado} 
          onClose={cerrarModalDetalles} 
          isLoading={loadingDetalles}
          error={errorDetalles}
        />
      )}
    </div>
  );
}

export default App;