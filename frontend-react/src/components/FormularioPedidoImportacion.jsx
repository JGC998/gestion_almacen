// frontend-react/src/components/FormularioPedidoImportacion.jsx
import { useState } from 'react';
import './FormularioPedido.css';

// Definimos la estructura de datos para los desplegables dinámicos
const familias = {
  GOMA: ['6mm', '8mm', '10mm', '12mm', '15mm'],
  PVC: ['Blanco2mm', 'Blanco3mm', 'Verde2mm', 'Verde3mm', 'Azul2mm', 'Azul3mm'],
  FIELTRO: ['Fieltro10', 'Fieltro15'],
  CARAMELO: ['6mm', '8mm', '10mm', '12mm'],
  VERDE: ['6mm', '8mm', '10mm', '12mm'],
  NEGRA: ['6mm', '8mm', '10mm', '12mm'],
};

function FormularioPedidoImportacion() {
  const [familiaSeleccionada, setFamiliaSeleccionada] = useState('GOMA');

  const [pedido, setPedido] = useState({
    numero_factura: '',
    proveedor: '',
    fecha_pedido: new Date().toISOString().split('T')[0],
    observaciones: '',
    valor_conversion: '',
  });

  // El estado de las líneas ahora contiene las propiedades de la bobina
  const [lineas, setLineas] = useState([
    {
      id: Date.now(),
      referencia_bobina: '',
      espesor: '',
      ancho: '',
      largo: '',
      numero_bobinas: 1, // <-- AÑADIR (valor por defecto 1)
      peso_por_metro: '',
      precio_unitario_original: '',
      moneda_original: 'USD', // (Solo en Importacion)
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
      numero_bobinas: 1, // <-- AÑADIR
      peso_por_metro: '', precio_unitario_original: '',
      moneda_original: 'USD', // (Solo en Importacion)
    }]);
  };

  const removeLinea = (id) => {
    if (lineas.length > 1) {
      setLineas(prev => prev.filter(linea => linea.id !== id));
    }
  };

  const addGasto = () => {
    // Inicializamos con tipo_gasto: 'SUPLIDOS'
    setGastos(prev => [...prev, { temp_id: Date.now(), tipo_gasto: 'SUPLIDOS', descripcion: '', coste_eur: '' }]);
};

  const removeGasto = (index) => {
    setGastos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null); setSuccessMessage('');

    // Pre-cálculo del porcentaje de gastos para enviar al backend
    const totalGastos = gastos.reduce((acc, g) => acc + (parseFloat(g.coste_eur) || 0), 0);
    const totalMateriales = lineas.reduce((acc, l) => acc + ((parseFloat(l.largo) || 0) * (parseFloat(l.precio_unitario_original) || 0)), 0);
    const porcentajeGastos = totalMateriales > 0 ? totalGastos / totalMateriales : 0;

    const lineasParaEnviar = lineas.map(l => ({
        ...l,
        // Renombramos 'largo' a 'cantidad_original' para el backend
        cantidad_original: parseFloat(l.largo) || 0, 
    }));

    const payload = {
      pedido: { ...pedido, porcentajeGastos }, // Enviamos el porcentaje precalculado
      lineas: lineasParaEnviar,
      gastos: gastos,
      material_tipo_general: familiaSeleccionada
    };

    try {
      const response = await fetch('http://localhost:5002/api/pedidos-importacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.detalle || `Error del servidor`);
      setSuccessMessage(`¡Pedido de Importación (ID: ${data.pedidoId}) creado con éxito!`);
      // Resetear formulario
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <h2>Nuevo Pedido de Importación (Contenedor)</h2>
      {error && <p className="error-message">{error}</p>}
      {successMessage && <p className="success-message">{successMessage}</p>}

      <form onSubmit={handleSubmit}>
        <fieldset>
          <legend>Datos del Pedido</legend>
          <div className="form-grid">
            <div>
              <label htmlFor="familiaSelect">Familia del Contenedor:</label>
              <select id="familiaSelect" value={familiaSeleccionada} onChange={(e) => setFamiliaSeleccionada(e.target.value)}>
                {Object.keys(familias).map(fam => <option key={fam} value={fam}>{fam}</option>)}
              </select>
            </div>
             <div>
              <label htmlFor="valorConversion">Valor Conversión (a EUR):</label>
              <input type="number" step="0.0001" id="valorConversion" name="valor_conversion" value={pedido.valor_conversion} onChange={handlePedidoChange} required />
            </div>
            <label>Nº Factura: <input type="text" name="numero_factura" value={pedido.numero_factura} onChange={handlePedidoChange} required /></label>
            <label>Proveedor: <input type="text" name="proveedor" value={pedido.proveedor} onChange={handlePedidoChange} /></label>
            <label>Fecha Pedido: <input type="date" name="fecha_pedido" value={pedido.fecha_pedido} onChange={handlePedidoChange} required /></label>
          </div>
        </fieldset>

        <h3>Líneas del Pedido (Bobinas)</h3>
        {lineas.map((linea) => (
          <fieldset key={linea.id} className="linea-item">
            <legend>Bobina</legend>
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
              <label>Peso (kg/m): <input type="number" step="0.01" name="peso_por_metro" value={linea.peso_por_metro} onChange={(e) => handleLineaChange(linea.id, e)} /></label>
              <label>Precio Unit. ({linea.moneda_original}/m)*: <input type="number" step="0.0001" name="precio_unitario_original" value={linea.precio_unitario_original} onChange={(e) => handleLineaChange(linea.id, e)} required /></label>
              <label>Nº Bobinas*: <input type="number" name="numero_bobinas" value={linea.numero_bobinas} onChange={(e) => handleLineaChange(linea.id, e)} required min="1" step="1" /></label>
{/* <label>Ubicación: <input type="text" name="ubicacion" value={linea.ubicacion} onChange={(e) => handleLineaChange(linea.id, e)} /></label> */}            </div>
            <button type="button" onClick={() => removeLinea(linea.id)} className="remove-btn">Eliminar Bobina</button>
          </fieldset>
        ))}
        <button type="button" onClick={addLinea} className="add-btn">Añadir Bobina</button>

        {/* La sección de GASTOS se mantiene igual que antes */}
        <h3>Gastos del Pedido</h3>
        {gastos.map((gasto, index) => (
          <fieldset key={gasto.temp_id} className="gasto-item">
            <legend>Gasto {index + 1}</legend>
            <div className="form-grid-gastos" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <label>Tipo de Gasto:
                    <select name="tipo_gasto" value={gasto.tipo_gasto} onChange={(e) => handleGastoChange(index, e)}>
                        <option value="SUPLIDOS">Suplidos</option>
                        <option value="EXENTO">Exento</option>
                        <option value="SUJETO">Sujeto a IVA</option>
                    </select>
                </label>
                <label>Descripción: <input type="text" name="descripcion" value={gasto.descripcion} onChange={(e) => handleGastoChange(index, e)} required /></label>
                <label>Coste (€): <input type="number" step="0.01" name="coste_eur" value={gasto.coste_eur} onChange={(e) => handleGastoChange(index, e)} required /></label>
            </div>
            {gastos.length > 0 && <button type="button" onClick={() => removeGasto(index)} className="remove-btn">Eliminar Gasto</button>}
          </fieldset>
        ))}
        <button type="button" onClick={addGasto} className="add-btn">Añadir Gasto</button>

        <button type="submit" disabled={loading} className="submit-btn">
          {loading ? 'Guardando...' : 'Guardar Pedido Importación'}
        </button>
      </form>
    </div>
  );
}

export default FormularioPedidoImportacion;