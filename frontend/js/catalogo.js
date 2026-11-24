/* AndesB2B · Categorías, explorar catálogo y carrito multi-producto (comprador)
   Script: comparte el ámbito global con los demás archivos de /js (ver orden de carga en panel.html). */

async function cargarCategorias() {
    try {
        const res = await fetch(`${API_URL}/catalogo/categorias`);
        if (!res.ok) return;
        const categorias = await res.json();
        const selFiltro = document.getElementById('filtro-categoria');
        const selForm = document.getElementById('prod-categoria');

        if (selFiltro) selFiltro.innerHTML = '<option value="">Todas las categorías</option>';
        if (selForm) selForm.innerHTML = '';
        categorias.forEach(c => {
            if (selFiltro) selFiltro.innerHTML += `<option value="${Number(c.idCategoria)}">${esc(c.nombreCategoria)}</option>`;
            if (selForm) selForm.innerHTML += `<option value="${Number(c.idCategoria)}">${esc(c.nombreCategoria)}</option>`;
        });
    } catch (e) {
        console.error('Error cargando categorías:', e);
    }
}
// EXPLORAR CATÁLOGO Y CARRITO MULTI-PRODUCTO
async function cargarCatalogoActivo() {
    const res = await fetch(`${API_URL}/catalogo/activos`);
    catalogoGlobal = res.ok ? await res.json() : [];
    window.renderizarCatalogo();
    renderizarCarrito();
}

const pgCatalogo = crearPaginador('pag-catalogo', [12, 24, 48], () => window.renderizarCatalogo());

window.renderizarCatalogo = function () {
    const elTexto = document.getElementById('filtro-texto');
    const elCat = document.getElementById('filtro-categoria');
    const elRegion = document.getElementById('filtro-region');
    const elOrden = document.getElementById('filtro-orden');
    const contenedor = document.getElementById('grid-catalogo');
    if (!contenedor) return;

    const texto = (elTexto ? elTexto.value : '').toLowerCase();
    const cat = elCat ? elCat.value : '';
    const region = elRegion ? elRegion.value : '';
    const orden = elOrden ? elOrden.value : 'asc';

    contenedor.innerHTML = '';

    const filtrados = catalogoGlobal
        .filter(p => (!cat || String(p.categoria.idCategoria) === cat) &&
                     (!region || (p.empresaVendedora && p.empresaVendedora.region === region)) &&
                     (p.nombreProducto.toLowerCase().includes(texto) || p.sku.toLowerCase().includes(texto)))
        .sort((a, b) => orden === 'asc'
            ? Number(a.precioUnitario) - Number(b.precioUnitario)
            : Number(b.precioUnitario) - Number(a.precioUnitario));

    // Al cambiar un filtro se vuelve a la primera página
    const firma = [texto, cat, region, orden].join('|');
    if (firma !== pgCatalogo.firma) { pgCatalogo.firma = firma; pgCatalogo.pagina = 1; }
    const visibles = paginar(pgCatalogo, filtrados);
    dibujarPaginacion(pgCatalogo, contenedor, filtrados.length);

    visibles.forEach(p => {
        const idProd = Number(p.idProducto);
        const imagenes = obtenerListaImagenesProducto(p);
        const dirTienda = p.empresaVendedora
            ? `${p.empresaVendedora.direccion || 'Casa Matriz'} (${p.empresaVendedora.region || 'Chile'})`
            : 'Chile';

        const card = document.createElement('div');
        card.className = 'product-item';
        card.innerHTML = `
            ${construirGaleriaHtml(imagenes, `cat-img-${idProd}`)}
            <div class="pi-head">
                <small class="badge badge-info">${esc(p.sku)}</small>
                <small class="text-muted pi-categoria" title="${esc(p.categoria ? p.categoria.nombreCategoria : '-')}">${esc(p.categoria ? p.categoria.nombreCategoria : '-')}</small>
            </div>
            <h4 class="pi-titulo" title="${esc(p.nombreProducto)}">${esc(p.nombreProducto)}</h4>
            <small class="pi-tienda" title="${esc(p.empresaVendedora ? p.empresaVendedora.razonSocial : '-')}">Tienda: ${esc(p.empresaVendedora ? p.empresaVendedora.razonSocial : '-')}</small>
            <small class="pi-origen" title="${esc(dirTienda)}">Origen: ${esc(dirTienda)}</small>
            <div class="product-price">${formatearCLP(p.precioUnitario)} <small style="font-size:0.75rem; font-weight:400;">neto</small></div>
            <p class="pi-stock">Stock disponible: <strong>${Number(p.stockDisponible)} unidades</strong></p>
            <button type="button" class="btn btn-primary btn-sm full-width pi-boton" onclick="agregarAlCarritoPorId(${idProd})">Agregar al Pedido</button>
        `;
        contenedor.appendChild(card);
    });
};

