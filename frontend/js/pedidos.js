/* AndesB2B · Mis pedidos (comprador) y pedidos recibidos (vendedor): cotización, factura PDF, seguimiento, recepción
   Script: comparte el ámbito global con los demás archivos de /js (ver orden de carga en panel.html). */
// MIS PEDIDOS Y PEDIDOS RECIBIDOS
async function cargarMisPedidos() {
    const res = await fetch(`${API_URL}/pedidos/mis-compras`);
    const lista = res.ok ? await res.json() : [];
    const tbody = document.getElementById('tabla-mis-pedidos');
    if (!tbody) return;
    tbody.innerHTML = '';

    lista.forEach(p => {
        const idPed = Number(p.idPedido);
        const prodTexto = (p.detalles && p.detalles.length > 0)
            ? p.detalles.map(d => `${esc(d.nombreProducto)} (${Number(d.cantidad)} un.)`).join(' + ')
            : '-';

        const origenTexto = p.empresaVendedora
            ? `<br><small class="text-muted">Tienda: ${esc(p.empresaVendedora.direccion || '')}, ${esc(p.empresaVendedora.region || '')}</small>`
            : '';

        const tiempoBadge = p.tiempoEstimadoEnvio
            ? `<br><small class="badge badge-info">⏱️ ${esc(p.tiempoEstimadoEnvio)}</small>`
            : '';

        const entregaTexto = p.direccionDestino
            ? `<br><small class="text-muted">Destino: ${esc(p.direccionDestino)}</small><br><small class="text-muted">Recibe: ${esc(p.nombreReceptor || '-')} (${esc(p.telefonoContacto || '-')})</small>`
            : '';

        let badgePago = '';
        if (p.estadoPago === 'EN_REVISION') {
            badgePago = '<br><small class="badge badge-warn">PDF en revisión</small>';
        } else if (p.estadoPago === 'VERIFICADO') {
            badgePago = '<br><small class="badge badge-success">Pago confirmado</small>';
        } else if (p.estadoPago === 'OBSERVADO') {
            badgePago = '<br><small class="badge badge-danger">PDF rechazado - Reenviar</small>';
        }

        let acciones = '<span class="text-muted">Esperando cotización</span>';
        if (p.estadoPedido === 'COTIZANDO_ENVIO' && p.medioTransporte) {
            acciones = `
                <button class="btn btn-success btn-sm" onclick="responderCotizacion(${idPed}, true)">Aceptar y Confirmar</button>
                <button class="btn btn-danger btn-sm" onclick="responderCotizacion(${idPed}, false)">Rechazar</button>
            `;
        } else if (p.estadoPedido === 'COMPRA_CONFIRMADA') {
            if (p.estadoPago === 'SIN_COMPROBANTE' || p.estadoPago === 'OBSERVADO') {
                acciones = `
                    <input type="file" id="file-pdf-${idPed}" accept="application/pdf" class="hidden" onchange="subirFacturaPdf(${idPed}, event)">
                    <button class="btn btn-primary btn-sm" onclick="document.getElementById('file-pdf-${idPed}').click()">Adjuntar Factura PDF</button>
                `;
            } else if (p.estadoPago === 'EN_REVISION') {
                acciones = `
                    <button class="btn btn-outline btn-sm" onclick="verFacturaPdf(${idPed})">Ver PDF</button>
                    <small class="text-muted" style="display:block;">Esperando validación</small>
                `;
            } else if (p.estadoPago === 'VERIFICADO') {
                acciones = `
                    <button class="btn btn-outline btn-sm" onclick="verFacturaPdf(${idPed})">Ver PDF</button>
                    <small class="text-success" style="display:block; font-weight:600;">Listo para despacho</small>
                `;
            }
        } else if (p.estadoPedido === 'EN_TRANSITO') {
            acciones = `
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    ${p.tieneComprobante ? `<button class="btn btn-outline btn-sm" onclick="verFacturaPdf(${idPed})">PDF</button>` : ''}
                    <button class="btn btn-primary btn-sm" onclick="confirmarRecepcion(${idPed})">Confirmar Recepción</button>
                </div>
            `;
        } else if (p.estadoPedido === 'FINALIZADO') {
            acciones = `
                <span class="badge badge-success">Finalizado</span>
                ${p.tieneComprobante ? `<button class="btn btn-outline btn-sm" style="margin-left:4px;" onclick="verFacturaPdf(${idPed})">PDF</button>` : ''}
            `;
        }

        tbody.innerHTML += `
            <tr>
                <td><strong>#${idPed}</strong></td>
                <td><strong>${esc(p.empresaVendedora ? p.empresaVendedora.razonSocial : '-')}</strong>${origenTexto}</td>
                <td>${prodTexto}</td>
                <td>${esc(p.medioTransporte || 'Por asignar')}${tiempoBadge}${entregaTexto}</td>
                <td>${formatearCLP(p.subtotalProductos)}</td>
                <td>${formatearCLP(p.costoEnvio)}</td>
                <td>${esc(p.codigoSeguimiento || '-')}</td>
                <td><span class="badge badge-info">${esc(p.estadoPedido)}</span>${badgePago}</td>
                <td>${acciones}</td>
            </tr>
        `;
    });
}

