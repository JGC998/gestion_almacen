// frontend-react/src/components/TarifaVenta.jsx
import { useState, useEffect, useCallback } from 'react';
// Puedes reutilizar estilos de tabla de App.css o crear uno específico

function TarifaVenta() {
  const [tarifaData, setTarifaData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTipoCliente, setSelectedTipoCliente] = useState(''); // 'final', 'fabricante', 'metrajes'

  const tiposCliente = [
    { value: '', label: 'Seleccione un tipo de cliente...' },
    { value: 'final', label: 'Cliente Final' },
    { value: 'fabricante', label: 'Fabricante' },
    { value: 'metrajes', label: 'Venta por Metrajes' },
  ];

  const fetchTarifaVenta = useCallback(async () => {
    if (!selectedTipoCliente) {
      setTarifaData([]); // Limpiar datos si no hay tipo de cliente seleccionado
      return;
    }

    setLoading(true);
    setError(null);
    const apiUrl = `http://localhost:5002/api/tarifa-venta?tipo_cliente=${selectedTipoCliente}`;
    console.log("Llamando a API para tarifa de venta:", apiUrl);

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.detalle || `Error del servidor: ${response.status}`);
      }
      const data = await response.json();
      setTarifaData(data);
    } catch (err) {
      console.error(`Error al obtener tarifa de venta para ${selectedTipoCliente}:`, err);
      setError(err.message);
      setTarifaData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedTipoCliente]);

  // Cargar la tarifa cuando se selecciona un tipo de cliente válido
  useEffect(() => {
    if (selectedTipoCliente) {
      fetchTarifaVenta();
    } else {
      setTarifaData([]); // Limpiar si se deselecciona
    }
  }, [selectedTipoCliente, fetchTarifaVenta]);

  return (
    <div className="tarifa-venta-container">
      <h2>Tarifa de Venta</h2>

      <div className="filtros-container" style={{ maxWidth: '400px', marginBottom: '20px' }}>
        <div className="filtro-item">
          <label htmlFor="tipoClienteTarifa">Seleccionar Tipo de Cliente:</label>
          <select 
            id="tipoClienteTarifa" 
            value={selectedTipoCliente} 
            onChange={(e) => setSelectedTipoCliente(e.target.value)}
          >
            {tiposCliente.map(tc => (
              <option key={tc.value} value={tc.value}>{tc.label}</option>
            ))}
          </select>
        </div>
        {/* Podríamos añadir un botón explícito de "Generar Tarifa" si no queremos que se cargue automáticamente al cambiar el select */}
        {/* <button onClick={fetchTarifaVenta} disabled={!selectedTipoCliente || loading}>
          {loading ? 'Generando...' : 'Generar Tarifa'}
        </button> */}
      </div>

      {loading && <p>Generando tarifa...</p>}
      {error && <p className="error-backend">Error al generar tarifa: {error}</p>}
      
      {!loading && !error && selectedTipoCliente && tarifaData.length === 0 && (
        <p>No hay datos de tarifa para mostrar para el tipo de cliente seleccionado (o no hay stock base para calcularla).</p>
      )}
      {!loading && !error && !selectedTipoCliente && (
        <p>Por favor, seleccione un tipo de cliente para ver la tarifa.</p>
      )}

      {!loading && !error && tarifaData.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th>Subtipo</th>
              <th>Espesor</th>
              <th>Coste Máx. (€)</th>
              <th>Margen (%)</th>
              <th>Precio Venta (€)</th>
            </tr>
          </thead>
          <tbody>
            {tarifaData.map((item, index) => (
              <tr key={`${item.material_tipo}-${item.subtipo_material}-${item.espesor}-${index}`}> {/* Clave más robusta */}
                <td>{item.material_tipo}</td>
                <td>{item.subtipo_material}</td>
                <td>{item.espesor}</td>
                <td>{item.coste_maximo_grupo.toFixed(4)}</td>
                <td>{(item.margen_aplicado * 100).toFixed(2)}%</td>
                <td>{item.precio_venta_calculado.toFixed(2)}</td> {/* Precio de venta usualmente con 2 decimales */}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default TarifaVenta;