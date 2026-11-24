/* AndesB2B · Gestionar catálogo propio (vendedor)
   Script: comparte el ámbito global con los demás archivos de /js (ver orden de carga en panel.html). */
// GESTIONAR CATÁLOGO (VENDEDOR)
// Etiqueta de alerta junto al stock (usa UMBRAL_STOCK_BAJO de dashboard.js)
function badgeStock(p) {
    const stock = Number(p.stockDisponible);
    if (stock <= 0) return ' <span class="badge badge-danger">Sin stock</span>';
    if (stock <= UMBRAL_STOCK_BAJO) return ' <span class="badge badge-warn">Stock bajo</span>';
    return '';
}

async function cargarMiCatalogo() {
    const res = await fetch(`${API_URL}/catalogo/mi-inventario`);
    miInventarioGlobal = res.ok ? await res.json() : [];
    renderizarMiInventario();
}

window.cambiarVistaInventario = function (vista) {
    vistaInventarioActual = vista;
    const listaEl = document.getElementById('contenedor-inv-lista');
    const tarjEl = document.getElementById('contenedor-inv-tarjetas');
    const btnLista = document.getElementById('btn-vista-lista');
    const btnTarj = document.getElementById('btn-vista-tarjetas');

    if (listaEl) listaEl.classList.toggle('hidden', vista !== 'lista');
    if (tarjEl) tarjEl.classList.toggle('hidden', vista !== 'tarjetas');
    if (btnLista) btnLista.className = vista === 'lista' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline';
    if (btnTarj) btnTarj.className = vista === 'tarjetas' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline';
    renderizarMiInventario();
};

const pgInventario = crearPaginador('pag-inventario', [10, 20, 50], () => renderizarMiInventario());

function renderizarMiInventario() {
    const tbody = document.getElementById('tabla-mi-catalogo');
    const grid = document.getElementById('contenedor-inv-tarjetas');
    if (tbody) tbody.innerHTML = '';
    if (grid) grid.innerHTML = '';

    const visiblesInv = paginar(pgInventario, miInventarioGlobal);
    const refInv = document.getElementById('contenedor-inv-tarjetas');
    dibujarPaginacion(pgInventario, refInv, miInventarioGlobal.length);
    visiblesInv.forEach(p => {
        const idProd = Number(p.idProducto);
        const imagenes = obtenerListaImagenesProducto(p);
        const imgPortada = esc(imagenes[0]);

        if (tbody) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${esc(p.sku)}</strong></td>
                <td>
                    <img src="${imgPortada}" alt="${esc(p.sku)}" style="width:40px; height:40px; object-fit:cover; border-radius:6px; vertical-align:middle; margin-right:10px; border:1px solid #cbd5e1;">
                    ${esc(p.nombreProducto)} <small class="text-muted">(${Number(imagenes.length)} foto${imagenes.length > 1 ? 's' : ''})</small>
                </td>
                <td>${esc(p.categoria ? p.categoria.nombreCategoria : '-')}</td>
                <td>${formatearCLP(p.precioUnitario)}</td>
                <td>${Number(p.stockDisponible)} un.${badgeStock(p)}</td>
                <td>
                    <label class="switch"><input type="checkbox" ${p.visible ? 'checked' : ''} onchange="alternarVisibilidadProducto(${idProd}, this.checked)">
                        <span class="slider"></span>
                    </label>
                    <span class="badge ${p.visible ? 'badge-success' : 'badge-warn'}">${p.visible ? 'Visible' : 'Borrador'}</span>
                </td>
                <td>
                    <div style="display:flex; gap:6px;">
                        <button type="button" class="btn btn-primary btn-sm" onclick="seleccionarProductoEditar(${idProd})">Editar</button>
                        <button type="button" class="btn btn-danger btn-sm" onclick="eliminarProducto(${idProd})">Eliminar</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        }

        if (grid) {
            const card = document.createElement('div');
            card.className = 'product-item';
            card.innerHTML = `
                ${construirGaleriaHtml(imagenes, `inv-img-${idProd}`)}
                <div style="display:flex; justify-content:space-between;">
                    <small class="badge badge-info">${esc(p.sku)}</small>
                    <span class="badge ${p.visible ? 'badge-success' : 'badge-warn'}">${p.visible ? 'Visible' : 'Borrador'}</span>
                </div>
                <h4 style="margin-top:8px;">${esc(p.nombreProducto)}</h4>
                <small>${esc(p.categoria ? p.categoria.nombreCategoria : '-')}</small>
                <div class="product-price">${formatearCLP(p.precioUnitario)}</div>
                <p style="font-size:0.85rem; margin-bottom:10px;">Stock: <strong>${Number(p.stockDisponible)} un.</strong>${badgeStock(p)}</p>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px;">
                    <button type="button" class="btn btn-primary btn-sm" onclick="seleccionarProductoEditar(${idProd})">Editar</button>
                    <button type="button" class="btn btn-danger btn-sm" onclick="eliminarProducto(${idProd})">Eliminar</button>
                </div>
            `;
            grid.appendChild(card);
        }
    });
}

