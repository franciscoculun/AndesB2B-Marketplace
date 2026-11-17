package cl.iplacex.andesb2b.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "pedidos")
public class Pedido {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_pedido")
    private Integer idPedido;

    @ManyToOne
    @JoinColumn(name = "id_empresa_compradora", nullable = false)
    private Empresa empresaCompradora;

    @ManyToOne
    @JoinColumn(name = "id_empresa_vendedora", nullable = false)
    private Empresa empresaVendedora;

    @ManyToOne
    @JoinColumn(name = "id_usuario_comprador", nullable = false)
    private Usuario usuarioComprador;

    @Column(name = "estado_pedido", length = 50)
    private String estadoPedido = "COTIZANDO_ENVIO";

    @Column(name = "medio_transporte", length = 100)
    private String medioTransporte;

    @Column(name = "costo_envio", precision = 12, scale = 2)
    private BigDecimal costoEnvio = BigDecimal.ZERO;

    @Column(name = "codigo_seguimiento", length = 100)
    private String codigoSeguimiento;

    @Column(name = "fecha_creacion", insertable = false, updatable = false)
    private LocalDateTime fechaCreacion;

    public Integer getIdPedido() { return idPedido; }
    public void setIdPedido(Integer idPedido) { this.idPedido = idPedido; }
    public Empresa getEmpresaCompradora() { return empresaCompradora; }
    public void setEmpresaCompradora(Empresa empresaCompradora) { this.empresaCompradora = empresaCompradora; }
    public Empresa getEmpresaVendedora() { return empresaVendedora; }
    public void setEmpresaVendedora(Empresa empresaVendedora) { this.empresaVendedora = empresaVendedora; }
    public Usuario getUsuarioComprador() { return usuarioComprador; }
    public void setUsuarioComprador(Usuario usuarioComprador) { this.usuarioComprador = usuarioComprador; }
    public String getEstadoPedido() { return estadoPedido; }
    public void setEstadoPedido(String estadoPedido) { this.estadoPedido = estadoPedido; }
    public String getMedioTransporte() { return medioTransporte; }
    public void setMedioTransporte(String medioTransporte) { this.medioTransporte = medioTransporte; }
    public BigDecimal getCostoEnvio() { return costoEnvio; }
    public void setCostoEnvio(BigDecimal costoEnvio) { this.costoEnvio = costoEnvio; }
    public String getCodigoSeguimiento() { return codigoSeguimiento; }
    public void setCodigoSeguimiento(String codigoSeguimiento) { this.codigoSeguimiento = codigoSeguimiento; }
    public LocalDateTime getFechaCreacion() { return fechaCreacion; }
    public void setFechaCreacion(LocalDateTime fechaCreacion) { this.fechaCreacion = fechaCreacion; }

    @Column(name = "nombre_archivo_pdf")
    private String nombreArchivoPdf;

    @Column(name = "estado_pago", length = 30)
    private String estadoPago = "SIN_COMPROBANTE";

    public String getNombreArchivoPdf() { return nombreArchivoPdf; }
    public void setNombreArchivoPdf(String nombreArchivoPdf) { this.nombreArchivoPdf = nombreArchivoPdf; }

    public String getEstadoPago() { return estadoPago; }
    public void setEstadoPago(String estadoPago) { this.estadoPago = estadoPago; }

    @Column(name = "nombre_receptor", length = 120)
    private String nombreReceptor;

    @Column(name = "telefono_contacto", length = 40)
    private String telefonoContacto;

    @Column(name = "direccion_destino", length = 255)
    private String direccionDestino;

    @Column(name = "tiempo_estimado_envio", length = 80)
    private String tiempoEstimadoEnvio;

    public String getNombreReceptor() { return nombreReceptor; }
    public void setNombreReceptor(String nombreReceptor) { this.nombreReceptor = nombreReceptor; }

    public String getTelefonoContacto() { return telefonoContacto; }
    public void setTelefonoContacto(String telefonoContacto) { this.telefonoContacto = telefonoContacto; }

    public String getDireccionDestino() { return direccionDestino; }
    public void setDireccionDestino(String direccionDestino) { this.direccionDestino = direccionDestino; }

    public String getTiempoEstimadoEnvio() { return tiempoEstimadoEnvio; }
    public void setTiempoEstimadoEnvio(String tiempoEstimadoEnvio) { this.tiempoEstimadoEnvio = tiempoEstimadoEnvio; }
}