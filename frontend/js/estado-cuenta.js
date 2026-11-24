/* AndesB2B · Estado de cuenta y comisión del 3 %
   Script: comparte el ámbito global con los demás archivos de /js (ver orden de carga en panel.html). */
// ESTADO DE CUENTA (3%)
const pgEstadoCuenta = crearPaginador('pag-estado-cuenta', [10, 25, 50], () => cargarEstadoCuenta());

async function cargarEstadoCuenta() {
    const res = await fetch(`${API_URL}/pedidos/mi-estado-cuenta`);
    const cobros = res.ok ? await res.json() : [];
    const tbody = document.getElementById('tabla-estado-cuenta');
    if (!tbody) return;
    tbody.innerHTML = '';

    let acumSubtotal = 0, acumEnvio = 0, acumComision = 0;

    // Los totales se calculan con TODOS los cobros; la tabla solo muestra la página actual
    cobros.forEach(c => {
        if (c.estadoCobro !== 'ANULADO') {
            acumSubtotal += Number(c.subtotalProductos || 0);
            acumEnvio += Number(c.montoEnvio || 0);
            acumComision += Number(c.comision || 0);
        }
    });

    const visiblesEc = paginar(pgEstadoCuenta, cobros);
    dibujarPaginacion(pgEstadoCuenta, tbody.closest('.table-responsive') || tbody.parentElement, cobros.length);
    visiblesEc.forEach(c => {
        const anulado = c.estadoCobro === 'ANULADO';

        tbody.innerHTML += `
            <tr>
                <td><strong>#DOC-${Number(c.idDocumento)}</strong></td>
                <td>Pedido #${Number(c.idPedido)}</td>
                <td>${esc(c.fechaEmision ? c.fechaEmision.replace('T', ' ').substring(0, 16) : '-')}</td>
                <td>${formatearCLP(c.subtotalProductos)}</td>
                <td>${formatearCLP(c.montoEnvio)}</td>
                <td style="color:#dc2626; font-weight:700;">-${formatearCLP(c.comision)}</td>
                <td><strong>${formatearCLP(c.totalOperacion)}</strong></td>
                <td><span class="badge ${anulado ? 'badge-danger' : 'badge-success'}">${esc(c.estadoCobro)}</span></td>
            </tr>
        `;
    });

    const ecSub = document.getElementById('ec-subtotal');
    const ecEnv = document.getElementById('ec-envio');
    const ecCom = document.getElementById('ec-comision');
    const ecNeto = document.getElementById('ec-neto');

    if (ecSub) ecSub.textContent = formatearCLP(acumSubtotal);
    if (ecEnv) ecEnv.textContent = formatearCLP(acumEnvio);
    if (ecCom) ecCom.textContent = '-' + formatearCLP(acumComision);
    if (ecNeto) ecNeto.textContent = formatearCLP(acumSubtotal - acumComision + acumEnvio);
}
