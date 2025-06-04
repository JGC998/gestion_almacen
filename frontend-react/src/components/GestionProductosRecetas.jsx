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
    coste_extra_unitario: '',
    status: 'ACTIVO'
  });
  const [stockReferencias, setStockReferencias] = useState([]); // Para el desplegable de referencias de stock

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

  // --- Fetch de Materias Primas y Componentes (para selects de Recetas y Referencias de Producto) ---
  const fetchMaterialesYComponentes = useCallback(async () => {
    try {
      const [stockRes, compRes, refsRes] = await Promise.all([
        fetch('http://localhost:5002/api/stock'), // Asume que esto trae materias primas
        fetch('http://localhost:5002/api/stock-componentes'), // Endpoint para componentes si existe
        fetch('http://localhost:5002/api/stock-referencias-ultimocoste') // Nuevo endpoint
      ]);

      if (!stockRes.ok) throw new Error(`Error al cargar stock de materias primas: ${stockRes.status}`);
      if (!compRes.ok) console.warn(`Advertencia: No se pudo cargar stock de componentes: ${compRes.status}. Usando solo MP.`); // No lanzar error fatal si no hay endpoint de componentes
      if (!refsRes.ok) throw new Error(`Error al cargar referencias de stock: ${refsRes.status}`);


      const stockData = await stockRes.json();
      const compData = await compRes.json();
      const refsData = await refsRes.json();

      setMateriasPrimas(stockData.filter(item => item.material_tipo !== 'COMPONENTE' && item.material_tipo !== 'MAQUINARIA'));
      setComponentes(compData); // Usar datos de componentes si hay un endpoint específico
      setStockReferencias(refsData); // Guardar las referencias de stock
    } catch (err) {
      console.error("Error al cargar dependencias para recetas/productos:", err);
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
      // Reiniciar el formulario de receta al seleccionar un nuevo producto
      resetRecetaForm(selectedProductForReceta.id);
    } else {
      setRecetas([]);
      resetRecetaForm('');
    }
  }, [selectedProductForReceta, fetchRecetasForProduct]);


  // --- Handlers para Productos Terminados ---
  const handleProductChange = (e) => {
    const { name, value } = e.target;
    setCurrentProduct(prev => ({ ...prev, [name]: value }));
  };

  // Nuevo handler para seleccionar referencia de stock y auto-rellenar
  const handleSelectStockReference = (e) => {
    const selectedRef = e.target.value;
    if (selectedRef === "") {
        setCurrentProduct(prev => ({
            ...prev,
            referencia: '',
            nombre: '',
            coste_fabricacion_estandar: '', // Limpiar también el coste
            // Otros campos que quieras limpiar/resetear
        }));
        return;
    }
    const selectedItem = stockReferencias.find(item => item.referencia_stock === selectedRef);
    if (selectedItem) {
        setCurrentProduct(prev => ({
            ...prev,
            referencia: selectedItem.referencia_stock,
            nombre: `${selectedItem.material_tipo} ${selectedItem.subtipo_material || ''} ${selectedItem.espesor || ''} ${selectedItem.ancho || ''}mm ${selectedItem.color || ''}`.trim(),
            coste_fabricacion_estandar: parseFloat(selectedItem.coste_unitario_final || 0).toFixed(4),
            unidad_medida: selectedItem.unidad_medida || 'unidad'
            // Puedes rellenar más campos si lo consideras oportuno
        }));
    }
  };


  const handleEditProduct = (product) => {
    setCurrentProduct({
      ...product,
      // Asegurarse de que los números se muestren correctamente en el formulario
      coste_fabricacion_estandar: product.coste_fabricacion_estandar !== null ? parseFloat(product.coste_fabricacion_estandar).toFixed(4) : '',
      margen_venta_default: product.margen_venta_default !== null ? parseFloat(product.margen_venta_default).toFixed(2) : '',
      precio_venta_sugerido: product.precio_venta_sugerido !== null ? parseFloat(product.precio_venta_sugerido).toFixed(2) : '',
      coste_extra_unitario: product.coste_extra_unitario !== null ? parseFloat(product.coste_extra_unitario).toFixed(2) : '',
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
      coste_extra_unitario: '',
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

  // Función para rellenar campos de material/componente al seleccionar
  const handleMaterialOrComponentSelect = (e) => {
    const selectedId = parseInt(e.target.value);
    const selectedType = e.target.name; // 'material_id' or 'componente_id'

    let selectedItem = null;
    let materialRef = '';
    let materialType = '';
    let materialEspesor = '';
    let materialAncho = '';
    let materialColor = '';
    let materialUnidad = '';
    let materialDescripcion = ''; // Para componentes

    if (selectedType === 'material_id') {
      selectedItem = materiasPrimas.find(mp => mp.id === selectedId);
      if (selectedItem) {
        materialRef = selectedItem.referencia_stock;
        materialType = selectedItem.material_tipo;
        materialEspesor = selectedItem.espesor;
        materialAncho = selectedItem.ancho;
        materialColor = selectedItem.color;
        materialUnidad = selectedItem.unidad_medida;
      }
    } else if (selectedType === 'componente_id') {
      selectedItem = componentes.find(comp => comp.id === selectedId);
      if (selectedItem) {
        materialRef = selectedItem.componente_ref;
        materialType = 'COMPONENTE';
        materialDescripcion = selectedItem.descripcion;
        materialUnidad = selectedItem.unidad_medida;
      }
    }

    setCurrentReceta(prev => ({
      ...prev,
      [selectedType]: e.target.value, // Guardar el ID seleccionado
      // Rellenar campos para mostrar en la interfaz (no se guardan en la DB de receta)
      display_material_ref: materialRef,
      display_material_type: materialType,
      display_material_espesor: materialEspesor,
      display_material_ancho: materialAncho,
      display_material_color: materialColor,
      display_material_unidad: materialUnidad,
      display_material_descripcion: materialDescripcion,
    }));
  };


  const handleEditReceta = (receta) => {
    // Rellenar los campos de display para que se muestren al editar
    let displayMaterialRef = '';
    let displayMaterialType = '';
    let displayMaterialEspesor = '';
    let displayMaterialAncho = '';
    let displayMaterialColor = '';
    let displayMaterialUnidad = '';
    let displayMaterialDescripcion = '';

    if (receta.material_id) {
        const mp = materiasPrimas.find(m => m.id === receta.material_id);
        if (mp) {
            displayMaterialRef = mp.referencia_stock;
            displayMaterialType = mp.material_tipo;
            displayMaterialEspesor = mp.espesor;
            displayMaterialAncho = mp.ancho;
            displayMaterialColor = mp.color;
            displayMaterialUnidad = mp.unidad_medida;
        }
    } else if (receta.componente_id) {
        const comp = componentes.find(c => c.id === receta.componente_id);
        if (comp) {
            displayMaterialRef = comp.componente_ref;
            displayMaterialType = 'COMPONENTE';
            displayMaterialDescripcion = comp.descripcion;
            displayMaterialUnidad = comp.unidad_medida;
        }
    }

    setCurrentReceta({
      ...receta,
      // Asegurarse de que los IDs sean strings para los selects
      producto_terminado_id: String(receta.producto_terminado_id),
      material_id: receta.material_id ? String(receta.material_id) : '',
      componente_id: receta.componente_id ? String(receta.componente_id) : '',
      // Campos de display para la UI
      display_material_ref: displayMaterialRef,
      display_material_type: displayMaterialType,
      display_material_espesor: displayMaterialEspesor,
      display_material_ancho: displayMaterialAncho,
      display_material_color: displayMaterialColor,
      display_material_unidad: displayMaterialUnidad,
      display_material_descripcion: displayMaterialDescripcion,
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
      // Eliminamos los campos de display del payload
      display_material_ref: undefined,
      display_material_type: undefined,
      display_material_espesor: undefined,
      display_material_ancho: undefined,
      display_material_color: undefined,
      display_material_unidad: undefined,
      display_material_descripcion: undefined,
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
      resetRecetaForm(selectedProductForReceta.id); // Pasa el ID para mantener el producto seleccionado
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

  const resetRecetaForm = (productId = '') => {
    setEditModeReceta(false);
    setCurrentReceta({
      id: null,
      producto_terminado_id: productId, // Mantener el ID del producto seleccionado
      material_id: '',
      componente_id: '',
      notas: '',
      display_material_ref: '', // Limpiar campos de display
      display_material_type: '',
      display_material_espesor: '',
      display_material_ancho: '',
      display_material_color: '',
      display_material_unidad: '',
      display_material_descripcion: '',
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
            {/* Selector de Referencia de Stock para auto-rellenar */}
            {!editModeProducto && (
              <label>Seleccionar de Referencia de Stock (Opcional):
                <select onChange={handleSelectStockReference} value={currentProduct.referencia || ""}>
                  <option value="">-- Seleccione una referencia --</option>
                  {stockReferencias.map(ref => (
                    <option key={ref.referencia_stock} value={ref.referencia_stock}>
                      {ref.referencia_stock} ({ref.material_tipo} {ref.espesor || ''} {ref.ancho || ''}mm - Último Coste: {parseFloat(ref.coste_unitario_final || 0).toFixed(4)}€)
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label>Referencia: <input type="text" name="referencia" value={currentProduct.referencia} onChange={handleProductChange} required={!editModeProducto} readOnly={!editModeProducto && currentProduct.referencia !== ''} /></label> {/* ReadOnly si se selecciona de la lista */}
            <label>Nombre: <input type="text" name="nombre" value={currentProduct.nombre} onChange={handleProductChange} required /></label>
            <label>Descripción: <textarea name="descripcion" value={currentProduct.descripcion} onChange={handleProductChange}></textarea></label>
            <label>Unidad Medida: <input type="text" name="unidad_medida" value={currentProduct.unidad_medida} onChange={handleProductChange} /></label>
            <label>Coste Estándar: <input type="number" step="0.0001" name="coste_fabricacion_estandar" value={currentProduct.coste_fabricacion_estandar} onChange={handleProductChange} readOnly title="Calculado automáticamente por las recetas y procesos" /></label>
            <label>Margen Venta (%): <input type="number" step="0.01" name="margen_venta_default" value={currentProduct.margen_venta_default} onChange={handleProductChange} /></label>
            <label>Precio Sugerido: <input type="number" step="0.01" name="precio_venta_sugerido" value={currentProduct.precio_venta_sugerido} onChange={handleProductChange} /></label>
            <label>Coste Extra Unitario (€): <input type="number" step="0.01" name="coste_extra_unitario" value={currentProduct.coste_extra_unitario} onChange={handleProductChange} /></label> {/* Nuevo campo */}
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
                <th>Coste Extra (€)</th> {/* Nuevo campo */}
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
                  <td>{parseFloat(prod.coste_extra_unitario || 0).toFixed(2)}</td> {/* Mostrar nuevo campo */}
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
                  name="material_or_component_type" // Nuevo nombre para evitar conflicto
                  value={currentReceta.material_id ? 'material' : (currentReceta.componente_id ? 'componente' : '')}
                  onChange={(e) => {
                    const type = e.target.value;
                    setCurrentReceta(prev => ({
                      ...prev,
                      material_id: type === 'material' ? (editModeReceta ? prev.material_id : '') : '',
                      componente_id: type === 'componente' ? (editModeReceta ? prev.componente_id : '') : '',
                      // Limpiar campos de display al cambiar de tipo
                      display_material_ref: '',
                      display_material_type: '',
                      display_material_espesor: '',
                      display_material_ancho: '',
                      display_material_color: '',
                      display_material_unidad: '',
                      display_material_descripcion: '',
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
              {(currentReceta.material_id || (currentReceta.material_id === '' && currentReceta.componente_id === '' && (currentReceta.material_or_component_type === 'material' || (!editModeReceta && !currentReceta.componente_id)))) && (
                <label>Materia Prima:
                  <select name="material_id" value={currentReceta.material_id} onChange={handleMaterialOrComponentSelect} required={!currentReceta.componente_id}>
                    <option value="">Seleccione Materia Prima</option>
                    {materiasPrimas.map(mp => (
                      <option key={mp.id} value={mp.id}>{mp.referencia_stock} ({mp.material_tipo} {mp.espesor || ''} {mp.ancho || ''}mm)</option>
                    ))}
                  </select>
                </label>
              )}

              {/* Selector de Componente */}
              {(currentReceta.componente_id || (currentReceta.material_id === '' && currentReceta.componente_id === '' && (currentReceta.material_or_component_type === 'componente' || (!editModeReceta && !currentReceta.material_id)))) && (
                <label>Componente:
                  <select name="componente_id" value={currentReceta.componente_id} onChange={handleMaterialOrComponentSelect} required={!currentReceta.material_id}>
                    <option value="">Seleccione Componente</option>
                    {componentes.map(comp => (
                      <option key={comp.id} value={comp.id}>{comp.componente_ref} ({comp.descripcion})</option>
                    ))}
                  </select>
                </label>
              )}

              {/* Mostrar detalles del material/componente seleccionado */}
              {(currentReceta.display_material_ref || currentReceta.display_material_type) && (
                <>
                  <label>Ref. Seleccionada: <input type="text" value={currentReceta.display_material_ref} readOnly /></label>
                  <label>Tipo: <input type="text" value={currentReceta.display_material_type} readOnly /></label>
                  {currentReceta.display_material_espesor && <label>Espesor/Desc: <input type="text" value={currentReceta.display_material_espesor} readOnly /></label>}
                  {currentReceta.display_material_ancho && <label>Ancho: <input type="text" value={currentReceta.display_material_ancho} readOnly /></label>}
                  {currentReceta.display_material_color && <label>Color: <input type="text" value={currentReceta.display_material_color} readOnly /></label>}
                  {currentReceta.display_material_unidad && <label>Unidad: <input type="text" value={currentReceta.display_material_unidad} readOnly /></label>}
                </>
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
                      {rec.material_id ? `${rec.material_referencia_stock} (${rec.material_tipo} ${rec.material_espesor || ''} ${rec.material_ancho || ''}mm)` : ''}
                      {rec.componente_id ? `${rec.componente_referencia_stock} (${rec.componente_descripcion || ''})` : ''}
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
