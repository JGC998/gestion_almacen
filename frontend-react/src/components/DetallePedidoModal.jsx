// frontend-react/src/components/DetallePedidoModal.jsx
import { useState, useEffect, useCallback } from 'react';
import './DetallePedidoModal.css'; // Asegúrate de tener este archivo o los estilos en App.css

function DetallePedidoModal({ pedidoId, onClose }) {
  const [detallePedido, setDetallePedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDetallePedido = useCallback(async () => {
    if (!pedidoId) return;

    setLoading(true);
    setError(null);
    const apiUrl = `http://localhost:5002/api/pedidos/${pedidoId}/detalles`;
    
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.detalle || `Error del servidor: ${response.status}`);
      }
      const data = await response.json();
      setDetallePedido(data);
    } catch (err) {
      console.error(`Error al obtener detalles del pedido ${pedidoId}:`, err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pedidoId]);

  useEffect(() => {
    fetchDetallePedido();
  }, [fetchDetallePedido]);
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const userTimezoneOffset = date.getTimezoneOffset() * 60000;
      const correctedDate = new Date(date.getTime() + userTimezoneOffset);
      return correctedDate.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '800px'}}>
        {loading && <p>Cargando detalles del pedido...</p>}
        {error && <p className="error-backend">Error al cargar detalles: {error}</p>}
        
        {detallePedido && !loading && !error && (
          <>
            <h2>Detalles del Pedido: {detallePedido.pedidoInfo.numero_factura} (ID: {pedidoId})</h2>
            
            <div className="detalle-pedido-seccion">
              <h3>Información del Pedido</h3>
              <div className="modal-details-grid">
                <p><strong>Nº Factura:</strong> {detallePedido.pedidoInfo.numero_factura}</p>
                <p><strong>Proveedor:</strong> {detallePedido.pedidoInfo.proveedor || '-'}</p>
                <p><strong>Fecha Pedido:</strong> {formatDate(detallePedido.pedidoInfo.fecha_pedido)}</p>
                <p><strong>Fecha Llegada:</strong> {formatDate(detallePedido.pedidoInfo.fecha_llegada)}</p>
                <p><strong>% Gastos sobre Material:</strong> {(detallePedido.porcentajeGastos * 100).toFixed(2)}%</p>
              </div>
            </div>

            {detallePedido.stockItems && detallePedido.stockItems.length > 0 && (
              <div className="detalle-pedido-seccion">
                <h3>Items de Stock Recibidos en este Pedido</h3>
                <table className="sub-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Descripción</th>
                      <th>Lote</th>
                      <th>Cantidad Recibida</th>
                      <th>Coste Lote (€)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detallePedido.stockItems.map(item => (
                      <tr key={item.id}>
                        <td>{item.sku}</td>
                        <td>{item.descripcion}</td>
                        <td>{item.lote}</td>
                        <td>{parseFloat(item.cantidad_actual).toFixed(2)} {item.unidad_medida}</td>
                        <td>{parseFloat(item.coste_lote).toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        <button onClick={onClose} className="modal-close-button">Cerrar</button>
      </div>
    </div>
  );
}

export default DetallePedidoModal;