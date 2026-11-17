/* AndesB2B · Datos de la empresa y cambio de contraseña
   Script: comparte el ámbito global con los demás archivos de /js (ver orden de carga en panel.html). */
// DATOS EMPRESA Y CAMBIO DE CONTRASEÑA (SOLO LECTURA POR DEFECTO)
function cargarDatosEmpresa() {
    const seccion = document.getElementById('mod-datos-empresa');
    if (seccion && !document.getElementById('card-cambiar-pass')) {
        seccion.innerHTML = `
            <div class="card">
                <div class="card-header-flex" style="flex-wrap:wrap; gap:10px;">
                    <div>
                        <h3 style="margin-bottom:4px;">Ficha Tributaria y Dirección de la Tienda / Pyme</h3>
                        <span class="badge badge-success">Cuenta Corporativa Verificada (Módulo 11)</span>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button type="button" id="btn-habilitar-edicion-emp" class="btn btn-primary btn-sm" onclick="habilitarEdicionEmpresa(true)">Editar Datos
                        </button>
                        <button type="button" id="btn-mostrar-pass" class="btn btn-outline btn-sm" onclick="mostrarFormularioPassword(true)">Cambiar Contraseña
                        </button>
                    </div>
                </div>

                <form id="form-datos-empresa" onsubmit="guardarDatosEmpresa(event)" style="margin-top:14px;">
                    <div class="form-grid-2">
                        <div>
                            <label>Razón Social</label>
                            <input type="text" id="emp-razon" readonly disabled>
                            <label>RUT Empresa (Único)</label>
                            <input type="text" id="emp-rut" readonly disabled>
                            <label>Giro Comercial Declarado</label>
                            <input type="text" id="emp-giro" required disabled>
                        </div>
                        <div>
                            <label>Región de Operación / Despacho</label>
                            <select id="emp-region" required disabled>
                                <option value="Los Lagos">Los Lagos</option>
                                <option value="Biobío">Biobío</option>
                                <option value="Araucanía">La Araucanía</option>
                                <option value="Metropolitana">Metropolitana</option>
                                <option value="Valparaíso">Valparaíso</option>
                            </select>
                            <label>Dirección Casa Matriz / Bodega de Despacho</label>
                            <input type="text" id="emp-direccion" required disabled>
                            <label>Usuario en Sesión</label>
                            <input type="text" id="emp-admin" readonly disabled>
                        </div>
                    </div>

                    <div id="acciones-guardar-empresa" class="hidden" style="margin-top:12px; display:flex; gap:10px;">
                        <button type="submit" class="btn btn-success">Guardar Cambios</button>
                        <button type="button" class="btn btn-outline" onclick="habilitarEdicionEmpresa(false)">Cancelar</button>
                    </div>
                </form>
            </div>

            <div id="card-cambiar-pass" class="card hidden">
                <div class="card-header-flex">
                    <h3>Seguridad - Cambiar Contraseña de Acceso</h3>
                    <button type="button" class="btn btn-outline btn-sm" onclick="mostrarFormularioPassword(false)">Cerrar</button>
                </div>
                <form id="form-cambiar-pass" onsubmit="cambiarMiPassword(event)">
                    <div class="form-grid-3">
                        <div>
                            <label>Contraseña Actual *</label>
                            <input type="password" id="pass-actual" required placeholder="Ingresa tu contraseña vigente">
                        </div>
                        <div>
                            <label>Nueva Contraseña (mín. 6 caracteres) *</label>
                            <input type="password" id="pass-nueva" required placeholder="Ingresa la nueva contraseña">
                        </div>
                        <div>
                            <label>Confirmar Nueva Contraseña *</label>
                            <input type="password" id="pass-confirmar" required placeholder="Repite la nueva contraseña">
                        </div>
                    </div>
                    <div style="display:flex; gap:10px; margin-top:8px;">
                        <button type="submit" class="btn btn-success">Actualizar Contraseña</button>
                        <button type="button" class="btn btn-outline" onclick="mostrarFormularioPassword(false)">Cancelar</button>
                    </div>
                </form>
            </div>
        `;
    }

    rellenarCamposEmpresa();
    window.habilitarEdicionEmpresa(false);
    window.mostrarFormularioPassword(false);

    const esAdmin = usuarioActual.rol === 'Administrador';
    const btnEditarEmp = document.getElementById('btn-habilitar-edicion-emp');
    if (btnEditarEmp) {
        btnEditarEmp.classList.toggle('hidden', !esAdmin);
    }
}

