// frontend-react/src/ListaPedidos.jsx
import React, { useState, useEffect, useCallback } from 'react';
import DetallePedidoModal from './components/DetallePedidoModal';

function ListaPedidos({ status, onEditRequest }) {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtroProveedor, setFiltroProveedor] = useState('');
  const [selectedPedidoId, setSelectedPedidoId] = useState(null);

  const fetchPedidos = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (filtroProveedor.trim()) params.append('proveedor_like', filtroProveedor.trim());
    
    const apiUrl = `http://localhost:5002/api/pedidos?${params.toString()}`;
    
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error('Error al cargar los pedidos.');
      setPedidos(await response.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [status, filtroProveedor]);

  useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES');
  };

  const handleRowClick = (pedido) => {
    if (pedido.status === 'BORRADOR') {
        onEditRequest(pedido.id);
    } else {
        setSelectedPedidoId(pedido.id);
    }
  };

  return (
    <div className="lista-pedidos-container">
      <h2>{status === 'BORRADOR' ? 'Pedidos en Borrador' : 'Historial de Pedidos'}</h2>
      {/* ... (filtros si los necesitas) ... */}
      {loading && <p>Cargando...</p>}
      {error && <p className="error-message">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>Nº Factura</th>
            <th>Proveedor</th>
            <th>Fecha Pedido</th>
            <th>Tipo</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {pedidos.map(pedido => (
            <tr key={pedido.id} onClick={() => handleRowClick(pedido)} title={status === 'BORRADOR' ? 'Clic para editar y finalizar' : 'Doble clic para ver detalles'} style={{cursor: 'pointer'}}>
              <td>{pedido.numero_factura}</td>
              <td>{pedido.proveedor}</td>
              <td>{formatDate(pedido.fecha_pedido)}</td>
              <td>{pedido.origen_tipo}</td>
              <td><span className={`status-${pedido.status.toLowerCase()}`}>{pedido.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      {selectedPedidoId && <DetallePedidoModal pedidoId={selectedPedidoId} onClose={() => setSelectedPedidoId(null)} />}
    </div>
  );
}

export default ListaPedidos;