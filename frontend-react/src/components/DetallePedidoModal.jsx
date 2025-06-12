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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '1000px'}}>
        {loading && <p>Cargando detalles del pedido...</p>}
        {error && <p className="error-backend">Error al cargar detalles: {error}</p>}
        
        {detallePedido && !loading && !error && (
          <>
            <h2>Detalles del Pedido: {detallePedido.pedidoInfo.numero_factura}</h2>
            
            {/* SECCIÓN DE INFORMACIÓN DEL PEDIDO MODIFICADA */}
            <div className="detalle-pedido-seccion">
              <h3>Información del Pedido</h3>
              <div className="modal-details-grid" style={{gridTemplateColumns: 'auto 1fr auto 1fr'}}>
                <p><strong>Nº Factura:</strong> {detallePedido.pedidoInfo.numero_factura}</p>
                <p><strong>Proveedor:</strong> {detallePedido.pedidoInfo.proveedor || '-'}</p>
                {/* AÑADIMOS DE NUEVO EL PORCENTAJE DE GASTOS AQUÍ */}
                <p><strong>% Gastos sobre Material:</strong> {(detallePedido.porcentajeGastos * 100).toFixed(2)} %</p>
                {detallePedido.pedidoInfo.origen_tipo === 'CONTENEDOR' && (
                  <p><strong>Valor Conversión:</strong> {detallePedido.pedidoInfo.valor_conversion}</p>
                )}
                {Object.entries(detallePedido.resumenGastos).map(([tipo, total]) => (
                    <p key={tipo}><strong>Suma {tipo}:</strong> {total.toFixed(2)} €</p>
                ))}
              </div>
            </div>

            {/* SECCIÓN DE LÍNEAS DE PEDIDO REDISEÑADA */}
            {detallePedido.lineasDetalladas && detallePedido.lineasDetalladas.length > 0 && (
              <div className="detalle-pedido-seccion">
                <h3>Líneas del Pedido</h3>
                <table className="sub-table">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Espesor</th>
                      <th>Ancho (mm)</th>
                      <th>Largo (m)</th>
                      <th>Nº Bobinas</th>
                      <th>Precio Compra (€)</th>
                      <th>Precio Compra + Gastos (€)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detallePedido.lineasDetalladas.map((linea, index) => (
                      <tr key={index}>
                        <td>{linea.familia}</td>
                        <td>{linea.espesor}</td>
                        <td>{linea.ancho}</td>
                        <td>{parseFloat(linea.largo).toFixed(2)}</td>
                        <td>{linea.numero_bobinas}</td>
                        <td>{linea.precio_sin_gastos.toFixed(4)}</td>
                        <td>{linea.precio_con_gastos.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* SECCIÓN DE DESGLOSE DE GASTOS (se mantiene igual) */}
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