window.agregarAlCarritoPorId = function (idProducto) {
    const prod = catalogoGlobal.find(item => item.idProducto === idProducto);
    if (prod) window.agregarAlCarrito(prod);
};

window.agregarAlCarrito = function (p) {
    if (usuarioActual.empresa && p.empresaVendedora && usuarioActual.empresa.idEmpresa === p.empresaVendedora.idEmpresa) {
        return mostrarAlerta('Restricción comercial: No puedes emitir órdenes de compra a tu propia empresa.', true);
    }
    if (p.stockDisponible <= 0) {
        return mostrarAlerta('Este insumo no cuenta con stock disponible actualmente.', true);
    }

    if (carritoActual.idEmpresaVendedora && carritoActual.idEmpresaVendedora !== p.empresaVendedora.idEmpresa) {
        return mostrarAlerta(
            `Tu carrito actual tiene insumos de "${carritoActual.razonSocialVendedora}". Envía o vacía ese pedido antes de agregar productos de otro proveedor.`,
            true
        );
    }

    const eraCarritoVacio = carritoActual.items.length === 0;
    carritoActual.idEmpresaVendedora = p.empresaVendedora.idEmpresa;
    carritoActual.razonSocialVendedora = p.empresaVendedora.razonSocial;
    carritoActual.origenVendedora = `${p.empresaVendedora.direccion || ''} (${p.empresaVendedora.region || 'Chile'})`;

    const existente = carritoActual.items.find(i => i.idProducto === p.idProducto);
    if (existente) {
        if (existente.cantidad + 1 > p.stockDisponible) {
            return mostrarAlerta('No puedes superar el stock disponible del proveedor.', true);
        }
        existente.cantidad += 1;
    } else {
        carritoActual.items.push({
            idProducto: p.idProducto,
            sku: p.sku,
            nombreProducto: p.nombreProducto,
            precioUnitario: Number(p.precioUnitario),
            stockDisponible: p.stockDisponible,
            cantidad: 1
        });
    }

    renderizarCarrito();
    if (eraCarritoVacio) {
        window.usarDireccionMiPyme();
    }
    mostrarAlerta(`"${p.nombreProducto}" añadido al carrito para ${p.empresaVendedora.razonSocial}.`);
};

// Devuelve el texto de error de una línea del carrito ('' si la cantidad es válida)
function errorLineaCarrito(item) {
    const c = Number(item.cantidad);
    if (!Number.isInteger(c) || c <= 0) {
        return 'Ingresa una cantidad entera mayor a cero.';
    }
    if (c > Number(item.stockDisponible)) {
        return `Stock insuficiente: máximo ${Number(item.stockDisponible)} unidades.`;
    }
    return '';
}

window.cambiarCantidadCarrito = function (idProducto, nuevaCant) {
    const item = carritoActual.items.find(i => i.idProducto === idProducto);
    if (!item) return;
    // Se conserva exactamente lo que escribió el usuario: no se corrige solo.
    // Si es inválido, la línea queda marcada y el botón de solicitar permanece bloqueado.
    const texto = String(nuevaCant).trim();
    item.cantidad = texto === '' ? 0 : Number(texto);
    renderizarCarrito();
    const msg = errorLineaCarrito(item);
    if (msg) mostrarAlerta(`${item.nombreProducto}: ${msg}`, true);
};