window.seleccionarProductoEditar = function (idProducto) {
    const prod = miInventarioGlobal.find(item => item.idProducto === idProducto);
    if (prod) window.cargarProductoEnForm(prod);
};

window.alternarVisibilidadProducto = async function (idProducto, nuevoEstadoVisible) {
    if (!await confirmarAccion(nuevoEstadoVisible
        ? '¿Publicar este producto en el catálogo? Quedará visible para los compradores.'
        : '¿Pasar este producto a borrador? Dejará de ser visible para los compradores.')) return;
    const res = await fetch(`${API_URL}/catalogo/productos/${idProducto}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible: nuevoEstadoVisible })
    });
    const data = await res.json();
    if (!res.ok) {
        mostrarAlerta(data.error, true);
    } else {
        mostrarAlerta(`Estado cambiado a ${nuevoEstadoVisible ? 'Visible en Catálogo' : 'Borrador'}.`);
    }
    cargarMiCatalogo();
};

function generarSiguienteSku() {
    let maxNum = 100;
    miInventarioGlobal.forEach(p => {
        const match = String(p.sku || '').match(/(\d+)/);
        if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
        }
    });
    return `SKU-${maxNum + 1}`;
}

window.abrirNuevoProducto = function () {
    window.limpiarFormProducto();
    document.getElementById('prod-sku').value = generarSiguienteSku();
    const titulo = document.getElementById('titulo-form-producto');
    if (titulo) titulo.textContent = 'Registrar Nuevo Producto (SKU sugerido editable)';
    const cardForm = document.getElementById('card-form-producto');
    if (cardForm) {
        cardForm.classList.remove('hidden');
        cardForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

window.eliminarProducto = async function (idProducto) {
    const prod = miInventarioGlobal.find(item => item.idProducto === idProducto);
    const etiqueta = prod ? `${prod.sku} - ${prod.nombreProducto}` : `#${idProducto}`;
    if (!await confirmarAccion(`¿Estás seguro de eliminar el producto "${etiqueta}" del inventario? Esta acción no se puede deshacer.`,
        { titulo: 'Eliminar producto', textoSi: 'Sí, eliminar', peligro: true })) {
        return;
    }
    const res = await fetch(`${API_URL}/catalogo/productos/${idProducto}`, {
        method: 'DELETE',
        credentials: 'same-origin'
    });
    const data = await res.json();
    if (!res.ok) return mostrarAlerta(data.error, true);

    if (prod && prod.sku) {
        try {
            const guardadas = JSON.parse(localStorage.getItem('imagenesAndesB2B') || '{}');
            delete guardadas[prod.sku];
            localStorage.setItem('imagenesAndesB2B', JSON.stringify(guardadas));
        } catch (e) {}
    }

    mostrarAlerta(data.mensaje || 'Producto eliminado correctamente.');
    cargarMiCatalogo();
};

window.cerrarFormProducto = function () {
    window.limpiarFormProducto();
    const cardForm = document.getElementById('card-form-producto');
    if (cardForm) cardForm.classList.add('hidden');
};

window.cargarProductoEnForm = function (p) {
    document.getElementById('prod-id').value = p.idProducto;
    document.getElementById('prod-sku').value = p.sku;
    document.getElementById('prod-sku').readOnly = true;
    document.getElementById('prod-nombre').value = p.nombreProducto;
    document.getElementById('prod-categoria').value = p.categoria.idCategoria;
    document.getElementById('prod-precio').value = p.precioUnitario;
    document.getElementById('prod-stock').value = p.stockDisponible;
    document.getElementById('prod-visible').value = String(p.visible);

    try {
        const guardadas = JSON.parse(localStorage.getItem('imagenesAndesB2B') || '{}');
        if (Array.isArray(guardadas[p.sku])) {
            imagenesFormularioActual = [...guardadas[p.sku]].slice(0, 3);
        } else if (typeof guardadas[p.sku] === 'string' && guardadas[p.sku].trim() !== '') {
            imagenesFormularioActual = [guardadas[p.sku]];
        } else {
            imagenesFormularioActual = [];
        }
    } catch (e) {
        imagenesFormularioActual = [];
    }
    renderizarPreviewImagenesForm();

    const titulo = document.getElementById('titulo-form-producto');
    if (titulo) titulo.textContent = `Editar Producto - ${p.sku} (${p.nombreProducto})`;
    const cardForm = document.getElementById('card-form-producto');
    if (cardForm) {
        cardForm.classList.remove('hidden');
        cardForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

window.limpiarFormProducto = function () {
    const form = document.getElementById('form-producto');
    if (form) form.reset();
    document.getElementById('prod-id').value = '';
    document.getElementById('prod-sku').readOnly = false;
    document.getElementById('prod-stock').value = '';
    document.getElementById('prod-visible').value = 'false';
    imagenesFormularioActual = [];
    renderizarPreviewImagenesForm();
};

window.guardarProducto = async function (e) {
    e.preventDefault();
    const idProd = document.getElementById('prod-id').value;
    const skuVal = document.getElementById('prod-sku').value.trim();
    const stockInput = document.getElementById('prod-stock').value.trim();

    if (imagenesFormularioActual.length > 3) {
        return mostrarAlerta('No puedes guardar más de 3 imágenes por producto.', true);
    }
    if (!await confirmarAccion(idProd
        ? `¿Guardar los cambios del producto ${skuVal}?`
        : `¿Registrar el producto ${skuVal} en el inventario?`)) return;

    try {
        const guardadas = JSON.parse(localStorage.getItem('imagenesAndesB2B') || '{}');
        if (imagenesFormularioActual.length > 0) {
            guardadas[skuVal] = imagenesFormularioActual.slice(0, 3);
        } else {
            delete guardadas[skuVal];
        }
        localStorage.setItem('imagenesAndesB2B', JSON.stringify(guardadas));
    } catch (err) {
        console.warn('No se pudieron almacenar las imágenes en localStorage:', err);
    }

    const payload = {
        idCategoria: document.getElementById('prod-categoria').value,
        sku: skuVal,
        nombreProducto: document.getElementById('prod-nombre').value.trim(),
        precioUnitario: document.getElementById('prod-precio').value,
        stockDisponible: stockInput === '' ? 0 : stockInput,
        visible: document.getElementById('prod-visible').value === 'true'
    };

    const url = idProd ? `${API_URL}/catalogo/productos/${idProd}` : `${API_URL}/catalogo/productos`;
    const metodo = idProd ? 'PUT' : 'POST';

    const res = await fetch(url, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) return mostrarAlerta(data.error, true);

    mostrarAlerta(idProd ? 'Producto e imágenes actualizados correctamente.' : 'Producto registrado en el inventario.');
    window.cerrarFormProducto();
    cargarMiCatalogo();
};
