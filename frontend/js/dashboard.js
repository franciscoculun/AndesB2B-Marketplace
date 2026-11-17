/* AndesB2B · Panel general (dashboard)
   Script: comparte el ámbito global con los demás archivos de /js (ver orden de carga en panel.html). */
// PANEL GENERAL (DASHBOARD)
async function cargarDashboard() {
    try {
        const emp = usuarioActual.empresa || {};
        const resumenDatosEl = document.getElementById('resumen-empresa-datos');
        if (resumenDatosEl) {
            resumenDatosEl.textContent =
                `${emp.razonSocial || '-'} | RUT: ${emp.rutEmpresa || '-'} | Giro: ${emp.giro || '-'} | Casa Matriz: ${emp.direccion || '-'} (${emp.region || '-'})`;
        }

        const puedeVerVentas = (usuarioActual.rol === 'Administrador' || usuarioActual.rol === 'Vendedor');
        const promesas = [
            puedeVerVentas ? fetch(`${API_URL}/pedidos/mi-estado-cuenta`) : Promise.resolve({ ok: false }),
            fetch(`${API_URL}/pedidos/mis-compras`),
            puedeVerVentas ? fetch(`${API_URL}/pedidos/mis-ventas`) : Promise.resolve({ ok: false })
        ];

        const [resCobros, resCompras, resVentas] = await Promise.all(promesas);
        const cobros = resCobros.ok ? await resCobros.json() : [];
        const compras = resCompras.ok ? await resCompras.json() : [];
        const ventas = resVentas.ok ? await resVentas.json() : [];

        const sumaVentas = cobros.reduce((acc, c) => acc + Number(c.subtotalProductos || 0), 0);
        const sumaComision = cobros.reduce((acc, c) => acc + Number(c.comision || 0), 0);

        const kpiVentas = document.getElementById('kpi-ventas');
        const kpiPedidos = document.getElementById('kpi-pedidos');
        const kpiPedidosDet = document.getElementById('kpi-pedidos-detalle');
        const kpiComision = document.getElementById('kpi-comision');
        const topComision = document.getElementById('top-comision');

        if (kpiVentas) kpiVentas.textContent = formatearCLP(sumaVentas);
        if (kpiPedidos) kpiPedidos.textContent = `${compras.length + ventas.length} Pedidos`;
        if (kpiPedidosDet) kpiPedidosDet.textContent = `${ventas.length} ventas recibidas · ${compras.length} compras emitidas`;
        if (kpiComision) kpiComision.textContent = formatearCLP(sumaComision);
        if (topComision) topComision.textContent = formatearCLP(sumaComision);

        const tbodyMov = document.getElementById('tabla-ultimos-movimientos');
        if (tbodyMov) {
            tbodyMov.innerHTML = '';
            const combinados = [
                ...ventas.map(v => ({ ...v, tipoOp: 'Venta B2B', contraparte: v.empresaCompradora ? v.empresaCompradora.razonSocial : '-' })),
                ...compras.map(c => ({ ...c, tipoOp: 'Compra B2B', contraparte: c.empresaVendedora ? c.empresaVendedora.razonSocial : '-' }))
            ].slice(0, 6);

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
                            <td><span class="badge badge-warn">${esc(m.estadoPedido)}</span></td>
                        </tr>
                    `;
                });
            }
        }

        const contAlertas = document.getElementById('lista-alertas-dashboard');
        if (contAlertas) {
            const porCotizar = ventas.filter(v => v.estadoPedido === 'COTIZANDO_ENVIO').length;
            const porConfirmar = compras.filter(c => c.estadoPedido === 'COTIZANDO_ENVIO' && c.medioTransporte).length;
            const enTransito = [...ventas, ...compras].filter(p => p.estadoPedido === 'EN_TRANSITO').length;

            contAlertas.innerHTML = `
                <div class="alert-item ${porCotizar > 0 ? 'warn' : 'ok'}">
                    <strong>Pedidos recibidos por cotizar envío:</strong> ${Number(porCotizar)} solicitud(es) pendiente(s).
                </div>
                <div class="alert-item ${porConfirmar > 0 ? 'warn' : 'ok'}">
                    <strong>Cotizaciones listas para confirmar compra:</strong> ${Number(porConfirmar)} orden(es).
                </div>
                <div class="alert-item">
                    <strong>Despachos actualmente en tránsito:</strong> ${Number(enTransito)} envío(s) activo(s).
                </div>
                <div class="alert-item ok">
                    <strong>Empresa conectada:</strong> ${esc(emp.razonSocial || '-')} (${esc(emp.rutEmpresa || '-')})
                </div>
            `;
        }
    } catch (e) {
        console.error('Error cargando dashboard:', e);
    }
}
