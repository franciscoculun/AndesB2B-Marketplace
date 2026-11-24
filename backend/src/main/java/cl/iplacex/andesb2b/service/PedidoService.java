package cl.iplacex.andesb2b.service;

import cl.iplacex.andesb2b.config.UsuarioPrincipal;
import cl.iplacex.andesb2b.model.*;
import cl.iplacex.andesb2b.model.Dtos.*;
import cl.iplacex.andesb2b.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@Service
public class PedidoService {

    private static final int MAX_PDF_BYTES = 2 * 1024 * 1024; // 2 MB máximo

    private final PedidoRepository pedidoRepo;
    private final DetallePedidoRepository detalleRepo;
    private final ProductoRepository productoRepo;
    private final UsuarioRepository usuarioRepo;
    private final DocumentoCobroRepository cobroRepo;

    public PedidoService(PedidoRepository pedidoRepo,
                         DetallePedidoRepository detalleRepo,
                         ProductoRepository productoRepo,
                         UsuarioRepository usuarioRepo,
                         DocumentoCobroRepository cobroRepo) {
        this.pedidoRepo = pedidoRepo;
        this.detalleRepo = detalleRepo;
        this.productoRepo = productoRepo;
        this.usuarioRepo = usuarioRepo;
        this.cobroRepo = cobroRepo;
    }

    private void exigirRolComprador(UsuarioPrincipal sesion) {
        if (sesion == null || (!"Comprador".equals(sesion.rol()) && !"Administrador".equals(sesion.rol()))) {
            throw new SecurityException("Tu rol no tiene permisos para realizar operaciones de compra.");
        }
    }

    private void exigirRolVendedor(UsuarioPrincipal sesion) {
        if (sesion == null || (!"Vendedor".equals(sesion.rol()) && !"Administrador".equals(sesion.rol()))) {
            throw new SecurityException("Tu rol no tiene permisos para gestionar ventas y despachos.");
        }
    }

    private static final java.util.regex.Pattern TELEFONO_CL =
            java.util.regex.Pattern.compile("^(\\+?56)?[2-9]\\d{8}$");

