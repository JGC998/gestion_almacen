// frontend-react/src/components/CalculadoraFaldeta.jsx

import React, { useState, useEffect, useCallback } from 'react';
import '../App.css'; // Reutilizamos estilos
import './FormularioPedido.css'; // Reutilizamos más estilos para formularios

function CalculadoraFaldeta() {
    // Estado para los inputs del formulario
    const [calculo, setCalculo] = useState({
        anchoFaldeta: '',
        largoFaldeta: '',
        familia: '',
        espesor: '',
        tipoCliente: 'final',
        cantidad: 1,
    });

    // Estado para los checkboxes de gastos extra
    const [gastosSeleccionados, setGastosSeleccionados] = useState({
        grabado: false,
        troquelado: false,
    });

    // Estado para los datos de los desplegables
    const [opciones, setOpciones] = useState({
        familias: [],
        espesoresPorFamilia: {},
    });

    // Estado para el resultado y la comunicación con la API
    const [resultado, setResultado] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Cargar familias y espesores al iniciar
    useEffect(() => {
        const fetchOpciones = async () => {
            try {
                const [familiasRes, espesoresRes] = await Promise.all([
                    fetch('http://localhost:5002/api/familias'),
                    fetch('http://localhost:5002/api/stock/familias-y-espesores')
                ]);

                if (!familiasRes.ok || !espesoresRes.ok) {
                    throw new Error('No se pudieron cargar las opciones para la calculadora.');
                }

                const familiasData = await familiasRes.json();
                const espesoresData = await espesoresRes.json();

                setOpciones({
                    familias: familiasData,
                    espesoresPorFamilia: espesoresData,
                });

                // Seleccionar la primera familia por defecto si existe
                if (familiasData.length > 0) {
                    setCalculo(prev => ({ ...prev, familia: familiasData[0].nombre }));
                }

            } catch (err) {
                setError(err.message);
            }
        };
        fetchOpciones();
    }, []);

    // Manejar cambios en los inputs principales
    const handleChange = (e) => {
        const { name, value } = e.target;
        setCalculo(prev => ({ ...prev, [name]: value }));

        // Si cambia la familia, resetear el espesor
        if (name === 'familia') {
            setCalculo(prev => ({ ...prev, espesor: '' }));
        }
    };

    // Manejar cambios en los checkboxes
    const handleGastosChange = (e) => {
        const { name, checked } = e.target;
        setGastosSeleccionados(prev => ({ ...prev, [name]: checked }));
    };

    // Enviar el formulario para calcular
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setResultado(null);

        const payload = {
            ...calculo,
            anchoFaldeta: parseFloat(calculo.anchoFaldeta),
            largoFaldeta: parseFloat(calculo.largoFaldeta),
            cantidad: parseInt(calculo.cantidad, 10),
            gastosSeleccionados,
        };

        try {
            const response = await fetch('http://localhost:5002/api/calculadora/precio-faldeta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.detalle || 'Error en el cálculo.');
            }
            setResultado(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const espesoresDisponibles = calculo.familia ? opciones.espesoresPorFamilia[calculo.familia] || [] : [];

    return (
        <div className="form-container">
            <h2>Calculadora de Precios de Faldetas</h2>
            <form onSubmit={handleSubmit}>
                <fieldset>
                    <legend>Datos de la Faldeta</legend>
                    <div className="form-grid">
                        <label>Ancho (mm)*: <input type="number" name="anchoFaldeta" value={calculo.anchoFaldeta} onChange={handleChange} required /></label>
                        <label>Largo (mm)*: <input type="number" name="largoFaldeta" value={calculo.largoFaldeta} onChange={handleChange} required /></label>
                        <label>Cantidad*: <input type="number" name="cantidad" value={calculo.cantidad} onChange={handleChange} required min="1" /></label>
                    </div>
                </fieldset>

                <fieldset>
                    <legend>Material y Cliente</legend>
                    <div className="form-grid">
                        <label>Material (Familia)*:
                            <select name="familia" value={calculo.familia} onChange={handleChange} required>
                                <option value="" disabled>Seleccione...</option>
                                {opciones.familias.map(f => <option key={f.id} value={f.nombre}>{f.nombre}</option>)}
                            </select>
                        </label>
                        <label>Espesor*:
                            <select name="espesor" value={calculo.espesor} onChange={handleChange} required disabled={!calculo.familia}>
                                <option value="" disabled>Seleccione...</option>
                                {espesoresDisponibles.map(e => <option key={e} value={e}>{e}</option>)}
                            </select>
                        </label>
                        <label>Tipo de Cliente*:
                            <select name="tipoCliente" value={calculo.tipoCliente} onChange={handleChange} required>
                                <option value="final">Cliente Final</option>
                                <option value="fabricante">Fabricante</option>
                                <option value="metrajes">Metrajes</option>
                                <option value="intermediario">Intermediario</option>
                            </select>
                        </label>
                    </div>
                </fieldset>

                <fieldset>
                    <legend>Gastos Adicionales</legend>
                    <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                        <label style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <input type="checkbox" name="grabado" checked={gastosSeleccionados.grabado} onChange={handleGastosChange} style={{ width: 'auto', marginRight: '10px' }} />
                            Grabado
                        </label>
                        <label style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <input type="checkbox" name="troquelado" checked={gastosSeleccionados.troquelado} onChange={handleGastosChange} style={{ width: 'auto', marginRight: '10px' }} />
                            Troquelado
                        </label>
                    </div>
                </fieldset>

                <button type="submit" className="submit-btn" disabled={loading}>{loading ? 'Calculando...' : 'Calcular Precio'}</button>
            </form>

            {error && <p className="error-message" style={{ marginTop: '20px' }}>Error: {error}</p>}

            {resultado && (
                <div className="presupuesto-resultado" style={{ marginTop: '30px', padding: '20px', border: '1px solid #4CAF50', borderRadius: '8px', backgroundColor: '#e8f5e9' }}>
                    <h3>Resultado del Cálculo</h3>
                    <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: 'var(--color-verde-oscuro)', marginBottom: '15px', textAlign: 'center' }}>
                        Precio Total: {resultado.precioTotal.toFixed(2)} €
                    </div>
                    <div className="modal-details-grid">
                        <p><strong>Precio por Faldeta:</strong></p><p>{resultado.precioUnitario.toFixed(4)} €</p>
                        <p><strong>Coste Material:</strong></p><p>{resultado.desglose.costeMaterial.toFixed(4)} €</p>
                        <p><strong>Coste Gastos Fijos:</strong></p><p>{resultado.desglose.costeGastosFijos.toFixed(4)} €</p>
                        <p><strong>Coste Producción Unitario:</strong></p><p>{resultado.desglose.costeTotalProduccion.toFixed(4)} €</p>
                        <p><strong>Margen Aplicado:</strong></p><p>{(resultado.desglose.margenAplicado * 100).toFixed(2)} %</p>
                    </div>
                    <h4 style={{ marginTop: '15px' }}>Desglose de Gastos Fijos:</h4>
                    <ul>
                        {resultado.desglose.listaGastos.map(gasto => (
                            <li key={gasto.nombre}>{gasto.nombre}: {gasto.coste.toFixed(2)} €</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default CalculadoraFaldeta;