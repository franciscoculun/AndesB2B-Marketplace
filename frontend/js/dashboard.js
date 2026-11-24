/* AndesB2B · Panel general (dashboard)
   Script: comparte el ámbito global con los demás archivos de /js (ver orden de carga en panel.html). */
// PANEL GENERAL (DASHBOARD)
// Producto con stock igual o menor a este valor se considera "stock bajo" (alerta para Vendedor y Administrador)
const UMBRAL_STOCK_BAJO = 10;

async function cargarDashboard() {
    try {
        const emp = usuarioActual.empresa || {};
        const resumenDatosEl = document.getElementById('resumen-empresa-datos');
        if (resumenDatosEl) {
            resumenDatosEl.textContent =
                `${emp.razonSocial || '-'} | RUT: ${emp.rutEmpresa || '-'} | Giro: ${emp.giro || '-'} | Casa Matriz: ${emp.direccion || '-'} (${emp.region || '-'})`;
        }

        const rol = usuarioActual.rol;
        const veVentas = (rol === 'Administrador' || rol === 'Vendedor');
        const veCompras = (rol === 'Administrador' || rol === 'Comprador');
        const sinRespuesta = Promise.resolve({ ok: false });

        const [resCobros, resCompras, resVentas, resInv] = await Promise.all([
            veVentas ? fetch(`${API_URL}/pedidos/mi-estado-cuenta`) : sinRespuesta,
            veCompras ? fetch(`${API_URL}/pedidos/mis-compras`) : sinRespuesta,
            veVentas ? fetch(`${API_URL}/pedidos/mis-ventas`) : sinRespuesta,
            veVentas ? fetch(`${API_URL}/catalogo/mi-inventario`) : sinRespuesta
        ]);
        const cobros = resCobros.ok ? await resCobros.json() : [];
        const compras = resCompras.ok ? await resCompras.json() : [];
        const ventas = resVentas.ok ? await resVentas.json() : [];
        const inventario = resInv.ok ? await resInv.json() : [];

        const cobrosVigentes = cobros.filter(c => c.estadoCobro !== 'ANULADO');
        const sumaVentas = cobrosVigentes.reduce((acc, c) => acc + Number(c.subtotalProductos || 0), 0);
        const sumaComision = cobrosVigentes.reduce((acc, c) => acc + Number(c.comision || 0), 0);
        const comprasConfirmadas = compras.filter(c => ['COMPRA_CONFIRMADA', 'EN_TRANSITO', 'FINALIZADO'].includes(c.estadoPedido));
        const sumaCompras = comprasConfirmadas.reduce((acc, c) => acc + Number(c.subtotalProductos || 0), 0);
        const estaActivo = p => p.estadoPedido !== 'FINALIZADO' && p.estadoPedido !== 'RECHAZADO';

        const kpiVentas = document.getElementById('kpi-ventas');
        const kpiPedidos = document.getElementById('kpi-pedidos');
        const kpiPedidosDet = document.getElementById('kpi-pedidos-detalle');
        const kpiComision = document.getElementById('kpi-comision');
        const topComision = document.getElementById('top-comision');

        // Primera tarjeta: según el perfil (el Comprador no ve datos de ventas)
        if (kpiVentas) {
            const tarjeta = kpiVentas.closest('.kpi-card');
            const etiqueta = tarjeta ? tarjeta.querySelector('.kpi-label') : null;
            const nota = tarjeta ? tarjeta.querySelector('small') : null;
            if (veVentas) {
                if (etiqueta) etiqueta.textContent = 'VENTAS CONFIRMADAS';
                if (nota) nota.textContent = 'Subtotal de insumos vendidos en plataforma';
                kpiVentas.textContent = formatearCLP(sumaVentas);
            } else {
                if (etiqueta) etiqueta.textContent = 'COMPRAS CONFIRMADAS';
                if (nota) nota.textContent = 'Subtotal de insumos comprados (sin envío)';
                kpiVentas.textContent = formatearCLP(sumaCompras);
            }
        }

        const activos = [...ventas, ...compras].filter(estaActivo).length;
        if (kpiPedidos) kpiPedidos.textContent = `${activos} Pedido${activos === 1 ? '' : 's'}`;
        if (kpiPedidosDet) {
            const partes = [];
            if (veVentas) partes.push(`${ventas.length} venta(s) recibida(s)`);
            if (veCompras) partes.push(`${compras.length} compra(s) emitida(s)`);
            kpiPedidosDet.textContent = `${partes.join(' · ')} en total`;
        }
        if (kpiComision) kpiComision.textContent = formatearCLP(sumaComision);
        if (topComision) topComision.textContent = formatearCLP(sumaComision);

        const tbodyMov = document.getElementById('tabla-ultimos-movimientos');
        if (tbodyMov) {
            tbodyMov.innerHTML = '';
            const combinados = [
                ...ventas.map(v => ({ ...v, tipoOp: 'Venta B2B', contraparte: v.empresaCompradora ? v.empresaCompradora.razonSocial : '-' })),
                ...compras.map(c => ({ ...c, tipoOp: 'Compra B2B', contraparte: c.empresaVendedora ? c.empresaVendedora.razonSocial : '-' }))
            ].sort((a, b) => Number(b.idPedido) - Number(a.idPedido)).slice(0, 6);

            if (combinados.length === 0) {
                tbodyMov.innerHTML = '<tr><td colspan="5" class="text-muted">Aún no se registran pedidos en la cuenta.</td></tr>';
            } else {
                combinados.forEach(m => {
                    tbodyMov.innerHTML += `
                        <tr>
                            <td><strong>#${Number(m.idPedido)}</strong></td>
                            <td>${esc(m.contraparte)}</td>
                            <td><span class="badge ${m.tipoOp === 'Venta B2B' ? 'badge-success' : 'badge-info'}">${esc(m.tipoOp)}</span></td>
                            <td>${formatearCLP(m.subtotalProductos)}</td>
                            <td><span class="badge ${m.estadoPedido === 'RECHAZADO' ? 'badge-danger' : 'badge-warn'}">${esc(m.estadoPedido)}</span></td>
                        </tr>
                    `;
                });
            }
        }

        const contAlertas = document.getElementById('lista-alertas-dashboard');
        if (contAlertas) {
            const items = [];
            const itemAlerta = (clase, html) => `<div class="alert-item ${clase}">${html}</div>`;

            if (veVentas) {
                // Alertas de stock del catálogo propio (solo productos publicados)
                const publicados = inventario.filter(p => p.visible);
                const sinStock = publicados.filter(p => Number(p.stockDisponible) <= 0);
                const stockBajo = publicados.filter(p => Number(p.stockDisponible) > 0 && Number(p.stockDisponible) <= UMBRAL_STOCK_BAJO);
                const detalle = lista => lista.slice(0, 5)
                    .map(p => `${esc(p.sku)} (${Number(p.stockDisponible)} un.)`).join(', ') + (lista.length > 5 ? '…' : '');

                items.push(itemAlerta(sinStock.length > 0 ? 'danger' : 'ok',
                    `<strong>Productos sin stock:</strong> ${sinStock.length}${sinStock.length ? ' - ' + detalle(sinStock) : '.'}`));
                items.push(itemAlerta(stockBajo.length > 0 ? 'warn' : 'ok',
                    `<strong>Productos con stock bajo (${UMBRAL_STOCK_BAJO} un. o menos):</strong> ${stockBajo.length}${stockBajo.length ? ' - ' + detalle(stockBajo) : '.'}`));

                const porCotizar = ventas.filter(v => v.estadoPedido === 'COTIZANDO_ENVIO' && !v.medioTransporte).length;
                const porVerificar = ventas.filter(v => v.estadoPedido === 'COMPRA_CONFIRMADA' && v.estadoPago === 'EN_REVISION').length;
                const porDespachar = ventas.filter(v => v.estadoPedido === 'COMPRA_CONFIRMADA' && v.estadoPago === 'VERIFICADO').length;
                items.push(itemAlerta(porCotizar > 0 ? 'warn' : 'ok',
                    `<strong>Pedidos recibidos por cotizar envío:</strong> ${porCotizar} solicitud(es) pendiente(s).`));
                items.push(itemAlerta(porVerificar > 0 ? 'warn' : 'ok',
                    `<strong>Comprobantes de pago por verificar:</strong> ${porVerificar} pedido(s).`));
                items.push(itemAlerta(porDespachar > 0 ? 'warn' : 'ok',
                    `<strong>Pedidos listos para despachar:</strong> ${porDespachar} pedido(s) con pago verificado.`));
            }

            if (veCompras) {
                const porConfirmar = compras.filter(c => c.estadoPedido === 'COTIZANDO_ENVIO' && c.medioTransporte).length;
                const porPagar = compras.filter(c => c.estadoPedido === 'COMPRA_CONFIRMADA' &&
                    (c.estadoPago === 'SIN_COMPROBANTE' || c.estadoPago === 'OBSERVADO')).length;
                const porRecibir = compras.filter(c => c.estadoPedido === 'EN_TRANSITO').length;
                items.push(itemAlerta(porConfirmar > 0 ? 'warn' : 'ok',
                    `<strong>Cotizaciones listas para confirmar compra:</strong> ${porConfirmar} orden(es).`));
                items.push(itemAlerta(porPagar > 0 ? 'warn' : 'ok',
                    `<strong>Compras con factura PDF por adjuntar:</strong> ${porPagar} orden(es).`));
                items.push(itemAlerta('', `<strong>Compras en tránsito por recibir:</strong> ${porRecibir} envío(s).`));
            }

            if (veVentas) {
                const enTransito = ventas.filter(v => v.estadoPedido === 'EN_TRANSITO').length;
                items.push(itemAlerta('', `<strong>Despachos actualmente en tránsito:</strong> ${enTransito} envío(s) activo(s).`));
            }

            items.push(itemAlerta('ok', `<strong>Empresa conectada:</strong> ${esc(emp.razonSocial || '-')} (${esc(emp.rutEmpresa || '-')})`));
            contAlertas.innerHTML = items.join('');
        }
    } catch (e) {
        console.error('Error cargando dashboard:', e);
    }
}
