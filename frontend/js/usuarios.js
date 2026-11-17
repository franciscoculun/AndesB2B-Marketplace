/* AndesB2B · Gestionar usuarios de la empresa
   Script: comparte el ámbito global con los demás archivos de /js (ver orden de carga en panel.html). */
// GESTIONAR USUARIOS Y AUDITORÍA
async function cargarUsuariosEmpresa() {
    const res = await fetch(`${API_URL}/usuarios/mi-empresa`);
    listaUsuariosEmpresaGlobal = res.ok ? await res.json() : [];
    const tbody = document.getElementById('tabla-usuarios');
    if (!tbody) return;
    tbody.innerHTML = '';

    listaUsuariosEmpresaGlobal.forEach(u => {
        const idUsu = Number(u.idUsuario);
        const esMiCuenta = idUsu === usuarioActual.idUsuario;
        const nuevoEstadoBool = !u.activo;

        const botonesAccion = esMiCuenta
            ? `<div style="display:flex; gap:6px; align-items:center;">
                   <button type="button" class="btn btn-primary btn-sm" onclick="seleccionarUsuarioEditar(${idUsu})">Editar</button>
                   <span class="badge badge-info">Sesión Actual</span>
               </div>`
            : `<div style="display:flex; gap:6px; flex-wrap:wrap;">
                   <button type="button" class="btn btn-primary btn-sm" onclick="seleccionarUsuarioEditar(${idUsu})">Editar</button>
                   <button type="button" class="btn btn-outline btn-sm" onclick="cambiarEstadoUsuario(${idUsu}, ${nuevoEstadoBool})">${u.activo ? 'Desactivar' : 'Activar'}</button>
                   <button type="button" class="btn btn-danger btn-sm" onclick="eliminarUsuario(${idUsu})">Eliminar</button>
               </div>`;

        tbody.innerHTML += `
            <tr>
                <td><strong>${esc(u.nombreCompleto)}</strong></td>
                <td>${esc(u.rutUsuario)}</td>
                <td>${esc(u.email)}</td>
                <td><span class="badge badge-info">${esc(u.rol)}</span></td>
                <td><span class="badge ${u.activo ? 'badge-success' : 'badge-danger'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td>${botonesAccion}</td>
            </tr>
        `;
    });
}

