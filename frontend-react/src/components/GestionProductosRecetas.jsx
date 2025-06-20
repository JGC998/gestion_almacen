// frontend-react/src/components/GestionProductosRecetas.jsx
import React, { useState, useEffect, useCallback } from 'react';
import '../App.css'; // Reutilizamos estilos

function GestionProductosRecetas() {
    const [plantillas, setPlantillas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState('');

    // Estado para el formulario de nueva plantilla
    const [nuevaPlantilla, setNuevaPlantilla] = useState({
        nombre: '',
        familia: '',
        espesor: '',
        ancho_final: '',
        largo_final: '',
        unidad_medida: 'unidad',
    });

    // Estado para los desplegables dinámicos
    const [materialesDisponibles, setMaterialesDisponibles] = useState({});

    // --- Carga de datos ---
    const fetchPlantillas = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch('http://localhost:5002/api/items?tipo_item=PRODUCTO_TERMINADO');
            if (!response.ok) throw new Error('No se pudieron cargar las plantillas.');
            setPlantillas(await response.json());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchMateriales = useCallback(async () => {
        try {
            const response = await fetch('http://localhost:5002/api/materiales-disponibles');
            if (!response.ok) throw new Error('No se pudieron cargar los materiales.');
            const data = await response.json();
            setMaterialesDisponibles(data);
            // Si hay materiales, seleccionamos el primero por defecto
            if (Object.keys(data).length > 0) {
                const primeraFamilia = Object.keys(data)[0];
                setNuevaPlantilla(prev => ({
                    ...prev,
                    familia: primeraFamilia,
                    espesor: data[primeraFamilia][0] || ''
                }));
            }
        } catch (err) {
            setError(err.message);
        }
    }, []);

    useEffect(() => {
        fetchPlantillas();
        fetchMateriales();
    }, [fetchPlantillas, fetchMateriales]);

    // --- Manejadores de eventos ---
    const handleChange = (e) => {
        const { name, value } = e.target;
        setNuevaPlantilla(prev => ({ ...prev, [name]: value }));

        // Si cambiamos la familia, reseteamos el espesor al primero de la lista
        if (name === 'familia') {
            setNuevaPlantilla(prev => ({
                ...prev,
                espesor: materialesDisponibles[value][0] || ''
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess('');

        try {
            const response = await fetch('http://localhost:5002/api/productos-terminados', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nuevaPlantilla)
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.detalle || 'Error al crear la plantilla');
            }

            setSuccess(data.mensaje);
            fetchPlantillas(); // Recargar la lista de plantillas
            // Resetear formulario
            setNuevaPlantilla({
                nombre: '',
                familia: Object.keys(materialesDisponibles)[0] || '',
                espesor: materialesDisponibles[Object.keys(materialesDisponibles)[0]][0] || '',
                ancho_final: '',
                largo_final: '',
                unidad_medida: 'unidad',
            });
        } catch (err) {
            setError(err.message);
        }
    };

    const espesoresParaFamilia = nuevaPlantilla.familia ? materialesDisponibles[nuevaPlantilla.familia] || [] : [];

    return (
        <div className="gestion-articulos-container">
            <h1>Gestión de Plantillas de Producto</h1>
            {error && <p className="error-message">{error}</p>}
            {success && <p className="success-message">{success}</p>}

            <form onSubmit={handleSubmit} className="form-section">
                <h2>Crear Nueva Plantilla</h2>
                <div className="form-grid">
                    <label>Nombre de la Plantilla*: <input type="text" name="nombre" value={nuevaPlantilla.nombre} onChange={handleChange} required /></label>

                    <label>Material Principal (Familia)*: 
                        <select name="familia" value={nuevaPlantilla.familia} onChange={handleChange} required>
                            {Object.keys(materialesDisponibles).map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                    </label>

                    <label>Espesor Principal*: 
                        <select name="espesor" value={nuevaPlantilla.espesor} onChange={handleChange} required>
                            {espesoresParaFamilia.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                    </label>

                    <label>Ancho Final (mm): <input type="number" name="ancho_final" value={nuevaPlantilla.ancho_final} onChange={handleChange} /></label>
                    <label>Largo Final (mm): <input type="number" name="largo_final" value={nuevaPlantilla.largo_final} onChange={handleChange} /></label>
                    <label>Unidad de Medida*: <input type="text" name="unidad_medida" value={nuevaPlantilla.unidad_medida} onChange={handleChange} required /></label>
                </div>
                <button type="submit" className="submit-btn" style={{marginTop: '20px'}}>Guardar Plantilla</button>
            </form>

            <div className="list-section">
                <h2>Listado de Plantillas Creadas</h2>
                {loading && <p>Cargando...</p>}
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
                        {plantillas.map(p => (
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