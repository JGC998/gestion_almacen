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
    // Cambiado el endpoint para obtener la tarifa de productos terminados
    const apiUrl = `http://localhost:5002/api/tarifa-venta?tipo_tarifa=${selectedTipoTarifa}`;
    console.log("Llamando a API para tarifa de venta de Productos Terminados:", apiUrl);

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
      <h2>Tarifa de Venta de Productos Terminados</h2> {/* Título actualizado */}

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
        <p>No hay datos de tarifa para mostrar para el tipo de tarifa seleccionado (o no hay productos terminados activos para calcularla).</p>
      )}
      {!loading && !error && !selectedTipoTarifa && (
        <p>Por favor, seleccione un tipo de tarifa para verla.</p>
      )}

      {!loading && !error && tarifaData.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Referencia Producto</th> {/* Nuevo campo */}
              <th>Nombre Producto</th> {/* Nuevo campo */}
              <th>Unidad</th> {/* Nuevo campo */}
              <th>Coste Base Fabricación (€)</th> {/* Nuevo campo */}
              <th>Margen (%)</th>
              <th>Precio Venta aplicado margen (€)</th>
            </tr>
          </thead>
          <tbody>
            {tarifaData.map((item, index) => (
              <tr key={`${item.producto_referencia}-${index}`}> {/* Clave más robusta */}
                <td>{item.producto_referencia}</td>
                <td>{item.producto_nombre}</td>
                <td>{item.unidad_medida}</td>
                <td>{item.coste_base_fabricacion.toFixed(4)}</td>
                <td>{(item.margen_aplicado * 100).toFixed(2)}%</td>
                <td>{item.precio_venta_aplicado_margen.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default TarifaVenta;