    @Transactional
    public PedidoResumenDto crearPedido(UsuarioPrincipal sesion, Map< String, Object > payload) {
        exigirRolComprador(sesion);

        Usuario comprador = usuarioRepo.findById(sesion.idUsuario())
                .orElseThrow(() -> new IllegalArgumentException("Usuario comprador no válido."));

        List< ? > items;
        boolean esCarritoConDespacho = payload.containsKey("items") && payload.get("items") instanceof List< ? >;
        if (esCarritoConDespacho) {
            items = (List< ? >) payload.get("items");
        } else if (payload.containsKey("idProducto") && payload.containsKey("cantidad")) {
            items = List.of(Map.of(
                    "idProducto", payload.get("idProducto"),
                    "cantidad", payload.get("cantidad")
            ));
        } else {
            throw new IllegalArgumentException("Debes agregar al menos un producto al pedido.");
        }

        if (items.isEmpty()) {
            throw new IllegalArgumentException("El carrito de solicitud no puede estar vacío.");
        }

        String receptor = payload.get("nombreReceptor") != null ? payload.get("nombreReceptor").toString().trim() : "";
        String telefono = payload.get("telefonoContacto") != null ? payload.get("telefonoContacto").toString().trim() : "";
        String direccion = payload.get("direccionDestino") != null ? payload.get("direccionDestino").toString().trim() : "";

        if (esCarritoConDespacho && (receptor.isEmpty() || telefono.isEmpty() || direccion.isEmpty())) {
            throw new IllegalArgumentException("El nombre de quien recibe, el teléfono de contacto y la dirección de destino son obligatorios.");
        }

        if (esCarritoConDespacho && !TELEFONO_CL.matcher(telefono.replaceAll("[\\s\\-()]", "")).matches()) {
            throw new IllegalArgumentException("El teléfono de contacto no es válido. Usa un número chileno, por ejemplo +56 9 8765 4321.");
        }

        Empresa proveedorUnico = null;
        Pedido pedido = null;
        Map< Integer, Integer > cantidadPorProducto = new java.util.HashMap<>();

        for (Object rawItem : items) {
            Map< ?, ? > item = (Map< ?, ? >) rawItem;
            Integer idProducto = Integer.valueOf(item.get("idProducto").toString());
            Integer cantidad = Integer.valueOf(item.get("cantidad").toString());

            if (cantidad <= 0) {
                throw new IllegalArgumentException("La cantidad solicitada de cada insumo debe ser mayor a cero.");
            }

            Producto prod = productoRepo.findById(idProducto)
                    .orElseThrow(() -> new IllegalArgumentException("Producto no encontrado (ID: " + idProducto + ")."));

            if (!Boolean.TRUE.equals(prod.getVisible())) {
                throw new IllegalArgumentException("El producto " + prod.getNombreProducto() + " no está disponible.");
            }
            if (comprador.getEmpresa().getIdEmpresa().equals(prod.getEmpresaVendedora().getIdEmpresa())) {
                throw new IllegalArgumentException("Restricción comercial: Una empresa no puede emitir órdenes de compra a sí misma.");
            }
            // Las solicitudes pendientes NO reservan stock: solo se compara con el stock actual.
            // La verificación definitiva ocurre al aceptar la cotización (con bloqueo de fila).
            int cantidadAcumulada = cantidadPorProducto.merge(idProducto, cantidad, Integer::sum);
            if (prod.getStockDisponible() < cantidadAcumulada) {
                throw new IllegalArgumentException("Stock insuficiente para el insumo: " + prod.getNombreProducto()
                        + " (solicitado: " + cantidadAcumulada + ", disponible: " + prod.getStockDisponible() + ").");
            }

            if (proveedorUnico == null) {
                proveedorUnico = prod.getEmpresaVendedora();
                pedido = new Pedido();
                pedido.setEmpresaCompradora(comprador.getEmpresa());
                pedido.setEmpresaVendedora(proveedorUnico);
                pedido.setUsuarioComprador(comprador);
                pedido.setEstadoPedido("COTIZANDO_ENVIO");
                pedido.setEstadoPago("SIN_COMPROBANTE");
                pedido.setCostoEnvio(BigDecimal.ZERO);
                pedido.setNombreReceptor(receptor.isEmpty() ? comprador.getNombreCompleto() : receptor);
                pedido.setTelefonoContacto(telefono);
                pedido.setDireccionDestino(direccion.isEmpty()
                        ? comprador.getEmpresa().getDireccion() + " (" + comprador.getEmpresa().getRegion() + ")"
                        : direccion);
                pedido = pedidoRepo.saveAndFlush(pedido);
            } else if (!proveedorUnico.getIdEmpresa().equals(prod.getEmpresaVendedora().getIdEmpresa())) {
                throw new IllegalArgumentException("Todos los productos de una orden deben pertenecer al mismo proveedor.");
            }

            DetallePedido det = new DetallePedido();
            det.setPedido(pedido);
            det.setProducto(prod);
            det.setCantidad(cantidad);
            det.setPrecioUnitarioFijo(prod.getPrecioUnitario());
            detalleRepo.saveAndFlush(det);
        }

        return armarDto(pedido);
    }