async function cargarPedidosRecibidos() {
    const res = await fetch(`${API_URL}/pedidos/mis-ventas`);
    pedidosRecibidosGlobal = res.ok ? await res.json() : [];
    const tbody = document.getElementById('tabla-pedidos-recibidos');
    if (!tbody) return;
    tbody.innerHTML = '';

    pedidosRecibidosGlobal.forEach(p => {
        const idPed = Number(p.idPedido);
        const prodTexto = (p.detalles && p.detalles.length > 0)
            ? p.detalles.map(d => `${esc(d.nombreProducto)} (${Number(d.cantidad)} un.)`).join(' + ')
            : '-';

        const infoLogisticaComprador = `
            <br><small class="text-muted">Destino: ${esc(p.direccionDestino || '-')}</small>
            <br><small class="text-muted">Recibe: ${esc(p.nombreReceptor || '-')} (${esc(p.telefonoContacto || '-')})</small>
            ${p.tiempoEstimadoEnvio ? `<br><small class="badge badge-info">⏱️ ${esc(p.tiempoEstimadoEnvio)}</small>` : ''}
        `;

        let badgePago = '';
        if (p.estadoPago === 'EN_REVISION') {
            badgePago = '<br><small class="badge badge-warn">Factura PDF por validar</small>';
        } else if (p.estadoPago === 'VERIFICADO') {
            badgePago = '<br><small class="badge badge-success">Pago verificado</small>';
        } else if (p.estadoPago === 'OBSERVADO') {
            badgePago = '<br><small class="badge badge-danger">PDF observado</small>';
        }

        let boton = '<span class="text-muted">Sin acción pendiente</span>';
        if (p.estadoPedido === 'COTIZANDO_ENVIO') {
            boton = `<button class="btn btn-primary btn-sm" onclick="abrirCotizador(${idPed})">Cotizar Envío</button>`;
        } else if (p.estadoPedido === 'COMPRA_CONFIRMADA') {
            if (p.estadoPago === 'SIN_COMPROBANTE' || p.estadoPago === 'OBSERVADO') {
                boton = `<span class="text-muted">Esperando Factura PDF del comprador</span>`;
            } else if (p.estadoPago === 'EN_REVISION') {
                boton = `
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        <button class="btn btn-outline btn-sm" onclick="verFacturaPdf(${idPed})">Ver Factura PDF</button>
                        <button class="btn btn-success btn-sm" onclick="verificarPagoVendedor(${idPed}, true)">Confirmar Pago</button>
                        <button class="btn btn-danger btn-sm" onclick="verificarPagoVendedor(${idPed}, false)">Rechazar PDF</button>
                    </div>
                `;
            } else if (p.estadoPago === 'VERIFICADO') {
                boton = `
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        <button class="btn btn-outline btn-sm" onclick="verFacturaPdf(${idPed})">PDF</button>
                        <button class="btn btn-success btn-sm" onclick="ingresarTracking(${idPed})">Registrar Seguimiento</button>
                    </div>
                `;
            }
        } else if (p.tieneComprobante) {
            boton = `<button class="btn btn-outline btn-sm" onclick="verFacturaPdf(${idPed})">Ver Factura PDF</button>`;
        }

        tbody.innerHTML += `
            <tr>
                <td><strong>#${idPed}</strong></td>
                <td><strong>${esc(p.empresaCompradora ? p.empresaCompradora.razonSocial : '-')}</strong>${infoLogisticaComprador}</td>
                <td>${prodTexto}</td>
                <td>${formatearCLP(p.subtotalProductos)}</td>
                <td>${formatearCLP(p.costoEnvio)}</td>
                <td><span class="badge badge-warn">${esc(p.estadoPedido)}</span>${badgePago}</td>
                <td>${esc(p.codigoSeguimiento || 'Sin asignar')}</td>
                <td>${boton}</td>
            </tr>
        `;
    });
}

