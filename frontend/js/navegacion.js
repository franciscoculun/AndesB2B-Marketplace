/* AndesB2B · Roles y permisos visuales, cierre de sesión y navegación entre módulos
   Script: comparte el ámbito global con los demás archivos de /js (ver orden de carga en panel.html). */
// CONFIGURACIÓN DE ROLES Y PERMISOS VISUALES
function configurarInterfazPorRol() {
    const rol = usuarioActual.rol || 'Comprador';
    const emp = usuarioActual.empresa || {};
    const puedeVerComision = (rol === 'Administrador' || rol === 'Vendedor');

    const elEmpresa = document.getElementById('info-empresa');
    const elRut = document.getElementById('info-rut');
    const elUsuario = document.getElementById('info-usuario');

    if (elEmpresa) elEmpresa.textContent = emp.razonSocial || 'Empresa';
    if (elRut) elRut.textContent = `RUT: ${emp.rutEmpresa || '-'}`;
    if (elUsuario) elUsuario.textContent = `${usuarioActual.nombreCompleto || 'Usuario'} (${rol})`;

    const menuCompras = document.getElementById('menu-compras');
    const menuVentas = document.getElementById('menu-ventas');
    const menuAdmin = document.getElementById('menu-admin');

    if (menuCompras) menuCompras.classList.toggle('hidden', rol !== 'Administrador' && rol !== 'Comprador');
    if (menuVentas) menuVentas.classList.toggle('hidden', !puedeVerComision);

    if (menuAdmin) {
        menuAdmin.classList.remove('hidden');
        const botonesAdmin = menuAdmin.querySelectorAll('.nav-link');
        botonesAdmin.forEach(btn => {
            const texto = (btn.textContent || '').toLowerCase();
            if (!texto.includes('datos empresa') && rol !== 'Administrador') {
                btn.classList.add('hidden');
            } else {
                btn.classList.remove('hidden');
            }
        });
    }

    const topComisionBox = document.getElementById('top-comision-box') || document.querySelector('.comision-pill');
    const kpiComisionCard = document.getElementById('kpi-card-comision') || document.querySelector('.kpi-danger');

    if (topComisionBox) topComisionBox.classList.toggle('hidden', !puedeVerComision);
    if (kpiComisionCard) kpiComisionCard.classList.toggle('hidden', !puedeVerComision);

    cargarCategorias();
    cargarDashboard();
}

window.cerrarSesion = async function () {
    try {
        await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'same-origin' });
    } catch (e) {
        console.warn('Error cerrando sesión:', e);
    }
    sessionStorage.removeItem('usuarioAndesB2B');
    window.location.href = '/index.html';
};

window.cambiarModulo = function (modulo, btnElement) {
    document.querySelectorAll('.modulo').forEach(s => s.classList.add('hidden'));
    const seccion = document.getElementById(`mod-${modulo}`);
    if (seccion) seccion.classList.remove('hidden');

    if (btnElement) {
        document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
    }

    const rutas = {
        'dashboard': ['AndesB2B › Principal', 'Panel General - Resumen Operativo y Financiero'],
        'explorar': ['Módulo de Compras › Explorar catálogo', 'Explorar Catálogo de Proveedores B2B'],
        'mis-pedidos': ['Módulo de Compras › Mis pedidos', 'Mis Pedidos - Órdenes de Compra Emitidas'],
        'gestionar-catalogo': ['Módulo de Ventas › Gestionar catálogo', 'Gestionar Catálogo e Inventario de Productos'],
        'pedidos-recibidos': ['Módulo de Ventas › Pedidos recibidos', 'Pedidos Recibidos y Cotización de Envío'],
        'estado-cuenta': ['Módulo de Ventas › Estado de cuenta', 'Estado de Cuenta Mensual y Comisión (3%)'],
        'datos-empresa': ['Administración › Datos empresa y Seguridad', 'Ficha de la Pyme y Cambio de Contraseña'],
        'usuarios': ['Administración › Gestionar usuarios', 'Gestionar Usuarios y Permisos (RBAC)'],
        'auditoria': ['Administración › Auditoría de precios', 'Auditoría de Precios (Log_Auditoria_Precios)']
    };

    if (rutas[modulo]) {
        const breadEl = document.getElementById('breadcrumb-modulo');
        const tituloEl = document.getElementById('titulo-modulo');
        if (breadEl) breadEl.textContent = rutas[modulo][0];
        if (tituloEl) tituloEl.textContent = rutas[modulo][1];
    }

    if (modulo === 'dashboard') cargarDashboard();
    if (modulo === 'explorar') cargarCatalogoActivo();
    if (modulo === 'mis-pedidos') cargarMisPedidos();
    if (modulo === 'gestionar-catalogo') cargarMiCatalogo();
    if (modulo === 'pedidos-recibidos') cargarPedidosRecibidos();
    if (modulo === 'estado-cuenta') cargarEstadoCuenta();
    if (modulo === 'datos-empresa') cargarDatosEmpresa();
    if (modulo === 'usuarios') cargarUsuariosEmpresa();
    if (modulo === 'auditoria') cargarAuditoria();
};
