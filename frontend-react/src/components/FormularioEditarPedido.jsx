// frontend-react/src/components/FormularioEditarPedido.jsx
import React, { useState, useEffect, useCallback } from 'react';
import './FormularioPedido.css';

function FormularioEditarPedido({ pedidoId, onFinalizado, onCancel }) {
    const [pedido, setPedido] = useState(null);
    const [lineas, setLineas] = useState([]);
    const [gastos, setGastos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Carga los datos del borrador al iniciar
    useEffect(() => {
        const fetchDetallesPedido = async () => {
            setLoading(true);
            try {
                const response = await fetch(`http://localhost:5002/api/pedidos/${pedidoId}/detalles`);
                if (!response.ok) throw new Error('No se pudieron cargar los datos del borrador.');
                const data = await response.json();
                
                setPedido(data.pedidoInfo);
                // La respuesta del detalle ahora tiene las líneas agrupadas, necesitamos adaptarlo si queremos editar
                // Por simplicidad, asumiremos que las líneas no se editan, solo los gastos.
                setLineas(data.lineasDetalladas || []); 
                setGastos(data.gastos || []);

            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchDetallesPedido();
    }, [pedidoId]);

    const addGasto = () => setGastos(prev => [...prev, { id: `new-${Date.now()}`, tipo_gasto: 'SUPLIDOS', descripcion: '', coste_eur: '' }]);
    const removeGasto = (id) => setGastos(prev => prev.filter(g => g.id !== id));
    const handleGastoChange = (id, e) => {
        const { name, value } = e.target;
        setGastos(prev => prev.map(g => g.id === id ? { ...g, [name]: value } : g));
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);
        
        const payload = {
            pedido,
            gastos
        };

        try {
            const response = await fetch(`http://localhost:5002/api/pedidos/${pedidoId}/finalizar`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detalle || 'Error al finalizar el pedido.');

            setSuccess(data.mensaje);
            setTimeout(() => {
                onFinalizado(); // Llama a la función para volver a la lista
            }, 1500);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };
    
    if (loading) return <p>Cargando borrador...</p>;
    if (error) return <p className="error-message">{error}</p>;
    if (!pedido) return <p>No se encontró el borrador.</p>;

    return (
        <div className="form-container">
            <h2>Finalizar Pedido Borrador: {pedido.numero_factura}</h2>
            {success && <p className="success-message">{success}</p>}
            
            {/* Aquí podrías poner campos de edición si quisieras, por ahora nos centramos en los gastos */}

            <h3>Bobinas (solo visualización)</h3>
            <table className="sub-table">
                <thead><tr><th>Material</th><th>Espesor</th><th>Ancho</th><th>Largo</th><th>Nº Bobinas</th></tr></thead>
                <tbody>
                    {lineas.map((linea, i) => (
                        <tr key={i}>
                            <td>{linea.familia}</td>
                            <td>{linea.espesor}</td>
                            <td>{linea.ancho}</td>
                            <td>{linea.largo}</td>
                            <td>{linea.numero_bobinas}</td>
                        </tr>
                    ))}
                </tbody>
            </table>


            <h3>Añadir o Modificar Gastos</h3>
            {gastos.map((gasto, index) => (
                <fieldset key={gasto.id} className="gasto-item">
                    <legend>Gasto {index + 1}</legend>
                    <div className="form-grid-gastos">
                        <label>Tipo de Gasto: <select name="tipo_gasto" value={gasto.tipo_gasto} onChange={e => handleGastoChange(gasto.id, e)}><option value="SUPLIDOS">Suplidos</option><option value="EXENTO">Exento</option><option value="SUJETO">Sujeto a IVA</option></select></label>
                        <label>Descripción*: <input type="text" name="descripcion" value={gasto.descripcion} onChange={e => handleGastoChange(gasto.id, e)} required /></label>
                        <label>Coste (€)*: <input type="number" step="0.01" name="coste_eur" value={gasto.coste_eur} onChange={e => handleGastoChange(gasto.id, e)} required /></label>
                    </div>
                    <button type="button" onClick={() => removeGasto(gasto.id)} className="remove-btn">Eliminar Gasto</button>
                </fieldset>
            ))}
            <button type="button" onClick={addGasto} className="add-btn">Añadir Gasto</button>

            <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={onCancel} disabled={loading} className="btn-secondary">Cancelar</button>
                <button type="button" onClick={handleSubmit} disabled={loading} className="submit-btn" style={{marginTop: 0}}>
                    {loading ? 'Procesando...' : 'Finalizar y Procesar Stock'}
                </button>
            </div>
        </div>
    );
}

export default FormularioEditarPedido;