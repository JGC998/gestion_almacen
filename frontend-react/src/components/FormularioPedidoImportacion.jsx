// frontend-react/src/components/FormularioPedidoImportacion.jsx
import React, { useState, useEffect } from 'react';
import './FormularioPedido.css';

function FormularioPedidoImportacion() {
    const [pedido, setPedido] = useState({
        familia_pedido: 'GOMA',
        numero_factura: '',
        proveedor: '',
        fecha_pedido: new Date().toISOString().split('T')[0],
        observaciones: '',
        valor_conversion: '',
    });
    const [lineas, setLineas] = useState([
        { id: Date.now(), referencia_bobina: '', tipo_espesor: '', ancho: '', largo: '', precio_unitario_original: '', moneda_original: 'USD', numero_bobinas: 1 }
    ]);
    const [gastos, setGastos] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [facturaError, setFacturaError] = useState('');
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [loading, setLoading] = useState(false);

    const tiposEspesorPorFamilia = {
        'GOMA': ['6mm', '8mm', '10mm', '12mm', '15mm'],
        'PVC': ['Blanco2mm', 'Blanco3mm', 'Verde2mm', 'Verde3mm', 'Azul2mm', 'Azul3mm'],
        'FIELTRO': ['Fieltro10', 'Fieltro15'],
        'CARAMELO': ['6mm', '8mm', '10mm', '12mm'],
        'VERDE': ['6mm', '8mm', '10mm', '12mm'],
        'NEGRA': ['6mm', '8mm', '10mm', '12mm'],
    };

    useEffect(() => {
        const fetchProveedores = async () => {
            try {
                const response = await fetch('http://localhost:5002/api/proveedores');
                if (!response.ok) throw new Error('No se pudo cargar la lista de proveedores');
                const data = await response.json();
                setProveedores(data);
            } catch (err) { console.error(err); }
        };
        fetchProveedores();
    }, []);

    const handlePedidoChange = (e) => {
        const { name, value } = e.target;
        setPedido(prev => ({ ...prev, [name]: value }));
        if (name === 'numero_factura') setFacturaError('');
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

    const addLinea = () => setLineas(prev => [...prev, { id: Date.now(), referencia_bobina: '', tipo_espesor: '', ancho: '', largo: '', precio_unitario_original: '', moneda_original: 'USD', numero_bobinas: 1 }]);
    const removeLinea = (id) => { if (lineas.length > 1) setLineas(prev => prev.filter(l => l.id !== id)) };
    const handleLineaChange = (id, e) => {
        const { name, value } = e.target;
        setLineas(prev => prev.map(l => l.id === id ? { ...l, [name]: value } : l));
    };
    const addGasto = () => setGastos(prev => [...prev, { id: Date.now(), tipo_gasto: 'SUPLIDOS', descripcion: '', coste_eur: '' }]);
    const removeGasto = (id) => setGastos(prev => prev.filter(g => g.id !== id));
    const handleGastoChange = (id, e) => {
        const { name, value } = e.target;
        setGastos(prev => prev.map(g => g.id === id ? { ...g, [name]: value } : l));
    };

    const handleSubmit = async (isDraft) => {
        setError(null);
        setSuccess(null);
        setLoading(true);

        if (facturaError && !isDraft) {
            setError('Por favor, corrija los errores antes de guardar.');
            setLoading(false);
            return;
        }

        const lineasParaEnviar = lineas.map(l => ({ ...l, cantidad_original: l.largo, espesor: l.tipo_espesor }));
        const payload = {
            pedido: { ...pedido, origen_tipo: 'CONTENEDOR' },
            lineas: lineasParaEnviar,
            gastos,
            material_tipo_general: pedido.familia_pedido,
            status: isDraft ? 'BORRADOR' : 'COMPLETADO'
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
            // Reset form
            setPedido({ familia_pedido: 'GOMA', numero_factura: '', proveedor: '', fecha_pedido: new Date().toISOString().split('T')[0], observaciones: '', valor_conversion: '' });
            setLineas([{ id: Date.now(), referencia_bobina: '', tipo_espesor: '', ancho: '', largo: '', precio_unitario_original: '', moneda_original: 'USD', numero_bobinas: 1 }]);
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
                        <label>Familia: <select name="familia_pedido" value={pedido.familia_pedido} onChange={handlePedidoChange}>{Object.keys(tiposEspesorPorFamilia).map(f => <option key={f} value={f}>{f}</option>)}</select></label>
                        <label>Nº Factura*: <input type="text" name="numero_factura" value={pedido.numero_factura} onChange={handlePedidoChange} onBlur={handleFacturaBlur} required /><span style={{ color: 'red', fontSize: '0.8em', display: 'block' }}>{facturaError}</span></label>
                        <label>Proveedor*: <input type="text" name="proveedor" value={pedido.proveedor} onChange={handlePedidoChange} required list="proveedores-list" /><datalist id="proveedores-list">{proveedores.map(p => <option key={p} value={p} />)}</datalist></label>
                        <label>Fecha Pedido*: <input type="date" name="fecha_pedido" value={pedido.fecha_pedido} onChange={handlePedidoChange} required /></label>
                        <label>Valor Conversión (a EUR)*: <input type="number" step="0.0001" name="valor_conversion" value={pedido.valor_conversion} onChange={handlePedidoChange} required /></label>
                    </div>
                </fieldset>

                <h3>Bobinas</h3>
                {lineas.map((linea, index) => (
                    <fieldset key={linea.id} className="linea-item">
                        <legend>Bobina {index + 1}</legend>
                        <div className="form-grid-lineas">
                            <label>Referencia Bobina*: <input type="text" name="referencia_bobina" value={linea.referencia_bobina} onChange={e => handleLineaChange(linea.id, e)} required /></label>
                            <label>Tipo/Espesor*: <select name="tipo_espesor" value={linea.tipo_espesor} onChange={e => handleLineaChange(linea.id, e)} required><option value="">-- Selecciona --</option>{(tiposEspesorPorFamilia[pedido.familia_pedido] || []).map(st => <option key={st} value={st}>{st}</option>)}</select></label>
                            <label>Ancho (mm)*: <input type="number" name="ancho" value={linea.ancho} onChange={e => handleLineaChange(linea.id, e)} required /></label>
                            <label>Largo (m)*: <input type="number" step="0.01" name="largo" value={linea.largo} onChange={e => handleLineaChange(linea.id, e)} required /></label>
                            <label>Precio Metro Lineal ({linea.moneda_original})*: <input type="number" step="0.0001" name="precio_unitario_original" value={linea.precio_unitario_original} onChange={e => handleLineaChange(linea.id, e)} required /></label>
                            <label>Nº Bobinas*: <input type="number" name="numero_bobinas" value={linea.numero_bobinas} onChange={e => handleLineaChange(linea.id, e)} required min="1" step="1" /></label>
                        </div>
                        <button type="button" onClick={() => removeLinea(linea.id)} className="remove-btn">Eliminar Bobina</button>
                    </fieldset>
                ))}
                <button type="button" onClick={addLinea} className="add-btn">Añadir Bobina</button>

                <h3>Gastos del Pedido</h3>
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