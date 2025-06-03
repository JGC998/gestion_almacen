// frontend-react/src/components/GestionRecetas.jsx
import React, { useState, useEffect, useCallback } from 'react';
import '../App.css'; // Reutiliza estilos generales de App.css

function GestionRecetas() {
  const [recetas, setRecetas] = useState([]);
  const [productosTerminados, setProductosTerminados] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [componentes, setComponentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [currentReceta, setCurrentReceta] = useState({
    id: null,
    producto_terminado_id: '',
    material_id: '', // ID de StockMateriasPrimas
    componente_id: '', // ID de StockComponentes
    cantidad_requerida: '',
    unidad_medida_requerida: '',
    notas: ''
  });

  const fetchDependencies = useCallback(async () => {
    try {
      const [productosRes, mpRes, compRes] = await Promise.all([
        fetch('http://localhost:5002/api/productos-terminados'),
        fetch('http://localhost:5002/api/stock'), // Asume que esto trae materias primas
        // Si tienes un endpoint para componentes, úsalo aquí:
        // fetch('http://localhost:5002/api/stock-componentes')
        // Por ahora, simulamos componentes si no hay endpoint específico
        Promise.resolve({ ok: true, json: () => Promise.resolve([]) }) // Simulación
      ]);

      if (!productosRes.ok) throw new Error(`Error al cargar productos: ${productosRes.status}`);
      if (!mpRes.ok) throw new Error(`Error al cargar materias primas: ${mpRes.status}`);
      if (!compRes.ok) throw new Error(`Error al cargar componentes: ${compRes.status}`);

      const productosData = await productosRes.json();
      const mpData = await mpRes.json();
      const compData = await compRes.json(); // Si tienes datos reales de componentes, úsalos

      setProductosTerminados(productosData);
      setMateriasPrimas(mpData.filter(item => item.material_tipo !== 'COMPONENTE' && item.material_tipo !== 'MAQUINARIA'));
      setComponentes(mpData.filter(item => item.material_tipo === 'COMPONENTE')); // O usa compData si es un endpoint separado
    } catch (err) {
      console.error("Error al cargar dependencias para recetas:", err);
      setError(err.message);
    }
  }, []);

  const fetchRecetas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:5002/api/recetas');
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error del servidor: ${response.status}`);
      }
      const data = await response.json();
      setRecetas(data);
    } catch (err) {
      console.error("Error al obtener recetas:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDependencies();
    fetchRecetas();
  }, [fetchDependencies, fetchRecetas]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCurrentReceta(prev => ({ ...prev, [name]: value }));
  };

  const handleMaterialTypeChange = (e) => {
    const { value } = e.target;
    setCurrentReceta(prev => ({
      ...prev,
      material_id: value === 'material' ? prev.material_id : '', // Limpiar si cambia de tipo
      componente_id: value === 'componente' ? prev.componente_id : '',
    }));
  };

  const handleEdit = (receta) => {
    setCurrentReceta({
      ...receta,
      cantidad_requerida: parseFloat(receta.cantidad_requerida).toFixed(2),
      // Determinar qué tipo de material es para el select
      material_type_selector: receta.material_id ? 'material' : (receta.componente_id ? 'componente' : '')
    });
    setEditMode(true);
    setSuccessMessage('');
    setError(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar esta receta (ID: ${id})? Esta acción es irreversible.`)) {
      return;
    }
    setLoading(true);
    setSuccessMessage('');
    setError(null);
    try {
      const response = await fetch(`http://localhost:5002/api/recetas/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${response.status}`);
      }
      setSuccessMessage(data.mensaje);
      fetchRecetas();
      // Opcional: Recalcular coste del producto terminado afectado
    } catch (err) {
      console.error("Error al eliminar receta:", err);
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

    // Validar que se seleccionó un material o un componente, no ambos
    if ((currentReceta.material_id && currentReceta.componente_id) || (!currentReceta.material_id && !currentReceta.componente_id)) {
        setError("Debe seleccionar un Material O un Componente, no ambos.");
        setLoading(false);
        return;
    }

    const payload = {
      ...currentReceta,
      // Asegurarse de que los IDs sean números o null
      producto_terminado_id: parseInt(currentReceta.producto_terminado_id),
      material_id: currentReceta.material_id ? parseInt(currentReceta.material_id) : null,
      componente_id: currentReceta.componente_id ? parseInt(currentReceta.componente_id) : null,
      cantidad_requerida: parseFloat(currentReceta.cantidad_requerida)
    };

    const method = editMode ? 'PUT' : 'POST';
    const url = editMode
      ? `http://localhost:5002/api/recetas/${currentReceta.id}`
      : 'http://localhost:5002/api/recetas';

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
      setSuccessMessage(data.mensaje || `Receta ${editMode ? 'actualizada' : 'creada'} con éxito.`);
      resetForm();
      fetchRecetas();
      // Opcional: Recalcular coste del producto terminado afectado
    } catch (err) {
      console.error("Error al guardar receta:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditMode(false);
    setCurrentReceta({
      id: null,
      producto_terminado_id: '',
      material_id: '',
      componente_id: '',
      cantidad_requerida: '',
      unidad_medida_requerida: '',
      notas: ''
    });
    setSuccessMessage('');
    setError(null);
  };

  return (
    <div className="gestion-recetas-container">
      <h2>Gestión de Recetas (Lista de Materiales)</h2>

      {error && <p className="error-message">{error}</p>}
      {successMessage && <p className="success-message">{successMessage}</p>}

      <form onSubmit={handleSubmit} className="form-container">
        <h3>{editMode ? 'Editar Receta' : 'Crear Nueva Receta'}</h3>
        <div className="form-grid">
          <label>Producto Terminado:
            <select name="producto_terminado_id" value={currentReceta.producto_terminado_id} onChange={handleChange} required>
              <option value="">Seleccione Producto</option>
              {productosTerminados.map(prod => (
                <option key={prod.id} value={prod.id}>{prod.referencia} - {prod.nombre}</option>
              ))}
            </select>
          </label>
          <label>Tipo de Material:
            <select name="material_type_selector" value={currentReceta.material_id ? 'material' : (currentReceta.componente_id ? 'componente' : '')} onChange={handleMaterialTypeChange}>
                <option value="">Seleccione Tipo</option>
                <option value="material">Materia Prima</option>
                <option value="componente">Componente</option>
            </select>
          </label>
          {currentReceta.material_id || (currentReceta.material_type_selector === 'material' && !editMode) ? (
            <label>Materia Prima:
              <select name="material_id" value={currentReceta.material_id} onChange={handleChange} required={!currentReceta.componente_id}>
                <option value="">Seleccione Materia Prima</option>
                {materiasPrimas.map(mp => (
                  <option key={mp.id} value={mp.id}>{mp.referencia_stock} ({mp.material_tipo} {mp.espesor} {mp.ancho}mm)</option>
                ))}
              </select>
            </label>
          ) : null}
          {currentReceta.componente_id || (currentReceta.material_type_selector === 'componente' && !editMode) ? (
            <label>Componente:
              <select name="componente_id" value={currentReceta.componente_id} onChange={handleChange} required={!currentReceta.material_id}>
                <option value="">Seleccione Componente</option>
                {componentes.map(comp => (
                  <option key={comp.id} value={comp.id}>{comp.componente_ref} ({comp.descripcion})</option>
                ))}
              </select>
            </label>
          ) : null}
          <label>Cantidad Requerida: <input type="number" step="0.01" name="cantidad_requerida" value={currentReceta.cantidad_requerida} onChange={handleChange} required /></label>
          <label>Unidad Medida Requerida: <input type="text" name="unidad_medida_requerida" value={currentReceta.unidad_medida_requerida} onChange={handleChange} required /></label>
          <label>Notas: <textarea name="notas" value={currentReceta.notas} onChange={handleChange}></textarea></label>
        </div>
        <button type="submit" disabled={loading} className="submit-btn">
          {loading ? 'Guardando...' : (editMode ? 'Actualizar Receta' : 'Crear Receta')}
        </button>
        {editMode && <button type="button" onClick={resetForm} className="add-btn" style={{backgroundColor: '#6c757d'}}>Cancelar Edición</button>}
      </form>

      <h3>Listado de Recetas</h3>
      {loading && <p>Cargando recetas...</p>}
      {!loading && !error && recetas.length === 0 && <p>No hay recetas registradas.</p>}
      {!loading && !error && recetas.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Producto Final</th>
              <th>Material/Componente</th>
              <th>Cantidad</th>
              <th>Unidad</th>
              <th>Notas</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {recetas.map(rec => (
              <tr key={rec.id}>
                <td>{rec.id}</td>
                <td>{rec.producto_referencia} - {rec.producto_nombre}</td>
                <td>
                  {rec.material_id ? `${rec.material_referencia_stock} (${rec.material_tipo})` : ''}
                  {rec.componente_id ? `${rec.componente_referencia_stock}` : ''}
                </td>
                <td>{parseFloat(rec.cantidad_requerida).toFixed(2)}</td>
                <td>{rec.unidad_medida_requerida}</td>
                <td>{rec.notas || '-'}</td>
                <td>
                  <button onClick={() => handleEdit(rec)} className="action-button empezada">Editar</button>
                  <button onClick={() => handleDelete(rec.id)} className="action-button agotada" style={{backgroundColor: '#dc3545'}}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default GestionRecetas;
