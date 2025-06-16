// frontend-react/src/components/FormularioOrdenProduccion.jsx
import React, { useState, useEffect, useCallback } from 'react';
import './FormularioPedido.css'; // Reutilizamos los estilos

function FormularioOrdenProduccion() {
    const [productosBase, setProductosBase] = useState([]);
    const [stockCompatible, setStockCompatible] = useState([]);
    
    // Estado del formulario
    const [selectedProductoId, setSelectedProductoId] = useState('');
    const [selectedLoteId, setSelectedLoteId] = useState('');
    const [ancho, setAncho] = useState('');
    const [largo, setLargo] = useState('');
    const [cantidad, setCantidad] = useState('');
    const [observaciones, setObservaciones] = useState('');

    // Estado para UI
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [costeEstimado, setCosteEstimado] = useState(0);

    // Cargar los productos base (plantillas) al inicio
    useEffect(() => {
        const fetchProductosBase = async () => {
            try {
                const response = await fetch('http://localhost:5002/api/productos-terminados');
                if (!response.ok) throw new Error('No se pudieron cargar los productos base.');
                setProductosBase(await response.json());
            } catch (err) {
                setError(err.message);
            }
        };
        fetchProductosBase();
    }, []);

    // Cargar stock compatible cuando se selecciona un producto base
    useEffect(() => {
        if (!selectedProductoId) {
            setStockCompatible([]);
            setSelectedLoteId('');
            return;
        }
        const fetchStockCompatible = async () => {
            setLoading(true);
            try {
                const response = await fetch(`http://localhost:5002/api/stock-compatible/${selectedProductoId}`);
                if (!response.ok) throw new Error('No se pudo encontrar stock compatible.');
                setStockCompatible(await response.json());
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchStockCompatible();
    }, [selectedProductoId]);

    // Calcular el coste estimado en tiempo real
    useEffect(() => {
        const loteSeleccionado = stockCompatible.find(s => s.id === parseInt(selectedLoteId));
        if (!loteSeleccionado || !ancho || !largo || !cantidad) {
            setCosteEstimado(0);
            return;
        }
        
        const anchoBobinaMM = parseInt(loteSeleccionado.atributos.match(/Ancho: (\d+)mm/)[1], 10);
        const anchoBobinaMetros = anchoBobinaMM / 1000;
        const metrosCuadradosPorPieza = (ancho / 1000) * (largo / 1000);
        const metrosLinealesConsumidos = (metrosCuadradosPorPieza * cantidad) / anchoBobinaMetros;
        const costeTotal = metrosLinealesConsumidos * loteSeleccionado.coste_lote;

        setCosteEstimado(costeTotal);

    }, [selectedLoteId, ancho, largo, cantidad, stockCompatible]);


    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);
        
        const payload = {
            producto_base_id: parseInt(selectedProductoId),
            lote_materia_prima_id: parseInt(selectedLoteId),
            ancho_producido: parseFloat(ancho),
            largo_producido: parseFloat(largo),
            cantidad_producida: parseInt(cantidad),
            observaciones,
        };

        try {
            const response = await fetch('http://localhost:5002/api/ordenes-produccion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detalle || 'Error al crear la orden.');
            
            setSuccess(data.mensaje);
            // Resetear formulario
            setSelectedProductoId('');
            setSelectedLoteId('');
            setAncho('');
            setLargo('');
            setCantidad('');
            setObservaciones('');

        } catch(err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="form-container">
            <h2>Nueva Orden de Producción</h2>
            {error && <p className="error-message">{error}</p>}
            {success && <p className="success-message">{success}</p>}

            <form onSubmit={handleSubmit}>
                <fieldset>
                    <legend>1. Seleccionar Producto a Fabricar</legend>
                    <select value={selectedProductoId} onChange={e => setSelectedProductoId(e.target.value)} required>
                        <option value="">-- Seleccione un producto base --</option>
                        {productosBase.map(p => <option key={p.id} value={p.id}>{p.descripcion} ({p.sku})</option>)}
                    </select>
                </fieldset>

                {selectedProductoId && (
                    <fieldset>
                        <legend>2. Seleccionar Bobina de Materia Prima</legend>
                        <select value={selectedLoteId} onChange={e => setSelectedLoteId(e.target.value)} required>
                            <option value="">-- Seleccione un lote de stock --</option>
                            {loading && <option>Cargando stock compatible...</option>}
                            {stockCompatible.map(s => (
                                <option key={s.id} value={s.id}>
                                    Lote: {s.lote} (Disponible: {s.cantidad_actual.toFixed(2)}m) - {s.atributos}
                                </option>
                            ))}
                        </select>
                    </fieldset>
                )}

                {selectedLoteId && (
                    <fieldset>
                        <legend>3. Definir Medidas y Cantidad</legend>
                        <div className="form-grid">
                            <label>Ancho a Producir (mm)*: <input type="number" value={ancho} onChange={e => setAncho(e.target.value)} required /></label>
                            <label>Largo a Producir (mm)*: <input type="number" value={largo} onChange={e => setLargo(e.target.value)} required /></label>
                            <label>Cantidad de Unidades*: <input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)} required min="1" /></label>
                        </div>
                    </fieldset>
                )}

                <fieldset>
                    <legend>4. Coste y Observaciones</legend>
                    <label>Coste de Material Estimado (€): <input type="text" value={costeEstimado.toFixed(4)} readOnly className="read-only-input" /></label>
                    <label>Observaciones: <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)}></textarea></label>
                </fieldset>

                <button type="submit" disabled={!selectedLoteId || loading} className="submit-btn">
                    {loading ? 'Procesando...' : 'Registrar Orden y Descontar Stock'}
                </button>
            </form>
        </div>
    );
}

export default FormularioOrdenProduccion;