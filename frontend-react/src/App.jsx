// frontend-react/src/App.jsx
import { useState, useEffect, useCallback } from 'react';
import './App.css';
import FormularioPedidoNacional from './components/FormularioPedidoNacional.jsx';
import FormularioPedidoImportacion from './components/FormularioPedidoImportacion.jsx';
import ListaPedidos from './ListaPedidos.jsx';
import TarifaVenta from './components/TarifaVenta.jsx';
import GestionProductosRecetas from './components/GestionProductosRecetas.jsx';
import GestionMaquinaria from './components/GestionMaquinaria.jsx';
import GestionProduccion from './components/GestionProduccion.jsx';
import FormularioConfiguracion from './components/FormularioConfiguracion.jsx';
import CalculadoraPresupuestos from './components/CalculadoraPresupuestos.jsx';
import FormularioEditarPedido from './components/FormularioEditarPedido.jsx';
import FormularioOrdenProduccion from './components/FormularioOrdenProduccion.jsx';

// El modal de detalles ya no se usará en esta vista, pero lo dejamos por si se necesita en otro lugar.
function DetalleStockModal({ item, onClose }) {
  if (!item) return null;
   return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Detalles del Lote: {item.lote} (Ref: {item.sku})</h2>
        <div className="modal-details-grid">
            <p><strong>Referencia:</strong> {item.sku || 'N/A'}</p>
            <p><strong>Descripción:</strong> {item.descripcion || 'N/A'}</p>
            <p><strong>Familia:</strong> {item.familia || 'N/A'}</p>
            <p><strong>Espesor:</strong> {item.espesor || 'N/A'}</p>
            <p><strong>Ancho:</strong> {item.ancho ? `${item.ancho} mm` : 'N/A'}</p>
            <p><strong>Lote:</strong> {item.lote || 'N/A'}</p>
            <p><strong>Cantidad Actual:</strong> {parseFloat(item.cantidad_actual || 0).toFixed(2)} {item.unidad_medida}</p>
            <p><strong>Coste del Lote:</strong> {parseFloat(item.coste_lote || 0).toFixed(4)} €/{item.unidad_medida}</p>
            <p><strong>Ubicación:</strong> {item.ubicacion || 'N/A'}</p>
            <p><strong>Estado:</strong> {item.status || 'N/A'}</p>
        </div>
        <button onClick={onClose} className="modal-close-button">Cerrar</button>
      </div>
    </div>
  );
}


