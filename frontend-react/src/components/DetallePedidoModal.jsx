// frontend-react/src/components/DetallePedidoModal.jsx
import { useState, useEffect, useCallback } from 'react';
import './DetallePedidoModal.css';

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
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '950px'}}>
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
                <p><strong>% Gastos sobre Material:</strong> {(detallePedido.porcentajeGastos * 100).toFixed(2)}%</p>
              </div>
            </div>

            {/* --- NUEVA SECCIÓN DE DESGLOSE DE LÍNEAS --- */}
            {detallePedido.lineasDetalladas && detallePedido.lineasDetalladas.length > 0 && (
              <div className="detalle-pedido-seccion">
                <h3>Desglose de Líneas de Compra</h3>
                <table className="sub-table">
                  <thead>
                    <tr>
                      <th>Descripción Material</th>
                      <th>Cantidad</th>
                      <th>Precio Compra / m</th>
                      <th>Coste Final / m (con gastos)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detallePedido.lineasDetalladas.map((linea, index) => (
                      <tr key={`linea-${index}`}>
                        <td>{linea.descripcion}</td>
                        <td>{parseFloat(linea.cantidad_original).toFixed(2)} m</td>
                        <td>{parseFloat(linea.precio_unitario_original).toFixed(4)} {linea.moneda_original}</td>
                        <td>{parseFloat(linea.coste_final_unitario).toFixed(4)} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {detallePedido.stockItems && detallePedido.stockItems.length > 0 && (
              <div className="detalle-pedido-seccion">
                <h3>Items de Stock Generados</h3>
                <table className="sub-table">
                  <thead>
                    <tr>
                      <th>Referencia (SKU)</th>
                      <th>Descripción</th>
                      <th>Lote</th>
                      <th>Cantidad Recibida</th>
                      <th>Coste Lote (€)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detallePedido.stockItems.map(item => (
                      <tr key={`stock-${item.id}`}>
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

            {detallePedido.gastos && detallePedido.gastos.length > 0 && (
              <div className="detalle-pedido-seccion">
                <h3>Desglose de Gastos</h3>
                <table className="sub-table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Descripción</th>
                      <th>Coste (€)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detallePedido.gastos.map(gasto => (
                      <tr key={`gasto-${gasto.id}`}>
                        <td>{gasto.tipo_gasto}</td>
                        <td>{gasto.descripcion}</td>
                        <td>{parseFloat(gasto.coste_eur).toFixed(2)}</td>
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