    @Transactional
    public PedidoResumenDto cotizarEnvio(UsuarioPrincipal sesion, Integer idPedido, Map< String, Object > datos) {
        exigirRolVendedor(sesion);

        Pedido p = pedidoRepo.findById(idPedido)
                .orElseThrow(() -> new IllegalArgumentException("Pedido no encontrado."));

        if (!p.getEmpresaVendedora().getIdEmpresa().equals(sesion.idEmpresa())) {
            throw new SecurityException("No puedes cotizar un pedido dirigido a otra empresa proveedora.");
        }
        if (!"COTIZANDO_ENVIO".equals(p.getEstadoPedido())) {
            throw new IllegalArgumentException("Solo se pueden cotizar pedidos que estén en estado COTIZANDO_ENVIO.");
        }

        if (p.getMedioTransporte() != null && !p.getMedioTransporte().isBlank()) {
            throw new IllegalArgumentException("Este pedido ya fue cotizado. La cotización no puede modificarse; espera la respuesta del comprador.");
        }

        String transporte = datos.get("medioTransporte") != null ? datos.get("medioTransporte").toString().trim() : "";
        String tiempoEstimado = datos.get("tiempoEstimadoEnvio") != null ? datos.get("tiempoEstimadoEnvio").toString().trim() : "";
        BigDecimal costo = new BigDecimal(datos.get("costoEnvio").toString());
        if (transporte.isEmpty() || costo.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Debes indicar una empresa transportista válida y un costo de envío no negativo.");
        }

        p.setMedioTransporte(transporte);
        p.setTiempoEstimadoEnvio(tiempoEstimado.isEmpty() ? "3 a 5 días hábiles" : tiempoEstimado);
        p.setCostoEnvio(costo);
        return armarDto(pedidoRepo.save(p));
    }

    // Cancelación / anulación: cierra el pedido en estado RECHAZADO desde cualquiera de las dos partes.
    //  - COTIZANDO_ENVIO: el comprador cancela o el vendedor rechaza la solicitud (el stock no se había descontado aún).
    //  - COMPRA_CONFIRMADA con pago sin verificar: se devuelve el stock y el documento de cobro queda ANULADO.
    @Transactional
    public PedidoResumenDto cancelarPedido(UsuarioPrincipal sesion, Integer idPedido) {
        if (sesion == null) {
            throw new SecurityException("Sesión no válida.");
        }
        Pedido p = pedidoRepo.findById(idPedido)
                .orElseThrow(() -> new IllegalArgumentException("Pedido no encontrado."));

        if (sesion.idEmpresa().equals(p.getEmpresaCompradora().getIdEmpresa())) {
            exigirRolComprador(sesion);
        } else if (sesion.idEmpresa().equals(p.getEmpresaVendedora().getIdEmpresa())) {
            exigirRolVendedor(sesion);
        } else {
            throw new SecurityException("No tienes permiso para modificar pedidos de otra empresa.");
        }

        String estado = p.getEstadoPedido();
        if ("COTIZANDO_ENVIO".equals(estado)) {
            p.setEstadoPedido("RECHAZADO");
            return armarDto(pedidoRepo.save(p));
        }
        if ("COMPRA_CONFIRMADA".equals(estado)) {
            if ("VERIFICADO".equals(p.getEstadoPago())) {
                throw new IllegalArgumentException("El pago de este pedido ya fue verificado y no puede anularse desde el sistema.");
            }
            for (DetallePedido d : detalleRepo.findByPedidoIdPedido(idPedido)) {
                Producto prodBloqueado = productoRepo.findByIdForUpdate(d.getProducto().getIdProducto())
                        .orElseThrow(() -> new IllegalArgumentException("Producto no encontrado."));
                prodBloqueado.setStockDisponible(prodBloqueado.getStockDisponible() + d.getCantidad());
                productoRepo.save(prodBloqueado);
            }
            cobroRepo.findByPedidoIdPedido(idPedido).ifPresent(doc -> {
                doc.setEstadoCobro("ANULADO");
                cobroRepo.save(doc);
            });
            p.setEstadoPedido("RECHAZADO");
            return armarDto(pedidoRepo.save(p));
        }
        throw new IllegalArgumentException("Este pedido ya no puede cancelarse (Estado actual: " + estado + ").");
    }

