import React, { useState, useEffect } from 'react';

function GestionProductosRecetas() {
    // Estado para almacenar la lista de productos terminados
    const [productosTerminados, setProductosTerminados] = useState([]);
    // Estado para manejar los datos del nuevo producto a crear
    const [newProduct, setNewProduct] = useState({
        referencia: '',
        nombre: '',
        descripcion: '',
        material: '', // Nuevo campo para el material principal (Goma, PVC, Fieltro)
        espesor: '',  // Nuevo campo para el espesor, dependiente del material
        ancho: '',    // Nuevo campo para el ancho
        largo: '',    // Nuevo campo para el largo
        unidad_medida: 'unidad', // Se registra internamente, no se muestra en el formulario
        coste: 0,     // Coste calculado, se mostrará como de solo lectura
        status: 'ACTIVO' // Estado por defecto para nuevos productos
    });
    // Estado para manejar el producto que se está editando
    const [editingProduct, setEditingProduct] = useState(null);
    // Estado para almacenar los materiales genéricos (para el desplegable de material)
    // Esta variable ahora se usa para obtener los tipos principales, pero el fetch original se mantiene por si se usa en otro lado o para desarrollo futuro.
    const [materialesGenericos, setMaterialesGenericos] = useState([]);
    // Estado para errores de carga o creación
    const [error, setError] = useState(null);
    // Estado para mensajes de éxito
    const [successMessage, setSuccessMessage] = useState(null);

    // Opciones de espesor condicionales basadas en el material seleccionado
    const espesorOptions = {
        'Goma': ['6mm', '8mm', '10mm', '12mm', '15mm'],
        'PVC': ['2mm', '3mm'],
        'Fieltro': ['F10', 'F15']
    };
    
    // Opciones para los desplegables de material principal
    const materialPrincipalOptions = Object.keys(espesorOptions);

    // Función para obtener los productos terminados del backend
    const fetchProductosTerminados = async () => {
        try {
            const response = await fetch('http://localhost:5002/api/productos-terminados');
            if (!response.ok) {
                // Intenta parsear el error del backend si es JSON
                let errorMsg = `Error del servidor: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorData.detalle || errorMsg;
                } catch (e) {
                    // No hacer nada si el cuerpo del error no es JSON
                }
                throw new Error(errorMsg);
            }
            const data = await response.json();
            setProductosTerminados(data);
            setError(null); // Limpiar cualquier error anterior
        } catch (err) {
            console.error("Error al obtener productos terminados:", err);
            setError(`Error al obtener productos terminados: ${err.message}`);
        }
    };

    // Función para cargar los materiales genéricos del backend
    // Esta función se mantiene por si es necesaria para futuras ampliaciones de "Recetas",
    // pero el dropdown de material principal ahora usa materialPrincipalOptions.
    const fetchMaterialesGenericos = async () => {
        try {
            const response = await fetch('http://localhost:5002/api/materiales-genericos');
            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.status}`);
            }
            const data = await response.json();
            setMaterialesGenericos(data); // Podría usarse para otros selectores más detallados
            setError(null);
        } catch (err) {
            console.error("Error al cargar materiales genéricos para recetas:", err);
            setError(`Error al cargar materiales genéricos: ${err.message}`);
        }
    };

    // Cargar productos terminados y materiales genéricos al montar el componente
    useEffect(() => {
        fetchProductosTerminados();
        fetchMaterialesGenericos(); // Se mantiene por si acaso, aunque el dropdown principal no lo use directamente
    }, []);

    // Efecto para recalcular el coste cuando cambian material, espesor, ancho o largo
    useEffect(() => {
        const calculateCost = async () => {
            const { material, espesor, ancho, largo } = newProduct;
            if (material && espesor && ancho > 0 && largo > 0) {
                try {
                    const response = await fetch('http://localhost:5002/api/calcular-coste-producto-temporal', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            material_tipo: material,
                            espesor: espesor,
                            ancho: parseFloat(ancho),
                            largo: parseFloat(largo)
                        })
                    });
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error || `Error del servidor: ${response.status}`);
                    }
                    const data = await response.json();
                    setNewProduct(prev => ({ ...prev, coste: data.costeCalculado }));
                } catch (err) {
                    console.error("Error al calcular el coste:", err);
                    setNewProduct(prev => ({ ...prev, coste: 0 }));
                }
            } else {
                setNewProduct(prev => ({ ...prev, coste: 0 }));
            }
        };
        if (newProduct.material && newProduct.espesor && newProduct.ancho && newProduct.largo) {
            calculateCost();
        }
    }, [newProduct.material, newProduct.espesor, newProduct.ancho, newProduct.largo]);


    // Manejar cambios en el formulario de creación de producto
    const handleNewProductChange = (e) => {
        const { name, value } = e.target;
        setNewProduct(prev => {
            const updatedProduct = { ...prev, [name]: value };
            // Si cambia el material, resetear el espesor
            if (name === 'material') {
                updatedProduct.espesor = '';
            }
            return updatedProduct;
        });
    };

    // Manejar el envío del formulario para crear un nuevo producto
    const handleCreateProduct = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);

        try {
            const productToSend = {
                referencia: newProduct.referencia,
                nombre: newProduct.nombre,
                descripcion: newProduct.descripcion,
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
                throw new Error(errorData.error || errorData.detalle || `Error del servidor: ${response.status}`);
            }

            const data = await response.json();
            setSuccessMessage(data.mensaje || `Producto creado con éxito.`); // Modificado para usar data.mensaje
            setNewProduct({
                referencia: '', nombre: '', descripcion: '',
                material: '', espesor: '', ancho: '', largo: '',
                unidad_medida: 'unidad', coste: 0, status: 'ACTIVO'
            });
            fetchProductosTerminados();
        } catch (err) {
            console.error("Error al crear producto:", err);
            setError(`Error al crear producto: ${err.message}`);
        }
    };

    // Manejar la edición de un producto existente
    const handleEditProduct = (product) => {
        // Asegurarse de que los valores numéricos se tratan como strings para los inputs si es necesario,
        // o se convierten a número donde haga falta. Aquí los dejamos como vienen si el input los maneja.
        setEditingProduct({ ...product });
    };

    // Manejar cambios en el formulario de edición
    const handleEditingProductChange = (e) => {
        const { name, value } = e.target;
        setEditingProduct(prev => {
            const updatedProduct = { ...prev, [name]: value };
            if (name === 'material_principal') { // material_principal es el name en el form de edición
                updatedProduct.espesor_principal = ''; // Resetea el espesor si cambia el material
            }
            return updatedProduct;
        });
    };

    // Guardar los cambios de un producto editado
    const handleUpdateProduct = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);

        if (!editingProduct || !editingProduct.id) return;

        try {
            // Asegurarse que ancho_final y largo_final son números
            const productToUpdate = {
                ...editingProduct,
                ancho_final: parseFloat(editingProduct.ancho_final) || 0,
                largo_final: parseFloat(editingProduct.largo_final) || 0,
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

    // Eliminar un producto
    const handleDeleteProduct = async (id) => {
        if (!window.confirm(`¿Estás seguro de que quieres eliminar el producto con ID ${id}?`)) {
            return;
        }
        setError(null);
        setSuccessMessage(null);

        try {
            const response = await fetch(`http://localhost:5002/api/productos-terminados/${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.detalle || `Error del servidor: ${response.status}`);
            }
            
            setSuccessMessage(`Producto ID ${id} eliminado con éxito.`);
            fetchProductosTerminados();
        } catch (err) {
            console.error("Error al eliminar producto:", err);
            setError(`Error al eliminar producto: ${err.message}`);
        }
    };

    return (
        <div className="gestion-productos-recetas-container">
            <h1>Gestión de Productos Terminados</h1>

            {error && <div className="error-message">{error}</div>}
            {successMessage && <div className="success-message">{successMessage}</div>}

            {/* Formulario para Crear Nuevo Producto */}
            <div className="form-section">
                <h2>Crear Nuevo Producto</h2>
                <form onSubmit={handleCreateProduct}>
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="referencia">Referencia:</label>
                            <input
                                type="text"
                                id="referencia"
                                name="referencia"
                                value={newProduct.referencia}
                                onChange={handleNewProductChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="nombre">Nombre:</label>
                            <input
                                type="text"
                                id="nombre"
                                name="nombre"
                                value={newProduct.nombre}
                                onChange={handleNewProductChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group full-width">
                            <label htmlFor="descripcion">Descripción:</label>
                            <textarea
                                id="descripcion"
                                name="descripcion"
                                value={newProduct.descripcion}
                                onChange={handleNewProductChange}
                            ></textarea>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="material">Material:</label>
                            <select
                                id="material"
                                name="material"
                                value={newProduct.material}
                                onChange={handleNewProductChange}
                                required
                            >
                                <option value="">Selecciona un material</option>
                                {materialPrincipalOptions.map(material => (
                                    <option key={material} value={material}>
                                        {material}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {newProduct.material && espesorOptions[newProduct.material] && (
                            <div className="form-group">
                                <label htmlFor="espesor">Espesor:</label>
                                <select
                                    id="espesor"
                                    name="espesor"
                                    value={newProduct.espesor}
                                    onChange={handleNewProductChange}
                                    required
                                >
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
                            <label htmlFor="ancho">Ancho (m):</label>
                            <input
                                type="number"
                                id="ancho"
                                name="ancho"
                                value={newProduct.ancho}
                                onChange={handleNewProductChange}
                                min="0"
                                step="any"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="largo">Largo (m):</label>
                            <input
                                type="number"
                                id="largo"
                                name="largo"
                                value={newProduct.largo}
                                onChange={handleNewProductChange}
                                min="0"
                                step="any"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="coste">Coste Calculado:</label>
                            <input
                                type="text"
                                id="coste"
                                name="coste"
                                value={newProduct.coste.toFixed(4)}
                                readOnly
                                className="read-only-input"
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn-primary">Crear Producto</button>
                </form>
            </div>

            {/* Listado de Productos Terminados */}
            <div className="list-section">
                <h2>Listado de Productos Terminados</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Referencia</th>
                            <th>Nombre</th>
                            <th>Descripción</th>
                            <th>Material Principal</th>
                            <th>Espesor Principal</th>
                            <th>Ancho Final</th>
                            <th>Largo Final</th>
                            <th>Coste Estándar</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {productosTerminados.length === 0 ? (
                            <tr>
                                <td colSpan="10">No hay productos terminados registrados.</td>
                            </tr>
                        ) : (
                            productosTerminados.map(product => (
                                <tr key={product.id}>
                                    <td>{product.referencia}</td>
                                    <td>{product.nombre}</td>
                                    <td>{product.descripcion}</td>
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

            {/* Formulario de Edición (Modal o similar) */}
            {editingProduct && (
                <div className="edit-modal">
                    <div className="modal-content">
                        <h2>Editar Producto</h2>
                        <form onSubmit={handleUpdateProduct}>
                            <div className="form-group">
                                <label htmlFor="edit-referencia">Referencia:</label>
                                <input
                                    type="text"
                                    id="edit-referencia"
                                    name="referencia"
                                    value={editingProduct.referencia}
                                    onChange={handleEditingProductChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="edit-nombre">Nombre:</label>
                                <input
                                    type="text"
                                    id="edit-nombre"
                                    name="nombre"
                                    value={editingProduct.nombre}
                                    onChange={handleEditingProductChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="edit-descripcion">Descripción:</label>
                                <textarea
                                    id="edit-descripcion"
                                    name="descripcion"
                                    value={editingProduct.descripcion || ''}
                                    onChange={handleEditingProductChange}
                                ></textarea>
                            </div>
                            <div className="form-group">
                                <label htmlFor="edit-material">Material:</label>
                                <select
                                    id="edit-material"
                                    name="material_principal"
                                    value={editingProduct.material_principal || ''}
                                    onChange={handleEditingProductChange}
                                    required
                                >
                                    <option value="">Selecciona un material</option>
                                    {materialPrincipalOptions.map(material => (
                                        <option key={material} value={material}>
                                            {material}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {editingProduct.material_principal && espesorOptions[editingProduct.material_principal] && (
                                <div className="form-group">
                                    <label htmlFor="edit-espesor">Espesor:</label>
                                    <select
                                        id="edit-espesor"
                                        name="espesor_principal"
                                        value={editingProduct.espesor_principal || ''}
                                        onChange={handleEditingProductChange}
                                        required
                                    >
                                        <option value="">Selecciona un espesor</option>
                                        {espesorOptions[editingProduct.material_principal].map(option => (
                                            <option key={option} value={option}>{option}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="form-group">
                                <label htmlFor="edit-ancho">Ancho (m):</label>
                                <input
                                    type="number"
                                    id="edit-ancho"
                                    name="ancho_final"
                                    value={editingProduct.ancho_final || ''}
                                    onChange={handleEditingProductChange}
                                    min="0"
                                    step="any"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="edit-largo">Largo (m):</label>
                                <input
                                    type="number"
                                    id="edit-largo"
                                    name="largo_final"
                                    value={editingProduct.largo_final || ''}
                                    onChange={handleEditingProductChange}
                                    min="0"
                                    step="any"
                                    required
                                />
                            </div>
                            
                            <div className="form-group">
                                <label htmlFor="edit-coste">Coste Estándar:</label>
                                <input
                                    type="text"
                                    id="edit-coste"
                                    name="coste_fabricacion_estandar"
                                    value={editingProduct.coste_fabricacion_estandar !== null && editingProduct.coste_fabricacion_estandar !== undefined ? parseFloat(editingProduct.coste_fabricacion_estandar).toFixed(4) : '0.0000'}
                                    readOnly
                                    className="read-only-input"
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="edit-status">Estado:</label>
                                <select
                                    id="edit-status"
                                    name="status"
                                    value={editingProduct.status}
                                    onChange={handleEditingProductChange}
                                >
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
