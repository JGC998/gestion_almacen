// frontend-react/src/components/TarifaVenta.jsx
import { useState, useEffect, useCallback } from 'react';
// Puedes reutilizar estilos de tabla de App.css o crear uno específico

function TarifaVenta() {
  const [tarifaData, setTarifaData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTipoTarifa, setSelectedTipoTarifa] = useState(''); // Cambiado a tipo_tarifa

  const tiposTarifa = [ // Cambiado a tipos de tarifa
    { value: '', label: 'Seleccione un tipo de tarifa...' },
    { value: 'final', label: 'Tarifa Cliente Final' },
    { value: 'fabricante', label: 'Tarifa Fabricante' },
    { value: 'metrajes', label: 'Tarifa Venta por Metrajes' },
    { value: 'intermediario', label: 'Tarifa Intermediario' }, // Nuevo tipo de tarifa
  ];

  const fetchTarifaVenta = useCallback(async () => {
    if (!selectedTipoTarifa) {
      setTarifaData([]); // Limpiar datos si no hay tipo de tarifa seleccionado
      return;
    }

    setLoading(true);
    setError(null);
    // Cambiado el query param a tipo_tarifa
    const apiUrl = `http://localhost:5002/api/tarifa-venta?tipo_tarifa=${selectedTipoTarifa}`;
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
      console.error(`Error al obtener tarifa de venta para ${selectedTipoTarifa}:`, err);
      setError(err.message);
      setTarifaData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedTipoTarifa]);

  // Cargar la tarifa cuando se selecciona un tipo de tarifa válido
  useEffect(() => {
    if (selectedTipoTarifa) {
      fetchTarifaVenta();
    } else {
      setTarifaData([]); // Limpiar si se deselecciona
    }
  }, [selectedTipoTarifa, fetchTarifaVenta]);

  return (
    <div className="tarifa-venta-container">
      <h2>Tarifa de Venta</h2>

      <div className="filtros-container" style={{ maxWidth: '400px', marginBottom: '20px' }}>
        <div className="filtro-item">
          <label htmlFor="tipoTarifa">Seleccionar Tipo de Tarifa:</label> {/* Cambiado el label */}
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
        <p>No hay datos de tarifa para mostrar para el tipo de tarifa seleccionado (o no hay stock base para calcularla).</p>
      )}
      {!loading && !error && !selectedTipoTarifa && (
        <p>Por favor, seleccione un tipo de tarifa para verla.</p>
      )}

      {!loading && !error && tarifaData.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th>Subtipo</th>
              <th>Espesor</th>
              <th>Ancho (mm)</th> {/* Nuevo campo */}
              <th>Precio ML antes margen (€)</th> {/* Nuevo campo */}
              <th>Margen (%)</th>
              <th>Precio Venta aplicado margen (€)</th> {/* Nuevo campo */}
            </tr>
          </thead>
          <tbody>
            {tarifaData.map((item, index) => (
              <tr key={`${item.material_tipo}-${item.subtipo_material}-${item.espesor}-${item.ancho}-${index}`}> {/* Clave más robusta */}
                <td>{item.material_tipo}</td>
                <td>{item.subtipo_material}</td>
                <td>{item.espesor}</td>
                <td>{item.ancho !== null && item.ancho !== undefined ? parseFloat(item.ancho).toFixed(0) : '-'}</td> {/* Mostrar ancho */}
                <td>{item.precio_metro_lineal_antes_margen.toFixed(4)}</td> {/* Mostrar nuevo campo */}
                <td>{(item.margen_aplicado * 100).toFixed(2)}%</td>
                <td>{item.precio_venta_aplicado_margen.toFixed(2)}</td> {/* Mostrar nuevo campo */}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default TarifaVenta;
