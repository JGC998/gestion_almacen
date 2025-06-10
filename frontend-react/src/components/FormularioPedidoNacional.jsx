// frontend-react/src/components/FormularioPedidoNacional.jsx
import { useState } from 'react';
import './FormularioPedido.css';

// Reutilizamos la misma estructura de familias
const familias = {
  GOMA: ['6mm', '8mm', '10mm', '12mm', '15mm'],
  PVC: ['Blanco2mm', 'Blanco3mm', 'Verde2mm', 'Verde3mm', 'Azul2mm', 'Azul3mm'],
  FIELTRO: ['Fieltro10', 'Fieltro15'],
  CARAMELO: ['6mm', '8mm', '10mm', '12mm'],
  VERDE: ['6mm', '8mm', '10mm', '12mm'],
  NEGRA: ['6mm', '8mm', '10mm', '12mm'],
};

function FormularioPedidoNacional() {
  const [familiaSeleccionada, setFamiliaSeleccionada] = useState('GOMA');

  const [pedido, setPedido] = useState({
    numero_factura: '',
    proveedor: '',
    fecha_pedido: new Date().toISOString().split('T')[0],
    observaciones: '',
  });

  const [lineas, setLineas] = useState([
    {
      id: Date.now(),
      referencia_bobina: '',
      espesor: '',
      ancho: '',
      largo: '',
      peso_por_metro: '',
      precio_unitario_original: '',
      ubicacion: '',
    }
  ]);

  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const handlePedidoChange = (e) => {
    setPedido(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleLineaChange = (id, e) => {
    const { name, value } = e.target;
    setLineas(prevLineas => prevLineas.map(linea =>
      linea.id === id ? { ...linea, [name]: value } : linea
    ));
  };
  
  const handleGastoChange = (index, e) => {
    const { name, value } = e.target;
    const nuevosGastos = [...gastos];
    nuevosGastos[index][name] = value;
    setGastos(nuevosGastos);
  };

  const addLinea = () => {
    setLineas(prev => [...prev, {
      id: Date.now(), referencia_bobina: '', espesor: '', ancho: '', largo: '',
      peso_por_metro: '', precio_unitario_original: '', ubicacion: ''
    }]);
  };

  const removeLinea = (id) => {
    if (lineas.length > 1) {
      setLineas(prev => prev.filter(linea => linea.id !== id));
    }
  };

  const addGasto = () => {
    setGastos(prev => [...prev, { temp_id: Date.now(), tipo_gasto: 'NACIONAL', descripcion: '', coste_eur: '' }]);
  };

  const removeGasto = (index) => {
    setGastos(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null); setSuccessMessage('');

    const totalGastos = gastos.reduce((acc, g) => acc + (parseFloat(g.coste_eur) || 0), 0);
    const totalMateriales = lineas.reduce((acc, l) => acc + ((parseFloat(l.largo) || 0) * (parseFloat(l.precio_unitario_original) || 0)), 0);
    const porcentajeGastos = totalMateriales > 0 ? totalGastos / totalMateriales : 0;

    const lineasParaEnviar = lineas.map(l => ({
        ...l,
        cantidad_original: parseFloat(l.largo) || 0,
        moneda_original: 'EUR' // Para pedidos nacionales, la moneda es EUR
    }));

    const payload = {
      pedido: { ...pedido, origen_tipo: 'NACIONAL', porcentajeGastos },
      lineas: lineasParaEnviar,
      gastos,
      material_tipo_general: familiaSeleccionada,
    };

    try {
      const response = await fetch('http://localhost:5002/api/pedidos-nacionales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.detalle || `Error del servidor`);
      setSuccessMessage(`¡Pedido Nacional (ID: ${data.pedidoId}) creado con éxito!`);
      // Resetear formulario
      setLineas([{ id: Date.now(), referencia_bobina: '', espesor: '', ancho: '', largo: '', peso_por_metro: '', precio_unitario_original: '', ubicacion: '' }]);
      setGastos([]);
      setPedido({ numero_factura: '', proveedor: '', fecha_pedido: new Date().toISOString().split('T')[0], observaciones: ''});

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
      {successMessage && <p className="success-message">{successMessage}</p>}

      <form onSubmit={handleSubmit}>
        <fieldset>
          <legend>Datos del Pedido</legend>
          <div className="form-grid">
             <div>
              <label htmlFor="familiaSelect">Familia del Pedido:</label>
              <select id="familiaSelect" value={familiaSeleccionada} onChange={(e) => setFamiliaSeleccionada(e.target.value)}>
                {Object.keys(familias).map(fam => <option key={fam} value={fam}>{fam}</option>)}
              </select>
            </div>
            <label>Nº Factura: <input type="text" name="numero_factura" value={pedido.numero_factura} onChange={handlePedidoChange} required /></label>
            <label>Proveedor: <input type="text" name="proveedor" value={pedido.proveedor} onChange={handlePedidoChange} /></label>
            <label>Fecha Pedido: <input type="date" name="fecha_pedido" value={pedido.fecha_pedido} onChange={handlePedidoChange} required /></label>
          </div>
        </fieldset>

        <h3>Líneas del Pedido (Materias Primas)</h3>
        {lineas.map((linea) => (
          <fieldset key={linea.id} className="linea-item">
            <legend>Línea de Material</legend>
            <div className="form-grid-lineas" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))'}}>
              <label>Referencia Bobina*: <input type="text" name="referencia_bobina" value={linea.referencia_bobina} onChange={(e) => handleLineaChange(linea.id, e)} required /></label>
              <label>Tipo/Espesor*:
                <select name="espesor" value={linea.espesor} onChange={(e) => handleLineaChange(linea.id, e)} required>
                    <option value="">-- Selecciona --</option>
                    {familias[familiaSeleccionada].map(subtipo => <option key={subtipo} value={subtipo}>{subtipo}</option>)}
                </select>
              </label>
              <label>Ancho (mm)*: <input type="number" name="ancho" value={linea.ancho} onChange={(e) => handleLineaChange(linea.id, e)} required /></label>
              <label>Largo (m)*: <input type="number" step="0.01" name="largo" value={linea.largo} onChange={(e) => handleLineaChange(linea.id, e)} required /></label>
              <label>Precio Unitario (€/m)*: <input type="number" step="0.01" name="precio_unitario_original" value={linea.precio_unitario_original} onChange={(e) => handleLineaChange(linea.id, e)} required /></label>
              <label>Ubicación: <input type="text" name="ubicacion" value={linea.ubicacion} onChange={(e) => handleLineaChange(linea.id, e)} /></label>
            </div>
            <button type="button" onClick={() => removeLinea(linea.id)} className="remove-btn">Eliminar Línea</button>
          </fieldset>
        ))}
        <button type="button" onClick={addLinea} className="add-btn">Añadir Línea</button>

        <h3>Gastos del Pedido</h3>
        {gastos.map((gasto, index) => (
          <fieldset key={gasto.temp_id} className="gasto-item">
            <legend>Gasto {index + 1}</legend>
            <div className="form-grid-gastos">
              <label>Descripción: <input type="text" name="descripcion" value={gasto.descripcion} onChange={(e) => handleGastoChange(index, e)} required /></label>
              <label>Coste (€): <input type="number" step="0.01" name="coste_eur" value={gasto.coste_eur} onChange={(e) => handleGastoChange(index, e)} required /></label>
            </div>
            {gastos.length > 0 && <button type="button" onClick={() => removeGasto(index)} className="remove-btn">Eliminar Gasto</button>}
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