function App() {
  const [stockList, setStockList] = useState([]);
  const [loadingStock, setLoadingStock] = useState(true);
  const [errorStock, setErrorStock] = useState(null);
  const [filtroFamilia, setFiltroFamilia] = useState('');
  const [vistaActual, setVistaActual] = useState('STOCK');
  const [pedidoAEditarId, setPedidoAEditarId] = useState(null);

  const fetchStockAndProcess = useCallback(async () => {
    setLoadingStock(true);
    setErrorStock(null);
    const params = new URLSearchParams();
    if (filtroFamilia) params.append('familia', filtroFamilia);
    const queryString = params.toString();
    const apiUrl = `http://localhost:5002/api/stock/agrupado${queryString ? `?${queryString}` : ''}`;
    
    console.log("Llamando a la API de stock agrupado:", apiUrl);

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);
      const data = await response.json();
      setStockList(data);
    } catch (err) {
      console.error("Error al obtener y procesar el stock agrupado:", err);
      setErrorStock(err.message);
      setStockList([]);
    } finally {
      setLoadingStock(false);
    }
  }, [filtroFamilia]);

  useEffect(() => {
    if (vistaActual === 'STOCK') {
        fetchStockAndProcess();
    }
  }, [vistaActual, fetchStockAndProcess]);

  // LA FUNCIÓN renderVista SÓLO DEVUELVE EL CONTENIDO DE LA VISTA ACTUAL
  const renderVista = () => {
    if (pedidoAEditarId) {
        return <FormularioEditarPedido 
                    pedidoId={pedidoAEditarId} 
                    onFinalizado={() => setPedidoAEditarId(null)} // Al finalizar, volvemos a la lista
                    onCancel={() => setPedidoAEditarId(null)} // Al cancelar, también
                />;
    }


    switch (vistaActual) {
      case 'NACIONAL': return <FormularioPedidoNacional />;
      case 'LISTA_PEDIDOS': return <ListaPedidos status="COMPLETADO" onEditRequest={setPedidoAEditarId} />;
      case 'BORRADORES': return <ListaPedidos status="BORRADOR" onEditRequest={setPedidoAEditarId} />;
      case 'TARIFA_VENTA': return <TarifaVenta />;
      case 'PRODUCTOS_RECETAS': return <GestionProductosRecetas />;
      case 'IMPORTACION': return <FormularioPedidoImportacion />;
      case 'PRODUCTOS_RECETAS': return <GestionProductosRecetas />;
      case 'MAQUINARIA': return <GestionMaquinaria />;
      case 'PRODUCCION': return <GestionProduccion />; // Esta será la lista de órdenes
      case 'NUEVA_ORDEN_PRODUCCION': return <FormularioOrdenProduccion />; // <-- NUEVO CASE
      case 'CALCULADORA_PRESUPUESTOS': return <CalculadoraPresupuestos />;
      // En App.jsx, dentro de la función renderVista, REEMPLAZA el bloque case 'STOCK'

      case 'STOCK':
      default:
        if (loadingStock) return <p>Cargando stock...</p>;
        if (errorStock) return <p className="error-backend">Error al cargar lista de stock: {errorStock}</p>;

        return (
            <>
              <h2>Stock Actual de Materias Primas</h2>
              <div className="filtros-container">
                <div className="filtro-item">
                  <label htmlFor="filtro-familia">Filtrar por Familia:</label>
                  <select id="filtro-familia" value={filtroFamilia} onChange={(e) => setFiltroFamilia(e.target.value)}>
                      <option value="">Todas</option>
                      {/* Aquí podrías cargar las familias dinámicamente si lo deseas en el futuro */}
                      <option value="GOMA">GOMA</option>
                      <option value="FIELTRO">FIELTRO</option>
                      <option value="PVC">PVC</option>
                  </select>
                </div>
              </div>

              {stockList.length === 0 && <p>No hay stock que coincida con los filtros.</p>}

              {stockList.length > 0 && (
                <table>
                  <thead>
                    <tr>
                      <th>Familia</th>
                      <th>Descripción</th>
                      <th>Características</th>
                      <th>Nº de Lotes</th>
                      <th>Cantidad Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockList.map((item) => (
                      <tr key={item.item_id}>
                        <td>{item.familia}</td>
                        <td>{item.descripcion}</td>
                        <td>{item.atributos}</td>
                        <td>{item.numero_lotes}</td>
                        <td>{parseFloat(item.cantidad_total || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
        );
    }
  };
  
  // LA ESTRUCTURA PRINCIPAL DE LA APP VA AQUÍ, EN EL RETURN DEL COMPONENTE APP
  return (
    <div className="app-layout">
      <nav className="sidebar">
        <h1 className="app-title">Gestión de Almacén</h1>
        <div className="sidebar-section">
            <h3>Materias Primas y Stock</h3>
            <button onClick={() => setVistaActual('STOCK')} disabled={vistaActual === 'STOCK'}>Ver Stock</button>
            <button onClick={() => setVistaActual('LISTA_PEDIDOS')} disabled={vistaActual === 'LISTA_PEDIDOS'}>Ver Pedidos</button>
            <button onClick={() => setVistaActual('TARIFA_VENTA')} disabled={vistaActual === 'TARIFA_VENTA'}>Ver Tarifa Venta</button>
            <button onClick={() => setVistaActual('NACIONAL')} disabled={vistaActual === 'NACIONAL'}>Nuevo Pedido Nacional</button>
            <button onClick={() => setVistaActual('IMPORTACION')} disabled={vistaActual === 'IMPORTACION'}>Nuevo Pedido Importación</button>
            <button onClick={() => setVistaActual('BORRADORES')} disabled={vistaActual === 'BORRADORES'}>Borradores</button>
        </div>
        <div className="sidebar-section">
            <h3>Fabricación</h3>
            <button onClick={() => setVistaActual('PRODUCTOS_RECETAS')} disabled={vistaActual === 'PRODUCTOS_RECETAS'}>Gestión de Artículos</button>
            <button onClick={() => setVistaActual('MAQUINARIA')} disabled={vistaActual === 'MAQUINARIA'}>Gestión Maquinaria</button>
            {/* Cambiamos el nombre de "Producción" a "Ver Órdenes" o similar */}
            <button onClick={() => setVistaActual('PRODUCCION')} disabled={vistaActual === 'PRODUCCION'}>Ver Órdenes</button>
            {/* NUEVO BOTÓN */}
            <button onClick={() => setVistaActual('NUEVA_ORDEN_PRODUCCION')} disabled={vistaActual === 'NUEVA_ORDEN_PRODUCCION'}>Nueva Orden Producción</button>
        </div>
        <div className="sidebar-section">
            <h3>Herramientas</h3>
            <button onClick={() => setVistaActual('CALCULADORA_PRESUPUESTOS')} disabled={vistaActual === 'CALCULADORA_PRESUPUESTOS'}>Calculadora Presupuestos</button>
            <button onClick={() => setVistaActual('CONFIGURACION')} disabled={vistaActual === 'CONFIGURACION'}>Configuración</button>
        </div>
      </nav>
      <div className="main-content-area">
        <div className="container">
          {renderVista()}
        </div>
      </div>
    </div>
  );
}

export default App;