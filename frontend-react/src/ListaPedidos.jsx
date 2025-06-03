// frontend-react/src/components/ListaPedidos.jsx
import { useState, useEffect, useCallback } from 'react';
import DetallePedidoModal from './components/DetallePedidoModal'; // Asegúrate que la ruta sea correcta
// Asumiremos que DetallePedidoModal.jsx existirá en la misma carpeta o donde corresponda
// Lo crearemos en el siguiente paso. Por ahora, preparamos su llamada.
// import DetallePedidoModal from './DetallePedidoModal'; 

function ListaPedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estados para los filtros
  const [filtroOrigenTipo, setFiltroOrigenTipo] = useState('');
  const [filtroProveedor, setFiltroProveedor] = useState('');
  const [filtroFactura, setFiltroFactura] = useState('');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');

  // --- NUEVOS ESTADOS para el modal de detalles del pedido ---
  const [selectedPedidoId, setSelectedPedidoId] = useState(null);
  const [showDetallePedidoModal, setShowDetallePedidoModal] = useState(false);

  // --- NUEVOS ESTADOS para feedback de eliminación ---
  const [deleteMessage, setDeleteMessage] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const fetchPedidos = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDeleteMessage(''); // Limpiar mensajes de eliminación al recargar
    setDeleteError('');

    const params = new URLSearchParams();
    if (filtroOrigenTipo) params.append('origen_tipo', filtroOrigenTipo);
    if (filtroProveedor.trim()) params.append('proveedor_like', filtroProveedor.trim());
    if (filtroFactura.trim()) params.append('factura_like', filtroFactura.trim());
    if (filtroFechaDesde) params.append('fecha_pedido_desde', filtroFechaDesde);
    if (filtroFechaHasta) params.append('fecha_pedido_hasta', filtroFechaHasta);
    
    const queryString = params.toString();
    const apiUrl = `http://localhost:5002/api/pedidos${queryString ? `?${queryString}` : ''}`;
    
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.detalle || `Error del servidor: ${response.status}`);
      }
      const data = await response.json();
      setPedidos(data);
    } catch (err) {
      setError(err.message);
      setPedidos([]);
    } finally {
      setLoading(false);
    }
  }, [filtroOrigenTipo, filtroProveedor, filtroFactura, filtroFechaDesde, filtroFechaHasta]);

  useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const userTimezoneOffset = date.getTimezoneOffset() * 60000;
      const correctedDate = new Date(date.getTime() + userTimezoneOffset);
      return correctedDate.toLocaleDateString('es-ES', {
        year: 'numeric', month: '2-digit', day: '2-digit',
      });
    } catch (e) {
      return dateString;
    }
  };
  
  const handlePedidoDoubleClick = (pedidoId) => {
    setSelectedPedidoId(pedidoId);
    setShowDetallePedidoModal(true);
  };

  const handleCloseDetallePedidoModal = () => {
    setShowDetallePedidoModal(false);
    setSelectedPedidoId(null);
  };

  // --- NUEVA FUNCIÓN para eliminar un pedido ---
  const handleEliminarPedido = async (pedidoId, numeroFactura) => {
    setDeleteMessage('');
    setDeleteError('');

    // Confirmación antes de eliminar
    if (!window.confirm(`¿Estás seguro de que quieres eliminar el pedido con factura Nº ${numeroFactura} (ID: ${pedidoId})? Esta acción también eliminará los gastos y el stock asociado a este pedido.`)) {
      return;
    }

    console.log(`Intentando eliminar pedido ID: ${pedidoId}`);
    try {
      const response = await fetch(`http://localhost:5002/api/pedidos/${pedidoId}`, {
        method: 'DELETE',
      });
      const data = await response.json(); // El backend devuelve un resumen o un error
      if (!response.ok) {
        throw new Error(data.error || data.detalle || `Error del servidor: ${response.status}`);
      }
      setDeleteMessage(data.mensaje || `Pedido ID ${pedidoId} eliminado con éxito.`);
      fetchPedidos(); // Recargar la lista de pedidos
    } catch (err) {
      console.error(`Error al eliminar el pedido ${pedidoId}:`, err);
      setDeleteError(err.message);
    }
  };

  return (
    <div className="lista-pedidos-container">
      <h2>Listado de Pedidos y Contenedores</h2>

      <div className="filtros-container" style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '4px' }}>
        {/* ... (tus filtros) ... */}
        <div className="filtro-item">
          <label htmlFor="filtroOrigenTipo">Tipo Origen:</label>
          <select id="filtroOrigenTipo" value={filtroOrigenTipo} onChange={(e) => setFiltroOrigenTipo(e.target.value)}>
            <option value="">Todos</option>
            <option value="NACIONAL">NACIONAL</option>
            <option value="CONTENEDOR">CONTENEDOR</option>
          </select>
        </div>
        <div className="filtro-item">
          <label htmlFor="filtroProveedor">Proveedor:</label>
          <input type="text" id="filtroProveedor" value={filtroProveedor} onChange={(e) => setFiltroProveedor(e.target.value)} placeholder="Nombre proveedor..." />
        </div>
        <div className="filtro-item">
          <label htmlFor="filtroFactura">Nº Factura:</label>
          <input type="text" id="filtroFactura" value={filtroFactura} onChange={(e) => setFiltroFactura(e.target.value)} placeholder="Número factura..." />
        </div>
        <div className="filtro-item">
          <label htmlFor="filtroFechaDesde">Fecha Pedido Desde:</label>
          <input type="date" id="filtroFechaDesde" value={filtroFechaDesde} onChange={(e) => setFiltroFechaDesde(e.target.value)} />
        </div>
        <div className="filtro-item">
          <label htmlFor="filtroFechaHasta">Fecha Pedido Hasta:</label>
          <input type="date" id="filtroFechaHasta" value={filtroFechaHasta} onChange={(e) => setFiltroFechaHasta(e.target.value)} />
        </div>
      </div>

      {/* Mensajes de feedback para la eliminación */}
      {deleteMessage && <p className="success-message" style={{textAlign: 'center'}}>{deleteMessage}</p>}
      {deleteError && <p className="error-backend" style={{textAlign: 'center'}}>{deleteError}</p>}

      {loading && <p>Cargando pedidos...</p>}
      {error && !loading && <p className="error-backend">Error al cargar pedidos: {error}</p>} {/* Mostrar error solo si no está cargando */}
      
      {!loading && !error && pedidos.length === 0 && (
        <p>No se encontraron pedidos con los filtros aplicados.</p>
      )}

      {!loading && !error && pedidos.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nº Factura</th>
              <th>Proveedor</th>
              <th>Fecha Pedido</th>
              <th>Fecha Llegada</th>
              <th>Tipo Origen</th>
              <th>Observaciones</th>
              <th>Acciones</th> {/* <-- NUEVA COLUMNA */}
            </tr>
          </thead>
          <tbody>
            {pedidos.map(pedido => (
              <tr 
                key={pedido.id} 
                onDoubleClick={() => handlePedidoDoubleClick(pedido.id)}
                title="Doble clic para ver detalles del pedido"
                style={{cursor: 'pointer'}}
              >
                <td>{pedido.id}</td>
                <td>{pedido.numero_factura}</td>
                <td>{pedido.proveedor || '-'}</td>
                <td>{formatDate(pedido.fecha_pedido)}</td>
                <td>{formatDate(pedido.fecha_llegada)}</td>
                <td>{pedido.origen_tipo}</td>
                <td title={pedido.observaciones || ''}>
                  {(pedido.observaciones || '-').substring(0, 30)} {/* Acortado un poco más */}
                  {(pedido.observaciones && pedido.observaciones.length > 30) ? '...' : ''}
                </td>
                <td>
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Evitar que el doble clic se active también
                      handleEliminarPedido(pedido.id, pedido.numero_factura);
                    }}
                    className="action-button agotada" /* Reutilizamos clase o creamos una nueva */
                    title="Eliminar Pedido"
                    style={{backgroundColor: '#dc3545'}} /* Rojo para eliminar */
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showDetallePedidoModal && selectedPedidoId && (
        <DetallePedidoModal
          pedidoId={selectedPedidoId}
          onClose={handleCloseDetallePedidoModal}
        />
      )}
    </div>
  );
}

export default ListaPedidos;