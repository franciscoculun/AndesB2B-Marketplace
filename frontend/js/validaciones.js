// Autoformatea el RUT mientras el usuario escribe: XX.XXX.XXX-X
function formatearInputRut(input) {
    let valor = input.value.replace(/[^0-9kK]/g, '').toUpperCase();
    if (valor.length > 9) valor = valor.slice(0, 9);

    if (valor.length > 1) {
        const cuerpo = valor.slice(0, -1);
        const dv = valor.slice(-1);
        const cuerpoPuntos = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        input.value = `${cuerpoPuntos}-${dv}`;
    } else {
        input.value = valor;
    }
}

// Verifica matemáticamente el dígito verificador con el algoritmo chileno Módulo 11
function validarRutChileno(rut) {
    if (!rut) return false;
    const limpio = rut.replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
    if (limpio.length < 8 || limpio.length > 9) return false;

    const cuerpo = limpio.slice(0, -1);
    const dvIngresado = limpio.slice(-1);
    if (!/^\d+$/.test(cuerpo)) return false;

    // Evitar RUTs de dígitos repetidos inválidos
    let suma = 0;
    let multiplicador = 2;
    for (let i = cuerpo.length - 1; i >= 0; i--) {
        suma += parseInt(cuerpo.charAt(i), 10) * multiplicador;
        multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
    }

    const resto = 11 - (suma % 11);
    let dvCalculado = '';
    if (resto === 11) dvCalculado = '0';
    else if (resto === 10) dvCalculado = 'K';
    else dvCalculado = String(resto);

    return dvIngresado === dvCalculado;
}

// Verifica formato estricto de correo con @ y dominio (.cl, .com, .org, .net, etc.)
function validarFormatoCorreo(email) {
    if (!email) return false;
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(cl|com|org|net|edu|gob|io|co|[a-zA-Z]{2,6})$/i;
    return regex.test(email.trim());
}

// Verifica formato de contraseña: mínimo 8 caracteres, al menos una letra mayúscula, una letra minúscula, un número y un carácter especial 
function esPasswordSegura(p) {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(p || '');
}

const MSG_PASSWORD_SEGURA =
    'La contraseña debe tener al menos 8 caracteres, con mayúscula, minúscula, número y símbolo.';

// Teléfono chileno: móvil (9 XXXX XXXX) o fijo (2 XXXX XXXX / 32 XXX XXXX), con +56 opcional.
// Acepta espacios, guiones y paréntesis como separadores.
function esTelefonoChileno(t) {
    const limpio = String(t || '').replace(/[\s\-()]/g, '');
    return /^(\+?56)?[2-9]\d{8}$/.test(limpio);
}
const MSG_TELEFONO_INVALIDO = 'El teléfono de contacto no es válido. Usa un número chileno, por ejemplo +56 9 8765 4321.';

// Cuadro de confirmación Sí / No. Uso: if (!await confirmarAccion('¿Estás seguro?')) return;
// La opción por defecto (foco) es "No"; Escape o clic fuera del cuadro cancelan.
function confirmarAccion(mensaje, opciones = {}) {
    return new Promise(resolve => {
        const fondo = document.createElement('div');
        fondo.className = 'modal-confirmar-fondo';
        fondo.setAttribute('role', 'dialog');
        fondo.setAttribute('aria-modal', 'true');

        const caja = document.createElement('div');
        caja.className = 'modal-confirmar';
        const h = document.createElement('h3');
        h.textContent = opciones.titulo || 'Confirmar acción';
        const p = document.createElement('p');
        p.textContent = mensaje;
        const botones = document.createElement('div');
        botones.className = 'modal-confirmar-botones';
        const btnNo = document.createElement('button');
        btnNo.type = 'button';
        btnNo.className = 'btn btn-outline';
        btnNo.textContent = opciones.textoNo || 'No';
        const btnSi = document.createElement('button');
        btnSi.type = 'button';
        btnSi.className = 'btn ' + (opciones.peligro ? 'btn-danger' : 'btn-success');
        btnSi.textContent = opciones.textoSi || 'Sí';
        botones.append(btnNo, btnSi);
        caja.append(h, p, botones);
        fondo.appendChild(caja);

        const onKey = ev => { if (ev.key === 'Escape') cerrar(false); };
        function cerrar(resultado) {
            document.removeEventListener('keydown', onKey);
            fondo.remove();
            resolve(resultado);
        }
        btnSi.addEventListener('click', () => cerrar(true));
        btnNo.addEventListener('click', () => cerrar(false));
        fondo.addEventListener('click', ev => { if (ev.target === fondo) cerrar(false); });
        document.addEventListener('keydown', onKey);
        document.body.appendChild(fondo);
        btnNo.focus();
    });
}
