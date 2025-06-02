// frontend-react/src/components/FormularioPedidoNacional.jsx
import { useState } from 'react';
import './FormularioPedido.css';

function FormularioPedidoNacional() {
  const [materialTipo, setMaterialTipo] = useState('GOMA'); // GOMA, PVC, FIELTRO
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
      precio_unitario_original: '', // Siempre EUR para nacional
      unidad_medida: 'm', // Puede variar por material, o ser fijo 'm'
      moneda_original: 'EUR', // Fijo para nacional
      ubicacion: '',
      notas_linea: ''
    }
  ]);

  const [gastos, setGastos] = useState([
    {
      temp_id: Date.now(),
      tipo_gasto: 'NACIONAL', // Para nacional, podría ser solo este tipo
      descripcion: '',
      coste_eur: ''
    }
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const handlePedidoChange = (e) => {
    setPedido(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleLineaChange = (index, e) => {
    const { name, value } = e.target;
    const nuevasLineas = [...lineas];
    nuevasLineas[index][name] = value;
    // Si el material es FIELTRO, la unidad podría ser m2, o ud. Aquí simplificamos a 'm'.
    // Podrías ajustar la unidad por defecto o hacerla editable según el material_tipo si es necesario.
    // nuevasLineas[index]['unidad_medida'] = materialTipo === 'FIELTRO' ? 'm2' : 'm'; 
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
      cantidad_original: '', precio_unitario_original: '', unidad_medida: 'm', moneda_original: 'EUR',
      ubicacion: '', notas_linea: ''
    }]);
  };

  const removeLinea = (index) => {
    if (lineas.length <= 1) return;
    setLineas(prev => prev.filter((_, i) => i !== index));
  };

  const addGasto = () => {
    setGastos(prev => [...prev, {
      temp_id: Date.now(), tipo_gasto: 'NACIONAL', descripcion: '', coste_eur: ''
    }]);
  };

  const removeGasto = (index) => {
    setGastos(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null); setSuccessMessage('');

    if (lineas.some(l => !l.referencia_stock.trim())) {
        setError("Todas las líneas deben tener una referencia de stock.");
        setLoading(false); return;
    }
    // ... (más validaciones como en el formulario original)

    const lineasParaEnviar = lineas.map(({ temp_id, ...rest }) => rest);
    const gastosParaEnviar = gastos.map(({ temp_id, ...rest }) => rest);

    const payload = {
      pedido,
      lineas: lineasParaEnviar,
      gastos: gastosParaEnviar,
      material_tipo: materialTipo // Enviamos el tipo de material seleccionado
    };

    try {
      const response = await fetch('http://localhost:5002/api/pedidos-nacionales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.detalle || `Error del servidor`);
      setSuccessMessage(`¡Pedido Nacional de ${materialTipo} (ID: ${data.pedidoId}) creado con éxito!`);
      // Opcional: resetear formulario
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
              <label htmlFor="materialTipoNacional">Material Principal:</label>
              <select 
                id="materialTipoNacional" 
                value={materialTipo} 
                onChange={(e) => setMaterialTipo(e.target.value)}
              >
                <option value="GOMA">GOMA</option>
                <option value="PVC">PVC</option>
                <option value="FIELTRO">FIELTRO</option>
              </select>
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
            <div className="form-grid-lineas">
              <label>Ref. Stock*: <input type="text" name="referencia_stock" value={linea.referencia_stock} onChange={(e) => handleLineaChange(index, e)} required /></label>
              <label>Subtipo Material: <input type="text" name="subtipo_material" value={linea.subtipo_material} onChange={(e) => handleLineaChange(index, e)} /></label>
              <label>Espesor: <input type="text" name="espesor" value={linea.espesor} onChange={(e) => handleLineaChange(index, e)} /></label>
              <label>Ancho (mm): <input type="number" name="ancho" value={linea.ancho} onChange={(e) => handleLineaChange(index, e)} /></label>
              <label>Color: <input type="text" name="color" value={linea.color} onChange={(e) => handleLineaChange(index, e)} /></label>
              <label>Cantidad ({linea.unidad_medida})*: <input type="number" step="0.01" name="cantidad_original" value={linea.cantidad_original} onChange={(e) => handleLineaChange(index, e)} required /></label>
              <label>Precio Unit. (€/{linea.unidad_medida})*: <input type="number" step="0.01" name="precio_unitario_original" value={linea.precio_unitario_original} onChange={(e) => handleLineaChange(index, e)} required /></label>
              <label>Ubicación: <input type="text" name="ubicacion" value={linea.ubicacion} onChange={(e) => handleLineaChange(index, e)} /></label>
            </div>
            <label>Notas Línea: <textarea name="notas_linea" value={linea.notas_linea} onChange={(e) => handleLineaChange(index, e)}></textarea></label>
            {lineas.length > 1 && <button type="button" onClick={() => removeLinea(index)} className="remove-btn">Eliminar</button>}
          </fieldset>
        ))}
        <button type="button" onClick={addLinea} className="add-btn">Añadir Línea</button>

        <h3>Gastos del Pedido</h3>
        {gastos.map((gasto, index) => (
          <fieldset key={gasto.temp_id} className="gasto-item">
            <legend>Gasto {index + 1}</legend>
            <div className="form-grid-gastos">
              <label>Tipo:
                <select name="tipo_gasto" value={gasto.tipo_gasto} onChange={(e) => handleGastoChange(index, e)}>
                  <option value="NACIONAL">NACIONAL</option>
                  <option value="OTRO">OTRO</option>
                </select>
              </label>
              <label>Descripción: <input type="text" name="descripcion" value={gasto.descripcion} onChange={(e) => handleGastoChange(index, e)} required /></label>
              <label>Coste (€): <input type="number" step="0.01" name="coste_eur" value={gasto.coste_eur} onChange={(e) => handleGastoChange(index, e)} required /></label>
            </div>
            <button type="button" onClick={() => removeGasto(index)} className="remove-btn">Eliminar</button>
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