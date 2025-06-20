// frontend-react/src/components/FormularioPedidoImportacion.jsx
import React, { useState, useEffect } from 'react';
import './FormularioPedido.css';

function FormularioPedidoImportacion() {
    const [pedido, setPedido] = useState({
        numero_factura: '',
        proveedor: '',
        fecha_pedido: new Date().toISOString().split('T')[0],
        observaciones: '',
        valor_conversion: ''
    });

    const [lineas, setLineas] = useState([
        { id: Date.now(), familia: 'GOMA', espesor: '', ancho: '', largo: '', precio_unitario: '', numero_bobinas: 1, referencia_bobina: '', moneda: 'USD' }
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

    const addLinea = () => setLineas(prev => [...prev, { id: Date.now(), familia: familias[0]?.nombre || '', espesor: '', ancho: '', largo: '', precio_unitario: '', numero_bobinas: 1, referencia_bobina: '', moneda: 'USD' }]);
    const removeLinea = (id) => { if (lineas.length > 1) setLineas(prev => prev.filter(l => l.id !== id)) };
    const handleLineaChange = (id, e) => {
        const { name, value } = e.target;
        setLineas(prev => prev.map(l => l.id === id ? { ...l, [name]: value } : l));
    };
    const addGasto = () => setGastos(prev => [...prev, { id: Date.now(), tipo_gasto: 'SUPLIDOS', descripcion: '', coste_eur: '' }]);
    const removeGasto = (id) => setGastos(prev => prev.filter(g => g.id !== id));
    const handleGastoChange = (id, e) => {
        const { name, value } = e.target;
        setGastos(prev => prev.map(g => g.id === id ? { ...g, [name]: value } : g));
    };

    const handleSubmit = async (isDraft) => {
        setError(null);
        setSuccess(null);
        setLoading(true);

        if (facturaError && !isDraft) {
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
                moneda: l.moneda,
                item: { sku, descripcion, familia: l.familia, tipo_item: 'MATERIA_PRIMA', atributos: [{ nombre: 'Espesor', valor: l.espesor }, { nombre: 'Ancho', valor: `${l.ancho}mm` }] }
            };
        });
        
        const payload = {
            pedido: { ...pedido, origen_tipo: 'IMPORTACION' },
            lineas: lineasParaEnviar,
            gastos: gastos.map(g => ({ ...g, coste_eur: parseFloat(g.coste_eur) })),
            status: isDraft ? 'BORRADOR' : 'COMPLETADO',
            material_tipo_general: lineas[0]?.familia
        };

        try {
            const response = await fetch('http://localhost:5002/api/pedidos-importacion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detalle || 'Error al guardar el pedido');
            
            setSuccess(data.mensaje);
            setPedido({ numero_factura: '', proveedor: '', fecha_pedido: new Date().toISOString().split('T')[0], observaciones: '', valor_conversion: '' });
            setLineas([{ id: Date.now(), familia: familias[0]?.nombre || '', espesor: '', ancho: '', largo: '', precio_unitario: '', numero_bobinas: 1, referencia_bobina: '', moneda: 'USD' }]);
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
            <h2>Nuevo Pedido de Importación</h2>
            {error && <p className="error-message">{error}</p>}
            {success && <p className="success-message">{success}</p>}

            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(false); }}>
                <fieldset>
                    <legend>Datos del Pedido</legend>
                    <div className="form-grid">
                        <label>Proveedor*: <input type="text" name="proveedor" value={pedido.proveedor} onChange={handlePedidoChange} required list="proveedores-list" /><datalist id="proveedores-list">{proveedores.map(p => <option key={p} value={p} />)}</datalist></label>
                        <label>Nº Factura*: <input type="text" name="numero_factura" value={pedido.numero_factura} onChange={handlePedidoChange} onBlur={handleFacturaBlur} required /><span style={{ color: 'red', fontSize: '0.8em' }}>{facturaError}</span></label>
                        <label>Fecha Pedido*: <input type="date" name="fecha_pedido" value={pedido.fecha_pedido} onChange={handlePedidoChange} required /></label>
                        <label>Valor Conversión (a EUR)*: <input type="number" step="0.0001" name="valor_conversion" value={pedido.valor_conversion} onChange={handlePedidoChange} required /></label>
                    </div>
                </fieldset>

                <h3>Bobinas</h3>
                {lineas.map((linea, index) => (
                    <fieldset key={linea.id} className="linea-item">
                        <legend>Bobina {index + 1}</legend>
                        <div className="form-grid-lineas">
                            <label>Familia*: <select name="familia" value={linea.familia} onChange={e => handleLineaChange(linea.id, e)} required><option value="" disabled>Selecciona...</option>{familias.map(f => <option key={f.id} value={f.nombre}>{f.nombre}</option>)}</select></label>
                            <label>Espesor*: <input type="text" name="espesor" value={linea.espesor} onChange={e => handleLineaChange(linea.id, e)} placeholder="Ej: 6mm" required /></label>
                            <label>Ancho (mm)*: <input type="number" name="ancho" value={linea.ancho} onChange={e => handleLineaChange(linea.id, e)} required /></label>
                            <label>Largo (m)*: <input type="number" step="0.01" name="largo" value={linea.largo} onChange={e => handleLineaChange(linea.id, e)} required /></label>
                            <label>Precio Unitario*: <input type="number" step="0.0001" name="precio_unitario" value={linea.precio_unitario} onChange={e => handleLineaChange(linea.id, e)} required /></label>
                            <label>Moneda*: <input type="text" name="moneda" value={linea.moneda} onChange={e => handleLineaChange(linea.id, e)} required placeholder="Ej: USD" /></label>
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
                            <label>Tipo de Gasto: 
                                <select name="tipo_gasto" value={gasto.tipo_gasto} onChange={e => handleGastoChange(gasto.id, e)}>
                                    <option value="SUPLIDOS">Suplidos</option>
                                    <option value="EXENTO">Exento</option>
                                    <option value="SUJETO">Sujeto a IVA</option>
                                </select>
                            </label>                            
                            <label>Descripción*: <input type="text" name="descripcion" value={gasto.descripcion} onChange={(e) => handleGastoChange(gasto.id, e)} required /></label>
                            <label>Coste (€)*: <input type="number" step="0.01" name="coste_eur" value={gasto.coste_eur} onChange={(e) => handleGastoChange(gasto.id, e)} required /></label>
                        </div>
                        <button type="button" onClick={() => removeGasto(gasto.id)} className="remove-btn">Eliminar Gasto</button>
                    </fieldset>
                ))}
                <button type="button" onClick={addGasto} className="add-btn">Añadir Gasto</button>

                <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                    <button type="button" onClick={() => handleSubmit(true)} disabled={loading} className="btn-secondary">
                        {loading ? 'Guardando...' : 'Guardar como Borrador'}
                    </button>
                    <button type="submit" disabled={loading} className="submit-btn" style={{marginTop: 0}}>
                        {loading ? 'Guardando...' : 'Guardar y Procesar Stock'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default FormularioPedidoImportacion;