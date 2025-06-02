// frontend-react/src/App.jsx
import { useState, useEffect, useCallback } from 'react';
import './App.css';
import FormularioPedidoNacional from './components/FormularioPedidoNacional.jsx';
import FormularioPedidoImportacion from './components/FormularioPedidoImportacion.jsx';
import ListaPedidos from './ListaPedidos.jsx'; 


// --- Componente Modal Simple para Detalles del Stock (Bobina) ---
function DetalleStockModal({ item, onClose, isLoading, error }) {
  // ... (código del modal DetalleStockModal como lo tenías en la respuesta #38)
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
            <h2>Detalles de la Bobina (ID: {item.id})</h2>
            <div className="modal-details-grid">
              <p><strong>Referencia Producto:</strong> {item.referencia_stock || 'N/A'}</p>
              <p><strong>Material Principal:</strong> {item.material_tipo || 'N/A'}</p>
              {item.subtipo_material && <p><strong>Subtipo/Variante:</strong> {item.subtipo_material}</p>}
              {item.espesor && <p><strong>Espesor:</strong> {item.espesor}</p>}
              {item.ancho !== null && item.ancho !== undefined && <p><strong>Ancho (mm):</strong> {parseFloat(item.ancho).toFixed(0)}</p>}
              {item.color && <p><strong>Color:</strong> {item.color}</p>}
              <p><strong>Estado Bobina:</strong> {item.status || 'N/A'}</p>
              {item.largo_inicial !== null && item.largo_inicial !== undefined && 
                <p><strong>Largo Inicial Bobina:</strong> {parseFloat(item.largo_inicial).toFixed(2)} {unidad}</p>}
              {item.largo_actual !== null && item.largo_actual !== undefined && 
                <p><strong>Largo Actual Bobina:</strong> {parseFloat(item.largo_actual).toFixed(2)} {unidad}</p>}
              <p><strong>Unidad Medida:</strong> {unidad}</p>
              <p><strong>Coste Unit. Bobina (Compra):</strong> {item.coste_unitario_final !== null && item.coste_unitario_final !== undefined ? parseFloat(item.coste_unitario_final).toFixed(4) + ` €/${unidad}` : 'N/A'}</p>
              <p><strong>Fecha Entrada Bobina:</strong> {fechaEntradaFormateada}</p>
              <p><strong>Factura Origen Bobina:</strong> {item.origen_factura || 'N/A'}</p>
              <p><strong>Pedido ID Origen:</strong> {item.pedido_id || 'N/A'}</p>
              <p><strong>Ubicación:</strong> {item.ubicacion || 'N/A'}</p>
              <p><strong>Notas Bobina:</strong> {item.notas || 'N/A'}</p>
            </div>
          </>
        )}
        <button onClick={onClose} className="modal-close-button">Cerrar</button>
      </div>
    </div>
  );
}


