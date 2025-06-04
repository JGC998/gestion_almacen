// frontend-react/src/components/CalculadoraPresupuestos.jsx
import React, { useState, useEffect, useCallback } from 'react';
import '../App.css'; // Reutiliza estilos generales

function CalculadoraPresupuestos() {
  const [productosTerminados, setProductosTerminados] = useState([]);
  const [materialesGenericos, setMaterialesGenericos] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [tipoCliente, setTipoCliente] = useState('');
  const [materialesRequeridosReceta, setMaterialesRequeridosReceta] = useState([]); // Materiales genéricos que la receta requiere
  const [materialesSeleccionadosStock, setMaterialesSeleccionadosStock] = useState({}); // {material_generico_key: stock_item_id}
  const [stockDisponibleParaSeleccion, setStockDisponibleParaSeleccion] = useState([]); // Stock real filtrado por material genérico

  const [presupuestoResultado, setPresupuestoResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const tiposCliente = [
    { value: '', label: 'Seleccione Tipo de Cliente...' },
    { value: 'final', label: 'Cliente Final' },
    { value: 'fabricante', label: 'Fabricante' },
    { value: 'metrajes', label: 'Metrajes' },
    { value: 'intermediario', label: 'Intermediario' },
  ];

  // Fetch productos terminados
  const fetchProductosTerminados = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5002/api/productos-terminados');
      if (!response.ok) throw new Error(`Error al cargar productos terminados: ${response.status}`);
      const data = await response.json();
      setProductosTerminados(data);
    } catch (err) {
      console.error("Error fetching productos terminados:", err);
      setError(err.message);
    }
  }, []);

  // Fetch materiales genéricos (para poblar selectores de receta y stock disponible)
  const fetchMaterialesGenericos = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5002/api/materiales-genericos');
      if (!response.ok) throw new Error(`Error al cargar materiales genéricos: ${response.status}`);
      const data = await response.json();
      setMaterialesGenericos(data);
    } catch (err) {
      console.error("Error fetching materiales genéricos:", err);
      setError(err.message);
    }
  }, []);

  // Fetch receta del producto seleccionado
  const fetchRecetaProducto = useCallback(async (productId) => {
    if (!productId) {
      setMaterialesRequeridosReceta([]);
      setMaterialesSeleccionadosStock({});
      return;
    }
    try {
      const response = await fetch(`http://localhost:5002/api/recetas?producto_terminado_id=${productId}`);
      if (!response.ok) throw new Error(`Error al cargar receta: ${response.status}`);
      const data = await response.json();
      setMaterialesRequeridosReceta(data);
      // Inicializar materiales seleccionados en stock
      const initialSelections = {};
      data.forEach(rec => {
        // Genera una clave única para cada material genérico en la receta
        const key = rec.material_tipo_generico ? 
          `${rec.material_tipo_generico}-${rec.subtipo_material_generico || ''}-${rec.espesor_generico || ''}-${rec.ancho_generico || ''}-${rec.color_generico || ''}` :
          `COMPONENTE-${rec.componente_ref_generico}`;
        initialSelections[key] = ''; // Inicialmente vacío
      });
      setMaterialesSeleccionadosStock(initialSelections);
    } catch (err) {
      console.error("Error fetching receta:", err);
      setError(err.message);
    }
  }, []);

  // Fetch stock disponible para un material genérico específico
  const fetchStockDisponibleParaMaterialGenerico = useCallback(async (materialTipo, subtipo, espesor, ancho, color, componenteRef) => {
    let url = '';
    if (materialTipo) { // Es materia prima
      const params = new URLSearchParams({
        material_tipo: materialTipo,
        status: 'DISPONIBLE,EMPEZADA' // Buscar solo stock disponible o empezado
      });
      if (subtipo) params.append('subtipo_material', subtipo);
      if (espesor) params.append('espesor', espesor);
      if (ancho) params.append('ancho', ancho);
      if (color) params.append('color', color);
      url = `http://localhost:5002/api/stock?${params.toString()}`;
    } else if (componenteRef) { // Es componente
      const params = new URLSearchParams({
        componente_ref: componenteRef,
        status: 'DISPONIBLE,RESERVADO' // Buscar solo stock disponible o reservado
      });
      url = `http://localhost:5002/api/stock-componentes?${params.toString()}`;
    } else {
      return [];
    }

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Error al cargar stock disponible: ${response.status}`);
      const data = await response.json();
      return data;
    } catch (err) {
      console.error("Error fetching stock disponible:", err);
      setError(err.message);
      return [];
    }
  }, []);

  useEffect(() => {
    fetchProductosTerminados();
    fetchMaterialesGenericos();
  }, [fetchProductosTerminados, fetchMaterialesGenericos]);

  useEffect(() => {
    fetchRecetaProducto(selectedProductId);
  }, [selectedProductId, fetchRecetaProducto]);

  // Cuando cambia la selección de un material genérico en la receta,
  // cargar el stock disponible para ese tipo de material.
  useEffect(() => {
    const loadAllAvailableStock = async () => {
      const newStockMap = {};
      for (const rec of materialesRequeridosReceta) {
        let stock = [];
        if (rec.material_tipo_generico) {
          stock = await fetchStockDisponibleParaMaterialGenerico(
            rec.material_tipo_generico, rec.subtipo_material_generico, rec.espesor_generico, rec.ancho_generico, rec.color_generico, null
          );
          const key = `${rec.material_tipo_generico}-${rec.subtipo_material_generico || ''}-${rec.espesor_generico || ''}-${rec.ancho_generico || ''}-${rec.color_generico || ''}`;
          newStockMap[key] = stock;
        } else if (rec.componente_ref_generico) {
          stock = await fetchStockDisponibleParaMaterialGenerico(
            null, null, null, null, null, rec.componente_ref_generico
          );
          const key = `COMPONENTE-${rec.componente_ref_generico}`;
          newStockMap[key] = stock;
        }
      }
      setStockDisponibleParaSeleccion(newStockMap);
    };

    if (materialesRequeridosReceta.length > 0) {
      loadAllAvailableStock();
    } else {
      setStockDisponibleParaSeleccion({});
    }
  }, [materialesRequeridosReceta, fetchStockDisponibleParaMaterialGenerico]);


  const handleMaterialStockSelection = (recetaKey, stockItemId) => {
    setMaterialesSeleccionadosStock(prev => ({
      ...prev,
      [recetaKey]: stockItemId
    }));
  };

  const handleSubmitPresupuesto = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPresupuestoResultado(null);

    if (!selectedProductId || !cantidad || !tipoCliente) {
      setError("Por favor, complete todos los campos obligatorios.");
      setLoading(false);
      return;
    }

    // Validar que se haya seleccionado un ítem de stock para cada material requerido
    const materialesFaltantes = materialesRequeridosReceta.filter(rec => {
        const key = rec.material_tipo_generico ? 
            `${rec.material_tipo_generico}-${rec.subtipo_material_generico || ''}-${rec.espesor_generico || ''}-${rec.ancho_generico || ''}-${rec.color_generico || ''}` :
            `COMPONENTE-${rec.componente_ref_generico}`;
        return !materialesSeleccionadosStock[key];
    });

    if (materialesFaltantes.length > 0) {
        setError("Debe seleccionar un ítem de stock específico para cada material/componente requerido por la receta.");
        setLoading(false);
        return;
    }

    // Transformar materialesSeleccionadosStock a un formato que el backend entienda
    const materialesParaBackend = Object.keys(materialesSeleccionadosStock).map(key => {
        const stockId = materialesSeleccionadosStock[key];
        // Buscar el material generico correspondiente para obtener su tipo
        const recetaItem = materialesRequeridosReceta.find(rec => {
            const recKey = rec.material_tipo_generico ? 
                `${rec.material_tipo_generico}-${rec.subtipo_material_generico || ''}-${rec.espesor_generico || ''}-${rec.ancho_generico || ''}-${rec.color_generico || ''}` :
                `COMPONENTE-${rec.componente_ref_generico}`;
            return recKey === key;
        });

        if (recetaItem.material_tipo_generico) {
            // Es materia prima, buscar en stock real para obtener sus propiedades
            const actualStockItem = stockDisponibleParaSeleccion[key]?.find(item => item.id === parseInt(stockId));
            return {
                id: parseInt(stockId),
                type: 'materia_prima',
                material_tipo: actualStockItem.material_tipo,
                subtipo_material: actualStockItem.subtipo_material,
                espesor: actualStockItem.espesor,
                ancho: actualStockItem.ancho,
                color: actualStockItem.color
            };
        } else if (recetaItem.componente_ref_generico) {
            // Es componente, buscar en stock real para obtener sus propiedades
            const actualStockItem = stockDisponibleParaSeleccion[key]?.find(item => item.id === parseInt(stockId));
            return {
                id: parseInt(stockId),
                type: 'componente',
                componente_ref: actualStockItem.componente_ref
            };
        }
        return null;
    }).filter(Boolean); // Eliminar cualquier null si algo fallara

    const payload = {
      producto_id: parseInt(selectedProductId),
      cantidad: parseFloat(cantidad),
      tipo_cliente: tipoCliente,
      materiales_seleccionados_stock: materialesParaBackend,
    };

    try {
      const response = await fetch('http://localhost:5002/api/calcular-presupuesto-producto-terminado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${response.status}`);
      }
      setPresupuestoResultado(data);
    } catch (err) {
      console.error("Error al calcular presupuesto:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="calculadora-presupuestos-container">
      <h2>Calculadora de Presupuestos</h2>

      {error && <p className="error-message">{error}</p>}
      {loading && <p>Calculando presupuesto...</p>}

      <form onSubmit={handleSubmitPresupuesto} className="form-container">
        <div className="form-grid">
          <label>Producto Terminado:
            <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} required>
              <option value="">Seleccione un producto</option>
              {productosTerminados.map(prod => (
                <option key={prod.id} value={prod.id}>{prod.referencia} - {prod.nombre}</option>
              ))}
            </select>
          </label>
          <label>Cantidad a Presupuestar:
            <input type="number" step="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} required min="1" />
          </label>
          <label>Tipo de Cliente:
            <select value={tipoCliente} onChange={(e) => setTipoCliente(e.target.value)} required>
              {tiposCliente.map(tipo => (
                <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
              ))}
            </select>
          </label>
        </div>

        {selectedProductId && materialesRequeridosReceta.length > 0 && (
          <fieldset style={{ marginTop: '20px' }}>
            <legend>Selección de Stock para Receta</legend>
            {materialesRequeridosReceta.map(rec => {
              const key = rec.material_tipo_generico ? 
                `${rec.material_tipo_generico}-${rec.subtipo_material_generico || ''}-${rec.espesor_generico || ''}-${rec.ancho_generico || ''}-${rec.color_generico || ''}` :
                `COMPONENTE-${rec.componente_ref_generico}`;
              
              const materialDisplay = rec.material_tipo_generico ? 
                `${rec.material_tipo_generico} ${rec.subtipo_material_generico || ''} ${rec.espesor_generico || ''} ${rec.ancho_generico || ''}mm ${rec.color_generico || ''}`.trim() : 
                `${rec.componente_ref_generico} (${rec.descripcion_generico || ''})`; // Asumo descripcion_generico si existe en el futuro
              
              const stockOptions = stockDisponibleParaSeleccion[key] || [];

              return (
                <div key={rec.id} className="form-grid" style={{ borderBottom: '1px dashed #ccc', paddingBottom: '10px', marginBottom: '10px' }}>
                  <label>
                    Material/Componente Requerido: <strong>{materialDisplay}</strong>
                    <br/>
                    Cantidad por unidad de PT: {rec.cantidad_requerida} {rec.unidad_medida_requerida}
                    {rec.unidades_por_ancho_material && rec.unidades_por_ancho_material > 1 && ` (x${rec.unidades_por_ancho_material} por ancho)`}
                  </label>
                  <label>
                    Seleccionar Stock Específico:
                    <select
                      value={materialesSeleccionadosStock[key] || ''}
                      onChange={(e) => handleMaterialStockSelection(key, e.target.value)}
                      required
                    >
                      <option value="">-- Seleccione una bobina/lote --</option>
                      {stockOptions.length === 0 && <option value="" disabled>No hay stock disponible para este tipo</option>}
                      {stockOptions.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.referencia_stock || item.componente_ref} (Actual: {item.largo_actual !== undefined ? item.largo_actual.toFixed(2) + item.unidad_medida : item.cantidad_actual.toFixed(2) + item.unidad_medida}) - Coste: {item.coste_unitario_final.toFixed(4)}€
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              );
            })}
          </fieldset>
        )}
        
        <button type="submit" disabled={loading} className="submit-btn">
          Calcular Presupuesto
        </button>
      </form>

      {presupuestoResultado && (
        <div className="presupuesto-resultado" style={{ marginTop: '30px', padding: '20px', border: '1px solid #4CAF50', borderRadius: '8px', backgroundColor: '#e8f5e9' }}>
          <h3>Resultado del Presupuesto para {presupuestoResultado.producto.nombre}</h3>
          <div className="modal-details-grid">
            <p><strong>Producto:</strong> {presupuestoResultado.producto.referencia} - {presupuestoResultado.producto.nombre}</p>
            <p><strong>Cantidad:</strong> {presupuestoResultado.cantidad_presupuestada} {presupuestoResultado.producto.unidad_medida}</p>
            <p><strong>Tipo Cliente:</strong> {presupuestoResultado.tipo_cliente.toUpperCase()}</p>
            <p><strong>Coste Unitario Fabricación:</strong> {presupuestoResultado.coste_unitario_fabricacion.toFixed(4)} €</p>
            <p><strong>Coste Total Fabricación:</strong> {presupuestoResultado.coste_total_fabricacion.toFixed(2)} €</p>
            <p><strong>Margen Aplicado:</strong> {(presupuestoResultado.margen_aplicado_porcentaje * 100).toFixed(2)} %</p>
            <p><strong>Precio Venta Unitario:</strong> {presupuestoResultado.precio_venta_unitario.toFixed(2)} €</p>
            <p><strong>Precio Venta Total:</strong> {presupuestoResultado.precio_venta_total.toFixed(2)} €</p>
            <p><strong>Peso Total Estimado:</strong> {presupuestoResultado.peso_total_estimado_kg.toFixed(2)} kg</p>
          </div>

          <h4 style={{marginTop: '20px'}}>Desglose de Materiales:</h4>
          <table>
            <thead>
              <tr>
                <th>Material/Componente</th>
                <th>Stock ID Seleccionado</th>
                <th>Ref. Stock Real</th>
                <th>Cantidad Consumir (Simulada)</th>
                <th>Coste Unit. Stock Real (€)</th>
                <th>Coste Total Material (€)</th>
              </tr>
            </thead>
            <tbody>
              {presupuestoResultado.desglose_materiales.map((item, index) => (
                <tr key={index}>
                  <td>{item.material_generico}</td>
                  <td>{item.stock_item_id_seleccionado}</td>
                  <td>{item.referencia_stock_real}</td>
                  <td>{item.cantidad_simulada_consumir.toFixed(2)} {item.unidad_consumo}</td>
                  <td>{item.coste_unitario_stock_real.toFixed(4)}</td>
                  <td>{item.coste_total_material_receta.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4 style={{marginTop: '20px'}}>Desglose de Procesos ({presupuestoResultado.tipo_cliente.toUpperCase()}):</h4>
          <table>
            <thead>
              <tr>
                <th>Proceso</th>
                <th>Tiempo Est. (h)</th>
                <th>Coste Hora Máquina (€/h)</th>
                <th>Aplica a Cliente</th>
                <th>Coste Unit. Proceso (€)</th>
                <th>Coste Total Proceso (€)</th>
              </tr>
            </thead>
            <tbody>
              {presupuestoResultado.desglose_procesos.map((proc, index) => (
                <tr key={index} style={{ backgroundColor: proc.aplica_a_este_cliente ? '' : '#f0f0f0' }}>
                  <td>{proc.nombre_proceso}</td>
                  <td>{proc.tiempo_estimado_horas.toFixed(2)}</td>
                  <td>{proc.coste_hora_maquina.toFixed(2)}</td>
                  <td>{proc.aplica_a_clientes}</td>
                  <td>{proc.coste_unitario_proceso.toFixed(4)}</td>
                  <td>{proc.coste_total_proceso.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4 style={{marginTop: '20px'}}>Coste Extra por Unidad:</h4>
          <p><strong>Coste Extra Unitario:</strong> {presupuestoResultado.coste_extra_unitario.toFixed(2)} €</p>
          <p><strong>Coste Total Extra:</strong> {presupuestoResultado.coste_total_extra.toFixed(2)} €</p>

        </div>
      )}
    </div>
  );
}

export default CalculadoraPresupuestos;
