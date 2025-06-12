// frontend-react/src/components/FormularioPedidoNacional.jsx
import React, { useState, useEffect } from 'react';
import './FormularioPedido.css';

function FormularioPedidoNacional() {
    const [pedido, setPedido] = useState({
        familia_pedido: 'GOMA',
        numero_factura: '',
        proveedor: '',
        fecha_pedido: new Date().toISOString().split('T')[0],
        observaciones: ''
    });

    const [lineas, setLineas] = useState([
        { id: Date.now(), referencia_bobina: '', tipo_espesor: '', ancho: '', largo: '', precio_unitario_original: '', numero_bobinas: 1 }
    ]);

    const [gastos, setGastos] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [facturaError, setFacturaError] = useState('');
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const tiposEspesorPorFamilia = {
        'GOMA': ['6mm', '8mm', '10mm', '12mm', '15mm'],
        'PVC': ['Blanco2mm', 'Blanco3mm', 'Verde2mm', 'Verde3mm', 'Azul2mm', 'Azul3mm'],
        'FIELTRO': ['Fieltro10', 'Fieltro15'],
        'CARAMELO': ['6mm', '8mm', '10mm', '12mm'],
        'VERDE': ['6mm', '8mm', '10mm', '12mm'],
        'NEGRA': ['6mm', '8mm', '10mm', '12mm'],
    };

    // --- Cargar proveedores para autocompletar ---
    useEffect(() => {
        const fetchProveedores = async () => {
            try {
                const response = await fetch('http://localhost:5002/api/proveedores');
                if (!response.ok) throw new Error('No se pudo cargar la lista de proveedores');
                const data = await response.json();
                setProveedores(data);
            } catch (err) {
                console.error(err);
            }
        };
        fetchProveedores();
    }, []);

    const handlePedidoChange = (e) => {
        const { name, value } = e.target;
        setPedido(prev => ({ ...prev, [name]: value }));
        if (name === 'numero_factura') {
            setFacturaError(''); // Limpiar el error al cambiar
        }
    };

    // --- Validar factura al perder el foco ---
    const handleFacturaBlur = async (e) => {
        const numeroFactura = e.target.value;
        if (!numeroFactura) {
            setFacturaError('');
            return;
        }
        try {
            const response = await fetch(`http://localhost:5002/api/pedidos/verificar-factura?numero=${numeroFactura}`);
            const data = await response.json();
            if (data.existe) {
                setFacturaError('¡Atención! Este número de factura ya existe en la base de datos.');
            } else {
                setFacturaError('');
            }
        } catch (err) {
            console.error(err);
            setFacturaError('No se pudo verificar la factura.');
        }
    };

    const addLinea = () => {
        setLineas(prev => [...prev, { id: Date.now(), referencia_bobina: '', tipo_espesor: '', ancho: '', largo: '', precio_unitario_original: '', numero_bobinas: 1 }]);
    };

    const removeLinea = (id) => {
        if (lineas.length > 1) {
            setLineas(prev => prev.filter(l => l.id !== id));
        }
    };

    const handleLineaChange = (id, e) => {
        const { name, value } = e.target;
        setLineas(prev => prev.map(l => l.id === id ? { ...l, [name]: value } : l));
    };

    const addGasto = () => {
        setGastos(prev => [...prev, { id: Date.now(), descripcion: '', coste_eur: '' }]);
    };

    const removeGasto = (id) => {
        setGastos(prev => prev.filter(g => g.id !== id));
    };

    const handleGastoChange = (id, e) => {
        const { name, value } = e.target;
        setGastos(prev => prev.map(g => g.id === id ? { ...g, [name]: value } : g));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        if (facturaError) {
            setError('Por favor, corrija los errores antes de guardar.');
            return;
        }

        // Pre-cálculo del porcentaje de gastos para enviar al backend
        const totalGastos = gastos.reduce((acc, g) => acc + (parseFloat(g.coste_eur) || 0), 0);
        const totalMateriales = lineas.reduce((acc, l) => acc + ((parseFloat(l.largo) || 0) * (parseFloat(l.precio_unitario_original) || 0) * (parseInt(l.numero_bobinas, 10) || 1)), 0);
        const porcentajeGastos = totalMateriales > 0 ? totalGastos / totalMateriales : 0;

        const lineasParaEnviar = lineas.map(l => ({
            ...l,
            cantidad_original: l.largo,
            espesor: l.tipo_espesor
        }));
        
        const payload = {
            pedido: { ...pedido, origen_tipo: 'NACIONAL', porcentajeGastos },
            lineas: lineasParaEnviar,
            gastos: gastos.map(g => ({ ...g, tipo_gasto: 'NACIONAL' })),
            material_tipo_general: pedido.familia_pedido
        };

        try {
            const response = await fetch('http://localhost:5002/api/pedidos-nacionales', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detalle || 'Error al guardar el pedido');
            }
            const data = await response.json();
            setSuccess(data.mensaje);
            // Resetear formulario
            setPedido({ familia_pedido: 'GOMA', numero_factura: '', proveedor: '', fecha_pedido: new Date().toISOString().split('T')[0], observaciones: '' });
            setLineas([{ id: Date.now(), referencia_bobina: '', tipo_espesor: '', ancho: '', largo: '', precio_unitario_original: '', numero_bobinas: 1 }]);
            setGastos([]);
        } catch (err) {
            setError(err.message);
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
                        <label>Familia del Pedido:
                            <select name="familia_pedido" value={pedido.familia_pedido} onChange={handlePedidoChange}>
                                {Object.keys(tiposEspesorPorFamilia).map(familia => (
                                    <option key={familia} value={familia}>{familia}</option>
                                ))}
                            </select>
                        </label>
                        <label>Nº Factura*:
                            <input type="text" name="numero_factura" value={pedido.numero_factura} onChange={handlePedidoChange} onBlur={handleFacturaBlur} required />
                            {facturaError && <span style={{ color: 'red', fontSize: '0.8em', display: 'block' }}>{facturaError}</span>}
                        </label>
                        <label>Proveedor*:
                            <input type="text" name="proveedor" value={pedido.proveedor} onChange={handlePedidoChange} required list="proveedores-list" />
                            <datalist id="proveedores-list">
                                {proveedores.map(p => <option key={p} value={p} />)}
                            </datalist>
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
                        <div className="form-grid-lineas" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                            <label>Referencia Bobina*: <input type="text" name="referencia_bobina" value={linea.referencia_bobina} onChange={(e) => handleLineaChange(linea.id, e)} required /></label>
                            <label>Tipo/Espesor*:
                                <select name="tipo_espesor" value={linea.tipo_espesor} onChange={(e) => handleLineaChange(linea.id, e)} required>
                                    <option value="">-- Selecciona --</option>
                                    {(tiposEspesorPorFamilia[pedido.familia_pedido] || []).map(subtipo => <option key={subtipo} value={subtipo}>{subtipo}</option>)}
                                </select>
                            </label>
                            <label>Ancho (mm)*: <input type="number" name="ancho" value={linea.ancho} onChange={(e) => handleLineaChange(linea.id, e)} required /></label>
                            <label>Largo (m)*: <input type="number" step="0.01" name="largo" value={linea.largo} onChange={(e) => handleLineaChange(linea.id, e)} required /></label>
                            <label>Precio Metro Lineal Euros*: <input type="number" step="0.0001" name="precio_unitario_original" value={linea.precio_unitario_original} onChange={(e) => handleLineaChange(linea.id, e)} required /></label>
                            <label>Nº Bobinas*: <input type="number" name="numero_bobinas" value={linea.numero_bobinas} onChange={(e) => handleLineaChange(linea.id, e)} required min="1" step="1" /></label>
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
                            <label>Descripción*: <input type="text" name="descripcion" value={gasto.descripcion} onChange={(e) => handleGastoChange(gasto.id, e)} required /></label>
                            <label>Coste (€)*: <input type="number" step="0.01" name="coste_eur" value={gasto.coste_eur} onChange={(e) => handleGastoChange(gasto.id, e)} required /></label>
                        </div>
                        <button type="button" onClick={() => removeGasto(gasto.id)} className="remove-btn">Eliminar Gasto</button>
                    </fieldset>
                ))}
                <button type="button" onClick={addGasto} className="add-btn">Añadir Gasto</button>

                <button type="submit" className="submit-btn">
                    Guardar Pedido Nacional
                </button>
            </form>
        </div>
    );
}

export default FormularioPedidoNacional;