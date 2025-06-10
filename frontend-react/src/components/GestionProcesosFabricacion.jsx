// frontend-react/src/components/GestionProcesosFabricacion.jsx
import React, { useState, useEffect, useCallback } from 'react';
import '../App.css'; // Reutiliza estilos generales de App.css

function GestionProcesosFabricacion() {
  const [procesos, setProcesos] = useState([]);
  const [productosTerminados, setProductosTerminados] = useState([]);
  const [maquinaria, setMaquinaria] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [currentProceso, setCurrentProceso] = useState({
    id: null,
    producto_terminado_id: '',
    maquinaria_id: '',
    nombre_proceso: '',
    tiempo_estimado_segundos: '',
    aplica_a_clientes: 'ALL' // NUEVO CAMPO: Por defecto 'ALL'
  });

  const tiposClienteProceso = [
    { value: 'ALL', label: 'Todos los Clientes' },
    { value: 'FINAL', label: 'Cliente Final' },
    { value: 'FABRICANTE', label: 'Fabricante' },
    { value: 'METRAJES', label: 'Metrajes' },
    { value: 'INTERMEDIARIO', label: 'Intermediario' },
  ];

  const fetchDependencies = useCallback(async () => {
    try {
      const [productosRes, maquinariaRes] = await Promise.all([
        fetch('http://localhost:5002/api/productos-terminados'),
        fetch('http://localhost:5002/api/maquinaria')
      ]);

      if (!productosRes.ok) throw new Error(`Error al cargar productos: ${productosRes.status}`);
      if (!maquinariaRes.ok) throw new Error(`Error al cargar maquinaria: ${maquinariaRes.status}`);

      const productosData = await productosRes.json();
      const maquinariaData = await maquinariaRes.json();

      setProductosTerminados(productosData);
      setMaquinaria(maquinariaData);
    } catch (err) {
      console.error("Error al cargar dependencias para procesos:", err);
      setError(err.message);
    }
  }, []);

  const fetchProcesos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:5002/api/procesos-fabricacion');
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error del servidor: ${response.status}`);
      }
      const data = await response.json();
      setProcesos(data);
    } catch (err) {
      console.error("Error al obtener procesos de fabricación:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDependencies();
    fetchProcesos();
  }, [fetchDependencies, fetchProcesos]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCurrentProceso(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (proceso) => {
    // CAMBIO al editar
    setCurrentProceso({
      ...proceso,
      tiempo_estimado_segundos: parseInt(proceso.tiempo_estimado_segundos) || '', // Se asegura que sea entero
      aplica_a_clientes: proceso.aplica_a_clientes || 'ALL',
    });
    setEditMode(true);
    setSuccessMessage('');
    setError(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar este proceso de fabricación (ID: ${id})? Esta acción es irreversible.`)) {
      return;
    }
    setLoading(true);
    setSuccessMessage('');
    setError(null);
    try {
      const response = await fetch(`http://localhost:5002/api/procesos-fabricacion/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${response.status}`);
      }
      setSuccessMessage(data.mensaje);
      fetchProcesos();
    } catch (err) {
      console.error("Error al eliminar proceso:", err);
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

    // CAMBIO en el payload
    const payload = {
      ...currentProceso,
      producto_terminado_id: parseInt(currentProceso.producto_terminado_id),
      maquinaria_id: parseInt(currentProceso.maquinaria_id),
      tiempo_estimado_segundos: parseInt(currentProceso.tiempo_estimado_segundos), // Se envía como entero
      aplica_a_clientes: currentProceso.aplica_a_clientes,
    };

    const method = editMode ? 'PUT' : 'POST';
    const url = editMode
      ? `http://localhost:5002/api/procesos-fabricacion/${currentProceso.id}`
      : 'http://localhost:5002/api/procesos-fabricacion';

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
      setSuccessMessage(data.mensaje || `Proceso ${editMode ? 'actualizado' : 'creado'} con éxito.`);
      resetForm();
      fetchProcesos();
    } catch (err) {
      console.error("Error al guardar proceso:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditMode(false);
    // CAMBIO en el reset
    setCurrentProceso({
      id: null,
      producto_terminado_id: '',
      maquinaria_id: '',
      nombre_proceso: '',
      tiempo_estimado_segundos: '',
      aplica_a_clientes: 'ALL'
    });
    setSuccessMessage('');
    setError(null);
  };

  return (
    <div className="gestion-procesos-container">
      <h2>Gestión de Procesos de Fabricación</h2>

      {error && <p className="error-message">{error}</p>}
      {successMessage && <p className="success-message">{successMessage}</p>}

      <form onSubmit={handleSubmit} className="form-container">
        <h3>{editMode ? 'Editar Proceso' : 'Crear Nuevo Proceso'}</h3>
        <div className="form-grid">
          <label>Producto Terminado:
            <select name="producto_terminado_id" value={currentProceso.producto_terminado_id} onChange={handleChange} required>
              <option value="">Seleccione Producto</option>
              {productosTerminados.map(prod => (
                <option key={prod.id} value={prod.id}>{prod.referencia} - {prod.nombre}</option>
              ))}
            </select>
          </label>
          <label>Maquinaria:
            <select name="maquinaria_id" value={currentProceso.maquinaria_id} onChange={handleChange} required>
              <option value="">Seleccione Máquina</option>
              {maquinaria.map(maq => (
                <option key={maq.id} value={maq.id}>{maq.nombre}</option>
              ))}
            </select>
          </label>
          <label>Nombre Proceso: <input type="text" name="nombre_proceso" value={currentProceso.nombre_proceso} onChange={handleChange} required /></label>
          <label>Tiempo Estimado (Segundos): <input type="number" step="1" name="tiempo_estimado_segundos" value={currentProceso.tiempo_estimado_segundos} onChange={handleChange} required /></label>          
          {/* NUEVO CAMPO: Aplica a Clientes */}
          <label>Aplica a Clientes:
            <select name="aplica_a_clientes" value={currentProceso.aplica_a_clientes} onChange={handleChange} required>
              {tiposClienteProceso.map(tipo => (
                <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
              ))}
            </select>
          </label>

        </div>
        <button type="submit" disabled={loading} className="submit-btn">
          {loading ? 'Guardando...' : (editMode ? 'Actualizar Proceso' : 'Crear Proceso')}
        </button>
        {editMode && <button type="button" onClick={resetForm} className="add-btn" style={{backgroundColor: '#6c757d'}}>Cancelar Edición</button>}
      </form>

      <h3>Listado de Procesos de Fabricación</h3>
      {loading && <p>Cargando procesos...</p>}
      {!loading && !error && procesos.length === 0 && <p>No hay procesos de fabricación registrados.</p>}
      {!loading && !error && procesos.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Producto Final</th>
              <th>Maquinaria</th>
              <th>Proceso</th>
              <th>Tiempo Est. (s)</th>
              <th>Aplica a Clientes</th> {/* NUEVA COLUMNA */}
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {procesos.map(proc => (
              <tr key={proc.id}>
                <td>{proc.id}</td>
                <td>{proc.producto_referencia} - {proc.producto_nombre}</td>
                <td>{proc.maquinaria_nombre}</td>
                <td>{proc.nombre_proceso}</td>
                <td>{proc.tiempo_estimado_segundos}</td>
                <td>{proc.aplica_a_clientes || 'ALL'}</td> {/* Mostrar el nuevo campo */}
                <td>
                  <button onClick={() => handleEdit(proc)} className="action-button empezada">Editar</button>
                  <button onClick={() => handleDelete(proc.id)} className="action-button agotada" style={{backgroundColor: '#dc3545'}}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default GestionProcesosFabricacion;
