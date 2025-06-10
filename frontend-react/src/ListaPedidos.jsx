// frontend-react/src/ListaPedidos.jsx
import { useState, useEffect, useCallback } from 'react';
import DetallePedidoModal from './components/DetallePedidoModal';

function ListaPedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estados para los filtros
  const [filtroOrigenTipo, setFiltroOrigenTipo] = useState('');
  const [filtroProveedor, setFiltroProveedor] = useState('');
  const [filtroFactura, setFiltroFactura] = useState('');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  // Se elimina el estado para filtroFechaHasta

  const [selectedPedidoId, setSelectedPedidoId] = useState(null);
  const [showDetallePedidoModal, setShowDetallePedidoModal] = useState(false);

  const [deleteMessage, setDeleteMessage] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const fetchPedidos = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDeleteMessage('');
    setDeleteError('');

    const params = new URLSearchParams();
    if (filtroOrigenTipo) params.append('origen_tipo', filtroOrigenTipo);
    if (filtroProveedor.trim()) params.append('proveedor_like', filtroProveedor.trim());
    if (filtroFactura.trim()) params.append('factura_like', filtroFactura.trim());
    if (filtroFechaDesde) params.append('fecha_pedido_desde', filtroFechaDesde);
    
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
  }, [filtroOrigenTipo, filtroProveedor, filtroFactura, filtroFechaDesde]);

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

  const handleEliminarPedido = async (pedidoId, numeroFactura) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar el pedido con factura Nº ${numeroFactura} (ID: ${pedidoId})? Esta acción también eliminará los gastos y el stock asociado a este pedido.`)) {
      return;
    }
    try {
      const response = await fetch(`http://localhost:5002/api/pedidos/${pedidoId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.detalle || `Error del servidor: ${response.status}`);
      }
      setDeleteMessage(data.mensaje || `Pedido ID ${pedidoId} eliminado con éxito.`);
      fetchPedidos();
    } catch (err) {
      console.error(`Error al eliminar el pedido ${pedidoId}:`, err);
      setDeleteError(err.message);
    }
  };

  return (
    <div className="lista-pedidos-container">
      <h2>Listado de Pedidos y Contenedores</h2>

      <div className="filtros-container" style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '4px' }}>
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
          <label htmlFor="filtroFechaDesde">Filtrar Pedidos Desde:</label>
          <input type="date" id="filtroFechaDesde" value={filtroFechaDesde} onChange={(e) => setFiltroFechaDesde(e.target.value)} />
        </div>
      </div>

      {deleteMessage && <p className="success-message" style={{textAlign: 'center'}}>{deleteMessage}</p>}
      {deleteError && <p className="error-backend" style={{textAlign: 'center'}}>{deleteError}</p>}

      {loading && <p>Cargando pedidos...</p>}
      {error && !loading && <p className="error-backend">Error al cargar pedidos: {error}</p>}
      
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
              <th>Tipo Origen</th>
              <th>Observaciones</th>
              <th>Acciones</th>
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
                <td>{pedido.origen_tipo}</td>
                <td title={pedido.observaciones || ''}>
                  {(pedido.observaciones || '-').substring(0, 30)}
                  {(pedido.observaciones && pedido.observaciones.length > 30) ? '...' : ''}
                </td>
                <td>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEliminarPedido(pedido.id, pedido.numero_factura);
                    }}
                    className="action-button agotada"
                    title="Eliminar Pedido"
                    style={{backgroundColor: '#dc3545'}}
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