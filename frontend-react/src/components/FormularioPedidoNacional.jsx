// frontend-react/src/components/FormularioPedidoNacional.jsx
import { useState, useEffect } from 'react';
import './FormularioPedido.css';

function FormularioPedidoNacional() {
  const [availableItems, setAvailableItems] = useState([]);
  const [pedido, setPedido] = useState({
    numero_factura: '',
    proveedor: '',
    fecha_pedido: new Date().toISOString().split('T')[0],
    fecha_llegada: '',
    observaciones: '',
  });

  const [lineas, setLineas] = useState([
    { temp_id: Date.now(), item_id: '', cantidad_original: '', precio_unitario_original: '', ubicacion: '' }
  ]);

  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await fetch('http://localhost:5002/api/items?tipo_item=MATERIA_PRIMA');
        if (!response.ok) throw new Error('No se pudieron cargar los artículos');
        const data = await response.json();
        setAvailableItems(data);
      } catch (err) {
        setError(err.message);
      }
    };
    fetchItems();
  }, []);

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
    setLineas(prev => [...prev, { temp_id: Date.now(), item_id: '', cantidad_original: '', precio_unitario_original: '', ubicacion: '' }]);
  };

  const removeLinea = (index) => {
    if (lineas.length > 1) {
      setLineas(prev => prev.filter((_, i) => i !== index));
    }
  };

  const addGasto = () => {
    setGastos(prev => [...prev, { temp_id: Date.now(), tipo_gasto: 'NACIONAL', descripcion: '', coste_eur: '' }]);
  };

  const removeGasto = (index) => {
    if (gastos.length > 0) {
      setGastos(prev => prev.filter((_, i) => i !== index));
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null); setSuccessMessage('');

    const lineasParaEnviar = lineas.map(({ temp_id, ...rest }) => ({
      ...rest,
      item_id: parseInt(rest.item_id, 10),
      cantidad_original: parseFloat(rest.cantidad_original),
      precio_unitario_original: parseFloat(rest.precio_unitario_original),
      moneda_original: 'EUR'
    }));

    if (lineasParaEnviar.some(l => !l.item_id || isNaN(l.item_id))) {
        setError("Todas las líneas deben tener un artículo seleccionado.");
        setLoading(false);
        return;
    }

    const payload = {
      pedido: { ...pedido, origen_tipo: 'NACIONAL' },
      lineas: lineasParaEnviar,
      gastos,
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
      setLineas([{ temp_id: Date.now(), item_id: '', cantidad_original: '', precio_unitario_original: '', ubicacion: '' }]);
      setGastos([]);
      setPedido({ numero_factura: '', proveedor: '', fecha_pedido: new Date().toISOString().split('T')[0], fecha_llegada: '', observaciones: ''});

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
            <label>Nº Factura: <input type="text" name="numero_factura" value={pedido.numero_factura} onChange={handlePedidoChange} required /></label>
            <label>Proveedor: <input type="text" name="proveedor" value={pedido.proveedor} onChange={handlePedidoChange} /></label>
            <label>Fecha Pedido: <input type="date" name="fecha_pedido" value={pedido.fecha_pedido} onChange={handlePedidoChange} required /></label>
            <label>Fecha Llegada: <input type="date" name="fecha_llegada" value={pedido.fecha_llegada} onChange={handlePedidoChange} required /></label>
          </div>
        </fieldset>

        <h3>Líneas del Pedido</h3>
        {lineas.map((linea, index) => (
          <fieldset key={linea.temp_id} className="linea-item">
            <legend>Línea {index + 1}</legend>
            <div className="form-grid-lineas" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
              <label>Artículo (Materia Prima)*:
                <select name="item_id" value={linea.item_id} onChange={(e) => handleLineaChange(index, e)} required>
                  <option value="">-- Selecciona un artículo --</option>
                  {availableItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.sku} - {item.descripcion}
                    </option>
                  ))}
                </select>
              </label>
              <label>Cantidad*: <input type="number" step="0.01" name="cantidad_original" value={linea.cantidad_original} onChange={(e) => handleLineaChange(index, e)} required /></label>
              <label>Precio Unitario (€)*: <input type="number" step="0.01" name="precio_unitario_original" value={linea.precio_unitario_original} onChange={(e) => handleLineaChange(index, e)} required /></label>
              <label>Ubicación: <input type="text" name="ubicacion" value={linea.ubicacion} onChange={(e) => handleLineaChange(index, e)} /></label>
            </div>
            {lineas.length > 1 && <button type="button" onClick={() => removeLinea(index)} className="remove-btn">Eliminar Línea</button>}
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
            {gastos.length > 1 && <button type="button" onClick={() => removeGasto(index)} className="remove-btn">Eliminar Gasto</button>}
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