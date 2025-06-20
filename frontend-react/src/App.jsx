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

function App() {
  const [stockList, setStockList] = useState([]);
  const [loadingStock, setLoadingStock] = useState(true);
  const [errorStock, setErrorStock] = useState(null);
  const [filtroFamilia, setFiltroFamilia] = useState('');
  const [vistaActual, setVistaActual] = useState('STOCK');
  const [pedidoAEditarId, setPedidoAEditarId] = useState(null);

  // --- NUEVO ESTADO PARA LAS FAMILIAS ---
  const [familias, setFamilias] = useState([]);

  // --- NUEVO USEEFFECT PARA CARGAR LAS FAMILIAS ---
  useEffect(() => {
    const fetchFamilias = async () => {
      try {
        const response = await fetch('http://localhost:5002/api/familias');
        if (!response.ok) throw new Error('No se pudieron cargar las familias');
        setFamilias(await response.json());
      } catch (error) {
        console.error(error);
        // No establecemos un error principal aquí para no bloquear la app
      }
    };
    fetchFamilias();
  }, []); // Se ejecuta solo una vez al cargar la aplicación

  const fetchStockAndProcess = useCallback(async () => {
    setLoadingStock(true);
    setErrorStock(null);
    const params = new URLSearchParams();
    if (filtroFamilia) params.append('familia', filtroFamilia);
    const queryString = params.toString();
    const apiUrl = `http://localhost:5002/api/stock/agrupado${queryString ? `?${queryString}` : ''}`;

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

  const renderVista = () => {
    if (pedidoAEditarId) {
        return <FormularioEditarPedido 
                    pedidoId={pedidoAEditarId} 
                    onFinalizado={() => { setPedidoAEditarId(null); setVistaActual('LISTA_PEDIDOS'); }}
                    onCancel={() => setPedidoAEditarId(null)}
                />;
    }

    switch (vistaActual) {
      case 'NACIONAL': return <FormularioPedidoNacional />;
      case 'LISTA_PEDIDOS': return <ListaPedidos status="COMPLETADO" onEditRequest={setPedidoAEditarId} />;
      case 'BORRADORES': return <ListaPedidos status="BORRADOR" onEditRequest={setPedidoAEditarId} />;
      case 'TARIFA_VENTA': return <TarifaVenta />;
      case 'PRODUCTOS_RECETAS': return <GestionProductosRecetas />;
      case 'IMPORTACION': return <FormularioPedidoImportacion />;
      case 'MAQUINARIA': return <GestionMaquinaria />;
      case 'PRODUCCION': return <GestionProduccion />;
      case 'CALCULADORA_PRESUPUESTOS': return <CalculadoraPresupuestos />;
      case 'CONFIGURACION': return <FormularioConfiguracion />;

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
                  {/* --- SELECT DINÁMICO --- */}
                  <select id="filtro-familia" value={filtroFamilia} onChange={(e) => setFiltroFamilia(e.target.value)}>
                      <option value="">Todas</option>
                      {familias.map(familia => (
                        <option key={familia.id} value={familia.nombre}>{familia.nombre}</option>
                      ))}
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
            <button onClick={() => setVistaActual('PRODUCCION')} disabled={vistaActual === 'PRODUCCION'}>Gestión de Producción</button>
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