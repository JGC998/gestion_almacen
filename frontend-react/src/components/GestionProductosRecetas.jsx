// frontend-react/src/components/GestionProductosRecetas.jsx
import React, { useState, useEffect, useCallback } from 'react';

function GestionProductosRecetas() {
    const [productosTerminados, setProductosTerminados] = useState([]);
    const [newProduct, setNewProduct] = useState({
        nombre: '',
        material: '', 
        espesor: '',
        ancho: '',
        largo: '',
        unidad_medida: 'unidad',
        coste: 0,
        status: 'ACTIVO'
    });
    const [editingProduct, setEditingProduct] = useState(null);
    
    // Estado para las opciones dinámicas cargadas desde el backend
    const [materialOptions, setMaterialOptions] = useState({});

    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    const fetchProductosTerminados = useCallback(async () => {
        try {
            const response = await fetch('http://localhost:5002/api/productos-terminados');
            if (!response.ok) throw new Error('Error al cargar plantillas de producto.');
            const data = await response.json();
            setProductosTerminados(data);
        } catch (err) {
            setError(err.message);
        }
    }, []);

    const fetchMaterialOptions = useCallback(async () => {
        try {
            const response = await fetch('http://localhost:5002/api/stock/familias-y-espesores');
            if (!response.ok) throw new Error('Error al cargar opciones de materiales.');
            const data = await response.json();
            setMaterialOptions(data);
        } catch (err) {
            setError(err.message);
        }
    }, []);

    useEffect(() => {
        fetchProductosTerminados();
        fetchMaterialOptions();
    }, [fetchProductosTerminados, fetchMaterialOptions]);

    useEffect(() => {
        const calculateCost = async () => {
            const { material, espesor, ancho, largo } = newProduct;
            const numAncho = parseFloat(ancho);
            const numLargo = parseFloat(largo);

            if (material && espesor && !isNaN(numAncho) && numAncho > 0 && !isNaN(numLargo) && numLargo > 0) {
                setError(null);
                try {
                    const response = await fetch('http://localhost:5002/api/calcular-coste-producto-temporal', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            material_tipo: material,
                            espesor: espesor,
                            ancho_producto_m: numAncho,
                            largo_producto_m: numLargo
                        })
                    });
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error || `Error del servidor: ${response.status}`);
                    }
                    const data = await response.json();
                    setNewProduct(prev => ({ ...prev, coste: data.costeCalculado }));
                } catch (err) {
                    setNewProduct(prev => ({ ...prev, coste: 0 }));
                    setError(`Error al calcular el coste: ${err.message}`);
                }
            } else {
                setNewProduct(prev => ({ ...prev, coste: 0 }));
            }
        };

        if (newProduct.material && newProduct.espesor) {
            calculateCost();
        }
    }, [newProduct.material, newProduct.espesor, newProduct.ancho, newProduct.largo]);

    const handleNewProductChange = (e) => {
        const { name, value } = e.target;
        setNewProduct(prev => {
            const updatedProduct = { ...prev, [name]: value };
            if (name === 'material') {
                updatedProduct.espesor = ''; // Resetea el espesor al cambiar de material
            }
            return updatedProduct;
        });
    };
    
    // ... (El resto de funciones de manejo de datos no necesitan cambios)
    const handleCreateProduct = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        try {
            const productToSend = {
                nombre: newProduct.nombre,
                unidad_medida: newProduct.unidad_medida,
                coste_fabricacion_estandar: newProduct.coste,
                material_principal: newProduct.material,
                espesor_principal: newProduct.espesor,
                ancho_final: parseFloat(newProduct.ancho),
                largo_final: parseFloat(newProduct.largo),
                status: newProduct.status
            };
            const response = await fetch('http://localhost:5002/api/productos-terminados', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productToSend),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Error del servidor: ${response.status}`);
            }
            const data = await response.json();
            setSuccessMessage(data.mensaje || `Plantilla creada con éxito. ID: ${data.id}, Ref: ${data.referencia}`);
            setNewProduct({
                nombre: '', material: '', espesor: '', ancho: '', largo: '',
                unidad_medida: 'unidad', coste: 0, status: 'ACTIVO'
            });
            fetchProductosTerminados();
        } catch (err) {
            setError(`Error al crear producto: ${err.message}`);
        }
    };

    const handleEditProduct = (product) => {
        setEditingProduct({ 
            ...product,
            ancho_final: product.ancho_final !== null ? String(product.ancho_final) : '',
            largo_final: product.largo_final !== null ? String(product.largo_final) : '',
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
                id: editingProduct.id,
                nombre: editingProduct.nombre,
                unidad_medida: editingProduct.unidad_medida,
                material_principal: editingProduct.material_principal,
                espesor_principal: editingProduct.espesor_principal,
                ancho_final: parseFloat(editingProduct.ancho_final) || null,
                largo_final: parseFloat(editingProduct.largo_final) || null,
                status: editingProduct.status
            };
            const response = await fetch(`http://localhost:5002/api/productos-terminados/${editingProduct.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productToUpdate),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Error del servidor: ${response.status}`);
            }
            setSuccessMessage(`Producto ID ${editingProduct.id} actualizado.`);
            setEditingProduct(null);
            fetchProductosTerminados();
        } catch (err) {
            setError(`Error al actualizar producto: ${err.message}`);
        }
    };

    const handleDeleteProduct = async (id) => {
        if (!window.confirm(`¿Seguro que quieres eliminar la plantilla ID ${id}?`)) return;
        setError(null); setSuccessMessage(null);
        try {
            const response = await fetch(`http://localhost:5002/api/productos-terminados/${id}`, { method: 'DELETE' });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Error del servidor: ${response.status}`);
            }
            setSuccessMessage(`Plantilla ID ${id} eliminada.`);
            fetchProductosTerminados();
        } catch (err) {
            setError(`Error al eliminar producto: ${err.message}`);
        }
    };


    return (
        <div className="gestion-productos-recetas-container">
            <h1>Gestión de Artículos (Plantillas de Producto)</h1>

            {error && <div className="error-message">{error}</div>}
            {successMessage && <div className="success-message">{successMessage}</div>}

            <div className="form-section">
                <h2>Crear Nueva Plantilla</h2>
                <form onSubmit={handleCreateProduct}>
                    <div className="form-group">
                        <label htmlFor="nombre">Nombre Plantilla:</label>
                        <input type="text" id="nombre" name="nombre" value={newProduct.nombre} onChange={handleNewProductChange} required />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="material">Material:</label>
                            <select id="material" name="material" value={newProduct.material} onChange={handleNewProductChange} required>
                                <option value="">Selecciona un material</option>
                                {Object.keys(materialOptions).map(material => (
                                    <option key={material} value={material}>{material}</option>
                                ))}
                            </select>
                        </div>
                        {newProduct.material && materialOptions[newProduct.material] && (
                            <div className="form-group">
                                <label htmlFor="espesor">Espesor:</label>
                                <select id="espesor" name="espesor" value={newProduct.espesor} onChange={handleNewProductChange} required>
                                    <option value="">Selecciona un espesor</option>
                                    {materialOptions[newProduct.material].map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="ancho">Ancho Producto Final (m):</label>
                            <input type="number" id="ancho" name="ancho" value={newProduct.ancho} onChange={handleNewProductChange} min="0" step="any" placeholder="Ej: 0.55" required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="largo">Largo Producto Final (m):</label>
                            <input type="number" id="largo" name="largo" value={newProduct.largo} onChange={handleNewProductChange} min="0" step="any" placeholder="Ej: 0.5" required />
                        </div>
                    </div>

                    <button type="submit" className="btn-primary">Crear Plantilla</button>
                </form>
            </div>

            <div className="list-section">
                <h2>Listado de Plantillas</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Referencia</th>
                            <th>Nombre</th>
                            <th>Material</th>
                            <th>Espesor</th>
                            <th>Ancho (m)</th>
                            <th>Largo (m)</th>
                            <th>Coste Estándar (€)</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {productosTerminados.map(product => (
                            <tr key={product.id}>
                                <td>{product.referencia}</td>
                                <td>{product.nombre}</td>
                                <td>{product.material_principal || 'N/A'}</td>
                                <td>{product.espesor_principal || 'N/A'}</td>
                                <td>{product.ancho_final !== null ? parseFloat(product.ancho_final).toFixed(2) : 'N/A'}</td>
                                <td>{product.largo_final !== null ? parseFloat(product.largo_final).toFixed(2) : 'N/A'}</td>
                                <td>{product.coste_fabricacion_estandar !== null ? parseFloat(product.coste_fabricacion_estandar).toFixed(4) : 'N/A'}</td>
                                <td>{product.status}</td>
                                <td>
                                    <button onClick={() => handleEditProduct(product)} className="btn-secondary">Editar</button>
                                    <button onClick={() => handleDeleteProduct(product.id)} className="btn-danger">Eliminar</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {editingProduct && (
                <div className="edit-modal">
                    <div className="modal-content">
                        <h2>Editar Plantilla (ID: {editingProduct.id})</h2>
                        <form onSubmit={handleUpdateProduct}>
                            <div className="form-group">
                                <label>Nombre Plantilla:</label>
                                <input type="text" name="nombre" value={editingProduct.nombre} onChange={handleEditingProductChange} required />
                            </div>
                            <div className="form-group">
                                <label>Material:</label>
                                <select name="material_principal" value={editingProduct.material_principal || ''} onChange={handleEditingProductChange} required>
                                    <option value="">Selecciona material</option>
                                    {Object.keys(materialOptions).map(material => (
                                        <option key={material} value={material}>{material}</option>
                                    ))}
                                </select>
                            </div>
                            {editingProduct.material_principal && materialOptions[editingProduct.material_principal] && (
                                <div className="form-group">
                                    <label>Espesor:</label>
                                    <select name="espesor_principal" value={editingProduct.espesor_principal || ''} onChange={handleEditingProductChange} required>
                                        <option value="">Selecciona espesor</option>
                                        {materialOptions[editingProduct.material_principal].map(option => (
                                            <option key={option} value={option}>{option}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="form-group">
                                <label>Ancho Producto Final (m):</label>
                                <input type="number" name="ancho_final" value={editingProduct.ancho_final || ''} onChange={handleEditingProductChange} min="0" step="any" required />
                            </div>
                            <div className="form-group">
                                <label>Largo Producto Final (m):</label>
                                <input type="number" name="largo_final" value={editingProduct.largo_final || ''} onChange={handleEditingProductChange} min="0" step="any" required />
                            </div>
                            <div className="form-group">
                                <label>Estado:</label>
                                <select name="status" value={editingProduct.status} onChange={handleEditingProductChange}>
                                    <option value="ACTIVO">ACTIVO</option>
                                    <option value="DESCATALOGADO">DESCATALOGADO</option>
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