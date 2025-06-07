// frontend-react/src/components/FormularioPedidoImportacion.jsx
import { useState } from 'react';
import './FormularioPedido.css';

function FormularioPedidoImportacion() {
  const [materialTipo, setMaterialTipo] = useState('GOMA'); // GOMA, PVC, FIELTRO
  const [valorConversion, setValorConversion] = useState(''); // Ej: 1.1 para USD a EUR

  const [pedido, setPedido] = useState({
    numero_factura: '',
    proveedor: '',
    fecha_pedido: new Date().toISOString().split('T')[0],
    fecha_llegada: '',
    observaciones: '',
  });

  const [lineas, setLineas] = useState([
    {
      temp_id: Date.now(),
      subtipo_material: '',
      referencia_stock: '',
      espesor: '',
      ancho: '',
      color: '',
      cantidad_original: '',
      precio_unitario_original: '', // Puede ser en moneda extranjera
      moneda_original: 'USD', // Moneda por defecto para importación
      unidad_medida: 'm',
      ubicacion: '',
      notas_linea: '',
      peso_total_kg: '' // NUEVO CAMPO
    }
  ]);

  const [gastos, setGastos] = useState([
    {
      temp_id: Date.now(),
      tipo_gasto: 'SUPLIDOS', // SUPLIDOS, EXENTO, SUJETO
      descripcion: '',
      coste_eur: '' // Asumimos que los gastos se introducen en EUR
    }
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  // Handlers (handlePedidoChange, handleLineaChange, handleGastoChange, add/removeLinea, add/removeGasto)
  // son muy similares a FormularioPedidoNacional, puedes copiarlos y adaptarlos ligeramente si es necesario.
  // Aquí los incluyo para completitud:
  const handlePedidoChange = (e) => {
    setPedido(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleLineaChange = (index, e) => {
    const { name, value } = e.target;
    const nuevasLineas = [...lineas];
    nuevasLineas[index][name] = value;
    setLineas(nuevasLineas);
  };
  
  const handleGastoChange = (index, e) => {
    const { name, value } = e.target;
    const nuevosGastos = [...gastos];
    nuevosGastos[index][name] = value;
    setGastos(nuevosGastos);
  };

  const addLinea = () => {
    setLineas(prev => [...prev, {
      temp_id: Date.now(),
      subtipo_material: '', referencia_stock: '', espesor: '', ancho: '', color: '',
      cantidad_original: '', precio_unitario_original: '', moneda_original: 'USD', unidad_medida: 'm',
      ubicacion: '', notas_linea: '', peso_total_kg: '' // NUEVO CAMPO
    }]);
  };

  const removeLinea = (index) => {
    if (lineas.length <= 1) return;
    setLineas(prev => prev.filter((_, i) => i !== index));
  };

  const addGasto = () => {
    setGastos(prev => [...prev, {
      temp_id: Date.now(), tipo_gasto: 'SUPLIDOS', descripcion: '', coste_eur: ''
    }]);
  };

  const removeGasto = (index) => {
    setGastos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null); setSuccessMessage('');

    if (!valorConversion || isNaN(parseFloat(valorConversion)) || parseFloat(valorConversion) <= 0) {
        setError("El valor de conversión es obligatorio y debe ser un número positivo.");
        setLoading(false); return;
    }
    if (lineas.some(l => !l.referencia_stock.trim())) {
        setError("Todas las líneas deben tener una referencia de stock.");
        setLoading(false); return;
    }
    // Puedes añadir más validaciones aquí si es necesario
    // Por ejemplo, que peso_total_kg sea un número positivo

    const lineasParaEnviar = lineas.map(({ temp_id, ...rest }) => rest);
    const gastosParaEnviar = gastos.map(({ temp_id, ...rest }) => rest);

    const payload = {
      pedido,
      lineas: lineasParaEnviar,
      gastos: gastosParaEnviar,
      material_tipo: materialTipo,
      valor_conversion: parseFloat(valorConversion)
    };

    try {
      const response = await fetch('http://localhost:5002/api/pedidos-importacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.detalle || `Error del servidor`);
      setSuccessMessage(`¡Pedido de Importación de ${materialTipo} (ID: ${data.pedidoId}) creado con éxito!`);
      // Opcional: resetear formulario después de éxito
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
              <label htmlFor="materialTipoImport">Material Principal:</label>
              <select id="materialTipoImport" value={materialTipo} onChange={(e) => setMaterialTipo(e.target.value)}>
                <option value="GOMA">GOMA</option>
                <option value="PVC">PVC</option>
                <option value="FIELTRO">FIELTRO</option>
                <option value="FIELTRO">VERDE</option>
                <option value="FIELTRO">CARAMELO</option>


              </select>
            </div>
             <div>
              <label htmlFor="valorConversion">Valor Conversión (a EUR):</label>
              <input 
                type="number" 
                step="0.0001" 
                id="valorConversion" 
                name="valorConversion"
                value={valorConversion} 
                onChange={(e) => setValorConversion(e.target.value)} 
                placeholder="Ej: 1.08 (si 1 USD = 1.08 EUR)"
                required 
              />
            </div>
            <label>Nº Factura: <input type="text" name="numero_factura" value={pedido.numero_factura} onChange={handlePedidoChange} required /></label>
            <label>Proveedor: <input type="text" name="proveedor" value={pedido.proveedor} onChange={handlePedidoChange} /></label>
            <label>Fecha Pedido: <input type="date" name="fecha_pedido" value={pedido.fecha_pedido} onChange={handlePedidoChange} required /></label>
            <label>Fecha Llegada: <input type="date" name="fecha_llegada" value={pedido.fecha_llegada} onChange={handlePedidoChange} required /></label>
          </div>
          <label>Observaciones: <textarea name="observaciones" value={pedido.observaciones} onChange={handlePedidoChange}></textarea></label>
        </fieldset>

        <h3>Líneas del Pedido ({materialTipo})</h3>
        {lineas.map((linea, index) => (
          <fieldset key={linea.temp_id} className="linea-item">
            <legend>Línea {index + 1}</legend>
            <div className="form-grid-lineas" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))'}}>
              <label>Ref. Stock*: <input type="text" name="referencia_stock" value={linea.referencia_stock} onChange={(e) => handleLineaChange(index, e)} required /></label>
              <label>Espesor: <input type="text" name="espesor" value={linea.espesor} onChange={(e) => handleLineaChange(index, e)} /></label>
              <label>Ancho (mm): <input type="number" name="ancho" value={linea.ancho} onChange={(e) => handleLineaChange(index, e)} /></label>
              <label>Color: <input type="text" name="color" value={linea.color} onChange={(e) => handleLineaChange(index, e)} /></label>
              <label>Cantidad ({linea.unidad_medida})*: <input type="number" step="0.01" name="cantidad_original" value={linea.cantidad_original} onChange={(e) => handleLineaChange(index, e)} required /></label>
              <label>Moneda Lín.:
                <select name="moneda_original" value={linea.moneda_original} onChange={(e) => handleLineaChange(index, e)}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </label>
              <label>Precio Unit. ({linea.moneda_original}/{linea.unidad_medida})*: <input type="number" step="0.0001" name="precio_unitario_original" value={linea.precio_unitario_original} onChange={(e) => handleLineaChange(index, e)} required /></label>
              <label>Ubicación: <input type="text" name="ubicacion" value={linea.ubicacion} onChange={(e) => handleLineaChange(index, e)} /></label>
              <label>Peso Total (kg): <input type="number" step="0.01" name="peso_total_kg" value={linea.peso_total_kg} onChange={(e) => handleLineaChange(index, e)} placeholder="Peso de esta bobina/lote" /></label> {/* NUEVO CAMPO */}
            </div>
            <label>Notas Línea: <textarea name="notas_linea" value={linea.notas_linea} onChange={(e) => handleLineaChange(index, e)}></textarea></label>
            {lineas.length > 1 && <button type="button" onClick={() => removeLinea(index)} className="remove-btn">Eliminar</button>}
          </fieldset>
        ))}
        <button type="button" onClick={addLinea} className="add-btn">Añadir Línea</button>

        <h3>Gastos del Pedido (Importación)</h3>
        {gastos.map((gasto, index) => (
          <fieldset key={gasto.temp_id} className="gasto-item">
            <legend>Gasto {index + 1}</legend>
            <div className="form-grid-gastos">
              <label>Tipo Gasto:
                <select name="tipo_gasto" value={gasto.tipo_gasto} onChange={(e) => handleGastoChange(index, e)}>
                  <option value="SUPLIDOS">SUPLIDOS</option>
                  <option value="EXENTO">EXENTO</option>
                  <option value="SUJETO">SUJETO</option>
                </select>
              </label>
              <label>Descripción: <input type="text" name="descripcion" value={gasto.descripcion} onChange={(e) => handleGastoChange(index, e)} required /></label>
              <label>Coste (EUR)*: <input type="number" step="0.01" name="coste_eur" value={gasto.coste_eur} onChange={(e) => handleGastoChange(index, e)} placeholder="Coste en EUR" required /></label>
            </div>
            <button type="button" onClick={() => removeGasto(index)} className="remove-btn">Eliminar</button>
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
