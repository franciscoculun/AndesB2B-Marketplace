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

function mostrarAlerta(mensaje, esError = false) {
    const el = document.getElementById('app-alert');
    if (!el) return;
    el.textContent = mensaje;
    el.className = esError ? 'alert alert-danger' : 'alert alert-success';
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 5000);
}

function formatearCLP(valor) {
    return '$' + Number(valor || 0).toLocaleString('es-CL') + ' CLP';
}
