// frontend-react/src/components/TarifaVenta.jsx
import { useState, useEffect, useCallback } from 'react';

function TarifaVenta() {
  const [tarifaData, setTarifaData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTipoTarifa, setSelectedTipoTarifa] = useState('');

  const tiposTarifa = [
    { value: '', label: 'Seleccione un tipo de tarifa...' },
    { value: 'final', label: 'Tarifa Cliente Final' },
    { value: 'fabricante', label: 'Tarifa Fabricante' },
    { value: 'metrajes', label: 'Tarifa Venta por Metrajes' },
    { value: 'intermediario', label: 'Tarifa Intermediario' },
  ];

  const fetchTarifaVenta = useCallback(async () => {
    if (!selectedTipoTarifa) {
      setTarifaData([]);
      return;
    }

    setLoading(true);
    setError(null);
    const apiUrl = `http://localhost:5002/api/tarifa-venta?tipo_tarifa=${selectedTipoTarifa}`;

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.detalle || `Error del servidor: ${response.status}`);
      }
      const data = await response.json();
      setTarifaData(data);
    } catch (err) {
      setError(err.message);
      setTarifaData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedTipoTarifa]);

  useEffect(() => {
    if (selectedTipoTarifa) {
      fetchTarifaVenta();
    } else {
      setTarifaData([]);
    }
  }, [selectedTipoTarifa, fetchTarifaVenta]);

  return (
    <div className="tarifa-venta-container">
      <h2>Tarifa de Venta de Materiales en Stock</h2>

      <div className="filtros-container" style={{ maxWidth: '400px', marginBottom: '20px' }}>
        <div className="filtro-item">
          <label htmlFor="tipoTarifa">Seleccionar Tipo de Tarifa:</label>
          <select
            id="tipoTarifa"
            value={selectedTipoTarifa}
            onChange={(e) => setSelectedTipoTarifa(e.target.value)}
          >
            {tiposTarifa.map(tt => (
              <option key={tt.value} value={tt.value}>{tt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && <p>Generando tarifa...</p>}
      {error && <p className="error-backend">Error al generar tarifa: {error}</p>}
      
      {!loading && !error && selectedTipoTarifa && tarifaData.length === 0 && (
        <p>No hay materiales en stock para mostrar.</p>
      )}
      {!loading && !error && !selectedTipoTarifa && (
        <p>Por favor, seleccione un tipo de tarifa para verla.</p>
      )}

      {!loading && !error && tarifaData.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Referencia Stock</th>
              <th>Espesor</th>
              <th>Ancho (mm)</th>
              <th>Coste Metro Lineal (€)</th>
              <th>Margen Aplicado (%)</th>
              <th>Precio Venta Metro Lineal (€)</th>
            </tr>
          </thead>
          <tbody>
            {tarifaData.map(item => (
              <tr key={item.id}>
                <td>{item.referencia_stock}</td>
                <td>{item.espesor || '-'}</td>
                <td>{item.ancho || '-'}</td>
                <td>{item.coste_metro_lineal.toFixed(4)}</td>
                <td>{(item.margen_aplicado * 100).toFixed(2)}%</td>
                <td>{item.precio_venta_metro_lineal.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default TarifaVenta;