window.subirFacturaPdf = function (idPedido, event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
        mostrarAlerta('Solo se permiten archivos en formato PDF (.pdf).', true);
        event.target.value = '';
        return;
    }
    if (file.size > 2 * 1024 * 1024) {
        mostrarAlerta('El archivo PDF no debe superar el límite de 2 MB.', true);
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
        const base64Pdf = ev.target.result;
        const res = await fetch(`${API_URL}/pedidos/${idPedido}/comprobante`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombreArchivo: file.name,
                base64Pdf: base64Pdf
            })
        });
        const data = await res.json();
        if (!res.ok) return mostrarAlerta(data.error, true);

        mostrarAlerta(`Factura/comprobante "${file.name}" adjuntado con éxito. Enviado a revisión del proveedor.`);
        cargarMisPedidos();
    };
    reader.readAsDataURL(file);
};

window.verFacturaPdf = async function (idPedido) {
    const res = await fetch(`${API_URL}/pedidos/${idPedido}/comprobante`);
    const data = await res.json();
    if (!res.ok) return mostrarAlerta(data.error, true);

    try {
        const partes = data.base64Pdf.split(',');
        const bstr = atob(partes[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
    } catch (e) {
        mostrarAlerta('No fue posible abrir el visor de PDF.', true);
    }
};

window.verificarPagoVendedor = async function (idPedido, aprobar) {
    const msg = aprobar
        ? `¿Confirmas que la factura/comprobante PDF del Pedido #${idPedido} es correcta? Esto habilitará el despacho.`
        : `¿Deseas rechazar el PDF adjunto del Pedido #${idPedido} para que el comprador suba un nuevo documento?`;
    if (!confirm(msg)) return;

    const res = await fetch(`${API_URL}/pedidos/${idPedido}/verificar-pago`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aprobar })
    });
    const data = await res.json();
    if (!res.ok) return mostrarAlerta(data.error, true);

    mostrarAlerta(aprobar
        ? 'Pago verificado correctamente. Ahora puedes registrar el código de seguimiento.'
        : 'Comprobante observado. Se solicitó al comprador adjuntar un nuevo PDF.');
    cargarPedidosRecibidos();
};