window.quitarDelCarrito = function (idProducto) {
    carritoActual.items = carritoActual.items.filter(i => i.idProducto !== idProducto);
    if (carritoActual.items.length === 0) {
        carritoActual.idEmpresaVendedora = null;
        carritoActual.razonSocialVendedora = '';
        carritoActual.origenVendedora = '';
    }
    renderizarCarrito();
};

window.pedirVaciarCarrito = async function () {
    if (!await confirmarAccion('¿Seguro que quieres vaciar el carrito? Se quitarán todos los insumos agregados.', { textoSi: 'Sí, vaciar', peligro: true })) return;
    window.vaciarCarrito();
};

// El carrito permanece oculto hasta que el usuario pulsa "Ver Carrito y Emitir"; se puede ocultar de nuevo.
let carritoVisible = false;

window.alternarCarrito = function () {
    carritoVisible = !carritoVisible;
    renderizarCarrito();
};

window.ocultarCarrito = function () {
    if (!carritoVisible) return;
    window.alternarCarrito();
};

window.vaciarCarrito = function () {
    carritoVisible = false;
    carritoActual = { idEmpresaVendedora: null, razonSocialVendedora: '', origenVendedora: '', items: [] };
    renderizarCarrito();
};

function renderizarCarrito() {
    const banner = document.getElementById('barra-carrito-resumen');
    const card = document.getElementById('card-solicitar-pedido');
    if (!card) return;

    if (carritoActual.items.length === 0) {
        carritoVisible = false;
        document.body.classList.remove('carrito-abierto');
        if (banner) banner.classList.add('hidden');
        card.classList.add('hidden');
        return;
    }

    if (banner) banner.classList.remove('hidden');
    card.classList.add('carrito-fijo');
    card.classList.toggle('hidden', !carritoVisible);
    document.body.classList.toggle('carrito-abierto', carritoVisible);
    const btnVer = document.getElementById('btn-ver-carrito');
    if (btnVer) btnVer.textContent = carritoVisible ? 'Ocultar Carrito' : 'Ver Carrito y Emitir';

    if (!document.getElementById('cart-nombre-receptor')) {
        card.innerHTML = `
            <div class="card-header-flex">
                <h3>Carrito de Solicitud B2B - Proveedor: <span id="cart-titulo-proveedor"></span></h3>
                <span id="cart-origen-proveedor" class="badge badge-info">Origen: -</span>
                <button type="button" class="btn btn-outline btn-sm" onclick="ocultarCarrito()">Ocultar carrito</button>
            </div>
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>SKU</th>
                            <th>INSUMO</th>
                            <th>PRECIO UNIT. FIJO</th>
                            <th>CANTIDAD</th>
                            <th>SUBTOTAL LÍNEA</th>
                            <th>QUITAR</th>
                        </tr>
                    </thead>
                    <tbody id="tabla-carrito-items"></tbody>
                </table>
            </div>
            <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:10px; padding:16px; margin-top:16px;">
                <div class="card-header-flex" style="margin-bottom:10px;">
                    <h4 style="margin:0;">Datos de Despacho y Contacto de Recepción</h4>
                    <button type="button" class="btn btn-outline btn-sm" onclick="usarDireccionMiPyme()">Usar dirección registrada de mi Pyme
                    </button>
                </div>
                <div class="form-grid-3">
                    <div>
                        <label>Nombre de quien recibe *</label>
                        <input type="text" id="cart-nombre-receptor" required placeholder="Ej: María Soto (Jefa de Bodega)">
                    </div>
                    <div>
                        <label>Teléfono de contacto *</label>
                        <input type="text" id="cart-telefono-contacto" required placeholder="Ej: +56 9 8765 4321">
                    </div>
                    <div>
                        <label>Dirección de entrega (Casa Matriz u Obra) *</label>
                        <input type="text" id="cart-direccion-destino" required placeholder="Ej: Av. Diego Portales 1240, Puerto Montt">
                    </div>
                </div>
            </div>
            <div class="cart-footer">
                <div>
                    <span>Subtotal Neto Productos: </span>
                    <strong id="cart-total-final" style="font-size:1.3rem; color:#0284c7;">$0 CLP</strong>
                    <small style="display:block; color:#64748b;">* El costo y tiempo estimado de envío serán cotizados por el proveedor según tu dirección de entrega.</small>
                </div>
                <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:flex-end;">
                    <small id="cart-aviso-error" style="display:none; color:#b91c1c; font-weight:600; flex-basis:100%; text-align:right;">Corrige las cantidades marcadas en rojo para poder solicitar el pedido.</small>
                    <button type="button" class="btn btn-outline" onclick="pedirVaciarCarrito()">Vaciar Carrito</button>
                    <button type="button" id="btn-emitir-pedido" class="btn btn-success" onclick="emitirPedido()">Confirmar y Solicitar Cotización de Envío</button>
                </div>
            </div>
        `;
    }

    const provBanner = document.getElementById('cart-proveedor-nombre');
    const provTitulo = document.getElementById('cart-titulo-proveedor');
    const provOrigen = document.getElementById('cart-origen-proveedor');

    if (provBanner) provBanner.textContent = carritoActual.razonSocialVendedora;
    if (provTitulo) provTitulo.textContent = carritoActual.razonSocialVendedora;
    if (provOrigen) provOrigen.textContent = `Despacha desde: ${carritoActual.origenVendedora || 'Chile'}`;

    const tbody = document.getElementById('tabla-carrito-items');
    let subtotalTotal = 0;
    let totalUnidades = 0;
    tbody.innerHTML = '';

    let hayErrores = false;
    carritoActual.items.forEach(item => {
        const idProd = Number(item.idProducto);
        const cantNum = Number(item.cantidad);
        const msgError = errorLineaCarrito(item);
        if (msgError) hayErrores = true;
        const cantValida = !msgError;
        const subLinea = cantValida ? item.precioUnitario * cantNum : 0;
        subtotalTotal += subLinea;
        totalUnidades += cantValida ? cantNum : 0;

        tbody.innerHTML += `
            <tr>
                <td><strong>${esc(item.sku)}</strong></td>
                <td>${esc(item.nombreProducto)}</td>
                <td>${formatearCLP(item.precioUnitario)}</td>
                <td>
                    <input type="number" style="width:85px; margin-bottom:0; padding:6px; text-align:center;${msgError ? ' border:2px solid #dc2626; background:#fef2f2;' : ''}"
                           min="1" value="${Number.isFinite(cantNum) ? cantNum : ''}"
                           onchange="cambiarCantidadCarrito(${idProd}, this.value)">
                    <small style="display:block; color:${msgError ? '#b91c1c' : '#64748b'}; font-weight:${msgError ? '700' : '400'};">${msgError ? esc(msgError) : 'Stock: ' + Number(item.stockDisponible)}</small>
                </td>
                <td><strong>${cantValida ? formatearCLP(subLinea) : '-'}</strong></td>
                <td>
                    <button type="button" class="btn btn-danger btn-sm" onclick="quitarDelCarrito(${idProd})">×</button>
                </td>
            </tr>
        `;
    });

    const btnEmitir = document.getElementById('btn-emitir-pedido');
    if (btnEmitir) btnEmitir.disabled = hayErrores;
    const avisoError = document.getElementById('cart-aviso-error');
    if (avisoError) avisoError.style.display = hayErrores ? 'block' : 'none';

    const elCont = document.getElementById('cart-contador-items');
    const elSubBanner = document.getElementById('cart-subtotal-banner');
    const elTotalFinal = document.getElementById('cart-total-final');

    if (elCont) elCont.textContent = `${carritoActual.items.length} insumo(s) distinto(s) · ${totalUnidades} unidades en total`;
    if (elSubBanner) elSubBanner.textContent = formatearCLP(subtotalTotal);
    if (elTotalFinal) elTotalFinal.textContent = formatearCLP(subtotalTotal);
}

