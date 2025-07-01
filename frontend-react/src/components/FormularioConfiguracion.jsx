// frontend-react/src/components/FormularioConfiguracion.jsx
import React, { useState, useEffect, useCallback } from 'react';
import './FormularioPedido.css'; // Reutilizamos los estilos de formulario

function FormularioConfiguracion() {
  // El estado ahora refleja la nueva estructura anidada del config.json
  const [config, setConfig] = useState({
    margenes_venta: {
      final: '0.00',
      fabricante: '0.00',
      metrajes: '0.00',
      intermediario: '0.00',
    },
    costes_fijos: {
      mano_obra_faldeta: {
        final: '0.00',
        fabricante: '0.00',
        metrajes: '0.00',
        intermediario: '0.00',
      },
      mano_obra_metro_lineal: '0.00',
      grabado_faldeta: '0.00',
      troquelado_faldeta: '0.00',
    }
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  // Carga la configuración desde el backend
  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5002/api/configuracion');
      if (!response.ok) throw new Error('No se pudo cargar la configuración.');
      const data = await response.json();
      // Mapeamos los datos recibidos al estado, asegurando que existan los objetos
      setConfig({
        margenes_venta: data.margenes_venta || {},
        costes_fijos: {
            ...data.costes_fijos,
            mano_obra_faldeta: data.costes_fijos?.mano_obra_faldeta || {}
        }
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Maneja los cambios en los inputs, soportando la estructura anidada
  const handleChange = (e) => {
    const { name, value } = e.target;
    const [seccion, subseccion, clave] = name.split('.');

    if (clave) { // Es un valor anidado (ej: mano_obra_faldeta.final)
        setConfig(prev => ({
            ...prev,
            [seccion]: {
                ...prev[seccion],
                [subseccion]: {
                    ...prev[seccion][subseccion],
                    [clave]: value
                }
            }
        }));
    } else if (subseccion) { // Es un valor en el primer nivel de anidación (ej: margenes_venta.final)
        setConfig(prev => ({
            ...prev,
            [seccion]: {
                ...prev[seccion],
                [subseccion]: value
            }
        }));
    }
  };

  // Envía la configuración actualizada al backend
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage('');
    setError(null);

    // Creamos una copia profunda y convertimos todo a números antes de enviar
    const payload = JSON.parse(JSON.stringify(config));
    for (const key in payload.margenes_venta) {
        payload.margenes_venta[key] = parseFloat(payload.margenes_venta[key]);
    }
    for (const key in payload.costes_fijos.mano_obra_faldeta) {
        payload.costes_fijos.mano_obra_faldeta[key] = parseFloat(payload.costes_fijos.mano_obra_faldeta[key]);
    }
    payload.costes_fijos.mano_obra_metro_lineal = parseFloat(payload.costes_fijos.mano_obra_metro_lineal);
    payload.costes_fijos.grabado_faldeta = parseFloat(payload.costes_fijos.grabado_falkaeta);
    payload.costes_fijos.troquelado_faldeta = parseFloat(payload.costes_fijos.troquelado_faldeta);

    try {
      const response = await fetch('http://localhost:5002/api/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al guardar.');
      setSuccessMessage(data.mensaje || 'Configuración guardada con éxito.');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p>Cargando configuración...</p>;

  return (
    <div className="form-container">
      <h2>Configuración del Sistema</h2>
      {error && <p className="error-message">{error}</p>}
      {successMessage && <p className="success-message">{successMessage}</p>}

      <form onSubmit={handleSubmit}>
        <fieldset>
            <legend>Márgenes de Venta (%)</legend>
            <div className="form-grid">
                <label>Cliente Final: <input type="number" step="0.01" name="margenes_venta.final" value={config.margenes_venta.final} onChange={handleChange} required /></label>
                <label>Fabricante: <input type="number" step="0.01" name="margenes_venta.fabricante" value={config.margenes_venta.fabricante} onChange={handleChange} required /></label>
                <label>Metrajes: <input type="number" step="0.01" name="margenes_venta.metrajes" value={config.margenes_venta.metrajes} onChange={handleChange} required /></label>
                <label>Intermediario: <input type="number" step="0.01" name="margenes_venta.intermediario" value={config.margenes_venta.intermediario} onChange={handleChange} required /></label>
            </div>
        </fieldset>

        <fieldset>
            <legend>Costes Fijos de Producción (€)</legend>
            <div className="form-grid">
                 <label>Grabado por Faldeta: <input type="number" step="0.01" name="costes_fijos.grabado_faldeta" value={config.costes_fijos.grabado_faldeta} onChange={handleChange} required /></label>
                 <label>Troquelado por Faldeta: <input type="number" step="0.01" name="costes_fijos.troquelado_faldeta" value={config.costes_fijos.troquelado_faldeta} onChange={handleChange} required /></label>
            </div>
        </fieldset>
        
        <fieldset>
            <legend>Costes de Mano de Obra (€)</legend>
            <p style={{fontSize: '0.8em', color: '#666', marginTop: '-10px', marginBottom: '15px'}}>Coste de mano de obra por faldeta para clientes estándar. Para 'Metrajes', se usa el coste por metro lineal.</p>
             <div className="form-grid">
                <label>Clente Final: <input type="number" step="0.01" name="costes_fijos.mano_obra_faldeta.final" value={config.costes_fijos.mano_obra_faldeta.final} onChange={handleChange} required /></label>
                <label>Fabricante: <input type="number" step="0.01" name="costes_fijos.mano_obra_faldeta.fabricante" value={config.costes_fijos.mano_obra_faldeta.fabricante} onChange={handleChange} required /></label>
                <label>Intermediario: <input type="number" step="0.01" name="costes_fijos.mano_obra_faldeta.intermediario" value={config.costes_fijos.mano_obra_faldeta.intermediario} onChange={handleChange} required /></label>
                <label>Metrajes: <input type="number" step="0.01" name="costes_fijos.mano_obra_metro_lineal" value={config.costes_fijos.mano_obra_metro_lineal} onChange={handleChange} required /></label>
            </div>
        </fieldset>

        <button type="submit" disabled={loading} className="submit-btn">{loading ? 'Guardando...' : 'Guardar Configuración'}</button>
      </form>
    </div>
  );
}

export default FormularioConfiguracion;