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
    unidad_medida: 'unidad', // FIJO A "unidad" por defecto
    coste_fabricacion_estandar: '',
    margen_venta_default: '', // Este campo se gestiona en configuración, no aquí
    precio_venta_sugerido: '', // Este campo se gestiona en configuración, no aquí
    coste_extra_unitario: '', // Este campo se gestiona en configuración, no aquí
    status: 'ACTIVO'
  });
  // stockReferencias ahora contiene todos los materiales genéricos (MP y Componentes)
  const [materialesGenericos, setMaterialesGenericos] = useState([]); 

  // --- Estados para Recetas ---
  const [recetas, setRecetas] = useState([]);
  const [loadingRecetas, setLoadingRecetas] = useState(false);
  const [errorRecetas, setErrorRecetas] = useState(null);
  const [successRecetaMessage, setSuccessRecetaMessage] = useState('');
  const [editModeReceta, setEditModeReceta] = useState(false);
  const [currentReceta, setCurrentReceta] = useState({
    id: null,
    producto_terminado_id: '',
    // Campos genéricos para materias primas
    material_tipo_generico: '',
    subtipo_material_generico: '',
    espesor_generico: '',
    ancho_generico: '',
    color_generico: '',
    // Campo genérico para componentes
    componente_ref_generico: '',
    // Campos de cantidad y peso
    cantidad_requerida: '',
    unidad_medida_requerida: '',
    unidades_por_ancho_material: '',
    peso_por_unidad_producto: '',
    notas: '',
    // Campo temporal para el selector de tipo (materia_prima/componente)
    material_or_component_type_selector: '' 
  });

  const [selectedProductForReceta, setSelectedProductForReceta] = useState(null);

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

  // --- Fetch de Materiales y Componentes Genéricos (para selects de Recetas) ---
  const fetchMaterialesGenericos = useCallback(async () => {
    try {
      // Ahora llamamos a un endpoint que nos devuelve todos los materiales genéricos
      const response = await fetch('http://localhost:5002/api/materiales-genericos');
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error al cargar materiales genéricos: ${response.status}`);
      }
      const data = await response.json();
      setMaterialesGenericos(data);
    } catch (err) {
      console.error("Error al cargar materiales genéricos para recetas:", err);
      setErrorRecetas(err.message);
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
    fetchMaterialesGenericos(); // Cargar materiales genéricos al inicio
  }, [fetchProductos, fetchMaterialesGenericos]);

  // Cuando se selecciona un producto para ver/añadir recetas
  useEffect(() => {
    if (selectedProductForReceta) {
      fetchRecetasForProduct(selectedProductForReceta.id);
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

  // handleSelectStockReference ya no auto-rellena, solo se usará para el selector de stock en la calculadora de presupuestos
  // Aquí podemos eliminarlo o adaptarlo si se decide usar para algo más en el futuro.
  // Por ahora, el formulario de producto terminado no usa una referencia de stock para auto-rellenar.
  const handleSelectStockReference = (e) => {
    // Esta función ya no tiene el mismo propósito aquí.
    // El formulario de Producto Terminado ahora solo crea el producto, sin vincularlo a una bobina específica.
    // Mantenemos la función como un placeholder o si se decide reutilizarla para otra cosa.
    console.log("handleSelectStockReference llamado, pero ya no auto-rellena productos terminados.");
  };


  const handleEditProduct = (product) => {
    setCurrentProduct({
      ...product,
      // Asegurarse de que los números se muestren correctamente en el formulario
      coste_fabricacion_estandar: product.coste_fabricacion_estandar !== null ? parseFloat(product.coste_fabricacion_estandar).toFixed(4) : '',
      // margen_venta_default, precio_venta_sugerido, coste_extra_unitario ya no se editan aquí
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

    const payload = {
        referencia: currentProduct.referencia,
        nombre: currentProduct.nombre,
        descripcion: currentProduct.descripcion,
        unidad_medida: 'unidad', // Siempre "unidad"
        // Los campos de coste, margen y precio sugerido no se envían desde aquí al crear
        // porque se calculan o gestionan en otro lugar.
        status: currentProduct.status
    };

    const method = editModeProducto ? 'PUT' : 'POST';
    const url = editModeProducto
      ? `http://localhost:5002/api/productos-terminados/${currentProduct.id}`
      : 'http://localhost:5002/api/productos-terminados';

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

  // Handler para el selector de tipo de material/componente en la receta
  const handleMaterialOrComponentTypeChange = (e) => {
    const { value } = e.target;
    setCurrentReceta(prev => ({
      ...prev,
      material_or_component_type_selector: value,
      // Limpiar campos genéricos del otro tipo al cambiar
      material_tipo_generico: value === 'materia_prima' ? prev.material_tipo_generico : '',
      subtipo_material_generico: value === 'materia_prima' ? prev.subtipo_material_generico : '',
      espesor_generico: value === 'materia_prima' ? prev.espesor_generico : '',
      ancho_generico: value === 'materia_prima' ? prev.ancho_generico : '',
      color_generico: value === 'materia_prima' ? prev.color_generico : '',
      componente_ref_generico: value === 'componente' ? prev.componente_ref_generico : '',
    }));
  };

  const handleEditReceta = (receta) => {
    setCurrentReceta({
      ...receta,
      producto_terminado_id: String(receta.producto_terminado_id),
      cantidad_requerida: parseFloat(receta.cantidad_requerida).toFixed(2),
      unidades_por_ancho_material: receta.unidades_por_ancho_material !== null ? parseFloat(receta.unidades_por_ancho_material).toFixed(2) : '',
      peso_por_unidad_producto: receta.peso_por_unidad_producto !== null ? parseFloat(receta.peso_por_unidad_producto).toFixed(4) : '',
      // Determinar el valor del selector de tipo al editar
      material_or_component_type_selector: receta.material_tipo_generico ? 'materia_prima' : (receta.componente_ref_generico ? 'componente' : '')
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

    // Validar que se seleccionó un tipo y que los campos necesarios están llenos
    if (!currentReceta.material_or_component_type_selector) {
        setErrorRecetas("Debe seleccionar si es Materia Prima o Componente.");
        setLoadingRecetas(false); return;
    }
    if (currentReceta.material_or_component_type_selector === 'materia_prima' && !currentReceta.material_tipo_generico) {
        setErrorRecetas("Debe seleccionar un Tipo de Material para la Materia Prima.");
        setLoadingRecetas(false); return;
    }
    if (currentReceta.material_or_component_type_selector === 'componente' && !currentReceta.componente_ref_generico) {
        setErrorRecetas("Debe seleccionar una Referencia de Componente.");
        setLoadingRecetas(false); return;
    }
    if (!currentReceta.cantidad_requerida || !currentReceta.unidad_medida_requerida) {
        setErrorRecetas("Cantidad requerida y unidad de medida son obligatorias.");
        setLoadingRecetas(false); return;
    }


    const payload = {
      producto_terminado_id: parseInt(currentReceta.producto_terminado_id),
      cantidad_requerida: parseFloat(currentReceta.cantidad_requerida),
      unidad_medida_requerida: currentReceta.unidad_medida_requerida,
      unidades_por_ancho_material: currentReceta.unidades_por_ancho_material ? parseFloat(currentReceta.unidades_por_ancho_material) : null,
      peso_por_unidad_producto: currentReceta.peso_por_unidad_producto ? parseFloat(currentReceta.peso_por_unidad_producto) : null,
      notas: currentReceta.notas,
      // Campos genéricos condicionales
      material_tipo_generico: currentReceta.material_or_component_type_selector === 'materia_prima' ? currentReceta.material_tipo_generico : null,
      subtipo_material_generico: currentReceta.material_or_component_type_selector === 'materia_prima' ? (currentReceta.subtipo_material_generico || null) : null,
      espesor_generico: currentReceta.material_or_component_type_selector === 'materia_prima' ? (currentReceta.espesor_generico || null) : null,
      ancho_generico: currentReceta.material_or_component_type_selector === 'materia_prima' ? (currentReceta.ancho_generico ? parseFloat(currentReceta.ancho_generico) : null) : null,
      color_generico: currentReceta.material_or_component_type_selector === 'materia_prima' ? (currentReceta.color_generico || null) : null,
      componente_ref_generico: currentReceta.material_or_component_type_selector === 'componente' ? currentReceta.componente_ref_generico : null,
    };
    
    // Eliminar campos vacíos o nulos para evitar problemas de base de datos con UNIQUE constraints en el backend si se envían valores vacíos
    Object.keys(payload).forEach(key => {
      if (payload[key] === '' || payload[key] === null) {
        delete payload[key];
      }
    });


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
      resetRecetaForm(selectedProductForReceta.id);
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
      producto_terminado_id: productId,
      material_tipo_generico: '',
      subtipo_material_generico: '',
      espesor_generico: '',
      ancho_generico: '',
      color_generico: '',
      componente_ref_generico: '',
      cantidad_requerida: '',
      unidad_medida_requerida: '',
      unidades_por_ancho_material: '',
      peso_por_unidad_producto: '',
      notas: '',
      material_or_component_type_selector: ''
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
            {/* El selector de Referencia de Stock ya no auto-rellena aquí */}
            {/* <label>Seleccionar de Referencia de Stock (Opcional):
              <select onChange={handleSelectStockReference} value={currentProduct.referencia || ""}>
                <option value="">-- Seleccione una referencia --</option>
                {materialesGenericos.filter(m => m.type === 'materia_prima').map(ref => (
                  <option key={ref.referencia_stock} value={ref.referencia_stock}>
                    {ref.display}
                  </option>
                ))}
              </select>
            </label> */}

            <label>Referencia: <input type="text" name="referencia" value={currentProduct.referencia} onChange={handleProductChange} required /></label>
            <label>Nombre: <input type="text" name="nombre" value={currentProduct.nombre} onChange={handleProductChange} required /></label>
            <label>Descripción: <textarea name="descripcion" value={currentProduct.descripcion} onChange={handleProductChange}></textarea></label>
            {/* Unidad de medida ahora es fija a "unidad" para productos terminados */}
            <label>Unidad Medida: <input type="text" name="unidad_medida" value="unidad" readOnly /></label>
            
            {/* Campos de Coste, Margen y Precio Sugerido ahora son solo visualización o se gestionan en otro lugar */}
            <label>Coste Estándar: <input type="number" step="0.0001" name="coste_fabricacion_estandar" value={currentProduct.coste_fabricacion_estandar} readOnly title="Calculado automáticamente por las recetas y procesos" /></label>
            {/* <label>Margen Venta (%): <input type="number" step="0.01" name="margen_venta_default" value={currentProduct.margen_venta_default} onChange={handleProductChange} /></label> */}
            {/* <label>Precio Sugerido: <input type="number" step="0.01" name="precio_venta_sugerido" value={currentProduct.precio_venta_sugerido} onChange={handleProductChange} /></label> */}
            {/* <label>Coste Extra Unitario (€): <input type="number" step="0.01" name="coste_extra_unitario" value={currentProduct.coste_extra_unitario} onChange={handleProductChange} /></label> */}
            
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
                {/* <th>Margen (%)</th>
                <th>Precio Sugerido (€)</th>
                <th>Coste Extra (€)</th> */}
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
                  {/* <td>{(parseFloat(prod.margen_venta_default || 0) * 100).toFixed(2)}%</td>
                  <td>{parseFloat(prod.precio_venta_sugerido || 0).toFixed(2)}</td>
                  <td>{parseFloat(prod.coste_extra_unitario || 0).toFixed(2)}</td> */}
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

              {/* Selector de Tipo de Material/Componente */}
              <label>Tipo de Material/Componente:
                <select
                  name="material_or_component_type_selector"
                  value={currentReceta.material_or_component_type_selector}
                  onChange={handleMaterialOrComponentTypeChange}
                  required
                >
                  <option value="">Seleccione tipo</option>
                  <option value="materia_prima">Materia Prima (Bobina)</option>
                  <option value="componente">Componente</option>
                </select>
              </label>

              {/* Campos para Materia Prima Genérica */}
              {currentReceta.material_or_component_type_selector === 'materia_prima' && (
                <>
                  <label>Tipo Material:
                    <select name="material_tipo_generico" value={currentReceta.material_tipo_generico} onChange={handleRecetaChange} required>
                      <option value="">Seleccione Tipo</option>
                      {/* Asumiendo que estos son los tipos de material de tus bobinas */}
                      {["GOMA", "PVC", "FIELTRO"].map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </label>
                  <label>Subtipo Material: <input type="text" name="subtipo_material_generico" value={currentReceta.subtipo_material_generico} onChange={handleRecetaChange} /></label>
                  <label>Espesor: <input type="text" name="espesor_generico" value={currentReceta.espesor_generico} onChange={handleRecetaChange} /></label>
                  <label>Ancho (mm): <input type="number" step="0.01" name="ancho_generico" value={currentReceta.ancho_generico} onChange={handleRecetaChange} /></label>
                  <label>Color: <input type="text" name="color_generico" value={currentReceta.color_generico} onChange={handleRecetaChange} /></label>
                </>
              )}

              {/* Campo para Componente Genérico */}
              {currentReceta.material_or_component_type_selector === 'componente' && (
                <label>Referencia Componente:
                  <select name="componente_ref_generico" value={currentReceta.componente_ref_generico} onChange={handleRecetaChange} required>
                    <option value="">Seleccione Componente</option>
                    {materialesGenericos.filter(m => m.type === 'componente').map(comp => (
                      <option key={comp.componente_ref} value={comp.componente_ref}>{comp.componente_ref} ({comp.descripcion})</option>
                    ))}
                  </select>
                </label>
              )}
              
              {/* Campos de cantidad y peso */}
              <label>Cantidad Requerida: <input type="number" step="0.01" name="cantidad_requerida" value={currentReceta.cantidad_requerida} onChange={handleRecetaChange} required /></label>
              <label>Unidad Medida Requerida: <input type="text" name="unidad_medida_requerida" value={currentReceta.unidad_medida_requerida} onChange={handleRecetaChange} required /></label>
              
              {/* Campo para unidades_por_ancho_material, solo si es materia prima */}
              {currentReceta.material_or_component_type_selector === 'materia_prima' && (
                <label>Unidades por Ancho (material): <input type="number" step="0.01" name="unidades_por_ancho_material" value={currentReceta.unidades_por_ancho_material} onChange={handleRecetaChange} placeholder="Ej: 2 (si caben 2 al ancho)" /></label>
              )}

              <label>Peso por Unidad de Producto (kg): <input type="number" step="0.0001" name="peso_por_unidad_producto" value={currentReceta.peso_por_unidad_producto} onChange={handleRecetaChange} placeholder="Ej: 0.015 (15 gramos)" /></label>

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
                  <th>Material/Componente Genérico</th> {/* CAMBIADO */}
                  <th>Cantidad Req.</th>
                  <th>Unidad Req.</th>
                  <th>Unid. por Ancho</th>
                  <th>Peso por PT (kg)</th>
                  <th>Notas</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {recetas.map(rec => (
                  <tr key={rec.id}>
                    <td>{rec.id}</td>
                    <td>
                      {rec.material_tipo_generico ? 
                        `${rec.material_tipo_generico} ${rec.subtipo_material_generico || ''} ${rec.espesor_generico || ''} ${rec.ancho_generico || ''}mm ${rec.color_generico || ''}`.trim() : 
                        rec.componente_ref_generico
                      }
                    </td>
                    <td>{parseFloat(rec.cantidad_requerida).toFixed(2)}</td>
                    <td>{rec.unidad_medida_requerida}</td>
                    <td>{rec.unidades_por_ancho_material !== null ? parseFloat(rec.unidades_por_ancho_material).toFixed(0) : '-'}</td>
                    <td>{rec.peso_por_unidad_producto !== null ? parseFloat(rec.peso_por_unidad_producto).toFixed(4) : '-'}</td>
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
