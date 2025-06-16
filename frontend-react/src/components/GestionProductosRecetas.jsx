// frontend-react/src/components/GestionProductosRecetas.jsx
import React, { useState, useEffect, useCallback } from 'react';
import '../App.css'; // Reutilizamos estilos

function GestionProductosRecetas() {
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // --- Estado para el nuevo producto ---
    const [sku, setSku] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [familiaId, setFamiliaId] = useState('');
    const [atributos, setAtributos] = useState([{ nombre: '', valor: '' }]);
    
    // --- Estado para los catálogos ---
    const [familias, setFamilias] = useState([]);

    const fetchProductos = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch('http://localhost:5002/api/productos-terminados');
            if (!response.ok) throw new Error('No se pudieron cargar los artículos.');
            setProductos(await response.json());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const fetchCatalogos = async () => {
            const famRes = await fetch('http://localhost:5002/api/familias');
            const famData = await famRes.json();
            setFamilias(famData);
            if (famData.length > 0) setFamiliaId(famData[0].id);
        };
        fetchCatalogos();
        fetchProductos();
    }, [fetchProductos]);

    const handleAtributoChange = (index, event) => {
        const values = [...atributos];
        values[index][event.target.name] = event.target.value;
        setAtributos(values);
    };

    const addAtributo = () => setAtributos([...atributos, { nombre: '', valor: '' }]);
    const removeAtributo = (index) => {
        const values = [...atributos];
        values.splice(index, 1);
        setAtributos(values);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const familiaSeleccionada = familias.find(f => f.id === parseInt(familiaId));
        const payload = {
            sku,
            descripcion,
            familia: familiaSeleccionada.nombre,
            atributos: atributos.filter(a => a.nombre && a.valor) // Solo enviar atributos con nombre y valor
        };

        try {
            const response = await fetch('http://localhost:5002/api/productos-terminados', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detalle || 'Error al crear el artículo');
            }
            fetchProductos(); // Recargar la lista
            // Resetear formulario
            setSku('');
            setDescripcion('');
            setAtributos([{ nombre: '', valor: '' }]);
        } catch (err) {
            setError(err.message);
        }
    };
    
    // ... (Añadir función para eliminar producto)

    return (
        <div className="gestion-articulos-container">
            <h1>Gestión de Artículos</h1>
            {error && <p className="error-message">{error}</p>}
            
            <form onSubmit={handleSubmit} className="form-section">
                <h2>Crear Nuevo Artículo</h2>
                <div className="form-grid">
                    <label>SKU (Opcional): <input type="text" value={sku} onChange={e => setSku(e.target.value)} /></label>
                    <label>Descripción*: <input type="text" value={descripcion} onChange={e => setDescripcion(e.target.value)} required /></label>
                    <label>Familia*: 
                        <select value={familiaId} onChange={e => setFamiliaId(e.target.value)} required>
                            {familias.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                        </select>
                    </label>
                </div>

                <h4>Atributos</h4>
                {atributos.map((attr, index) => (
                    <div key={index} className="form-grid-lineas">
                        <input type="text" name="nombre" placeholder="Nombre Atributo (ej. Espesor)" value={attr.nombre} onChange={e => handleAtributoChange(index, e)} />
                        <input type="text" name="valor" placeholder="Valor (ej. 6mm)" value={attr.valor} onChange={e => handleAtributoChange(index, e)} />
                        <button type="button" onClick={() => removeAtributo(index)} className="remove-btn">Quitar</button>
                    </div>
                ))}
                <button type="button" onClick={addAtributo} className="add-btn">Añadir Atributo</button>
                <button type="submit" className="submit-btn" style={{marginTop: '20px'}}>Guardar Artículo</button>
            </form>

            <div className="list-section">
                <h2>Listado de Artículos Fabricados</h2>
                <table>
                    <thead>
                        <tr>
                            <th>SKU</th>
                            <th>Descripción</th>
                            <th>Familia</th>
                            <th>Características</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {productos.map(p => (
                            <tr key={p.id}>
                                <td>{p.sku}</td>
                                <td>{p.descripcion}</td>
                                <td>{p.familia}</td>
                                <td>{p.atributos}</td>
                                <td>{/* Botones de Editar/Eliminar irían aquí */}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default GestionProductosRecetas;