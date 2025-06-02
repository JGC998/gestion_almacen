// frontend-react/src/App.jsx
import { useState, useEffect, useCallback } from 'react';
import './App.css';
import FormularioPedidoNacional from './components/FormularioPedidoNacional.jsx';
import FormularioPedidoImportacion from './components/FormularioPedidoImportacion.jsx';
import ListaPedidos from './ListaPedidos.jsx';

// --- Componente Modal Simple para Detalles del Stock (sin cambios respecto a la versión anterior) ---
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
  const [stockList, setStockList] = useState([]); // Lista plana de todas las bobinas para mostrar
  const [loadingStock, setLoadingStock] = useState(true);
  const [errorStock, setErrorStock] = useState(null);

  const [filtroMaterial, setFiltroMaterial] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroBusqueda, setFiltroBusqueda] = useState('');

  const [itemSeleccionadoParaModal, setItemSeleccionadoParaModal] = useState(null);
  const [mostrarModalDetalles, setMostrarModalDetalles] = useState(false);
  // isLoadingDetalles y errorDetalles se mantienen por si el modal los usa, aunque ahora no hacemos fetch para el modal
  const [loadingDetalles, setLoadingDetalles] = useState(false); 
  const [errorDetalles, setErrorDetalles] = useState(null);

  const opcionesMaterial = ["", "GOMA", "PVC", "FIELTRO", "MAQUINARIA", "COMPONENTE"];
  const opcionesEstado = ["", "DISPONIBLE", "EMPEZADA", "AGOTADO", "DESCATALOGADO"];

  

  const fetchStockAndProcess = useCallback(async () => {
    setLoadingStock(true);
    setErrorStock(null);
    const apiUrl = `http://localhost:5002/api/stock`; // Trae todas las bobinas
    console.log("Llamando a la API (stock total para lista plana):", apiUrl);
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);
      let data = await response.json(); // data es la lista de todas las bobinas

      // 1. Filtrar
      data = data.filter(bobina => {
        let pasaFiltroMaterial = true;
        let pasaFiltroEstado = true;
        let pasaFiltroBusqueda = true;

        if (filtroMaterial) {
            pasaFiltroMaterial = bobina.material_tipo?.toUpperCase() === filtroMaterial.toUpperCase();
        }
        if (filtroEstado) {
            pasaFiltroEstado = bobina.status?.toUpperCase() === filtroEstado.toUpperCase();
        }
        if (filtroBusqueda.trim() !== '') {
            const termino = filtroBusqueda.trim().toUpperCase();
            pasaFiltroBusqueda = bobina.referencia_stock?.toUpperCase().includes(termino) ||
                                 bobina.subtipo_material?.toUpperCase().includes(termino) ||
                                 bobina.origen_factura?.toUpperCase().includes(termino) ||
                                 bobina.espesor?.toUpperCase().includes(termino) ||
                                 bobina.color?.toUpperCase().includes(termino) || // Añadido color a la búsqueda
                                 bobina.ubicacion?.toUpperCase().includes(termino); // Añadida ubicación a la búsqueda
        }
        return pasaFiltroMaterial && pasaFiltroEstado && pasaFiltroBusqueda;
      });

      // 2. Ordenar
      data.sort((a, b) => {
        const materialA = a.material_tipo || '';
        const materialB = b.material_tipo || '';
        if (materialA.localeCompare(materialB) !== 0) {
            return materialA.localeCompare(materialB);
        }
        // Opcional: sub-ordenación por referencia_stock si los materiales son iguales
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
  }, [filtroMaterial, filtroEstado, filtroBusqueda]); // Depende de los filtros para re-ejecutar

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

  const [vistaActual, setVistaActual] = useState('STOCK'); 

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
        if (loadingStock) {
          return <p>Cargando stock...</p>;
        }
        if (errorStock) {
          return <p className="error-backend">Error al cargar lista de stock: {errorStock}</p>;
        }
        if (stockList.length === 0) {
          return <p>No hay bobinas de stock que coincidan con los filtros o no hay stock.</p>;
        }
        return (
          <>
            <h2>Stock Actual (Bobinas Individuales)</h2>
            <div className="filtros-container">
              <div className="filtro-item">
                <label htmlFor="filtro-material">Material: </label>
                <select id="filtro-material" value={filtroMaterial} onChange={handleMaterialChange}>
                  {opcionesMaterial.map(opcion => ( <option key={opcion} value={opcion}>{opcion === "" ? "Todos" : opcion}</option> ))}
                </select>
              </div>
              <div className="filtro-item">
                <label htmlFor="filtro-estado">Estado Bobina: </label>
                <select id="filtro-estado" value={filtroEstado} onChange={handleEstadoChange}>
                  {opcionesEstado.map(opcion => ( <option key={opcion} value={opcion}>{opcion === "" ? "Todos" : opcion}</option> ))}
                </select>
              </div>
              <div className="filtro-item">
                <label htmlFor="filtro-busqueda">Buscar (Ref/Subt/Fact/Color...): </label>
                <input type="text" id="filtro-busqueda" value={filtroBusqueda} onChange={handleBusquedaChange} placeholder="Escribe para buscar..."/>
              </div>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>ID Bobina</th>
                  <th>Referencia Prod.</th>
                  <th>Material</th>
                  <th>Subtipo</th>
                  <th>Espesor</th>
                  <th>Ancho (mm)</th>
                  <th>Largo Actual</th>
                  <th>Coste Compra (€/ud)</th>
                  <th>Estado Bobina</th>
                  <th>Fecha Entrada</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {stockList.map((bobina) => (
                  <tr key={bobina.id}>
                    <td>{bobina.id}</td>
                    <td>{bobina.referencia_stock}</td>
                    <td>{bobina.material_tipo}</td>
                    <td>{bobina.subtipo_material || '-'}</td>
                    <td>{bobina.espesor || '-'}</td>
                    <td>{bobina.ancho !== null && bobina.ancho !== undefined ? parseFloat(bobina.ancho).toFixed(0) : '-'}</td>
                    <td>{parseFloat(bobina.largo_actual || 0).toFixed(2)} {bobina.unidad_medida || 'm'}</td>
                    <td>{bobina.coste_unitario_final !== null && bobina.coste_unitario_final !== undefined ? parseFloat(bobina.coste_unitario_final).toFixed(4) : 'N/A'}</td>
                    <td>{bobina.status}</td>
                    <td>{bobina.fecha_entrada_almacen ? new Date(bobina.fecha_entrada_almacen).toLocaleDateString('es-ES') : 'N/A'}</td>
                    <td>
                      <button 
                        className="details-button"
                        onClick={() => handleVerDetallesBobina(bobina)}
                      >
                        Ver Detalles
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        );
    } // Fin del switch
  }; // Fin de renderVista

  // EL BLOQUE DUPLICADO QUE ESTABA AQUÍ DEBE SER ELIMINADO

  return ( // Este es el único return principal del componente App
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
} // Fin del componente App

export default App;