function rellenarCamposEmpresa() {
    const emp = usuarioActual.empresa || {};
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };
    setVal('emp-razon', emp.razonSocial || '-');
    setVal('emp-rut', emp.rutEmpresa || '-');
    setVal('emp-giro', emp.giro || '');
    setVal('emp-region', emp.region || 'Los Lagos');
    setVal('emp-direccion', emp.direccion || '');
    setVal('emp-admin', `${usuarioActual.nombreCompleto || ''} (${usuarioActual.email || ''}) - Rol: ${usuarioActual.rol || ''}`);
}

window.habilitarEdicionEmpresa = function (activar) {
    const esAdmin = usuarioActual.rol === 'Administrador';
    const habilitar = Boolean(activar && esAdmin);

    ['emp-giro', 'emp-region', 'emp-direccion'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = !habilitar;
    });

    const barraAcciones = document.getElementById('acciones-guardar-empresa');
    const btnEditar = document.getElementById('btn-habilitar-edicion-emp');

    if (barraAcciones) barraAcciones.classList.toggle('hidden', !habilitar);
    if (btnEditar && esAdmin) btnEditar.classList.toggle('hidden', habilitar);

    if (!habilitar) {
        rellenarCamposEmpresa();
    } else {
        const inputGiro = document.getElementById('emp-giro');
        if (inputGiro) inputGiro.focus();
    }
};

window.mostrarFormularioPassword = function (mostrar) {
    const cardPass = document.getElementById('card-cambiar-pass');
    const formPass = document.getElementById('form-cambiar-pass');
    if (formPass) formPass.reset();

    if (cardPass) {
        cardPass.classList.toggle('hidden', !mostrar);
        if (mostrar) {
            cardPass.scrollIntoView({ behavior: 'smooth', block: 'start' });
            const inputActual = document.getElementById('pass-actual');
            if (inputActual) inputActual.focus();
        }
    }
};

window.guardarDatosEmpresa = async function (e) {
    e.preventDefault();
    const payload = {
        giro: document.getElementById('emp-giro').value.trim(),
        region: document.getElementById('emp-region').value,
        direccion: document.getElementById('emp-direccion').value.trim()
    };
    const res = await fetch(`${API_URL}/usuarios/mi-empresa/datos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) return mostrarAlerta(data.error, true);

    usuarioActual.empresa = data;
    window.habilitarEdicionEmpresa(false);
    mostrarAlerta('Dirección y datos comerciales de la empresa actualizados.');
};

window.cambiarMiPassword = async function (e) {
    e.preventDefault();
    const passwordActual = document.getElementById('pass-actual').value;
    const nuevaPassword = document.getElementById('pass-nueva').value;
    const confirmar = document.getElementById('pass-confirmar').value;

    if (nuevaPassword.length < 6) {
        return mostrarAlerta('La nueva contraseña debe tener al menos 6 caracteres.', true);
    }
    if (nuevaPassword !== confirmar) {
        return mostrarAlerta('La confirmación de la nueva contraseña no coincide.', true);
    }

    const res = await fetch(`${API_URL}/auth/cambiar-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passwordActual, nuevaPassword })
    });
    const data = await res.json();
    if (!res.ok) return mostrarAlerta(data.error, true);

    window.mostrarFormularioPassword(false);
    mostrarAlerta(data.mensaje || 'Contraseña actualizada correctamente.');
};