    @Transactional
    public PedidoResumenDto responderCotizacion(UsuarioPrincipal sesion, Integer idPedido, boolean aprobar) {
        exigirRolComprador(sesion);

        Pedido p = pedidoRepo.findById(idPedido)
                .orElseThrow(() -> new IllegalArgumentException("Pedido no encontrado."));

        if (!p.getEmpresaCompradora().getIdEmpresa().equals(sesion.idEmpresa())) {
            throw new SecurityException("No tienes permiso para responder órdenes de compra de otra empresa.");
        }
        if (!"COTIZANDO_ENVIO".equals(p.getEstadoPedido())) {
            throw new IllegalArgumentException("Esta orden ya fue procesada anteriormente (Estado actual: " + p.getEstadoPedido() + ").");
        }
        if (p.getMedioTransporte() == null || p.getMedioTransporte().isBlank()) {
            throw new IllegalArgumentException("El proveedor aún no ha enviado la cotización de transporte.");
        }

        if (!aprobar) {
            p.setEstadoPedido("RECHAZADO");
            return armarDto(pedidoRepo.save(p));
        }

        var detalles = detalleRepo.findByPedidoIdPedido(idPedido);
        BigDecimal subtotalProductos = BigDecimal.ZERO;

        for (DetallePedido d : detalles) {
            Producto prodBloqueado = productoRepo.findByIdForUpdate(d.getProducto().getIdProducto())
                    .orElseThrow(() -> new IllegalArgumentException("Producto no encontrado."));

            if (prodBloqueado.getStockDisponible() < d.getCantidad()) {
                throw new IllegalArgumentException("Stock insuficiente para confirmar la compra de: " + prodBloqueado.getNombreProducto());
            }
            prodBloqueado.setStockDisponible(prodBloqueado.getStockDisponible() - d.getCantidad());
            productoRepo.save(prodBloqueado);

            BigDecimal linea = d.getPrecioUnitarioFijo().multiply(BigDecimal.valueOf(d.getCantidad()));
            subtotalProductos = subtotalProductos.add(linea);
        }

        p.setEstadoPedido("COMPRA_CONFIRMADA");
        pedidoRepo.save(p);

        BigDecimal montoEnvio = p.getCostoEnvio() != null ? p.getCostoEnvio() : BigDecimal.ZERO;
        BigDecimal comision = subtotalProductos.multiply(new BigDecimal("0.03")).setScale(2, RoundingMode.HALF_UP);
        BigDecimal totalOperacion = subtotalProductos.add(montoEnvio);

        DocumentoCobro doc = new DocumentoCobro();
        doc.setPedido(p);
        doc.setSubtotalProductos(subtotalProductos);
        doc.setMontoEnvio(montoEnvio);
        doc.setComision(comision);
        doc.setTotalOperacion(totalOperacion);
        doc.setEstadoCobro("PENDIENTE_LIQUIDACION");
        cobroRepo.save(doc);

        return armarDto(p);
    }

    @Transactional
    public PedidoResumenDto registrarSeguimiento(UsuarioPrincipal sesion, Integer idPedido, String codigoSeguimiento) {
        exigirRolVendedor(sesion);

        Pedido p = pedidoRepo.findById(idPedido)
                .orElseThrow(() -> new IllegalArgumentException("Pedido no encontrado."));

        if (!p.getEmpresaVendedora().getIdEmpresa().equals(sesion.idEmpresa())) {
            throw new SecurityException("No puedes gestionar despachos de otra empresa proveedora.");
        }
        if (!"COMPRA_CONFIRMADA".equals(p.getEstadoPedido())) {
            throw new IllegalArgumentException("Solo se puede pasar a EN_TRANSITO un pedido en estado COMPRA_CONFIRMADA.");
        }
        if (!"VERIFICADO".equals(p.getEstadoPago())) {
            throw new IllegalArgumentException("Debes revisar la factura PDF y confirmar el pago del comprador antes de despachar el pedido.");
        }
        if (codigoSeguimiento == null || codigoSeguimiento.isBlank()) {
            throw new IllegalArgumentException("Debes ingresar un código de seguimiento válido.");
        }

        p.setCodigoSeguimiento(codigoSeguimiento.trim());
        p.setEstadoPedido("EN_TRANSITO");
        return armarDto(pedidoRepo.save(p));
    }

