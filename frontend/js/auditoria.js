/* AndesB2B · Auditoría de precios (solo lectura)
   Script: comparte el ámbito global con los demás archivos de /js (ver orden de carga en panel.html). */

async function cargarAuditoria() {
    const res = await fetch(`${API_URL}/catalogo/auditoria`);
    const logs = res.ok ? await res.json() : [];
    const tbody = document.getElementById('tabla-auditoria');
    if (!tbody) return;
    tbody.innerHTML = '';

    logs.forEach(l => {
        const dif = Number(l.precioNuevo) - Number(l.precioAnterior);
        const signo = dif >= 0 ? '+' : '';
        tbody.innerHTML += `
            <tr>
                <td><strong>#LOG-${Number(l.idLog)}</strong></td>
                <td>${esc(l.fechaModificacion ? l.fechaModificacion.replace('T', ' ').substring(0, 16) : '-')}</td>
                <td><strong>${esc(l.sku)}</strong> - ${esc(l.nombreProducto)}</td>
                <td>${formatearCLP(l.precioAnterior)}</td>
                <td style="color:#0284c7; font-weight:700;">${formatearCLP(l.precioNuevo)}</td>
                <td><span class="badge ${dif >= 0 ? 'badge-info' : 'badge-warn'}">${signo}${formatearCLP(dif)}</span></td>
                <td>${esc(l.nombreUsuario)}</td>
            </tr>
        `;
    });
}
