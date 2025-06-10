// frontend-react/src/components/GestionOrdenesProduccion.jsx
import React, { useState, useEffect, useCallback } from 'react';
import '../App.css'; // Reutiliza estilos generales de App.css
import GestionProduccion from './GestionProduccion.jsx';

function GestionOrdenesProduccion() {
  const [ordenes, setOrdenes] = useState([]);
  const [productosTerminados, setProductosTerminados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [currentOrden, setCurrentOrden] = useState({
    id: null,
    producto_terminado_id: '',
    cantidad_a_producir: '',
    fecha: new Date().toISOString().split('T')[0], // Un solo campo de fecha
    observaciones: ''
    // status se elimina de la UI
  });

  const fetchDependencies = useCallback(async () => {
    try {
      const productosRes = await fetch('http://localhost:5002/api/productos-terminados');
      if (!productosRes.ok) throw new Error(`Error al cargar productos: ${productosRes.status}`);
      const productosData = await productosRes.json();
      setProductosTerminados(productosData);
    } catch (err) {
      console.error("Error al cargar dependencias para órdenes de producción:", err);
      setError(err.message);
    }
  }, []);

  const fetchOrdenes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:5002/api/ordenes-produccion');
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error del servidor: ${response.status}`);
      }
      const data = await response.json();
      setOrdenes(data);
    } catch (err) {
      console.error("Error al obtener órdenes de producción:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDependencies();
    fetchOrdenes();
  }, [fetchDependencies, fetchOrdenes]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCurrentOrden(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (orden) => {
    setCurrentOrden({
      ...orden,
      cantidad_a_producir: parseFloat(orden.cantidad_a_producir).toFixed(2),
      fecha: orden.fecha ? new Date(orden.fecha).toISOString().split('T')[0] : '', // Usar el campo 'fecha'
      // fecha_fin y status se eliminan de la UI
    });
    setEditMode(true);
    setSuccessMessage('');
    setError(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar esta Orden de Producción (ID: ${id})? Esta acción es irreversible.`)) {
      return;
    }
    setLoading(true);
    setSuccessMessage('');
    setError(null);
    try {
      const response = await fetch(`http://localhost:5002/api/ordenes-produccion/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${response.status}`);
      }
      setSuccessMessage(data.mensaje);
      fetchOrdenes();
    } catch (err) {
      console.error("Error al eliminar orden de producción:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage('');
    setError(null);

    const payload = {
      ...currentOrden,
      producto_terminado_id: parseInt(currentOrden.producto_terminado_id),
      cantidad_a_producir: parseFloat(currentOrden.cantidad_a_producir),
      // status se elimina del payload
    };

    const method = editMode ? 'PUT' : 'POST';
    const url = editMode
      ? `http://localhost:5002/api/ordenes-produccion/${currentOrden.id}`
      : 'http://localhost:5002/api/ordenes-produccion';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${response.status}`);
      }
      setSuccessMessage(data.mensaje || `Orden de producción ${editMode ? 'actualizada' : 'creada'} con éxito.`);
      resetForm();
      fetchOrdenes();
    } catch (err) {
      console.error("Error al guardar orden de producción:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProcesarOrden = async (id, productoNombre) => {
    if (!window.confirm(`¿Estás seguro de que quieres PROCESAR la Orden de Producción ID ${id} para "${productoNombre}"? Esto consumirá materiales y generará stock de producto terminado.`)) {
      return;
    }
    setLoading(true);
    setSuccessMessage('');
    setError(null);
    try {
      const response = await fetch(`http://localhost:5002/api/ordenes-produccion/${id}/procesar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${response.status}`);
      }
      setSuccessMessage(data.mensaje);
      fetchOrdenes(); // Recargar para ver el estado actualizado
      // También podrías querer recargar el stock de materias primas y productos terminados aquí
    } catch (err) {
      console.error("Error al procesar orden de producción:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditMode(false);
    setCurrentOrden({
      id: null,
      producto_terminado_id: '',
      cantidad_a_producir: '',
      fecha: new Date().toISOString().split('T')[0],
      observaciones: ''
    });
    setSuccessMessage('');
    setError(null);
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
    <div className="gestion-ordenes-produccion-container">
      <h2>Gestión de Órdenes de Producción</h2>

      {error && <p className="error-message">{error}</p>}
      {successMessage && <p className="success-message">{successMessage}</p>}

      <form onSubmit={handleSubmit} className="form-container">
        <h3>{editMode ? 'Editar Orden' : 'Crear Nueva Orden de Producción'}</h3>
        <div className="form-grid">
          <label>Producto Terminado:
            <select name="producto_terminado_id" value={currentOrden.producto_terminado_id} onChange={handleChange} required>
              <option value="">Seleccione Producto</option>
              {productosTerminados.map(prod => (
                <option key={prod.id} value={prod.id}>{prod.referencia} - {prod.nombre}</option>
              ))}
            </select>
          </label>
          <label>Cantidad a Producir: <input type="number" step="0.01" name="cantidad_a_producir" value={currentOrden.cantidad_a_producir} onChange={handleChange} required /></label>
          <label>Fecha: <input type="date" name="fecha" value={currentOrden.fecha} onChange={handleChange} required /></label> {/* Un solo campo de fecha */}
          <label>Observaciones: <textarea name="observaciones" value={currentOrden.observaciones} onChange={handleChange}></textarea></label>
        </div>
        <button type="submit" disabled={loading} className="submit-btn">
          {loading ? 'Guardando...' : (editMode ? 'Actualizar Orden' : 'Crear Orden')}
        </button>
        {editMode && <button type="button" onClick={resetForm} className="add-btn" style={{backgroundColor: '#6c757d'}}>Cancelar Edición</button>}
      </form>

      <h3>Listado de Órdenes de Producción</h3>
      {loading && <p>Cargando órdenes...</p>}
      {!loading && !error && ordenes.length === 0 && <p>No hay órdenes de producción registradas.</p>}
      {!loading && !error && ordenes.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Fecha</th> {/* Un solo campo de fecha */}
              <th>Coste Real (€)</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {ordenes.map(orden => (
              <tr key={orden.id}>
                <td>{orden.id}</td>
                <td>{orden.producto_referencia} - {orden.producto_nombre}</td>
                <td>{parseFloat(orden.cantidad_a_producir).toFixed(2)}</td>
                <td>{formatDate(orden.fecha)}</td> {/* Mostrar el campo 'fecha' */}
                <td>{parseFloat(orden.coste_real_fabricacion || 0).toFixed(2)}</td>
                <td>
                  {orden.status !== 'COMPLETADA' && orden.status !== 'CANCELADA' && ( // Mantener la lógica de status internamente
                    <button onClick={() => handleProcesarOrden(orden.id, orden.producto_nombre)} className="action-button empezada" title="Procesar Orden">Procesar</button>
                  )}
                  <button onClick={() => handleEdit(orden)} className="action-button empezada" style={{marginLeft: '5px'}}>Editar</button>
                  <button onClick={() => handleDelete(orden.id)} className="action-button agotada" style={{backgroundColor: '#dc3545', marginLeft: '5px'}}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default GestionOrdenesProduccion;