    @Transactional
    public PedidoResumenDto confirmarRecepcion(UsuarioPrincipal sesion, Integer idPedido) {
        exigirRolComprador(sesion);

        Pedido p = pedidoRepo.findById(idPedido)
                .orElseThrow(() -> new IllegalArgumentException("Pedido no encontrado."));

        if (!p.getEmpresaCompradora().getIdEmpresa().equals(sesion.idEmpresa())) {
            throw new SecurityException("No puedes confirmar la recepción de órdenes de otra empresa.");
        }
        if (!"EN_TRANSITO".equals(p.getEstadoPedido())) {
            throw new IllegalArgumentException("Solo se puede finalizar un pedido que se encuentre EN_TRANSITO.");
        }

        p.setEstadoPedido("FINALIZADO");
        return armarDto(pedidoRepo.save(p));
    }

    @Transactional
    public PedidoResumenDto adjuntarComprobantePdf(UsuarioPrincipal sesion, Integer idPedido, String nombreArchivo, String base64Pdf) {
        exigirRolComprador(sesion);

        Pedido p = pedidoRepo.findById(idPedido)
                .orElseThrow(() -> new IllegalArgumentException("Pedido no encontrado."));

        if (!p.getEmpresaCompradora().getIdEmpresa().equals(sesion.idEmpresa())) {
            throw new SecurityException("No tienes permiso para adjuntar documentos en pedidos de otra empresa.");
        }
        if (!"COMPRA_CONFIRMADA".equals(p.getEstadoPedido())) {
            throw new IllegalArgumentException("Solo puedes adjuntar la factura/comprobante cuando la compra está en estado COMPRA_CONFIRMADA.");
        }
        if ("VERIFICADO".equals(p.getEstadoPago())) {
            throw new IllegalArgumentException("El pago de este pedido ya fue verificado por el vendedor y no admite modificaciones.");
        }

        String prefijo = "data:application/pdf;base64,";
        if (base64Pdf == null || !base64Pdf.startsWith(prefijo)) {
            throw new IllegalArgumentException("El archivo adjunto debe tener formato PDF válido.");
        }

        String contenidoBase64 = base64Pdf.substring(prefijo.length()).trim();
        if (contenidoBase64.isEmpty() || contenidoBase64.length() > 2_800_000) {
            throw new IllegalArgumentException("El archivo PDF supera el límite máximo permitido de 2 MB.");
        }

        byte[] bytesPdf;
        try {
            bytesPdf = Base64.getDecoder().decode(contenidoBase64);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("La codificación Base64 del archivo PDF es inválida.");
        }

        if (bytesPdf.length < 5 || bytesPdf.length > MAX_PDF_BYTES) {
            throw new IllegalArgumentException("El tamaño real del PDF debe ser menor o igual a 2 MB.");
        }

        String magicHeader = new String(bytesPdf, 0, 4, StandardCharsets.US_ASCII);
        if (!"%PDF".equals(magicHeader)) {
            throw new IllegalArgumentException("El archivo rechazado no corresponde a un documento PDF real (firma %PDF ausente).");
        }

        String nombreLimpio = (nombreArchivo != null && !nombreArchivo.isBlank())
                ? nombreArchivo.replaceAll("[^a-zA-Z0-9._-]", "_")
                : "factura_pago_" + idPedido + ".pdf";

        p.setNombreArchivoPdf(nombreLimpio);
        p.setEstadoPago("EN_REVISION");
        Pedido guardado = pedidoRepo.saveAndFlush(p);
        pedidoRepo.guardarContenidoPdf(idPedido, base64Pdf);
        return armarDto(guardado);
    }

