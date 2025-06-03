// frontend-react/src/components/GestionMaquinaria.jsx
import React, { useState, useEffect, useCallback } from 'react';
import '../App.css'; // Reutiliza estilos generales de App.css

function GestionMaquinaria() {
  const [maquinaria, setMaquinaria] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [currentMaquina, setCurrentMaquina] = useState({
    id: null,
    nombre: '',
    descripcion: '',
    coste_adquisicion: '',
    coste_hora_operacion: '' // Se eliminan vida_util_horas y depreciacion_hora
  });

  const fetchMaquinaria = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:5002/api/maquinaria');
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error del servidor: ${response.status}`);
      }
      const data = await response.json();
      setMaquinaria(data);
    } catch (err) {
      console.error("Error al obtener maquinaria:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMaquinaria();
  }, [fetchMaquinaria]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCurrentMaquina(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (maquina) => {
    setCurrentMaquina({
      ...maquina,
      coste_adquisicion: maquina.coste_adquisicion !== null ? parseFloat(maquina.coste_adquisicion).toFixed(2) : '',
      // Se eliminan vida_util_horas y depreciacion_hora
      coste_hora_operacion: maquina.coste_hora_operacion !== null ? parseFloat(maquina.coste_hora_operacion).toFixed(4) : '',
    });
    setEditMode(true);
    setSuccessMessage('');
    setError(null);
  };

  const handleDelete = async (id, nombre) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar la máquina "${nombre}" (ID: ${id})? Esta acción es irreversible y podría fallar si la máquina está en uso.`)) {
      return;
    }
    setLoading(true);
    setSuccessMessage('');
    setError(null);
    try {
      const response = await fetch(`http://localhost:5002/api/maquinaria/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${response.status}`);
      }
      setSuccessMessage(data.mensaje);
      fetchMaquinaria();
    } catch (err) {
      console.error("Error al eliminar máquina:", err);
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

    const method = editMode ? 'PUT' : 'POST';
    const url = editMode
      ? `http://localhost:5002/api/maquinaria/${currentMaquina.id}`
      : 'http://localhost:5002/api/maquinaria';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentMaquina)
      });
      const data = await response.json();
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${response.status}`);
      }
      setSuccessMessage(data.mensaje || `Máquina ${editMode ? 'actualizada' : 'creada'} con éxito.`);
      resetForm();
      fetchMaquinaria();
    } catch (err) {
      console.error("Error al guardar máquina:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditMode(false);
    setCurrentMaquina({
      id: null,
      nombre: '',
      descripcion: '',
      coste_adquisicion: '',
      coste_hora_operacion: ''
    });
    setSuccessMessage('');
    setError(null);
  };

  return (
    <div className="gestion-maquinaria-container">
      <h2>Gestión de Maquinaria</h2>

      {error && <p className="error-message">{error}</p>}
      {successMessage && <p className="success-message">{successMessage}</p>}

      <form onSubmit={handleSubmit} className="form-container">
        <h3>{editMode ? 'Editar Máquina' : 'Registrar Nueva Máquina'}</h3>
        <div className="form-grid">
          <label>Nombre: <input type="text" name="nombre" value={currentMaquina.nombre} onChange={handleChange} required /></label>
          <label>Descripción: <textarea name="descripcion" value={currentMaquina.descripcion} onChange={handleChange}></textarea></label>
          <label>Coste Adquisición (€): <input type="number" step="0.01" name="coste_adquisicion" value={currentMaquina.coste_adquisicion} onChange={handleChange} /></label>
          <label>Coste Hora Operación (€/h): <input type="number" step="0.0001" name="coste_hora_operacion" value={currentMaquina.coste_hora_operacion} onChange={handleChange} /></label>
        </div>
        <button type="submit" disabled={loading} className="submit-btn">
          {loading ? 'Guardando...' : (editMode ? 'Actualizar Máquina' : 'Registrar Máquina')}
        </button>
        {editMode && <button type="button" onClick={resetForm} className="add-btn" style={{backgroundColor: '#6c757d'}}>Cancelar Edición</button>}
      </form>

      <h3>Listado de Maquinaria</h3>
      {loading && <p>Cargando maquinaria...</p>}
      {!loading && !error && maquinaria.length === 0 && <p>No hay maquinaria registrada.</p>}
      {!loading && !error && maquinaria.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Descripción</th>
              <th>Coste Adq. (€)</th>
              <th>Coste Op. (€/h)</th> {/* Se eliminan Vida Útil y Deprec. Hora */}
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {maquinaria.map(maq => (
              <tr key={maq.id}>
                <td>{maq.id}</td>
                <td>{maq.nombre}</td>
                <td>{maq.descripcion || '-'}</td>
                <td>{parseFloat(maq.coste_adquisicion || 0).toFixed(2)}</td>
                <td>{parseFloat(maq.coste_hora_operacion || 0).toFixed(4)}</td>
                <td>
                  <button onClick={() => handleEdit(maq)} className="action-button empezada">Editar</button>
                  <button onClick={() => handleDelete(maq.id, maq.nombre)} className="action-button agotada" style={{backgroundColor: '#dc3545'}}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default GestionMaquinaria;
