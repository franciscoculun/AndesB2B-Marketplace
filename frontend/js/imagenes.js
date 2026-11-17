/* AndesB2B · Imágenes adjuntas de productos (máx. 3) y galería
   Script: comparte el ámbito global con los demás archivos de /js (ver orden de carga en panel.html). */
// GESTIÓN DE IMÁGENES ADJUNTAS (MÁXIMO 3 POR PRODUCTO)
function redimensionarImagenBase64(file, maxAncho = 520, maxAlto = 360) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                let w = img.width;
                let h = img.height;
                if (w > maxAncho || h > maxAlto) {
                    const ratio = Math.min(maxAncho / w, maxAlto / h);
                    w = Math.round(w * ratio);
                    h = Math.round(h * ratio);
                }
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = reject;
            img.src = ev.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

window.procesarImagenesAdjuntas = async function (event) {
    const archivos = Array.from(event.target.files || []);
    if (archivos.length === 0) return;

    if (imagenesFormularioActual.length + archivos.length > 3) {
        mostrarAlerta('Solo se permite adjuntar un máximo de 3 imágenes por producto.', true);
        event.target.value = '';
        return;
    }

    for (const file of archivos) {
        if (!file.type.startsWith('image/')) {
            mostrarAlerta(`El archivo "${file.name}" no es una imagen válida.`, true);
            continue;
        }
        try {
            const base64 = await redimensionarImagenBase64(file);
            if (imagenesFormularioActual.length < 3) {
                imagenesFormularioActual.push(base64);
            }
        } catch (err) {
            console.error('Error procesando imagen:', err);
        }
    }

    event.target.value = '';
    renderizarPreviewImagenesForm();
};

window.eliminarImagenAdjuntaForm = function (index) {
    imagenesFormularioActual.splice(index, 1);
    renderizarPreviewImagenesForm();
};

function renderizarPreviewImagenesForm() {
    const contenedor = document.getElementById('preview-imagenes-form');
    const contador = document.getElementById('contador-imgs-form');
    const inputFiles = document.getElementById('prod-img-files');

    if (contador) contador.textContent = `${imagenesFormularioActual.length}/3`;
    if (inputFiles) inputFiles.disabled = imagenesFormularioActual.length >= 3;
    if (!contenedor) return;

    contenedor.innerHTML = '';
    imagenesFormularioActual.forEach((src, idx) => {
        const div = document.createElement('div');
        div.className = 'img-preview-item';
        div.innerHTML = `
            <img src="${esc(src)}" alt="Foto ${Number(idx) + 1}">
            <button type="button" class="img-preview-remove" title="Quitar imagen" onclick="eliminarImagenAdjuntaForm(${Number(idx)})">×</button>
        `;
        contenedor.appendChild(div);
    });
}

function obtenerListaImagenesProducto(p) {
    try {
        const guardadas = JSON.parse(localStorage.getItem('imagenesAndesB2B') || '{}');
        if (p && p.sku && guardadas[p.sku]) {
            if (Array.isArray(guardadas[p.sku]) && guardadas[p.sku].length > 0) {
                return guardadas[p.sku].slice(0, 3);
            }
            if (typeof guardadas[p.sku] === 'string' && guardadas[p.sku].trim() !== '') {
                return [guardadas[p.sku]];
            }
        }
    } catch (e) {
        console.warn('No se pudo leer almacenamiento local de imágenes:', e);
    }

    const sku = (p && p.sku) ? String(p.sku) : 'SKU';
    const nombre = (p && p.nombreProducto) ? String(p.nombreProducto) : 'Insumo Industrial';
    const catNombre = (p && p.categoria && p.categoria.nombreCategoria)
        ? p.categoria.nombreCategoria.toLowerCase()
        : '';

    let colorFondo = '#0284c7';
    let etiqueta = 'INSUMO INDUSTRIAL';

    if (catNombre.includes('eléctrica') || catNombre.includes('herramienta') || sku === 'SKU-118') {
        colorFondo = '#d97706';
        etiqueta = 'HERRAMIENTAS Y CORTE';
    } else if (catNombre.includes('metal') || sku === 'SKU-101') {
        colorFondo = '#334155';
        etiqueta = 'ACERO Y METALURGIA';
    } else if (catNombre.includes('material') || sku === 'SKU-305') {
        colorFondo = '#059669';
        etiqueta = 'FIJACIONES E INSUMOS';
    }

    const nombreCorto = nombre.length > 28 ? nombre.substring(0, 26) + '...' : nombre;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240" viewBox="0 0 400 240">
        <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="${colorFondo}"/>
                <stop offset="100%" stop-color="#0f172a"/>
            </linearGradient>
        </defs>
        <rect width="400" height="240" fill="url(#g)"/>
        <rect x="16" y="16" width="368" height="208" rx="10" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="2"/>
        <text x="30" y="46" fill="#bae6fd" font-family="Segoe UI, sans-serif" font-size="13" font-weight="bold">${esc(sku)}</text>
        <circle cx="200" cy="96" r="34" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="4"/>
        <rect x="186" y="82" width="28" height="28" rx="4" fill="rgba(255,255,255,0.6)"/>
        <text x="200" y="172" text-anchor="middle" fill="#ffffff" font-family="Segoe UI, sans-serif" font-size="15" font-weight="bold">${esc(nombreCorto)}</text>
        <text x="200" y="200" text-anchor="middle" fill="#94a3b8" font-family="Segoe UI, sans-serif" font-size="11" font-weight="bold">${etiqueta}</text>
    </svg>`;

    return ['data:image/svg+xml;utf8,' + encodeURIComponent(svg)];
}

window.cambiarFotoPrincipalTarjeta = function (idImgPrincipal, miniBtn) {
    const imgEl = document.getElementById(idImgPrincipal);
    if (imgEl && miniBtn) {
        imgEl.src = miniBtn.getAttribute('src') || '';
    }
    if (miniBtn && miniBtn.parentElement) {
        miniBtn.parentElement.querySelectorAll('.thumb-mini-btn').forEach(b => b.classList.remove('active'));
        miniBtn.classList.add('active');
    }
};

function construirGaleriaHtml(imagenes, prefijoId) {
    const idSeguro = esc(prefijoId);
    const imgPrincipal = esc(imagenes[0]);
    let tiraMiniaturas = '';
    if (imagenes.length > 1) {
        tiraMiniaturas = `<div class="thumb-gallery-strip">` +
            imagenes.map((src, i) =>
                `<img src="${esc(src)}" class="thumb-mini-btn ${i === 0 ? 'active' : ''}" onclick="cambiarFotoPrincipalTarjeta('${idSeguro}', this)" title="Imagen ${Number(i) + 1}">`
            ).join('') +
            `</div>`;
    }
    return `
        <img id="${idSeguro}" src="${imgPrincipal}" alt="Producto" class="product-thumb" style="width:100%; height:145px; object-fit:cover; border-radius:8px; margin-bottom:10px; border:1px solid #e2e8f0;">
        ${tiraMiniaturas}
    `;
}
