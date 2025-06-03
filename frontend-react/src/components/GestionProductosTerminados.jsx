// frontend-react/src/components/GestionStockProductosTerminados.jsx
import React, { useState, useEffect, useCallback } from 'react';
import '../App.css'; // Reutiliza estilos generales de App.css

function GestionStockProductosTerminados() {
  const [stockPT, setStockPT] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const fetchStockPT = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:5002/api/stock-productos-terminados');
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error del servidor: ${response.status}`);
      }
      const data = await response.json();
      setStockPT(data);
    } catch (err) {
      console.error("Error al obtener stock de productos terminados:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStockPT();
  }, [fetchStockPT]);

  const handleDelete = async (id, referencia) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar este ítem de stock de producto terminado "${referencia}" (ID: ${id})? Esta acción es irreversible.`)) {
      return;
    }
    setLoading(true);
    setSuccessMessage('');
    setError(null);
    try {
      const response = await fetch(`http://localhost:5002/api/stock-productos-terminados/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${response.status}`);
      }
      setSuccessMessage(data.mensaje);
      fetchStockPT();
    } catch (err) {
      console.error("Error al eliminar stock de producto terminado:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
    <div className="gestion-stock-pt-container">
      <h2>Stock de Productos Terminados</h2>

      {error && <p className="error-message">{error}</p>}
      {successMessage && <p className="success-message">{successMessage}</p>}

      {loading && <p>Cargando stock de productos terminados...</p>}
      {!loading && !error && stockPT.length === 0 && <p>No hay stock de productos terminados.</p>}
      {!loading && !error && stockPT.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>ID Stock</th>
              <th>Referencia Producto</th>
              <th>Nombre Producto</th>
              <th>Cantidad Actual</th>
              <th>Unidad</th>
              <th>Coste Unit. Final (€)</th>
              <th>Fecha Entrada</th>
              <th>Estado</th>
              <th>Ubicación</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {stockPT.map(item => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.producto_referencia}</td>
                <td>{item.producto_nombre}</td>
                <td>{parseFloat(item.cantidad_actual).toFixed(2)}</td>
                <td>{item.unidad_medida}</td>
                <td>{parseFloat(item.coste_unitario_final).toFixed(4)}</td>
                <td>{formatDate(item.fecha_entrada_almacen)}</td>
                <td>{item.status}</td>
                <td>{item.ubicacion || '-'}</td>
                <td>
                  <button onClick={() => handleDelete(item.id, item.producto_referencia)} className="action-button agotada" style={{backgroundColor: '#dc3545'}}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default GestionStockProductosTerminados;