    @Transactional
    public PedidoResumenDto verificarComprobantePago(UsuarioPrincipal sesion, Integer idPedido, boolean aprobarPago) {
        exigirRolVendedor(sesion);

        Pedido p = pedidoRepo.findById(idPedido)
                .orElseThrow(() -> new IllegalArgumentException("Pedido no encontrado."));

        if (!p.getEmpresaVendedora().getIdEmpresa().equals(sesion.idEmpresa())) {
            throw new SecurityException("No puedes verificar pagos de otra empresa proveedora.");
        }
        if (p.getNombreArchivoPdf() == null || p.getNombreArchivoPdf().isBlank()) {
            throw new IllegalArgumentException("El comprador aún no ha adjuntado el PDF de la factura o comprobante de pago.");
        }

        if (aprobarPago) {
            p.setEstadoPago("VERIFICADO");
            cobroRepo.findByPedidoEmpresaVendedoraIdEmpresa(sesion.idEmpresa()).stream()
                    .filter(c -> c.getPedido().getIdPedido().equals(idPedido))
                    .findFirst()
                    .ifPresent(doc -> {
                        doc.setEstadoCobro("PAGADO_VERIFICADO");
                        cobroRepo.save(doc);
                    });
        } else {
            p.setEstadoPago("OBSERVADO");
        }

        return armarDto(pedidoRepo.save(p));
    }

    @Transactional(readOnly = true)
    public Map< String, String > obtenerArchivoPdf(UsuarioPrincipal sesion, Integer idPedido) {
        if (sesion == null) {
            throw new SecurityException("Sesión no válida.");
        }
        Pedido p = pedidoRepo.findById(idPedido)
                .orElseThrow(() -> new IllegalArgumentException("Pedido no encontrado."));

        boolean esComprador = p.getEmpresaCompradora().getIdEmpresa().equals(sesion.idEmpresa());
        boolean esVendedor = p.getEmpresaVendedora().getIdEmpresa().equals(sesion.idEmpresa());

        if (!esComprador && !esVendedor) {
            throw new SecurityException("No tienes permiso para visualizar el documento de este pedido.");
        }
        String contenidoPdf = pedidoRepo.obtenerContenidoPdf(idPedido);
        if (contenidoPdf == null || contenidoPdf.isBlank()) {
            throw new IllegalArgumentException("Este pedido no tiene un PDF adjunto.");
        }
        return Map.of(
                "nombreArchivo", p.getNombreArchivoPdf() != null ? p.getNombreArchivoPdf() : "comprobante.pdf",
                "base64Pdf", contenidoPdf
);
    }

    @Transactional(readOnly = true)
    public List< PedidoResumenDto > listarMisCompras(UsuarioPrincipal sesion) {
        return pedidoRepo.findByEmpresaCompradoraIdEmpresaOrderByFechaCreacionDesc(sesion.idEmpresa())
                .stream().map(this::armarDto).toList();
    }

    @Transactional(readOnly = true)
    public List< PedidoResumenDto > listarMisVentas(UsuarioPrincipal sesion) {
        return pedidoRepo.findByEmpresaVendedoraIdEmpresaOrderByFechaCreacionDesc(sesion.idEmpresa())
                .stream().map(this::armarDto).toList();
    }

    @Transactional(readOnly = true)
    public List< DocumentoCobroDto > listarMiEstadoCuenta(UsuarioPrincipal sesion) {
        exigirRolVendedor(sesion);
        return cobroRepo.findByPedidoEmpresaVendedoraIdEmpresa(sesion.idEmpresa())
                .stream().map(DocumentoCobroDto::from).toList();
    }

    private PedidoResumenDto armarDto(Pedido p) {
        var detalles = detalleRepo.findByPedidoIdPedido(p.getIdPedido());
        return PedidoResumenDto.from(p, detalles);
    }
}