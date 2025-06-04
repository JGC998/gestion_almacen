// frontend-react/src/components/FormularioConfiguracion.jsx
import React, { useState, useEffect, useCallback } from 'react';
import '../App.css'; // Reutiliza estilos generales

function FormularioConfiguracion() {
  const [config, setConfig] = useState({
    margen_default_final: '',
    margen_default_fabricante: '',
    margen_default_metrajes: '',
    margen_default_intermediario: '',
    coste_mano_obra_default: '',
    coste_mano_obra_por_metro_metraje: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:5002/api/configuracion');
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error del servidor: ${response.status}`);
      }
      const data = await response.json();
      // Asegurarse de que los números se muestren con 2 decimales para edición
      setConfig({
        margen_default_final: parseFloat(data.margen_default_final || 0).toFixed(2),
        margen_default_fabricante: parseFloat(data.margen_default_fabricante || 0).toFixed(2),
        margen_default_metrajes: parseFloat(data.margen_default_metrajes || 0).toFixed(2),
        margen_default_intermediario: parseFloat(data.margen_default_intermediario || 0).toFixed(2),
        coste_mano_obra_default: parseFloat(data.coste_mano_obra_default || 0).toFixed(2),
        coste_mano_obra_por_metro_metraje: parseFloat(data.coste_mano_obra_por_metro_metraje || 0).toFixed(4)
      });
    } catch (err) {
      console.error("Error al obtener la configuración:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage('');
    setError(null);

    // Convertir a número antes de enviar
    const payload = {
      margen_default_final: parseFloat(config.margen_default_final),
      margen_default_fabricante: parseFloat(config.margen_default_fabricante),
      margen_default_metrajes: parseFloat(config.margen_default_metrajes),
      margen_default_intermediario: parseFloat(config.margen_default_intermediario),
      coste_mano_obra_default: parseFloat(config.coste_mano_obra_default),
      coste_mano_obra_por_metro_metraje: parseFloat(config.coste_mano_obra_por_metro_metraje)
    };

    try {
      const response = await fetch('http://localhost:5002/api/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${response.status}`);
      }
      setSuccessMessage(data.mensaje);
      // Opcional: Volver a cargar la configuración para asegurar que se muestren los valores guardados
      fetchConfig();
    } catch (err) {
      console.error("Error al guardar la configuración:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="configuracion-container">
      <h2>Configuración del Sistema</h2>

      {error && <p className="error-message">{error}</p>}
      {successMessage && <p className="success-message">{successMessage}</p>}

      {loading && <p>Cargando configuración...</p>}
      {!loading && !error && (
        <form onSubmit={handleSubmit} className="form-container">
          <div className="form-grid">
            <label>Margen por defecto (Cliente Final %):
              <input type="number" step="0.01" name="margen_default_final" value={config.margen_default_final} onChange={handleChange} required />
            </label>
            <label>Margen por defecto (Fabricante %):
              <input type="number" step="0.01" name="margen_default_fabricante" value={config.margen_default_fabricante} onChange={handleChange} required />
            </label>
            <label>Margen por defecto (Metrajes %):
              <input type="number" step="0.01" name="margen_default_metrajes" value={config.margen_default_metrajes} onChange={handleChange} required />
            </label>
            <label>Margen por defecto (Intermediario %):
              <input type="number" step="0.01" name="margen_default_intermediario" value={config.margen_default_intermediario} onChange={handleChange} required />
            </label>
            <label>Coste Mano de Obra por defecto (€/h):
              <input type="number" step="0.01" name="coste_mano_obra_default" value={config.coste_mano_obra_default} onChange={handleChange} required />
            </label>
            <label>Coste Mano de Obra por Metro (Metraje €/m):
              <input type="number" step="0.0001" name="coste_mano_obra_por_metro_metraje" value={config.coste_mano_obra_por_metro_metraje} onChange={handleChange} required />
            </label>
          </div>
          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </form>
      )}
    </div>
  );
}

export default FormularioConfiguracion;