window.abrirNuevoUsuario = function () {
    window.limpiarFormUsuario();
    const titulo = document.getElementById('titulo-form-usuario');
    if (titulo) titulo.textContent = 'Registrar Nuevo Usuario en la Cuenta de la Pyme';

    const labelPass = document.getElementById('label-usu-pass');
    if (labelPass) labelPass.textContent = 'Contraseña Inicial *';

    const inputPass = document.getElementById('usu-pass');
    if (inputPass) {
        inputPass.value = 'Andes2026!';
        inputPass.placeholder = 'Contraseña inicial obligatoria';
    }

    const card = document.getElementById('card-form-usuario');
    if (card) {
        card.classList.remove('hidden');
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

window.seleccionarUsuarioEditar = function (idUsuario) {
    const u = listaUsuariosEmpresaGlobal.find(item => item.idUsuario === idUsuario);
    if (!u) return;

    let inputId = document.getElementById('usu-id');
    if (!inputId) {
        inputId = document.createElement('input');
        inputId.type = 'hidden';
        inputId.id = 'usu-id';
        document.getElementById('form-nuevo-usuario').prepend(inputId);
    }
    inputId.value = u.idUsuario;

    document.getElementById('usu-nombre').value = u.nombreCompleto || '';
    document.getElementById('usu-rut').value = u.rutUsuario || '';
    document.getElementById('usu-email').value = u.email || '';
    document.getElementById('usu-rol').value = u.rol || 'Comprador';
    document.getElementById('usu-rol').disabled = (u.idUsuario === usuarioActual.idUsuario);

    const labelPass = document.getElementById('label-usu-pass');
    if (labelPass) labelPass.textContent = 'Nueva Contraseña (Opcional)';

    const inputPass = document.getElementById('usu-pass');
    if (inputPass) {
        inputPass.value = '';
        inputPass.placeholder = 'Dejar en blanco para mantener actual';
    }

    const titulo = document.getElementById('titulo-form-usuario');
    if (titulo) titulo.textContent = `Editar Usuario - ${u.nombreCompleto}`;

    const card = document.getElementById('card-form-usuario');
    if (card) {
        card.classList.remove('hidden');
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

window.limpiarFormUsuario = function () {
    const form = document.getElementById('form-nuevo-usuario');
    if (form) form.reset();
    const inputId = document.getElementById('usu-id');
    if (inputId) inputId.value = '';
    const selRol = document.getElementById('usu-rol');
    if (selRol) selRol.disabled = false;
};

window.cerrarFormUsuario = function () {
    window.limpiarFormUsuario();
    const card = document.getElementById('card-form-usuario');
    if (card) card.classList.add('hidden');
};

window.crearUsuarioPyme = async function (e) {
    e.preventDefault();
    const idUsu = document.getElementById('usu-id') ? document.getElementById('usu-id').value.trim() : '';
    const nombreCompleto = document.getElementById('usu-nombre').value.trim();
    const rutUsuario = document.getElementById('usu-rut').value.trim();
    const email = document.getElementById('usu-email').value.trim();
    const nombreRol = document.getElementById('usu-rol').value;
    const password = document.getElementById('usu-pass').value;

    if (!nombreCompleto) {
        return mostrarAlerta('Ingresa el nombre completo del usuario.', true);
    }
    if (typeof validarRutChileno === 'function' && !validarRutChileno(rutUsuario)) {
        return mostrarAlerta('El RUT ingresado no es válido (Módulo 11).', true);
    }
    if (typeof validarFormatoCorreo === 'function' && !validarFormatoCorreo(email)) {
        return mostrarAlerta('Ingresa un correo electrónico válido con @ y dominio (.cl, .com, etc.).', true);
    }
    if (!idUsu && (!password || password.length < 6)) {
        return mostrarAlerta('La contraseña inicial debe tener al menos 6 caracteres.', true);
    }

    const payload = { nombreCompleto, rutUsuario, email, nombreRol };
    if (password && password.trim() !== '') {
        payload.password = password;
    }

    const url = idUsu ? `${API_URL}/usuarios/${idUsu}` : `${API_URL}/usuarios`;
    const metodo = idUsu ? 'PUT' : 'POST';

    const res = await fetch(url, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) return mostrarAlerta(data.error, true);

    if (idUsu && Number(idUsu) === usuarioActual.idUsuario) {
        usuarioActual.nombreCompleto = data.nombreCompleto;
        usuarioActual.email = data.email;
        const elUsuario = document.getElementById('info-usuario');
        if (elUsuario) elUsuario.textContent = `${usuarioActual.nombreCompleto} (${usuarioActual.rol})`;
    }

    mostrarAlerta(idUsu ? 'Datos del usuario actualizados correctamente.' : 'Usuario añadido a la nómina de la empresa.');
    window.cerrarFormUsuario();
    cargarUsuariosEmpresa();
};

window.eliminarUsuario = async function (idUsuario) {
    const u = listaUsuariosEmpresaGlobal.find(item => item.idUsuario === idUsuario);
    const nombre = u ? u.nombreCompleto : `#${idUsuario}`;
    if (!confirm(`¿Confirmas la eliminación del usuario "${nombre}" de la empresa?`)) {
        return;
    }
    const res = await fetch(`${API_URL}/usuarios/${idUsuario}`, {
        method: 'DELETE',
        credentials: 'same-origin'
    });
    const data = await res.json();
    if (!res.ok) return mostrarAlerta(data.error, true);

    mostrarAlerta(data.mensaje || 'Usuario eliminado correctamente.');
    cargarUsuariosEmpresa();
};

window.cambiarEstadoUsuario = async function (idUsuario, nuevoEstado) {
    const res = await fetch(`${API_URL}/usuarios/${idUsuario}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: nuevoEstado })
    });
    if (!res.ok) {
        const data = await res.json();
        return mostrarAlerta(data.error, true);
    }
    cargarUsuariosEmpresa();
};
