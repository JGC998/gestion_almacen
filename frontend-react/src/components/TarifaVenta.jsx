// frontend-react/src/components/TarifaVenta.jsx
import React, { useState, useEffect, useCallback } from 'react';

// frontend-react/src/components/TarifaVenta.jsx
import jsPDF from 'jspdf';
import { applyPlugin } from 'jspdf-autotable';

// Aplicamos el plugin a la clase jsPDF
applyPlugin(jsPDF);

import '../App.css';

function TarifaVenta() {
    const [tarifas, setTarifas] = useState([]);
    const [margenes, setMargenes] = useState({}); // Estado para guardar los márgenes
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchTarifas = useCallback(async () => {
        setLoading(true);
        try {
            console.log("FRONTEND: 1. Enviando petición a /api/tarifas..."); // <-- AÑADE ESTA LÍNEA
            const response = await fetch('http://localhost:5002/api/tarifas');
            console.log("FRONTEND: 3. Recibida respuesta de /api/tarifas");
            if (!response.ok) throw new Error('No se pudieron cargar las tarifas.');
            const data = await response.json();
            setTarifas(data.tarifas); // Ahora los datos vienen en data.tarifas
            setMargenes(data.margenes); // Guardamos los márgenes
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTarifas();
    }, [fetchTarifas]);

   // En frontend-react/src/components/TarifaVenta.jsx
// REEMPLAZA esta función

    const generatePdf = () => {
        // --- CHIVATO 1: ¿Se ejecuta la función? ---
        console.log("1. La función generatePdf se ha iniciado.");

        if (tarifas.length === 0) {
            console.error("2. ERROR: No hay datos en 'tarifas' para generar el PDF.");
            return;
        }

        // --- CHIVATO 2: ¿Qué datos tenemos? ---
        console.log("2. Datos disponibles para el PDF:", {
            tarifas: tarifas,
            margenes: margenes
        });

        const doc = new jsPDF('l', 'mm', 'a4');
        doc.text("Tarifa de Venta de Materiales", 14, 16);

        const tableColumn = [
            "SKU",
            "Coste Ref. (€)",
            `P.V.P Final (${(margenes.final * 100).toFixed(0)}%)`,
            `P.V.P Fabricante (${(margenes.fabricante * 100).toFixed(0)}%)`,
            `P.V.P Intermediario (${(margenes.intermediario * 100).toFixed(0)}%)`,
            `P.V.P Metrajes (${(margenes.metrajes * 100).toFixed(0)}%)`
        ];
        const tableRows = [];

        tarifas.forEach(tarifa => {
            const tarifaData = [
                tarifa.sku,
                tarifa.coste_referencia.toFixed(4),
                tarifa.precio_final.toFixed(2),
                tarifa.precio_fabricante.toFixed(2),
                tarifa.precio_intermediario.toFixed(2),
                tarifa.precio_metrajes.toFixed(2)
            ];
            tableRows.push(tarifaData);
        });

        // --- CHIVATO 3: ¿Se han procesado bien las filas? ---
        console.log("3. Filas procesadas para la tabla:", tableRows);

        try {
            // La línea clave a cambiar es la siguiente:
            doc.autoTable({ // <-- CAMBIADO DE autoTable(...) a doc.autoTable(...)
                head: [tableColumn],
                body: tableRows,
                startY: 20,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [14, 56, 16] },
            });

            console.log("4. PDF generado, iniciando la descarga...");
            doc.save('tarifa_venta.pdf');
        } catch (e) {
            console.error("5. ERROR: Fallo al generar la tabla o guardar el PDF.", e);
        }
    };

    if (loading) return <p>Cargando tarifas...</p>;
    if (error) return <p className="error-message">{error}</p>;

    return (
        <div className="tarifa-venta-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Consulta de Tarifas de Venta</h2>
                <button onClick={generatePdf} disabled={tarifas.length === 0} className="btn-primary">
                    Exportar a PDF
                </button>
            </div>
            <p>Esta tabla muestra los precios de venta finales basados en los lotes de referencia y los márgenes configurados.</p>

            <div style={{ overflowX: 'auto' }}>
                <table>
                    <thead>
                        <tr>
                            <th>SKU</th>
                            <th>Coste Referencia</th>
                            <th>P.V.P Final<br/><span>({(margenes.final * 100).toFixed(0)}%)</span></th>
                            <th>P.V.P Fabricante<br/><span>({(margenes.fabricante * 100).toFixed(0)}%)</span></th>
                            <th>P.V.P Intermediario<br/><span>({(margenes.intermediario * 100).toFixed(0)}%)</span></th>
                            <th>P.V.P Metrajes<br/><span>({(margenes.metrajes * 100).toFixed(0)}%)</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {tarifas.map(tarifa => (
                            <tr key={tarifa.id}>
                                <td>{tarifa.sku}</td>
                                <td>{tarifa.coste_referencia.toFixed(4)} €</td>
                                <td>{tarifa.precio_final.toFixed(2)} €</td>
                                <td>{tarifa.precio_fabricante.toFixed(2)} €</td>
                                <td>{tarifa.precio_intermediario.toFixed(2)} €</td>
                                <td>{tarifa.precio_metrajes.toFixed(2)} €</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default TarifaVenta;