window.usarDireccionMiPyme = function () {
    const emp = usuarioActual.empresa || {};
    const recEl = document.getElementById('cart-nombre-receptor');
    const dirEl = document.getElementById('cart-direccion-destino');

    if (recEl) recEl.value = usuarioActual.nombreCompleto || '';
    if (dirEl) dirEl.value = `${emp.direccion || ''}, ${emp.region || ''}`;
};

window.emitirPedido = async function (e) {
    if (e) e.preventDefault();
    if (carritoActual.items.length === 0) {
        return mostrarAlerta('Agrega al menos un producto al carrito antes de emitir la solicitud.', true);
    }

    // Sincroniza las cantidades escritas en pantalla (el evento change puede no haberse disparado aún)
    const inputsCant = document.querySelectorAll('#tabla-carrito-items input[type="number"]');
    carritoActual.items.forEach((it, k) => {
        if (inputsCant[k]) {
            const t = String(inputsCant[k].value).trim();
            it.cantidad = t === '' ? 0 : Number(t);
        }
    });

    // Refresca el stock real desde el servidor antes de validar
    try {
        const resStock = await fetch(`${API_URL}/catalogo/activos`);
        if (resStock.ok) {
            catalogoGlobal = await resStock.json();
            for (const it of carritoActual.items) {
                const vigente = catalogoGlobal.find(pr => pr.idProducto === it.idProducto);
                it.stockDisponible = vigente ? Number(vigente.stockDisponible) : 0;
            }
        }
    } catch (err) {
        console.warn('No se pudo refrescar el stock:', err);
    }

    // Si alguna cantidad es inválida o supera el stock: se muestra el error y NO se emite nada.
    const lineaConError = carritoActual.items.find(it => errorLineaCarrito(it));
    if (lineaConError) {
        renderizarCarrito();
        return mostrarAlerta(`${lineaConError.nombreProducto}: ${errorLineaCarrito(lineaConError)}`, true);
    }

    const nombreReceptor = (document.getElementById('cart-nombre-receptor')?.value || '').trim();
    const telefonoContacto = (document.getElementById('cart-telefono-contacto')?.value || '').trim();
    const direccionDestino = (document.getElementById('cart-direccion-destino')?.value || '').trim();

    const marcarCampo = (id, invalido) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.border = invalido ? '2px solid #dc2626' : '';
        el.style.background = invalido ? '#fef2f2' : '';
    };
    marcarCampo('cart-nombre-receptor', !nombreReceptor);
    marcarCampo('cart-telefono-contacto', !telefonoContacto || !esTelefonoChileno(telefonoContacto));
    marcarCampo('cart-direccion-destino', !direccionDestino);

    if (!nombreReceptor || !telefonoContacto || !direccionDestino) {
        return mostrarAlerta('Completa el nombre de quien recibe, teléfono de contacto y dirección de envío.', true);
    }

    if (!esTelefonoChileno(telefonoContacto)) {
        document.getElementById('cart-telefono-contacto').focus();
        return mostrarAlerta(MSG_TELEFONO_INVALIDO, true);
    }

    const unidades = carritoActual.items.reduce((acc, it) => acc + it.cantidad, 0);
    const subtotalConf = carritoActual.items.reduce((acc, it) => acc + it.precioUnitario * it.cantidad, 0);
    if (!await confirmarAccion(
        `¿Confirmas la solicitud de pedido a ${carritoActual.razonSocialVendedora}?\n` +
        `${carritoActual.items.length} insumo(s), ${unidades} unidad(es). Subtotal: ${formatearCLP(subtotalConf)}.\n` +
        `Despacho a: ${direccionDestino}.`,
        { titulo: 'Confirmar solicitud de pedido', textoSi: 'Sí, solicitar' })) return;

    const primerItem = carritoActual.items[0];
    const payload = {
        idProducto: primerItem.idProducto,
        cantidad: primerItem.cantidad,
        nombreReceptor,
        telefonoContacto,
        direccionDestino,
        items: carritoActual.items.map(i => ({
            idProducto: i.idProducto,
            cantidad: i.cantidad
        }))
    };

    const res = await fetch(`${API_URL}/pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) return mostrarAlerta(data.error, true);

    mostrarAlerta(`Orden #${data.idPedido} emitida correctamente hacia ${direccionDestino}.`);
    window.vaciarCarrito();
    window.cambiarModulo('mis-pedidos');
};
