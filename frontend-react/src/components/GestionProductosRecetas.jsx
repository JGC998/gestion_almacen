// frontend-react/src/components/GestionProductosRecetas.jsx
import React, { useState, useEffect, useCallback } from 'react';
import '../App.css'; // Reutiliza estilos generales de App.css

function GestionProductosRecetas() {
  // --- Estados para Productos Terminados ---
  const [productos, setProductos] = useState([]);
  const [loadingProductos, setLoadingProductos] = useState(true);
  const [errorProductos, setErrorProductos] = useState(null);
  const [successProductoMessage, setSuccessProductoMessage] = useState('');
  const [editModeProducto, setEditModeProducto] = useState(false);
  const [currentProduct, setCurrentProduct] = useState({
    id: null,
    referencia: '',
    nombre: '',
    descripcion: '',
    unidad_medida: 'unidad',
    coste_fabricacion_estandar: '',
    margen_venta_default: '',
    precio_venta_sugerido: '',
    status: 'ACTIVO'
  });

  // --- Estados para Recetas ---
  const [recetas, setRecetas] = useState([]);
  const [loadingRecetas, setLoadingRecetas] = useState(false); // Se carga después de seleccionar producto
  const [errorRecetas, setErrorRecetas] = useState(null);
  const [successRecetaMessage, setSuccessRecetaMessage] = useState('');
  const [editModeReceta, setEditModeReceta] = useState(false);
  const [currentReceta, setCurrentReceta] = useState({
    id: null,
    producto_terminado_id: '', // Se llenará automáticamente al seleccionar un producto
    material_id: '',
    componente_id: '',
    notas: ''
  });

  // --- Datos para Selects de Recetas ---
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [componentes, setComponentes] = useState([]);
  const [selectedProductForReceta, setSelectedProductForReceta] = useState(null); // Producto seleccionado para ver/añadir recetas

  // --- Fetch de Productos Terminados ---
  const fetchProductos = useCallback(async () => {
    setLoadingProductos(true);
    setErrorProductos(null);
    try {
      const response = await fetch('http://localhost:5002/api/productos-terminados');
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error del servidor: ${response.status}`);
      }
      const data = await response.json();
      setProductos(data);
    } catch (err) {
      console.error("Error al obtener productos terminados:", err);
      setErrorProductos(err.message);
    } finally {
      setLoadingProductos(false);
    }
  }, []);

  // --- Fetch de Materias Primas y Componentes (para selects de Recetas) ---
  const fetchMaterialesYComponentes = useCallback(async () => {
    try {
      // Asume que /api/stock trae tanto MP como Componentes y luego se filtran
      const stockRes = await fetch('http://localhost:5002/api/stock');
      if (!stockRes.ok) throw new Error(`Error al cargar stock: ${stockRes.status}`);
      const stockData = await stockRes.json();

      setMateriasPrimas(stockData.filter(item => item.material_tipo !== 'COMPONENTE' && item.material_tipo !== 'MAQUINARIA'));
      setComponentes(stockData.filter(item => item.material_tipo === 'COMPONENTE'));
    } catch (err) {
      console.error("Error al cargar materiales y componentes:", err);
      setErrorRecetas(err.message); // Usamos el error de recetas para esto
    }
  }, []);

  // --- Fetch de Recetas para un Producto Específico ---
  const fetchRecetasForProduct = useCallback(async (productId) => {
    setLoadingRecetas(true);
    setErrorRecetas(null);
    try {
      const response = await fetch(`http://localhost:5002/api/recetas?producto_terminado_id=${productId}`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error del servidor: ${response.status}`);
      }
      const data = await response.json();
      setRecetas(data);
    } catch (err) {
      console.error(`Error al obtener recetas para producto ${productId}:`, err);
      setErrorRecetas(err.message);
    } finally {
      setLoadingRecetas(false);
    }
  }, []);


  useEffect(() => {
    fetchProductos();
    fetchMaterialesYComponentes();
  }, [fetchProductos, fetchMaterialesYComponentes]);

  // Cuando se selecciona un producto para ver/añadir recetas
  useEffect(() => {
    if (selectedProductForReceta) {
      fetchRecetasForProduct(selectedProductForReceta.id);
      setCurrentReceta(prev => ({ ...prev, producto_terminado_id: selectedProductForReceta.id }));
    } else {
      setRecetas([]);
      setCurrentReceta(prev => ({ ...prev, producto_terminado_id: '' }));
    }
  }, [selectedProductForReceta, fetchRecetasForProduct]);


  // --- Handlers para Productos Terminados ---
  const handleProductChange = (e) => {
    const { name, value } = e.target;
    setCurrentProduct(prev => ({ ...prev, [name]: value }));
  };

  const handleEditProduct = (product) => {
    setCurrentProduct({
      ...product,
      coste_fabricacion_estandar: product.coste_fabricacion_estandar !== null ? parseFloat(product.coste_fabricacion_estandar).toFixed(4) : '',
      margen_venta_default: product.margen_venta_default !== null ? parseFloat(product.margen_venta_default).toFixed(2) : '',
      precio_venta_sugerido: product.precio_venta_sugerido !== null ? parseFloat(product.precio_venta_sugerido).toFixed(2) : '',
    });
    setEditModeProducto(true);
    setSuccessProductoMessage('');
    setErrorProductos(null);
  };

  const handleDeleteProduct = async (id, referencia) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar el producto "${referencia}" (ID: ${id})? Esta acción es irreversible y eliminará también sus recetas y procesos asociados.`)) {
      return;
    }
    setLoadingProductos(true);
    setSuccessProductoMessage('');
    setErrorProductos(null);
    try {
      const response = await fetch(`http://localhost:5002/api/productos-terminados/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${response.status}`);
      }
      setSuccessProductoMessage(data.mensaje);
      fetchProductos();
      resetProductForm(); // Limpiar formulario si el producto actual fue eliminado
      setSelectedProductForReceta(null); // Deseleccionar producto para recetas
    } catch (err) {
      console.error("Error al eliminar producto:", err);
      setErrorProductos(err.message);
    } finally {
      setLoadingProductos(false);
    }
  };

  const handleSubmitProduct = async (e) => {
    e.preventDefault();
    setLoadingProductos(true);
    setSuccessProductoMessage('');
    setErrorProductos(null);

    const method = editModeProducto ? 'PUT' : 'POST';
    const url = editModeProducto
      ? `http://localhost:5002/api/productos-terminados/${currentProduct.id}`
      : 'http://localhost:5002/api/productos-terminados';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentProduct)
      });
      const data = await response.json();
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${response.status}`);
      }
      setSuccessProductoMessage(data.mensaje || `Producto ${editModeProducto ? 'actualizado' : 'creado'} con éxito.`);
      resetProductForm();
      fetchProductos();
    } catch (err) {
      console.error("Error al guardar producto:", err);
      setErrorProductos(err.message);
    } finally {
      setLoadingProductos(false);
    }
  };

  const resetProductForm = () => {
    setEditModeProducto(false);
    setCurrentProduct({
      id: null,
      referencia: '',
      nombre: '',
      descripcion: '',
      unidad_medida: 'unidad',
      coste_fabricacion_estandar: '',
      margen_venta_default: '',
      precio_venta_sugerido: '',
      status: 'ACTIVO'
    });
    setSuccessProductoMessage('');
    setErrorProductos(null);
  };

  // --- Handlers para Recetas ---
  const handleRecetaChange = (e) => {
    const { name, value } = e.target;
    setCurrentReceta(prev => ({ ...prev, [name]: value }));
  };

  const handleEditReceta = (receta) => {
    setCurrentReceta({
      ...receta,
      // Asegurarse de que los IDs sean strings para los selects
      producto_terminado_id: String(receta.producto_terminado_id),
      material_id: receta.material_id ? String(receta.material_id) : '',
      componente_id: receta.componente_id ? String(receta.componente_id) : '',
    });
    setEditModeReceta(true);
    setSuccessRecetaMessage('');
    setErrorRecetas(null);
  };

  const handleDeleteReceta = async (id) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar esta línea de receta (ID: ${id})? Esta acción es irreversible.`)) {
      return;
    }
    setLoadingRecetas(true);
    setSuccessRecetaMessage('');
    setErrorRecetas(null);
    try {
      const response = await fetch(`http://localhost:5002/api/recetas/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${response.status}`);
      }
      setSuccessRecetaMessage(data.mensaje);
      if (selectedProductForReceta) {
        fetchRecetasForProduct(selectedProductForReceta.id);
      } else {
        setRecetas([]);
      }
    } catch (err) {
      console.error("Error al eliminar receta:", err);
      setErrorRecetas(err.message);
    } finally {
      setLoadingRecetas(false);
    }
  };

  const handleSubmitReceta = async (e) => {
    e.preventDefault();
    setLoadingRecetas(true);
    setSuccessRecetaMessage('');
    setErrorRecetas(null);

    // Validar que se seleccionó un material o un componente, no ambos
    if ((currentReceta.material_id && currentReceta.componente_id) || (!currentReceta.material_id && !currentReceta.componente_id)) {
        setErrorRecetas("Debe seleccionar un Material O un Componente, no ambos.");
        setLoadingRecetas(false);
        return;
    }

    const payload = {
      ...currentReceta,
      producto_terminado_id: parseInt(currentReceta.producto_terminado_id),
      material_id: currentReceta.material_id ? parseInt(currentReceta.material_id) : null,
      componente_id: currentReceta.componente_id ? parseInt(currentReceta.componente_id) : null,
      // cantidad_requerida y unidad_medida_requerida se eliminan
    };

    const method = editModeReceta ? 'PUT' : 'POST';
    const url = editModeReceta
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
      setSuccessRecetaMessage(data.mensaje || `Receta ${editModeReceta ? 'actualizada' : 'creada'} con éxito.`);
      resetRecetaForm();
      if (selectedProductForReceta) {
        fetchRecetasForProduct(selectedProductForReceta.id);
      }
    } catch (err) {
      console.error("Error al guardar receta:", err);
      setErrorRecetas(err.message);
    } finally {
      setLoadingRecetas(false);
    }
  };

  const resetRecetaForm = () => {
    setEditModeReceta(false);
    setCurrentReceta({
      id: null,
      producto_terminado_id: selectedProductForReceta ? selectedProductForReceta.id : '',
      material_id: '',
      componente_id: '',
      notas: ''
    });
    setSuccessRecetaMessage('');
    setErrorRecetas(null);
  };

  return (
    <div className="gestion-productos-recetas-container">
      {/* Sección de Gestión de Productos Terminados */}
      <div className="productos-terminados-section">
        <h2>Gestión de Productos Terminados</h2>

        {errorProductos && <p className="error-message">{errorProductos}</p>}
        {successProductoMessage && <p className="success-message">{successProductoMessage}</p>}

        <form onSubmit={handleSubmitProduct} className="form-container">
          <h3>{editModeProducto ? 'Editar Producto' : 'Crear Nuevo Producto'}</h3>
          <div className="form-grid">
            <label>Referencia: <input type="text" name="referencia" value={currentProduct.referencia} onChange={handleProductChange} required /></label>
            <label>Nombre: <input type="text" name="nombre" value={currentProduct.nombre} onChange={handleProductChange} required /></label>
            <label>Descripción: <textarea name="descripcion" value={currentProduct.descripcion} onChange={handleProductChange}></textarea></label>
            <label>Unidad Medida: <input type="text" name="unidad_medida" value={currentProduct.unidad_medida} onChange={handleProductChange} /></label>
            <label>Coste Estándar: <input type="number" step="0.0001" name="coste_fabricacion_estandar" value={currentProduct.coste_fabricacion_estandar} onChange={handleProductChange} readOnly title="Calculado automáticamente por las recetas y procesos" /></label>
            <label>Margen Venta (%): <input type="number" step="0.01" name="margen_venta_default" value={currentProduct.margen_venta_default} onChange={handleProductChange} /></label>
            <label>Precio Sugerido: <input type="number" step="0.01" name="precio_venta_sugerido" value={currentProduct.precio_venta_sugerido} onChange={handleProductChange} /></label>
            <label>Estado:
              <select name="status" value={currentProduct.status} onChange={handleProductChange}>
                <option value="ACTIVO">ACTIVO</option>
                <option value="DESCATALOGADO">DESCATALOGADO</option>
                <option value="OBSOLETO">OBSOLETO</option>
              </select>
            </label>
          </div>
          <button type="submit" disabled={loadingProductos} className="submit-btn">
            {loadingProductos ? 'Guardando...' : (editModeProducto ? 'Actualizar Producto' : 'Crear Producto')}
          </button>
          {editModeProducto && <button type="button" onClick={resetProductForm} className="add-btn" style={{backgroundColor: '#6c757d'}}>Cancelar Edición</button>}
        </form>

        <h3>Listado de Productos Terminados</h3>
        {loadingProductos && <p>Cargando productos...</p>}
        {!loadingProductos && !errorProductos && productos.length === 0 && <p>No hay productos terminados registrados.</p>}
        {!loadingProductos && !errorProductos && productos.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Referencia</th>
                <th>Nombre</th>
                <th>Unidad</th>
                <th>Coste Estándar (€)</th>
                <th>Margen (%)</th>
                <th>Precio Sugerido (€)</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productos.map(prod => (
                <tr key={prod.id}>
                  <td>{prod.id}</td>
                  <td>{prod.referencia}</td>
                  <td>{prod.nombre}</td>
                  <td>{prod.unidad_medida}</td>
                  <td>{parseFloat(prod.coste_fabricacion_estandar || 0).toFixed(4)}</td>
                  <td>{(parseFloat(prod.margen_venta_default || 0) * 100).toFixed(2)}%</td>
                  <td>{parseFloat(prod.precio_venta_sugerido || 0).toFixed(2)}</td>
                  <td>{prod.status}</td>
                  <td>
                    <button onClick={() => handleEditProduct(prod)} className="action-button empezada">Editar</button>
                    <button onClick={() => handleDeleteProduct(prod.id, prod.referencia)} className="action-button agotada" style={{backgroundColor: '#dc3545'}}>Eliminar</button>
                    <button onClick={() => setSelectedProductForReceta(prod)} className="action-button" style={{backgroundColor: '#4CAF50'}}>Ver/Editar Recetas</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Sección de Gestión de Recetas (solo visible si se selecciona un producto) */}
      {selectedProductForReceta && (
        <div className="recetas-section" style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
          <h2>Recetas para "{selectedProductForReceta.nombre}" (ID: {selectedProductForReceta.id})</h2>
          <button onClick={() => setSelectedProductForReceta(null)} className="add-btn" style={{marginBottom: '20px', backgroundColor: '#6c757d'}}>Cerrar Recetas</button>

          {errorRecetas && <p className="error-message">{errorRecetas}</p>}
          {successRecetaMessage && <p className="success-message">{successRecetaMessage}</p>}

          <form onSubmit={handleSubmitReceta} className="form-container">
            <h3>{editModeReceta ? 'Editar Línea de Receta' : 'Añadir Material/Componente a Receta'}</h3>
            <div className="form-grid">
              <label>Producto Terminado (automático):
                <input type="text" value={`${selectedProductForReceta.referencia} - ${selectedProductForReceta.nombre}`} readOnly />
                <input type="hidden" name="producto_terminado_id" value={currentReceta.producto_terminado_id} />
              </label>

              {/* Selector de Material o Componente */}
              <label>Material o Componente:
                <select
                  name="material_or_component"
                  value={currentReceta.material_id ? 'material' : (currentReceta.componente_id ? 'componente' : '')}
                  onChange={(e) => {
                    const type = e.target.value;
                    setCurrentReceta(prev => ({
                      ...prev,
                      material_id: type === 'material' ? (editModeReceta ? prev.material_id : '') : '',
                      componente_id: type === 'componente' ? (editModeReceta ? prev.componente_id : '') : '',
                    }));
                  }}
                  required
                >
                  <option value="">Seleccione tipo</option>
                  <option value="material">Materia Prima</option>
                  <option value="componente">Componente</option>
                </select>
              </label>

              {/* Selector de Materia Prima */}
              {(currentReceta.material_id || (currentReceta.material_id === '' && currentReceta.componente_id === '' && (currentReceta.material_type_selector === 'material' || (!editModeReceta && !currentReceta.componente_id)))) && (
                <label>Materia Prima:
                  <select name="material_id" value={currentReceta.material_id} onChange={handleRecetaChange} required={!currentReceta.componente_id}>
                    <option value="">Seleccione Materia Prima</option>
                    {materiasPrimas.map(mp => (
                      <option key={mp.id} value={mp.id}>{mp.referencia_stock} ({mp.material_tipo} {mp.espesor} {mp.ancho}mm)</option>
                    ))}
                  </select>
                </label>
              )}

              {/* Selector de Componente */}
              {(currentReceta.componente_id || (currentReceta.material_id === '' && currentReceta.componente_id === '' && (currentReceta.material_type_selector === 'componente' || (!editModeReceta && !currentReceta.material_id)))) && (
                <label>Componente:
                  <select name="componente_id" value={currentReceta.componente_id} onChange={handleRecetaChange} required={!currentReceta.material_id}>
                    <option value="">Seleccione Componente</option>
                    {componentes.map(comp => (
                      <option key={comp.id} value={comp.id}>{comp.componente_ref} ({comp.descripcion})</option>
                    ))}
                  </select>
                </label>
              )}

              <label>Notas: <textarea name="notas" value={currentReceta.notas} onChange={handleRecetaChange}></textarea></label>
            </div>
            <button type="submit" disabled={loadingRecetas} className="submit-btn">
              {loadingRecetas ? 'Guardando...' : (editModeReceta ? 'Actualizar Línea Receta' : 'Añadir a Receta')}
            </button>
            {editModeReceta && <button type="button" onClick={resetRecetaForm} className="add-btn" style={{backgroundColor: '#6c757d'}}>Cancelar Edición</button>}
          </form>

          <h3>Líneas de Receta</h3>
          {loadingRecetas && <p>Cargando recetas...</p>}
          {!loadingRecetas && !errorRecetas && recetas.length === 0 && <p>No hay líneas de receta para este producto.</p>}
          {!loadingRecetas && !errorRecetas && recetas.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Material/Componente</th>
                  <th>Notas</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {recetas.map(rec => (
                  <tr key={rec.id}>
                    <td>{rec.id}</td>
                    <td>
                      {rec.material_id ? `${rec.material_referencia_stock} (${rec.material_tipo})` : ''}
                      {rec.componente_id ? `${rec.componente_referencia_stock}` : ''}
                    </td>
                    <td>{rec.notas || '-'}</td>
                    <td>
                      <button onClick={() => handleEditReceta(rec)} className="action-button empezada">Editar</button>
                      <button onClick={() => handleDeleteReceta(rec.id)} className="action-button agotada" style={{backgroundColor: '#dc3545'}}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default GestionProductosRecetas;
