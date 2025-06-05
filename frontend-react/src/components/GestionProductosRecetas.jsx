// frontend-react/src/components/GestionProductosRecetas.jsx
import React, { useState, useEffect } from 'react';

function GestionProductosRecetas() {
    const [productosTerminados, setProductosTerminados] = useState([]);
    const [newProduct, setNewProduct] = useState({
        // referencia: '', // ELIMINADO - Se generará en backend
        nombre: '',
        // descripcion: '', // ELIMINADO
        material: '', 
        espesor: '',
        ancho: '',    // Ancho del producto final
        largo: '',    // Largo del producto final
        unidad_medida: 'unidad',
        coste: 0,     // Coste calculado para la creación
        status: 'ACTIVO'
        // Considerar añadir coste_extra_unitario si el usuario debe ingresarlo
    });
    const [editingProduct, setEditingProduct] = useState(null);
    const [materialesGenericos, setMaterialesGenericos] = useState([]); // Se mantiene por si se usa para recetas en el futuro
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    const espesorOptions = {
        'Goma': ['6mm', '8mm', '10mm', '12mm', '15mm'],
        'PVC': ['2mm', '3mm'],
        'Fieltro': ['F10', 'F15']
    };
    const materialPrincipalOptions = Object.keys(espesorOptions);

    const fetchProductosTerminados = async () => {
        try {
            const response = await fetch('http://localhost:5002/api/productos-terminados');
            if (!response.ok) {
                let errorMsg = `Error del servidor: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorData.detalle || errorMsg;
                } catch (e) { /* No hacer nada si el cuerpo del error no es JSON */ }
                throw new Error(errorMsg);
            }
            const data = await response.json();
            setProductosTerminados(data);
            setError(null);
        } catch (err) {
            console.error("Error al obtener productos terminados:", err);
            setError(`Error al obtener productos terminados: ${err.message}`);
        }
    };

    const fetchMaterialesGenericos = async () => {
        try {
            const response = await fetch('http://localhost:5002/api/materiales-genericos');
            if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);
            const data = await response.json();
            setMaterialesGenericos(data);
            setError(null);
        } catch (err) {
            console.error("Error al cargar materiales genéricos:", err);
            setError(`Error al cargar materiales genéricos: ${err.message}`);
        }
    };

    useEffect(() => {
        fetchProductosTerminados();
        fetchMaterialesGenericos();
    }, []);

    // frontend-react/src/components/GestionProductosRecetas.jsx
    useEffect(() => {
        const calculateCost = async () => {
            const { material, espesor, ancho, largo } = newProduct;

            // Convertir a número y validar
            const numAncho = parseFloat(ancho);
            const numLargo = parseFloat(largo);

            if (material && espesor && !isNaN(numAncho) && numAncho > 0 && !isNaN(numLargo) && numLargo > 0) {
                setError(null); // Limpiar error anterior de cálculo si ahora los datos son válidos
                try {
                    const response = await fetch('http://localhost:5002/api/calcular-coste-producto-temporal', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            material_tipo: material,
                            espesor: espesor,
                            ancho_producto_m: numAncho, // Enviar los números parseados
                            largo_producto_m: numLargo  // Enviar los números parseados
                        })
                    });
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error || errorData.detalle || `Error del servidor: ${response.status}`);
                    }
                    const data = await response.json();
                    setNewProduct(prev => ({ ...prev, coste: data.costeCalculado }));
                } catch (err) {
                    console.error("Error al calcular el coste:", err.message);
                    setNewProduct(prev => ({ ...prev, coste: 0 }));
                    // Mostrar el error específico del backend si es un 400 (datos inválidos)
                    if (err.message.includes("Datos incompletos")) {
                        setError(err.message); // Mostrar el mensaje de error del backend
                    } else {
                        setError(`Error al calcular el coste: ${err.message}`);
                    }
                }
            } else {
                // Si los datos no son válidos para calcular, resetear el coste y no mostrar error de cálculo.
                setNewProduct(prev => ({ ...prev, coste: 0 }));
                // No llamar a setError aquí si es solo por falta de datos iniciales.
            }
        };

        // Llamar a calculateCost solo si hay material y espesor.
        // La validación interna de calculateCost se encarga del ancho y largo.
        if (newProduct.material && newProduct.espesor) {
            calculateCost();
        } else {
            // Si no hay material o espesor, el coste es 0 y no hay error de cálculo
            setNewProduct(prev => ({ ...prev, coste: 0 }));
            setError(null); // Limpiar cualquier error previo de cálculo
        }
    }, [newProduct.material, newProduct.espesor, newProduct.ancho, newProduct.largo]); // Dependencias

    const handleNewProductChange = (e) => {
        const { name, value } = e.target;
        setNewProduct(prev => {
            const updatedProduct = { ...prev, [name]: value };
            if (name === 'material') {
                updatedProduct.espesor = '';
            }
            return updatedProduct;
        });
    };

    const handleCreateProduct = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        try {
            const productToSend = {
                nombre: newProduct.nombre,
                unidad_medida: newProduct.unidad_medida,
                coste_fabricacion_estandar: newProduct.coste, // Este es el coste calculado para el frontend
                material_principal: newProduct.material,
                espesor_principal: newProduct.espesor,
                ancho_final: parseFloat(newProduct.ancho),
                largo_final: parseFloat(newProduct.largo),
                status: newProduct.status
                // coste_extra_unitario: parseFloat(newProduct.coste_extra_unitario) || 0, // Añadir si es necesario
            };
            const response = await fetch('http://localhost:5002/api/productos-terminados', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productToSend),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.detalle || `Error del servidor: ${response.status}`);
            }
            const data = await response.json();
            setSuccessMessage(data.mensaje || `Producto (plantilla) creado con éxito. ID: ${data.id}, Ref: ${data.referencia}`);
            setNewProduct({
                nombre: '', material: '', espesor: '', ancho: '', largo: '',
                unidad_medida: 'unidad', coste: 0, status: 'ACTIVO'
            });
            fetchProductosTerminados();
        } catch (err) {
            console.error("Error al crear producto:", err);
            setError(`Error al crear producto: ${err.message}`);
        }
    };

    const handleEditProduct = (product) => {
        // La 'referencia' y 'descripcion' no se editan, pero vienen en el objeto 'product' de la BD.
        // Se cargarán los demás campos al estado editingProduct.
        setEditingProduct({ 
            ...product,
            // Asegurar que los campos numéricos sean strings para los inputs si es necesario, o que los inputs los manejen
            ancho_final: product.ancho_final !== null && product.ancho_final !== undefined ? String(product.ancho_final) : '',
            largo_final: product.largo_final !== null && product.largo_final !== undefined ? String(product.largo_final) : '',
            // coste_extra_unitario: product.coste_extra_unitario !== null ? String(product.coste_extra_unitario) : '' // Si se añade
        });
    };

    const handleEditingProductChange = (e) => {
        const { name, value } = e.target;
        setEditingProduct(prev => {
            const updatedProduct = { ...prev, [name]: value };
            if (name === 'material_principal') {
                updatedProduct.espesor_principal = '';
            }
            return updatedProduct;
        });
    };

    const handleUpdateProduct = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        if (!editingProduct || !editingProduct.id) return;
        try {
            const productToUpdate = {
                // No se envía 'referencia' ni 'descripcion' para actualizar
                id: editingProduct.id, // Necesario para el WHERE en el backend
                nombre: editingProduct.nombre,
                unidad_medida: editingProduct.unidad_medida,
                // coste_fabricacion_estandar se recalculará en backend si cambian componentes/procesos
                // No se actualiza directamente desde este formulario usualmente, a menos que edites sus componentes aquí.
                material_principal: editingProduct.material_principal,
                espesor_principal: editingProduct.espesor_principal,
                ancho_final: parseFloat(editingProduct.ancho_final) || null,
                largo_final: parseFloat(editingProduct.largo_final) || null,
                status: editingProduct.status
                // coste_extra_unitario: parseFloat(editingProduct.coste_extra_unitario) || 0, // Si se añade
            };
            const response = await fetch(`http://localhost:5002/api/productos-terminados/${editingProduct.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productToUpdate),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.detalle || `Error del servidor: ${response.status}`);
            }
            setSuccessMessage(`Producto ID ${editingProduct.id} actualizado con éxito.`);
            setEditingProduct(null);
            fetchProductosTerminados();
        } catch (err) {
            console.error("Error al actualizar producto:", err);
            setError(`Error al actualizar producto: ${err.message}`);
        }
    };

    const handleDeleteProduct = async (id) => {
        if (!window.confirm(`¿Estás seguro de que quieres eliminar la plantilla de producto con ID ${id}?`)) return;
        setError(null); setSuccessMessage(null);
        try {
            const response = await fetch(`http://localhost:5002/api/productos-terminados/${id}`, { method: 'DELETE' });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.detalle || `Error del servidor: ${response.status}`);
            }
            setSuccessMessage(`Plantilla de producto ID ${id} eliminada con éxito.`);
            fetchProductosTerminados();
        } catch (err) {
            console.error("Error al eliminar producto:", err);
            setError(`Error al eliminar producto: ${err.message}`);
        }
    };

    return (
        <div className="gestion-productos-recetas-container">
            <h1>Gestión de Plantillas de Producto</h1>

            {error && <div className="error-message">{error}</div>}
            {successMessage && <div className="success-message">{successMessage}</div>}

            <div className="form-section">
                <h2>Crear Nueva Plantilla de Producto</h2>
                <form onSubmit={handleCreateProduct}>
                    <div className="form-row">
                        {/* Referencia Eliminada del Formulario */}
                        <div className="form-group">
                            <label htmlFor="nombre">Nombre Plantilla:</label>
                            <input type="text" id="nombre" name="nombre" value={newProduct.nombre} onChange={handleNewProductChange} required />
                        </div>
                    </div>

                    {/* Descripción Eliminada del Formulario */}

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="material">Material Principal:</label>
                            <select id="material" name="material" value={newProduct.material} onChange={handleNewProductChange} required>
                                <option value="">Selecciona un material</option>
                                {materialPrincipalOptions.map(material => (
                                    <option key={material} value={material}>{material}</option>
                                ))}
                            </select>
                        </div>
                        {newProduct.material && espesorOptions[newProduct.material] && (
                            <div className="form-group">
                                <label htmlFor="espesor">Espesor Principal:</label>
                                <select id="espesor" name="espesor" value={newProduct.espesor} onChange={handleNewProductChange} required>
                                    <option value="">Selecciona un espesor</option>
                                    {espesorOptions[newProduct.material].map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="ancho">Ancho Producto Final (m):</label>
                            <input type="number" id="ancho" name="ancho" value={newProduct.ancho} onChange={handleNewProductChange} min="0" step="any" placeholder="Ej: 0.5" required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="largo">Largo Producto Final (m):</label>
                            <input type="number" id="largo" name="largo" value={newProduct.largo} onChange={handleNewProductChange} min="0" step="any" placeholder="Ej: 1.2" required />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="coste">Coste Material Estimado (para esta plantilla):</label>
                            <input type="text" id="coste" name="coste" value={newProduct.coste.toFixed(4)} readOnly className="read-only-input" />
                        </div>
                        {/* Podrías añadir un campo para coste_extra_unitario aquí si es necesario */}
                    </div>

                    <button type="submit" className="btn-primary">Crear Plantilla</button>
                </form>
            </div>

            <div className="list-section">
                <h2>Listado de Plantillas de Producto</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Referencia</th>{/* Se puede mantener para ver la generada */}
                            <th>Nombre Plantilla</th>
                            {/* Descripción Eliminada */}
                            <th>Material Principal</th>
                            <th>Espesor Principal</th>
                            <th>Ancho Final (m)</th>
                            <th>Largo Final (m)</th>
                            <th>Coste Estándar (€)</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {productosTerminados.length === 0 ? (
                            <tr>
                                <td colSpan="9">No hay plantillas de producto registradas.</td>{/* Ajustar colSpan */}
                            </tr>
                        ) : (
                            productosTerminados.map(product => (
                                <tr key={product.id}>
                                    <td>{product.referencia}</td>
                                    <td>{product.nombre}</td>
                                    {/* product.descripcion ELIMINADO */}
                                    <td>{product.material_principal || 'N/A'}</td>
                                    <td>{product.espesor_principal || 'N/A'}</td>
                                    <td>{product.ancho_final !== null && product.ancho_final !== undefined ? parseFloat(product.ancho_final).toFixed(2) : 'N/A'}</td>
                                    <td>{product.largo_final !== null && product.largo_final !== undefined ? parseFloat(product.largo_final).toFixed(2) : 'N/A'}</td>
                                    <td>{product.coste_fabricacion_estandar !== null && product.coste_fabricacion_estandar !== undefined ? parseFloat(product.coste_fabricacion_estandar).toFixed(4) : 'N/A'}</td>
                                    <td>{product.status}</td>
                                    <td>
                                        <button onClick={() => handleEditProduct(product)} className="btn-secondary">Editar</button>
                                        <button onClick={() => handleDeleteProduct(product.id)} className="btn-danger">Eliminar</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {editingProduct && (
                <div className="edit-modal">
                    <div className="modal-content">
                        <h2>Editar Plantilla de Producto (ID: {editingProduct.id} / Ref: {editingProduct.referencia})</h2>
                        <form onSubmit={handleUpdateProduct}>
                            {/* Referencia no editable */}
                            <div className="form-group">
                                <label htmlFor="edit-nombre">Nombre Plantilla:</label>
                                <input type="text" id="edit-nombre" name="nombre" value={editingProduct.nombre} onChange={handleEditingProductChange} required />
                            </div>
                            {/* Descripción eliminada */}
                            <div className="form-group">
                                <label htmlFor="edit-material">Material Principal:</label>
                                <select id="edit-material" name="material_principal" value={editingProduct.material_principal || ''} onChange={handleEditingProductChange} required>
                                    <option value="">Selecciona un material</option>
                                    {materialPrincipalOptions.map(material => (
                                        <option key={material} value={material}>{material}</option>
                                    ))}
                                </select>
                            </div>
                            {editingProduct.material_principal && espesorOptions[editingProduct.material_principal] && (
                                <div className="form-group">
                                    <label htmlFor="edit-espesor">Espesor Principal:</label>
                                    <select id="edit-espesor" name="espesor_principal" value={editingProduct.espesor_principal || ''} onChange={handleEditingProductChange} required>
                                        <option value="">Selecciona un espesor</option>
                                        {espesorOptions[editingProduct.material_principal].map(option => (
                                            <option key={option} value={option}>{option}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="form-group">
                                <label htmlFor="edit-ancho">Ancho Producto Final (m):</label>
                                <input type="number" id="edit-ancho" name="ancho_final" value={editingProduct.ancho_final || ''} onChange={handleEditingProductChange} min="0" step="any" required />
                            </div>
                            <div className="form-group">
                                <label htmlFor="edit-largo">Largo Producto Final (m):</label>
                                <input type="number" id="edit-largo" name="largo_final" value={editingProduct.largo_final || ''} onChange={handleEditingProductChange} min="0" step="any" required />
                            </div>
                            <div className="form-group">
                                <label htmlFor="edit-coste">Coste Fabricación Estándar (calculado):</label>
                                <input type="text" id="edit-coste" name="coste_fabricacion_estandar" value={editingProduct.coste_fabricacion_estandar !== null && editingProduct.coste_fabricacion_estandar !== undefined ? parseFloat(editingProduct.coste_fabricacion_estandar).toFixed(4) : 'N/A'} readOnly className="read-only-input" />
                            </div>
                             {/* Podrías añadir un campo para coste_extra_unitario aquí si es necesario */}
                            <div className="form-group">
                                <label htmlFor="edit-status">Estado:</label>
                                <select id="edit-status" name="status" value={editingProduct.status} onChange={handleEditingProductChange}>
                                    <option value="ACTIVO">ACTIVO</option>
                                    <option value="DESCATALOGADO">DESCATALOGADO</option>
                                    <option value="OBSOLETO">OBSOLETO</option>
                                </select>
                            </div>
                            <div className="modal-actions">
                                <button type="submit" className="btn-primary">Guardar Cambios</button>
                                <button type="button" onClick={() => setEditingProduct(null)} className="btn-secondary">Cancelar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default GestionProductosRecetas;