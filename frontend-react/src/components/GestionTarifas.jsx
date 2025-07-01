// frontend-react/src/components/GestionTarifas.jsx
import React, { useState, useEffect, useCallback } from 'react';
import '../App.css'; // Reutilizamos estilos

function GestionTarifas() {
    const [items, setItems] = useState([]);
    const [stockOptions, setStockOptions] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Carga la lista inicial de todos los materiales
    const fetchItemsParaTarifa = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch('http://localhost:5002/api/tarifa-items');
            if (!response.ok) throw new Error('No se pudieron cargar los materiales.');
            const itemsData = await response.json();
            setItems(itemsData);

            // Para cada item, carga sus lotes de stock disponibles
            const stockPromises = itemsData.map(item =>
                fetch(`http://localhost:5002/api/stock-para-item/${item.id}`).then(res => res.json())
            );
            const stockResults = await Promise.all(stockPromises);

            const stockMap = itemsData.reduce((acc, item, index) => {
                acc[item.id] = stockResults[index];
                return acc;
            }, {});
            setStockOptions(stockMap);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchItemsParaTarifa();
    }, [fetchItemsParaTarifa]);

    // Se ejecuta cuando el usuario selecciona un nuevo lote en el desplegable
    const handleReferenciaChange = async (itemId, stockId) => {
        // Actualiza el estado visualmente de inmediato para una mejor experiencia
        setItems(prevItems =>
            prevItems.map(item =>
                item.id === itemId ? { ...item, referencia_stock_id: parseInt(stockId) } : item
            )
        );

        // Envía la actualización al backend
        try {
            await fetch('http://localhost:5002/api/tarifa-referencia', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId, stockId: parseInt(stockId) }),
            });
            // Podrías mostrar un mensaje de éxito si quisieras
        } catch (err) {
            setError(`Error al guardar la referencia para el item ${itemId}.`);
            // Opcional: Revertir el cambio visual si falla el guardado
            fetchItemsParaTarifa();
        }
    };

    if (loading) return <p>Cargando materiales...</p>;
    if (error) return <p className="error-message">{error}</p>;

    return (
        <div className="gestion-tarifas-container">
            <h2>Gestión de ta rifa de venta</h2>
            <p>Selecciona qué bobina del Almacén debe usarse como referencia para calcular el precio de venta de cada tipo de material.</p>
            <table>
                <thead>
                    <tr>
                        <th>Material</th>
                        <th>Descripción</th>
                        <th>Atributos</th>
                        <th>Bobinas</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map(item => (
                        <tr key={item.id}>
                            <td>{item.sku}</td>
                            <td>{item.descripcion}</td>
                            <td>{item.atributos}</td>
                            <td>
                                <select
                                    value={item.referencia_stock_id || ''}
                                    onChange={(e) => handleReferenciaChange(item.id, e.target.value)}
                                    style={{ width: '100%' }}
                                >
                                    <option value="" disabled>-- Selecciona un lote --</option>
                                    {(stockOptions[item.id] || []).map(stock => (
                                        <option key={stock.id} value={stock.id}>
                                            {stock.lote} (Coste: {stock.coste_lote.toFixed(4)}€)
                                        </option>
                                    ))}
                                </select>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default GestionTarifas;