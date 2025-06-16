// frontend-react/src/components/TarifaVenta.jsx
import React, { useState, useEffect, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function TarifaVenta() {
  const [tarifas, setTarifas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTarifas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
        // La llamada ya no necesita parámetros
        const response = await fetch('http://localhost:5002/api/tarifas');
        if (!response.ok) throw new Error('Error al cargar las tarifas.');
        const data = await response.json();
        setTarifas(data);
    } catch (err) {
        setError(err.message);
    } finally {
        setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTarifas();
  }, [fetchTarifas]);

  const generatePdf = () => {
    if (tarifas.length === 0) return;

    const doc = new jsPDF('landscape'); // Ponemos la hoja en horizontal
    doc.text(`Matriz de Tarifas de Venta`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 14, 20);

    const tableColumn = ["SKU", "Características", "PVP Final", "PVP Fabricante", "PVP Intermediario", "PVP Metrajes"];
    const tableRows = [];

    tarifas.forEach(item => {
      const itemData = [
        item.sku,
        item.atributos,
        item.precio_final ? item.precio_final.toFixed(2) + ' €' : '-',
        item.precio_fabricante ? item.precio_fabricante.toFixed(2) + ' €' : '-',
        item.precio_intermediario ? item.precio_intermediario.toFixed(2) + ' €' : '-',
        item.precio_metrajes ? item.precio_metrajes.toFixed(2) + ' €' : '-',
      ];
      tableRows.push(itemData);
    });

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 25,
    });

    doc.save(`matriz_tarifas_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="tarifa-venta-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Matriz de Precios de Venta</h2>
        <button onClick={generatePdf} disabled={tarifas.length === 0} className="btn-primary">
            Generar PDF
        </button>
      </div>
      <p>Esta tabla muestra todos los precios de venta para cada tipo de cliente. Se actualiza automáticamente.</p>
      
      {loading && <p>Cargando tarifas...</p>}
      {error && <p className="error-backend">{error}</p>}
      
      {!loading && tarifas.length === 0 && <p>Aún no se han generado tarifas. Procese un pedido para crearlas.</p>}

      {!loading && tarifas.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
            <table>
            <thead>
                <tr>
                <th>SKU</th>
                <th>Características</th>
                <th>PVP Final</th>
                <th>PVP Fabricante</th>
                <th>PVP Intermediario</th>
                <th>PVP Metrajes</th>
                </tr>
            </thead>
            <tbody>
                {tarifas.map(item => (
                <tr key={item.id}>
                    <td>{item.sku}</td>
                    <td>{item.atributos}</td>
                    <td>{item.precio_final ? item.precio_final.toFixed(2) + ' €' : '-'}</td>
                    <td>{item.precio_fabricante ? item.precio_fabricante.toFixed(2) + ' €' : '-'}</td>
                    <td>{item.precio_intermediario ? item.precio_intermediario.toFixed(2) + ' €' : '-'}</td>
                    <td>{item.precio_metrajes ? item.precio_metrajes.toFixed(2) + ' €' : '-'}</td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
      )}
    </div>
  );
}

export default TarifaVenta;