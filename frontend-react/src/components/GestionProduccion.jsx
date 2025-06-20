// frontend-react/src/components/GestionProduccion.jsx
import React, { useState, useEffect, useCallback } from 'react';
import '../App.css'; 

function GestionProduccion() {
  const [ordenes, setOrdenes] = useState([]);
  const [productosTerminados, setProductosTerminados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const [newOrden, setNewOrden] = useState({
    producto_terminado_id: '',
    cantidad_a_producir: '',
    fecha: new Date().toISOString().split('T')[0],
  });

  const [selectedOrden, setSelectedOrden] = useState(null);
  const [recetaDeOrden, setRecetaDeOrden] = useState([]);
  const [stockDisponible, setStockDisponible] = useState({});
  const [stockAsignado, setStockAsignado] = useState({});

  const fetchProductosTerminados = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5002/api/items?tipo_item=PRODUCTO_TERMINADO');
      if (!response.ok) throw new Error('No se pudieron cargar las plantillas de producto.');
      setProductosTerminados(await response.json());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const fetchOrdenes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5002/api/ordenes-produccion');
      if (!response.ok) throw new Error('No se pudieron cargar las órdenes de producción.');
      setOrdenes(await response.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProductosTerminados();
    fetchOrdenes();
  }, [fetchProductosTerminados, fetchOrdenes]);

  const handleNewOrdenChange = (e) => {
    const { name, value } = e.target;
    setNewOrden(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateOrden = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage('');
    try {
        const payload = {
            item_id: parseInt(newOrden.producto_terminado_id),
            cantidad_a_producir: parseFloat(newOrden.cantidad_a_producir),
            fecha: newOrden.fecha
        };
        const response = await fetch('http://localhost:5002/api/ordenes-produccion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Error al crear la orden.');

        setSuccessMessage(data.mensaje);
        setNewOrden({ producto_terminado_id: '', cantidad_a_producir: '', fecha: new Date().toISOString().split('T')[0] });
        fetchOrdenes();
    } catch (err) {
        setError(err.message);
    }
  };

  const handleSelectOrden = async (orden) => {
    if (selectedOrden && selectedOrden.id === orden.id) {
        setSelectedOrden(null);
        return;
    }
    setSelectedOrden(orden);
    setRecetaDeOrden([]);
    setStockDisponible({});
    setStockAsignado({});
    setError(null);

    try {
        const recetaRes = await fetch(`http://localhost:5002/api/recetas?producto_id=${orden.item_id}`);
        if (!recetaRes.ok) throw new Error('No se pudo cargar la receta.');
        const recetaData = await recetaRes.json();
        setRecetaDeOrden(recetaData);

        const stockPromises = recetaData.map(itemReceta => 
            fetch(`http://localhost:5002/api/stock-compatible/${orden.item_id}`).then(res => res.json())
        );

        const stockResults = await Promise.all(stockPromises);
        const stockMap = recetaData.reduce((acc, itemReceta, index) => {
            acc[itemReceta.id] = stockResults[index];
            return acc;
        }, {});
        setStockDisponible(stockMap);

    } catch (err) {
        setError(err.message);
    }
  };

  const handleAsignarStock = (recetaId, stockId) => {
    setStockAsignado(prev => ({ ...prev, [recetaId]: stockId }));
  };

  const handleProcesarOrden = async () => {
    if (!selectedOrden) return;
    setError(null);
    setSuccessMessage('');

    const stockAssignments = Object.keys(stockAsignado).map(recetaId => ({
        recetaId: parseInt(recetaId),
        stockId: parseInt(stockAsignado[recetaId])
    }));

    if (stockAssignments.length !== recetaDeOrden.length) {
        setError("Debes asignar un lote de stock para cada material de la receta.");
        return;
    }

    try {
        setLoading(true);
        const response = await fetch(`http://localhost:5002/api/ordenes-produccion/${selectedOrden.id}/procesar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stockAssignments })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Error al procesar la orden.');

        setSuccessMessage(data.mensaje);
        setSelectedOrden(null);
        fetchOrdenes();
    } catch (err) {
        setError(err.message);
    } finally {
        setLoading(false);
    }
  };


  const isProcesarDisabled = recetaDeOrden.length === 0 || Object.keys(stockAsignado).length !== recetaDeOrden.length;

  return (
    <div className="gestion-produccion-container">
      <h1>Módulo de Producción</h1>
      {error && <p className="error-message">{error}</p>}
      {successMessage && <p className="success-message">{successMessage}</p>}

      <div className="form-section">
        <h2>Crear Nueva Orden de Producción</h2>
        <form onSubmit={handleCreateOrden}>
            <div className="form-grid" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
                <label>Producto a Fabricar:
                    <select name="producto_terminado_id" value={newOrden.producto_terminado_id} onChange={handleNewOrdenChange} required>
                        <option value="">Seleccione Producto...</option>
                        {productosTerminados.map(prod => <option key={prod.id} value={prod.id}>{prod.sku} - {prod.descripcion}</option>)}
                    </select>
                </label>
                <label>Cantidad a Producir:
                    <input type="number" step="1" min="1" name="cantidad_a_producir" value={newOrden.cantidad_a_producir} onChange={handleNewOrdenChange} required />
                </label>
                <label>Fecha:
                    <input type="date" name="fecha" value={newOrden.fecha} onChange={handleNewOrdenChange} required />
                </label>
            </div>
            <button type="submit" className="submit-btn" style={{marginTop: '10px'}}>Crear Orden</button>
        </form>
      </div>

      <div className="list-section">
        <h2>Listado de Órdenes</h2>
        {loading && <p>Cargando órdenes...</p>}
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th>Coste Real (€)</th>
            </tr>
          </thead>
          <tbody>
            {ordenes.map(orden => (
              <React.Fragment key={orden.id}>
                <tr onClick={() => orden.status === 'PENDIENTE' && handleSelectOrden(orden)} style={{ cursor: orden.status === 'PENDIENTE' ? 'pointer' : 'default', backgroundColor: selectedOrden?.id === orden.id ? 'var(--color-verde-claro)' : '' }}>
                  <td>{orden.id}</td>
                  <td>{orden.item_sku} - {orden.item_descripcion}</td>
                  <td>{orden.cantidad_a_producir}</td>
                  <td>{new Date(orden.fecha).toLocaleDateString('es-ES')}</td>
                  <td><span className={`status-${orden.status.toLowerCase()}`}>{orden.status}</span></td>
                  <td>{orden.coste_real_fabricacion ? parseFloat(orden.coste_real_fabricacion).toFixed(2) : '-'}</td>
                </tr>
                {selectedOrden?.id === orden.id && (
                  <tr>
                    <td colSpan="6" style={{ padding: '20px', backgroundColor: '#fdfdfd' }}>
                      <h4>Detalle de Orden de Producción #{orden.id}</h4>
                      <h5>Materiales Requeridos ({orden.cantidad_a_producir} uds.)</h5>
                      {recetaDeOrden.length === 0 && <p>Este producto no tiene una receta definida.</p>}
                      {recetaDeOrden.map(itemReceta => {
                        const stockItems = stockDisponible[itemReceta.id] || [];
                        const cantidadNecesaria = itemReceta.cantidad_requerida * orden.cantidad_a_producir;
                        return (
                          <div key={itemReceta.id} className="receta-item-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '15px', alignItems: 'center', marginBottom: '10px' }}>
                            <span>Material: <strong>{itemReceta.material_sku}</strong> (Necesitas: {cantidadNecesaria.toFixed(2)})</span>
                            <select value={stockAsignado[itemReceta.id] || ''} onChange={(e) => handleAsignarStock(itemReceta.id, e.target.value)} required>
                              <option value="">-- Selecciona un lote de stock --</option>
                              {stockItems.map(stock => (
                                <option key={stock.id} value={stock.id} disabled={stock.cantidad_actual < cantidadNecesaria}>
                                  Lote: {stock.lote} (Disponible: {stock.cantidad_actual.toFixed(2)})
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                      <button onClick={handleProcesarOrden} disabled={isProcesarDisabled || loading} className="submit-btn" style={{marginTop: '15px', backgroundColor: 'var(--color-verde-primario)'}}>
                        {loading ? 'Procesando...' : 'Confirmar y Procesar Producción'}
                      </button>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default GestionProduccion;