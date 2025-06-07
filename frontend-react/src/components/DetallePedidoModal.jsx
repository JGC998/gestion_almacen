// frontend-react/src/components/DetallePedidoModal.jsx
import { useState, useEffect, useCallback } from 'react';

function DetallePedidoModal({ pedidoId, onClose }) {
  const [detallePedido, setDetallePedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDetallePedido = useCallback(async () => {
    if (!pedidoId) return;

    setLoading(true);
    setError(null);
    const apiUrl = `http://localhost:5002/api/pedidos/${pedidoId}/detalles`;
    console.log("Llamando a API para detalles del pedido:", apiUrl);

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
      setDetallePedido(null);
    } finally {
      setLoading(false);
    }
  }, [pedidoId]);

  useEffect(() => {
    fetchDetallePedido();
  }, [fetchDetallePedido]);
  
  const formatDate = (dateString, includeTime = false) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const userTimezoneOffset = date.getTimezoneOffset() * 60000;
      const correctedDate = new Date(date.getTime() + userTimezoneOffset);
      
      const options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      };
      if (includeTime) {
        options.hour = '2-digit';
        options.minute = '2-digit';
      }
      return correctedDate.toLocaleDateString('es-ES', options);
    } catch (e) {
      return dateString;
    }
  };

  // Reutilizar estilos de modal de App.css para el contenedor principal
  // .modal-backdrop y .modal-content
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
                <p><strong>Tipo Origen:</strong> {detallePedido.pedidoInfo.origen_tipo}</p>
                {detallePedido.pedidoInfo.origen_tipo === 'CONTENEDOR' && (
                  <p><strong>Valor Conversión:</strong> {detallePedido.pedidoInfo.valor_conversion}</p>
                )}
                {/* Añadimos el porcentaje de gastos aquí */}
                {detallePedido.porcentajeGastos !== undefined && (
                  <p><strong>% Gastos sobre Material:</strong> {(detallePedido.porcentajeGastos * 100).toFixed(2)}%</p>
                )}
                <p><strong>Observaciones:</strong> {detallePedido.pedidoInfo.observaciones || '-'}</p>
              </div>
            </div>

            {detallePedido.gastos && detallePedido.gastos.length > 0 && (
              <div className="detalle-pedido-seccion">
                <h3>Gastos del Pedido</h3>
                <table className="sub-table" style={{fontSize: '0.9em'}}>
                  <thead>
                    <tr>
                      <th>ID Gasto</th>
                      <th>Tipo</th>
                      <th>Descripción</th>
                      <th>Coste (€)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detallePedido.gastos.map(gasto => (
                      <tr key={gasto.id}>
                        <td>{gasto.id}</td>
                        <td>{gasto.tipo_gasto}</td>
                        <td>{gasto.descripcion}</td>
                        <td>{parseFloat(gasto.coste_eur).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {detallePedido.stockItems && detallePedido.stockItems.length > 0 && (
              <div className="detalle-pedido-seccion">
                <h3>Bobinas/Items de Stock del Pedido</h3>
                <table className="sub-table" style={{fontSize: '0.85em'}}>
                  <thead>
                    <tr>
                      <th>ID Stock</th>
                      <th>Referencia</th>
                      <th>Subtipo</th>
                      <th>Espesor</th>
                      <th>Ancho</th>
                      <th>Color</th>
                      <th>Largo Inicial</th>
                      <th>Largo Actual</th>
                      <th>Precio m. lineal</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detallePedido.stockItems.map(item => (
                      <tr key={item.id}>
                        <td>{item.id}</td>
                        <td>{item.referencia_stock}</td>
                        <td>{item.subtipo_material || '-'}</td>
                        <td>{item.espesor || '-'}</td>
                        <td>{item.ancho ? parseFloat(item.ancho).toFixed(0) : '-'} mm</td>
                        <td>{item.color || '-'}</td>
                        <td>{parseFloat(item.largo_inicial).toFixed(2)} {item.unidad_medida}</td>
                        <td>{parseFloat(item.largo_actual).toFixed(2)} {item.unidad_medida}</td>
                        <td>{parseFloat(item.coste_unitario_final).toFixed(4)} €/m</td>
                        <td>{item.status}</td>
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