window.abrirCotizador = function (idPedido) {
    const pedido = pedidosRecibidosGlobal.find(item => item.idPedido === idPedido);
    if (!pedido) return;

    subtotalCotizacionActual = Number(pedido.subtotalProductos || 0);
    const cardCotizar = document.getElementById('card-cotizar-envio');
    const formCotizar = document.getElementById('form-cotizar');

    if (formCotizar && !document.getElementById('cot-tiempo')) {
        const gridInputs = formCotizar.querySelector('.form-grid-2') || formCotizar.querySelector('.form-grid-3');
        if (gridInputs) {
            gridInputs.className = 'form-grid-3';
            gridInputs.innerHTML = `
                <div>
                    <label>1. Empresa / Medio de Transporte *</label>
                    <input type="text" id="cot-transporte" required placeholder="Ej: Starken Cargo Empresas">
                </div>
                <div>
                    <label>2. Tiempo Estimado de Envío *</label>
                    <input type="text" id="cot-tiempo" required placeholder="Ej: 3 a 5 días hábiles" value="3 a 5 días hábiles">
                </div>
                <div>
                    <label>3. Costo de Envío ($ CLP - Exento de comisión) *</label>
                    <input type="number" id="cot-costo" min="0" required oninput="actualizarSimulador()">
                </div>
            `;
        }
    }

    if (cardCotizar && !document.getElementById('info-destino-cotizador')) {
        const divInfo = document.createElement('div');
        divInfo.id = 'info-destino-cotizador';
        divInfo.className = 'alert alert-success';
        divInfo.style.marginBottom = '14px';
        cardCotizar.insertBefore(divInfo, formCotizar);
    }

    document.getElementById('cot-id-pedido').value = pedido.idPedido;
    document.getElementById('cot-id-label').textContent = pedido.idPedido;
    document.getElementById('cot-costo').value = 35000;

    const tiempoEl = document.getElementById('cot-tiempo');
    if (tiempoEl) tiempoEl.value = '3 a 5 días hábiles';

    const infoDestino = document.getElementById('info-destino-cotizador');
    if (infoDestino) {
        infoDestino.innerHTML = `<strong>Destino del Despacho:</strong> ${esc(pedido.direccionDestino || '-')} · <strong>Recibe:</strong> ${esc(pedido.nombreReceptor || '-')} · <strong>Teléfono:</strong> ${esc(pedido.telefonoContacto || '-')}`;
    }

    window.actualizarSimulador();
    cardCotizar.classList.remove('hidden');
    cardCotizar.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.actualizarSimulador = function () {
    const envio = Number(document.getElementById('cot-costo').value || 0);
    const comision = Math.round(subtotalCotizacionActual * 0.03);
    const netoVendedor = subtotalCotizacionActual - comision + envio;

    const elSub = document.getElementById('sim-subtotal');
    const elCom = document.getElementById('sim-comision');
    const elEnv = document.getElementById('sim-envio');
    const elNeto = document.getElementById('sim-neto');

    if (elSub) elSub.textContent = formatearCLP(subtotalCotizacionActual);
    if (elCom) elCom.textContent = '-' + formatearCLP(comision);
    if (elEnv) elEnv.textContent = formatearCLP(envio);
    if (elNeto) elNeto.textContent = formatearCLP(netoVendedor);
};

window.enviarCotizacion = async function (e) {
    e.preventDefault();
    const idPedido = document.getElementById('cot-id-pedido').value;
    const payload = {
        medioTransporte: document.getElementById('cot-transporte').value,
        tiempoEstimadoEnvio: document.getElementById('cot-tiempo') ? document.getElementById('cot-tiempo').value : '3 a 5 días hábiles',
        costoEnvio: document.getElementById('cot-costo').value
    };
    const res = await fetch(`${API_URL}/pedidos/${idPedido}/cotizar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) return mostrarAlerta(data.error, true);

    mostrarAlerta('Cotización de envío y tiempo estimado enviados al comprador.');
    document.getElementById('card-cotizar-envio').classList.add('hidden');
    cargarPedidosRecibidos();
};

window.responderCotizacion = async function (idPedido, aprobar) {
    const res = await fetch(`${API_URL}/pedidos/${idPedido}/respuesta`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aprobar })
    });
    const data = await res.json();
    if (!res.ok) return mostrarAlerta(data.error, true);

    mostrarAlerta(aprobar ? 'Compra confirmada: stock descontado y Documento de Cobro (3%) emitido. Ahora adjunta la Factura/Comprobante en PDF.' : 'Cotización rechazada.');
    cargarMisPedidos();
};

window.ingresarTracking = async function (idPedido) {
    const codigo = prompt('Ingresa el código de seguimiento del transportista (ej: STK-994821):', 'STK-994821');
    if (!codigo) return;
    const res = await fetch(`${API_URL}/pedidos/${idPedido}/seguimiento`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigoSeguimiento: codigo })
    });
    const data = await res.json();
    if (!res.ok) return mostrarAlerta(data.error, true);

    mostrarAlerta('Seguimiento registrado. El pedido pasó a estado EN_TRANSITO.');
    cargarPedidosRecibidos();
};

window.confirmarRecepcion = async function (idPedido) {
    const res = await fetch(`${API_URL}/pedidos/${idPedido}/recepcion`, { method: 'PUT' });
    const data = await res.json();
    if (!res.ok) return mostrarAlerta(data.error, true);

    mostrarAlerta('Recepción conforme confirmada. Pedido FINALIZADO.');
    cargarMisPedidos();
};
