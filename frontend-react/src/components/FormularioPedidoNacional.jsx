// frontend-react/src/components/FormularioPedidoNacional.jsx
import React, { useState, useEffect } from 'react';
import './FormularioPedido.css';

function FormularioPedidoNacional() {
    const [pedido, setPedido] = useState({
        numero_factura: '',
        proveedor: '',
        fecha_pedido: new Date().toISOString().split('T')[0],
        observaciones: ''
    });

    const [lineas, setLineas] = useState([
        { id: Date.now(), familia: 'GOMA', espesor: '', ancho: '', largo: '', precio_unitario: '', numero_bobinas: 1, referencia_bobina: '' }
    ]);
    
    const [gastos, setGastos] = useState([]);
    const [familias, setFamilias] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [facturaError, setFacturaError] = useState('');
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const familiasRes = await fetch('http://localhost:5002/api/familias');
                if (!familiasRes.ok) throw new Error('No se pudieron cargar las familias');
                const familiasData = await familiasRes.json();
                setFamilias(familiasData);
                
                const proveedoresRes = await fetch('http://localhost:5002/api/proveedores');
                if (!proveedoresRes.ok) throw new Error('No se pudo cargar la lista de proveedores');
                setProveedores(await proveedoresRes.json());
            } catch (err) {
                console.error(err);
                setError(err.message);
            }
        };
        fetchData();
    }, []);

    const handlePedidoChange = (e) => {
        const { name, value } = e.target;
        setPedido(prev => ({ ...prev, [name]: value }));
        if (name === 'numero_factura') {
            setFacturaError('');
            setError(null);
        }
    };
    
    const handleFacturaBlur = async (e) => {
        const numeroFactura = e.target.value.trim();
        if (!numeroFactura) return setFacturaError('');
        try {
            const response = await fetch(`http://localhost:5002/api/pedidos/verificar-factura?numero=${numeroFactura}`);
            const data = await response.json();
            if (data.existe) setFacturaError('¡Atención! Este número de factura ya existe.');
            else setFacturaError('');
        } catch (err) { setFacturaError('No se pudo verificar la factura.'); }
    };

    const addLinea = () => setLineas(prev => [...prev, { id: Date.now(), familia: familias[0]?.nombre || '', espesor: '', ancho: '', largo: '', precio_unitario: '', numero_bobinas: 1, referencia_bobina: '' }]);
    const removeLinea = (id) => { if (lineas.length > 1) setLineas(prev => prev.filter(l => l.id !== id)) };
    const handleLineaChange = (id, e) => {
        const { name, value } = e.target;
        setLineas(prev => prev.map(l => l.id === id ? { ...l, [name]: value } : l));
    };
    const addGasto = () => setGastos(prev => [...prev, { id: Date.now(), descripcion: '', coste_eur: '' }]);
    const removeGasto = (id) => setGastos(prev => prev.filter(g => g.id !== id));
    const handleGastoChange = (id, e) => {
        const { name, value } = e.target;
        setGastos(prev => prev.map(g => g.id === id ? { ...g, [name]: value } : g));
    };

    // REEMPLAZA la función handleSubmit entera en tu archivo

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setLoading(true);

        if (facturaError) {
            setError('Por favor, corrija los errores del formulario.');
            setLoading(false);
            return;
        }

        const lineasParaEnviar = lineas.map(l => {
            const sku = `${l.familia}-${l.espesor.replace('mm','')}-${l.ancho}`;
            const descripcion = `${l.familia} ${l.espesor} ${l.ancho}mm`;

            return {
                referencia_bobina: l.referencia_bobina,
                cantidad_bobinas: parseInt(l.numero_bobinas, 10),
                metros_por_bobina: parseFloat(l.largo),
                precio_unitario: parseFloat(l.precio_unitario),
                moneda: 'EUR',
                item: {
                    sku,
                    descripcion,
                    familia: l.familia,
                    tipo_item: 'MATERIA_PRIMA',
                    atributos: [
                        { nombre: 'Espesor', valor: l.espesor },
                        { nombre: 'Ancho', valor: `${l.ancho}mm` }
                    ]
                }
            };
        });
        
        // --- PAYLOAD CORREGIDO Y COMPLETO ---
        const payload = {
            pedido: { ...pedido, origen_tipo: 'NACIONAL' },
            lineas: lineasParaEnviar,
            gastos: gastos.map(g => ({ ...g, tipo_gasto: 'NACIONAL', coste_eur: parseFloat(g.coste_eur) })),
            status: 'COMPLETADO',
            material_tipo_general: lineas[0]?.familia // <-- ESTA ES LA LÍNEA CLAVE QUE FALTABA
        };

        console.log("DEBUG: Enviando este payload al backend:", JSON.stringify(payload, null, 2));


        try {
            const response = await fetch('http://localhost:5002/api/pedidos-nacionales', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detalle || 'Error al guardar el pedido');
            
            setSuccess(data.mensaje);
            setPedido({ numero_factura: '', proveedor: '', fecha_pedido: new Date().toISOString().split('T')[0], observaciones: '' });
            setLineas([{ id: Date.now(), familia: familias[0]?.nombre || '', espesor: '', ancho: '', largo: '', precio_unitario: '', numero_bobinas: 1, referencia_bobina: '' }]);
            setGastos([]);
            setFacturaError('');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="form-container">
            <h2>Nuevo Pedido Nacional</h2>
            {error && <p className="error-message">{error}</p>}
            {success && <p className="success-message">{success}</p>}

            <form onSubmit={handleSubmit}>
                <fieldset>
                    <legend>Datos del Pedido</legend>
                    <div className="form-grid">
                        <label>Proveedor*:
                            <input type="text" name="proveedor" value={pedido.proveedor} onChange={handlePedidoChange} required list="proveedores-list" />
                            <datalist id="proveedores-list">
                                {proveedores.map(p => <option key={p} value={p} />)}
                            </datalist>
                        </label>
                        <label>Nº Factura*:
                            <input type="text" name="numero_factura" value={pedido.numero_factura} onChange={handlePedidoChange} onBlur={handleFacturaBlur} required />
                            {facturaError && <span style={{ color: 'red', fontSize: '0.8em', display: 'block' }}>{facturaError}</span>}
                        </label>
                        <label>Fecha Pedido*:
                            <input type="date" name="fecha_pedido" value={pedido.fecha_pedido} onChange={handlePedidoChange} required />
                        </label>
                    </div>
                </fieldset>

                <h3>Bobinas</h3>
                {lineas.map((linea, index) => (
                    <fieldset key={linea.id} className="linea-item">
                        <legend>Bobina {index + 1}</legend>
                        <div className="form-grid-lineas">
                            <label>Material*:
                                <select name="familia" value={linea.familia} onChange={e => handleLineaChange(linea.id, e)} required>
                                    <option value="" disabled>Selecciona...</option>
                                    {familias.map(f => <option key={f.id} value={f.nombre}>{f.nombre}</option>)}
                                </select>
                            </label>
                            <label>Espesor*: <input type="text" name="espesor" value={linea.espesor} onChange={e => handleLineaChange(linea.id, e)} placeholder="Ej: 6mm" required /></label>
                            <label>Ancho (mm)*: <input type="number" name="ancho" value={linea.ancho} onChange={e => handleLineaChange(linea.id, e)} required /></label>
                            <label>Largo (m)*: <input type="number" step="0.01" name="largo" value={linea.largo} onChange={e => handleLineaChange(linea.id, e)} required /></label>
                            <label>Precio Metro Lineal (€)*: <input type="number" step="0.0001" name="precio_unitario" value={linea.precio_unitario} onChange={e => handleLineaChange(linea.id, e)} required /></label>
                            <label>Nº Bobinas*: <input type="number" name="numero_bobinas" value={linea.numero_bobinas} onChange={e => handleLineaChange(linea.id, e)} required min="1" step="1" /></label>
                            <label>Referencia Bobina*: <input type="text" name="referencia_bobina" value={linea.referencia_bobina} onChange={e => handleLineaChange(linea.id, e)} required /></label>
                        </div>
                        <button type="button" onClick={() => removeLinea(linea.id)} className="remove-btn">Eliminar</button>
                    </fieldset>
                ))}
                <button type="button" onClick={addLinea} className="add-btn">Añadir Bobina</button>

                <h3>Gastos del Pedido</h3>
                {gastos.map((gasto, index) => (
                    <fieldset key={gasto.id} className="gasto-item">
                        <legend>Gasto {index + 1}</legend>
                        <div className="form-grid-gastos">
                            <label>Descripción*: <input type="text" name="descripcion" value={gasto.descripcion} onChange={(e) => handleGastoChange(gasto.id, e)} required /></label>
                            <label>Coste (€)*: <input type="number" step="0.01" name="coste_eur" value={gasto.coste_eur} onChange={(e) => handleGastoChange(gasto.id, e)} required /></label>
                        </div>
                        <button type="button" onClick={() => removeGasto(gasto.id)} className="remove-btn">Eliminar Gasto</button>
                    </fieldset>
                ))}
                <button type="button" onClick={addGasto} className="add-btn">Añadir Gasto</button>

                <button type="submit" disabled={loading} className="submit-btn">
                    {loading ? 'Guardando...' : 'Guardar Pedido Nacional'}
                </button>
            </form>
        </div>
    );
}

export default FormularioPedidoNacional;