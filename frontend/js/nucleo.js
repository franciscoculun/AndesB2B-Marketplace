/* AndesB2B · Núcleo: estado global, utilidades (esc, alertas, formato) y arranque de la sesión
   Script: comparte el ámbito global con los demás archivos de /js (ver orden de carga en panel.html). */

const API_URL = '/api';
let usuarioActual = null;
let catalogoGlobal = [];
let miInventarioGlobal = [];
let pedidosRecibidosGlobal = [];
let listaUsuariosEmpresaGlobal = [];
let vistaInventarioActual = 'lista';
let subtotalCotizacionActual = 0;

// Almacena temporalmente hasta 3 imágenes en Base64 mientras se crea o edita un producto
let imagenesFormularioActual = [];

// Estado del carrito agrupado por proveedor único
let carritoActual = {
    idEmpresaVendedora: null,
    razonSocialVendedora: '',
    origenVendedora: '',
    items: []
};

// Función de escape HTML para prevenir XSS almacenado entre empresas
function esc(valor) {
    if (valor === null || valor === undefined) return '';
    return String(valor)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

window.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch(`${API_URL}/auth/me`, { credentials: 'same-origin' });
        if (!res.ok) {
            window.location.href = '/index.html';
            return;
        }
        usuarioActual = await res.json();
        configurarInterfazPorRol();
    } catch (err) {
        console.error('Error al verificar sesión:', err);
        window.location.href = '/index.html';
    }
});

let temporizadorAlerta = null;
function mostrarAlerta(mensaje, esError = false) {
    const el = document.getElementById('app-alert');
    if (!el) return;
    el.textContent = mensaje;
    el.className = esError ? 'alert alert-danger' : 'alert alert-success';
    el.setAttribute('role', 'alert');
    el.classList.remove('hidden');
    clearTimeout(temporizadorAlerta);
    temporizadorAlerta = setTimeout(() => el.classList.add('hidden'), esError ? 7000 : 5000);
}

function formatearCLP(valor) {
    return '$' + Number(valor || 0).toLocaleString('es-CL') + ' CLP';
}

// PAGINACIÓN (se aplica sobre la lista ya cargada, para no pintar cientos de filas a la vez)
// Uso: const pg = crearPaginador('pag-xxx', [10, 20, 50], () => redibujar());
//      const visibles = paginar(pg, lista);  ...pintar visibles...  dibujarPaginacion(pg, elementoReferencia, lista.length);
function crearPaginador(idContenedor, tamanos, alCambiar) {
    return { id: idContenedor, tamanos, tamano: tamanos[0], pagina: 1, alCambiar, firma: '' };
}

function paginar(pg, lista) {
    const totalPaginas = Math.max(1, Math.ceil(lista.length / pg.tamano));
    if (pg.pagina > totalPaginas) pg.pagina = totalPaginas;
    if (pg.pagina < 1) pg.pagina = 1;
    const inicio = (pg.pagina - 1) * pg.tamano;
    return lista.slice(inicio, inicio + pg.tamano);
}

function dibujarPaginacion(pg, referencia, total) {
    if (!referencia) return;
    let cont = document.getElementById(pg.id);
    if (!cont) {
        cont = document.createElement('div');
        cont.id = pg.id;
        cont.className = 'paginacion';
        referencia.insertAdjacentElement('afterend', cont);
    }
    cont.innerHTML = '';
    if (total <= Math.min(...pg.tamanos)) {
        cont.classList.add('hidden');
        return;
    }
    cont.classList.remove('hidden');

    const totalPaginas = Math.max(1, Math.ceil(total / pg.tamano));
    const desde = (pg.pagina - 1) * pg.tamano + 1;
    const hasta = Math.min(total, pg.pagina * pg.tamano);

    const info = document.createElement('span');
    info.textContent = `Mostrando ${desde}-${hasta} de ${total}`;

    const botones = document.createElement('div');
    botones.className = 'paginacion-botones';
    const btnAnt = document.createElement('button');
    btnAnt.type = 'button';
    btnAnt.className = 'btn btn-outline btn-sm';
    btnAnt.textContent = 'Anterior';
    btnAnt.disabled = pg.pagina <= 1;
    const pos = document.createElement('span');
    pos.textContent = `Página ${pg.pagina} de ${totalPaginas}`;
    const btnSig = document.createElement('button');
    btnSig.type = 'button';
    btnSig.className = 'btn btn-outline btn-sm';
    btnSig.textContent = 'Siguiente';
    btnSig.disabled = pg.pagina >= totalPaginas;
    botones.append(btnAnt, pos, btnSig);

    const tam = document.createElement('label');
    tam.className = 'paginacion-tamano';
    tam.append('Por página: ');
    const sel = document.createElement('select');
    pg.tamanos.forEach(t => {
        const op = document.createElement('option');
        op.value = t;
        op.textContent = t;
        if (t === pg.tamano) op.selected = true;
        sel.appendChild(op);
    });
    tam.appendChild(sel);

    const irArriba = () => {
        referencia.style.scrollMarginTop = '100px';
        referencia.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    btnAnt.addEventListener('click', () => { pg.pagina--; pg.alCambiar(); irArriba(); });
    btnSig.addEventListener('click', () => { pg.pagina++; pg.alCambiar(); irArriba(); });
    sel.addEventListener('change', () => { pg.tamano = Number(sel.value); pg.pagina = 1; pg.alCambiar(); });

    cont.append(info, botones, tam);
}
