// frontend-react/src/components/DetallePedidoModal.jsx
import React, { useState, useEffect, useCallback } from 'react';
import './DetallePedidoModal.css';

function DetallePedidoModal({ pedidoId, onClose }) {
  const [detalle, setDetalle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!pedidoId) return;
    const fetchDetalles = async () => {
        setLoading(true);
        try {
            const response = await fetch(`http://localhost:5002/api/pedidos/${pedidoId}/detalles`);
            if (!response.ok) throw new Error('No se pudieron cargar los detalles.');
            setDetalle(await response.json());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };
    fetchDetalles();
  }, [pedidoId]);

  if (loading) return <div className="modal-backdrop"><div className="modal-content"><p>Cargando detalles...</p></div></div>;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '1000px'}}>
        {error && <p className="error-message">{error}</p>}
        {detalle && (
          <>
            <h2>Detalles del Pedido: {detalle.pedidoInfo.numero_factura}</h2>
            
            <div className="detalle-pedido-seccion">
              <h3>Información del Pedido</h3>
              <div className="modal-details-grid">
                <p><strong>Proveedor:</strong> {detalle.pedidoInfo.proveedor}</p>
                <p><strong>Fecha:</strong> {new Date(detalle.pedidoInfo.fecha_pedido).toLocaleDateString('es-ES')}</p>
                <p><strong>Tipo:</strong> {detalle.pedidoInfo.origen_tipo}</p>
                <p><strong>% Gastos:</strong> {(detalle.porcentajeGastos * 100).toFixed(2)} %</p>
                {detalle.pedidoInfo.valor_conversion && <p><strong>Conversión:</strong> {detalle.pedidoInfo.valor_conversion}</p>}
              </div>
            </div>

            <div className="detalle-pedido-seccion">
              <h3>Líneas del Pedido</h3>
              <table className="sub-table">
                <thead>
                  <tr>
                    <th>Descripción</th>
                    <th>Características</th>
                    <th>Nº Bobinas</th>
                    <th>Largo (m)</th>
                    <th>Precio Compra (€)</th>
                    <th>Precio Final (€)</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.lineasDetalladas.map((linea, index) => (
                    <tr key={index}>
                      <td>{linea.descripcion}</td>
                      <td>{linea.atributos}</td>
                      <td>{linea.cantidad_bobinas}</td>
                      <td>{linea.metros_por_bobina.toFixed(2)}</td>
                      <td>{linea.precio_sin_gastos.toFixed(4)}</td>
                      <td>{linea.precio_con_gastos.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="detalle-pedido-seccion">
              <h3>Desglose de Gastos</h3>
              <table className="sub-table">
                <thead><tr><th>Descripción</th><th>Tipo</th><th>Coste (€)</th></tr></thead>
                <tbody>
                  {detalle.gastos.map(gasto => (
                    <tr key={gasto.id}>
                      <td>{gasto.descripcion}</td>
                      <td>{gasto.tipo_gasto}</td>
                      <td>{gasto.coste_eur.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={onClose} className="modal-close-button">Cerrar</button>
          </>
        )}
      </div>
    </div>
  );
}

export default DetallePedidoModal;