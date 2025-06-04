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

    // Función para obtener los productos terminados del backend
    const fetchProductosTerminados = async () => {
        try {
            const response = await fetch('http://localhost:5002/api/productos-terminados');
            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.status}`);
            }
            const data = await response.json();
            setProductosTerminados(data);
            setError(null); // Limpiar cualquier error anterior
        } catch (err) {
            console.error("Error al obtener productos terminados:", err);
            setError(`Error al obtener productos terminados: ${err.message}`);
        }
    };

    // Función para cargar los materiales genéricos del backend (para el desplegable de material)
    const fetchMaterialesGenericos = async () => {
        try {
            const response = await fetch('http://localhost:5002/api/materiales-genericos');
            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.status}`);
            }
            const data = await response.json();
            setMaterialesGenericos(data);
            setError(null);
        } catch (err) {
            console.error("Error al cargar materiales genéricos para recetas:", err);
            setError(`Error al cargar materiales genéricos: ${err.message}`);
        }
    };

    // Cargar productos terminados y materiales genéricos al montar el componente
    useEffect(() => {
        fetchProductosTerminados();
        fetchMaterialesGenericos();
    }, []);

    // Efecto para recalcular el coste cuando cambian material, espesor, ancho o largo
    // ESTE ES UN PLACEHOLDER. NECESITAS IMPLEMENTAR EL ENDPOINT EN TU BACKEND.
    useEffect(() => {
        const calculateCost = async () => {
            const { material, espesor, ancho, largo } = newProduct;

            // Solo intentar calcular si todos los campos necesarios están presentes y son válidos
            if (material && espesor && ancho > 0 && largo > 0) {
                try {
                    // LLAMADA AL BACKEND: Necesitas crear un endpoint en server.js
                    // Por ejemplo: POST /api/calcular-coste-producto-temporal
                    // Que reciba material, espesor, ancho, largo y devuelva el coste calculado.
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
                        const errorData = await response.json();
                        throw new Error(errorData.error || `Error del servidor: ${response.status}`);
                    }
                    const data = await response.json();
                    setNewProduct(prev => ({ ...prev, coste: data.costeCalculado }));
                } catch (err) {
                    console.error("Error al calcular el coste:", err);
                    // Si hay un error en el cálculo, el coste se resetea a 0
                    setNewProduct(prev => ({ ...prev, coste: 0 }));
                    // Puedes mostrar un mensaje de error al usuario si lo deseas
                    // setError(`Error al calcular coste: ${err.message}`);
                }
            } else {
                // Si faltan datos, el coste es 0
                setNewProduct(prev => ({ ...prev, coste: 0 }));
            }
        };
        calculateCost();
    }, [newProduct.material, newProduct.espesor, newProduct.ancho, newProduct.largo]);


    // Manejar cambios en el formulario de creación de producto
    const handleNewProductChange = (e) => {
        const { name, value } = e.target;
        setNewProduct(prev => ({
            ...prev,
            [name]: value
        }));

        // Si cambia el material, resetear el espesor
        if (name === 'material') {
            setNewProduct(prev => ({ ...prev, espesor: '' }));
        }
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
                unidad_medida: newProduct.unidad_medida, // Siempre 'unidad'
                coste_fabricacion_estandar: newProduct.coste, // El coste calculado
                // Si estos campos son parte del "producto terminado" en tu DB, inclúyelos.
                // Si son para una "receta" asociada al PT, la lógica sería diferente.
                // Para este ejemplo, los enviamos como parte del producto terminado.
                material_principal: newProduct.material,
                espesor_principal: newProduct.espesor,
                ancho_final: newProduct.ancho,
                largo_final: newProduct.largo,
                status: newProduct.status
            };

            const response = await fetch('http://localhost:5002/api/productos-terminados', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(productToSend),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Error del servidor: ${response.status}`);
            }

            const data = await response.json();
            setSuccessMessage(`Producto creado con éxito: ${data.mensaje}`);
            // Limpiar el formulario
            setNewProduct({
                referencia: '', nombre: '', descripcion: '',
                material: '', espesor: '', ancho: '', largo: '',
                unidad_medida: 'unidad', coste: 0, status: 'ACTIVO'
            });
            fetchProductosTerminados(); // Recargar la lista de productos
        } catch (err) {
            console.error("Error al crear producto:", err);
            setError(`Error al crear producto: ${err.message}`);
        }
    };

    // Manejar la edición de un producto existente
    const handleEditProduct = (product) => {
        setEditingProduct({ ...product }); // Cargar los datos del producto en el estado de edición
    };

    // Manejar cambios en el formulario de edición
    const handleEditingProductChange = (e) => {
        const { name, value } = e.target;
        setEditingProduct(prev => ({ ...prev, [name]: value }));
    };

    // Guardar los cambios de un producto editado
    const handleUpdateProduct = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);

        if (!editingProduct || !editingProduct.id) return;

        try {
            const response = await fetch(`http://localhost:5002/api/productos-terminados/${editingProduct.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(editingProduct),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Error del servidor: ${response.status}`);
            }

            setSuccessMessage(`Producto ID ${editingProduct.id} actualizado con éxito.`);
            setEditingProduct(null); // Salir del modo edición
            fetchProductosTerminados(); // Recargar la lista
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
                const errorData = await response.json();
                throw new Error(errorData.error || `Error del servidor: ${response.status}`);
            }

            setSuccessMessage(`Producto ID ${id} eliminado con éxito.`);
            fetchProductosTerminados(); // Recargar la lista
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

                    {/* Nuevos campos de material, espesor, ancho y largo */}
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
                                {/* Mapear los materiales genéricos obtenidos del backend */}
                                {materialesGenericos.map(mat => (
                                    <option key={mat.material_tipo} value={mat.material_tipo}>
                                        {mat.material_tipo}
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
                                value={newProduct.coste.toFixed(4)} // Mostrar con 4 decimales
                                readOnly // Campo de solo lectura
                                className="read-only-input"
                            />
                        </div>
                        {/* La unidad_medida no se muestra, ya que es 'unidad' por defecto */}
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
                            <th>Material Principal</th> {/* Nueva columna */}
                            <th>Espesor Principal</th> {/* Nueva columna */}
                            <th>Ancho Final</th>       {/* Nueva columna */}
                            <th>Largo Final</th>       {/* Nueva columna */}
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
                                    <td>{product.material_principal || 'N/A'}</td> {/* Mostrar nuevo campo */}
                                    <td>{product.espesor_principal || 'N/A'}</td> {/* Mostrar nuevo campo */}
                                    <td>{product.ancho_final !== null ? product.ancho_final.toFixed(2) : 'N/A'}</td> {/* Mostrar nuevo campo */}
                                    <td>{product.largo_final !== null ? product.largo_final.toFixed(2) : 'N/A'}</td> {/* Mostrar nuevo campo */}
                                    <td>{product.coste_fabricacion_estandar !== null ? product.coste_fabricacion_estandar.toFixed(4) : 'N/A'}</td>
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
                            {/* Campos de material, espesor, ancho, largo también deberían ser editables si se permite */}
                            <div className="form-group">
                                <label htmlFor="edit-material">Material:</label>
                                <select
                                    id="edit-material"
                                    name="material_principal" // El nombre en la DB
                                    value={editingProduct.material_principal || ''}
                                    onChange={handleEditingProductChange}
                                    required
                                >
                                    <option value="">Selecciona un material</option>
                                    {materialesGenericos.map(mat => (
                                        <option key={mat.material_tipo} value={mat.material_tipo}>
                                            {mat.material_tipo}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {editingProduct.material_principal && espesorOptions[editingProduct.material_principal] && (
                                <div className="form-group">
                                    <label htmlFor="edit-espesor">Espesor:</label>
                                    <select
                                        id="edit-espesor"
                                        name="espesor_principal" // El nombre en la DB
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
                                    name="ancho_final" // El nombre en la DB
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
                                    name="largo_final" // El nombre en la DB
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
                                    value={editingProduct.coste_fabricacion_estandar !== null ? editingProduct.coste_fabricacion_estandar.toFixed(4) : '0.0000'}
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