function App() {
  const [stockList, setStockList] = useState([]);
  const [loadingStock, setLoadingStock] = useState(true);
  const [errorStock, setErrorStock] = useState(null);

  const [filtroMaterial, setFiltroMaterial] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroBusqueda, setFiltroBusqueda] = useState('');

  const [itemSeleccionadoParaModal, setItemSeleccionadoParaModal] = useState(null);
  const [mostrarModalDetalles, setMostrarModalDetalles] = useState(false);
  const [loadingDetalles, setLoadingDetalles] = useState(false); 
  const [errorDetalles, setErrorDetalles] = useState(null);
  
  const [vistaActual, setVistaActual] = useState('STOCK');
  // Para mensajes de feedback de la actualización de estado
  const [updateStatusMessage, setUpdateStatusMessage] = useState('');
  const [updateStatusError, setUpdateStatusError] = useState('');


  const opcionesMaterial = ["", "GOMA", "PVC", "FIELTRO", "MAQUINARIA", "COMPONENTE"];
  const opcionesEstado = ["", "DISPONIBLE", "EMPEZADA", "AGOTADO", "DESCATALOGADO"];

  const fetchStockAndProcess = useCallback(async () => {
    // ... (tu función fetchStockAndProcess de la respuesta #38, sin cambios en su lógica interna) ...
    setLoadingStock(true);
    setErrorStock(null);
    // Limpiar mensajes de actualización de estado al recargar el stock
    setUpdateStatusMessage('');
    setUpdateStatusError('');

    const apiUrl = `http://localhost:5002/api/stock`;
    console.log("Llamando a la API (stock total para lista plana):", apiUrl);
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);
      let data = await response.json();

      data = data.filter(bobina => {
        let pasaFiltroMaterial = true;
        let pasaFiltroEstado = true;
        let pasaFiltroBusqueda = true;
        if (filtroMaterial) pasaFiltroMaterial = bobina.material_tipo?.toUpperCase() === filtroMaterial.toUpperCase();
        if (filtroEstado) pasaFiltroEstado = bobina.status?.toUpperCase() === filtroEstado.toUpperCase();
        if (filtroBusqueda.trim() !== '') {
            const termino = filtroBusqueda.trim().toUpperCase();
            pasaFiltroBusqueda = bobina.referencia_stock?.toUpperCase().includes(termino) ||
                                 bobina.subtipo_material?.toUpperCase().includes(termino) ||
                                 bobina.origen_factura?.toUpperCase().includes(termino) ||
                                 bobina.espesor?.toUpperCase().includes(termino) ||
                                 bobina.color?.toUpperCase().includes(termino) ||
                                 bobina.ubicacion?.toUpperCase().includes(termino);
        }
        return pasaFiltroMaterial && pasaFiltroEstado && pasaFiltroBusqueda;
      });
      data.sort((a, b) => {
        const materialA = a.material_tipo || '';
        const materialB = b.material_tipo || '';
        if (materialA.localeCompare(materialB) !== 0) return materialA.localeCompare(materialB);
        const refA = a.referencia_stock || '';
        const refB = b.referencia_stock || '';
        return refA.localeCompare(refB);
      });
      setStockList(data);
    } catch (err) {
      console.error("Error al obtener y procesar el stock:", err);
      setErrorStock(err.message);
      setStockList([]);
    } finally {
      setLoadingStock(false);
    }
  }, [filtroMaterial, filtroEstado, filtroBusqueda]);

  useEffect(() => {
    fetchStockAndProcess();
  }, [fetchStockAndProcess]);

  const handleMaterialChange = (event) => setFiltroMaterial(event.target.value);
  const handleEstadoChange = (event) => setFiltroEstado(event.target.value);
  const handleBusquedaChange = (event) => setFiltroBusqueda(event.target.value);

  const handleVerDetallesBobina = (bobina) => {
    setItemSeleccionadoParaModal(bobina);
    setMostrarModalDetalles(true);
  };

  const cerrarModalDetalles = () => {
    setMostrarModalDetalles(false);
    setItemSeleccionadoParaModal(null);
  };

  // --- NUEVA FUNCIÓN para cambiar el estado del stock ---
  const handleChangeStockStatus = async (stockItemId, nuevoEstado) => {
    setUpdateStatusMessage(''); // Limpiar mensajes anteriores
    setUpdateStatusError('');

    console.log(`Intentando cambiar estado del item ${stockItemId} a ${nuevoEstado}`);
    try {
      const response = await fetch(`http://localhost:5002/api/stock-items/${stockItemId}/estado`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: nuevoEstado }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.detalle || `Error del servidor: ${response.status}`);
      }
      setUpdateStatusMessage(data.mensaje || `Estado del item ${stockItemId} actualizado con éxito.`);
      fetchStockAndProcess(); // Recargar la lista de stock para ver el cambio
    } catch (err) {
      console.error(`Error al cambiar estado del item ${stockItemId}:`, err);
      setUpdateStatusError(err.message);
    }
  };


  const renderVista = () => {
    switch (vistaActual) {
      case 'NACIONAL':
        return <FormularioPedidoNacional />;
      case 'LISTA_PEDIDOS':
        return <ListaPedidos />;
      case 'IMPORTACION':
        return <FormularioPedidoImportacion />;
      case 'STOCK':
      default:
        if (loadingStock) return <p>Cargando stock...</p>;
        if (errorStock) return <p className="error-backend">Error al cargar lista de stock: {errorStock}</p>;
        
        return (
          <>
            <h2>Stock Actual (Bobinas Individuales)</h2>
            {/* Mensajes de feedback para la actualización de estado */}
            {updateStatusMessage && <p className="success-message" style={{textAlign: 'center'}}>{updateStatusMessage}</p>}
            {updateStatusError && <p className="error-backend" style={{textAlign: 'center'}}>{updateStatusError}</p>}

            <div className="filtros-container">
              {/* ... (tus filtros existentes) ... */}
              <div className="filtro-item">
                <label htmlFor="filtro-material">Material: </label>
                <select id="filtro-material" value={filtroMaterial} onChange={handleMaterialChange}>
                  {opcionesMaterial.map(opcion => ( <option key={opcion} value={opcion}>{opcion === "" ? "Todos" : opcion}</option>))}
                </select>
              </div>
              <div className="filtro-item">
                <label htmlFor="filtro-estado">Estado Bobina: </label>
                <select id="filtro-estado" value={filtroEstado} onChange={handleEstadoChange}>
                  {opcionesEstado.map(opcion => ( <option key={opcion} value={opcion}>{opcion === "" ? "Todos" : opcion}</option>))}
                </select>
              </div>
              <div className="filtro-item">
                <label htmlFor="filtro-busqueda">Buscar (Ref/Subt/Fact/Color...): </label>
                <input type="text" id="filtro-busqueda" value={filtroBusqueda} onChange={handleBusquedaChange} placeholder="Escribe para buscar..."/>
              </div>
            </div>
            
            {stockList.length === 0 && <p>No hay bobinas de stock que coincidan con los filtros o no hay stock.</p>}
            
            {stockList.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Referencia Prod.</th>
                    <th>Material</th>
                    <th>Subtipo</th>
                    <th>Largo Actual</th>
                    <th>Estado Bobina</th>
                    <th>Acciones Estado</th> {/* Nueva Columna */}
                    <th>Ver Detalles</th>
                  </tr>
                </thead>
                <tbody>
                  {stockList.map((bobina) => (
                    <tr key={bobina.id}>
                      <td>{bobina.id}</td>
                      <td>{bobina.referencia_stock}</td>
                      <td>{bobina.material_tipo}</td>
                      <td>{bobina.subtipo_material || '-'}</td>
                      <td>{parseFloat(bobina.largo_actual || 0).toFixed(2)} {bobina.unidad_medida || 'm'}</td>
                      <td>{bobina.status}</td>
                      <td> {/* Acciones para cambiar estado */}
                        {bobina.status === 'DISPONIBLE' && (
                          <button 
                            onClick={() => handleChangeStockStatus(bobina.id, 'EMPEZADA')}
                            className="action-button empezada" 
                            title="Marcar como Empezada"
                          >
                            Empezar
                          </button>
                        )}
                        {bobina.status === 'EMPEZADA' && (
                          <button 
                            onClick={() => handleChangeStockStatus(bobina.id, 'AGOTADO')}
                            className="action-button agotada"
                            title="Marcar como Agotada"
                          >
                            Agotar
                          </button>
                        )}
                        {/* Podrías añadir un botón para volver a 'DISPONIBLE' desde 'AGOTADO' si es necesario */}
                        {/* {bobina.status === 'AGOTADO' && (
                          <button onClick={() => handleChangeStockStatus(bobina.id, 'DISPONIBLE')}>Reactivar</button>
                        )} */}
                      </td>
                      <td>
                        <button 
                          className="details-button"
                          onClick={() => handleVerDetallesBobina(bobina)}
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
    <div className="container">
      <h1>Gestión de Almacén</h1>
      <nav className="app-nav">
        <button onClick={() => setVistaActual('STOCK')} disabled={vistaActual === 'STOCK'}>Ver Stock</button>
        <button onClick={() => setVistaActual('LISTA_PEDIDOS')} disabled={vistaActual === 'LISTA_PEDIDOS'}>Ver Pedidos</button>
        <button onClick={() => setVistaActual('NACIONAL')} disabled={vistaActual === 'NACIONAL'}>Nuevo Pedido Nacional</button>
        <button onClick={() => setVistaActual('IMPORTACION')} disabled={vistaActual === 'IMPORTACION'}>Nuevo Pedido Importación</button>
      </nav>
      
      <div className="vista-contenido">
        {renderVista()}
      </div>

      {mostrarModalDetalles && (
        <DetalleStockModal 
          item={itemSeleccionadoParaModal} 
          onClose={cerrarModalDetalles} 
          isLoading={loadingDetalles} 
          error={errorDetalles}     
        />
      )}
    </div>
  );
}

export default App;