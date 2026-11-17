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

    filtrados.forEach(p => {
        const idProd = Number(p.idProducto);
        const imagenes = obtenerListaImagenesProducto(p);
        const dirTienda = p.empresaVendedora
            ? `${p.empresaVendedora.direccion || 'Casa Matriz'} (${p.empresaVendedora.region || 'Chile'})`
            : 'Chile';

        const card = document.createElement('div');
        card.className = 'product-item';
        card.innerHTML = `
            ${construirGaleriaHtml(imagenes, `cat-img-${idProd}`)}
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <small class="badge badge-info">${esc(p.sku)}</small>
                <small class="text-muted">${esc(p.categoria ? p.categoria.nombreCategoria : '-')}</small>
            </div>
            <h4 style="margin-top:8px;">${esc(p.nombreProducto)}</h4>
            <small style="display:block; color:#0f172a; font-weight:700;">Tienda: ${esc(p.empresaVendedora ? p.empresaVendedora.razonSocial : '-')}</small>
            <small style="display:block; color:#475569; margin-top:2px;">Origen: ${esc(dirTienda)}</small>
            <div class="product-price">${formatearCLP(p.precioUnitario)} <small style="font-size:0.75rem; font-weight:400;">neto</small></div>
            <p style="font-size:0.85rem; margin-bottom:10px;">Stock disponible: <strong>${Number(p.stockDisponible)} unidades</strong></p>
            <button type="button" class="btn btn-primary btn-sm full-width" onclick="agregarAlCarritoPorId(${idProd})">Agregar al Pedido</button>
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

window.cambiarCantidadCarrito = function (idProducto, nuevaCant) {
    const item = carritoActual.items.find(i => i.idProducto === idProducto);
    if (!item) return;
    const cant = parseInt(nuevaCant, 10);
    if (isNaN(cant) || cant <= 0) {
        window.quitarDelCarrito(idProducto);
        return;
    }
    if (cant > item.stockDisponible) {
        mostrarAlerta(`El stock máximo disponible es de ${item.stockDisponible} unidades.`, true);
        item.cantidad = item.stockDisponible;
    } else {
        item.cantidad = cant;
    }
    renderizarCarrito();
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

window.vaciarCarrito = function () {
    carritoActual = { idEmpresaVendedora: null, razonSocialVendedora: '', origenVendedora: '', items: [] };
    renderizarCarrito();
};

function renderizarCarrito() {
    const banner = document.getElementById('barra-carrito-resumen');
    const card = document.getElementById('card-solicitar-pedido');
    if (!card) return;

    if (carritoActual.items.length === 0) {
        if (banner) banner.classList.add('hidden');
        card.classList.add('hidden');
        return;
    }

    if (banner) banner.classList.remove('hidden');
    card.classList.remove('hidden');

    if (!document.getElementById('cart-nombre-receptor')) {
        card.innerHTML = `
            <div class="card-header-flex">
                <h3>Carrito de Solicitud B2B - Proveedor: <span id="cart-titulo-proveedor"></span></h3>
                <span id="cart-origen-proveedor" class="badge badge-info">Origen: -</span>
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
                <div style="display:flex; gap:10px;">
                    <button type="button" class="btn btn-outline" onclick="vaciarCarrito()">Vaciar Carrito</button>
                    <button type="button" class="btn btn-success" onclick="emitirPedido()">Confirmar y Solicitar Cotización de Envío</button>
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

    carritoActual.items.forEach(item => {
        const idProd = Number(item.idProducto);
        const subLinea = item.precioUnitario * item.cantidad;
        subtotalTotal += subLinea;
        totalUnidades += item.cantidad;

        tbody.innerHTML += `
            <tr>
                <td><strong>${esc(item.sku)}</strong></td>
                <td>${esc(item.nombreProducto)}</td>
                <td>${formatearCLP(item.precioUnitario)}</td>
                <td>
                    <input type="number" style="width:85px; margin-bottom:0; padding:6px; text-align:center;"
                           min="1" max="${Number(item.stockDisponible)}" value="${Number(item.cantidad)}"
                           onchange="cambiarCantidadCarrito(${idProd}, this.value)">
                </td>
                <td><strong>${formatearCLP(subLinea)}</strong></td>
                <td>
                    <button type="button" class="btn btn-danger btn-sm" onclick="quitarDelCarrito(${idProd})">×</button>
                </td>
            </tr>
        `;
    });

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

    const nombreReceptor = (document.getElementById('cart-nombre-receptor')?.value || '').trim();
    const telefonoContacto = (document.getElementById('cart-telefono-contacto')?.value || '').trim();
    const direccionDestino = (document.getElementById('cart-direccion-destino')?.value || '').trim();

    if (!nombreReceptor || !telefonoContacto || !direccionDestino) {
        return mostrarAlerta('Completa el nombre de quien recibe, teléfono de contacto y dirección de envío.', true);
    }

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
