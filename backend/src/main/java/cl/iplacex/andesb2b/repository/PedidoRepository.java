package cl.iplacex.andesb2b.repository;

import cl.iplacex.andesb2b.model.Pedido;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PedidoRepository extends JpaRepository< Pedido, Integer > {
    List< Pedido > findByEmpresaCompradoraIdEmpresaOrderByFechaCreacionDesc(Integer idEmpresa);
    List< Pedido > findByEmpresaVendedoraIdEmpresaOrderByFechaCreacionDesc(Integer idEmpresa);

    @Modifying
    @Query(value = "UPDATE pedidos SET comprobante_pdf = :base64Pdf WHERE id_pedido = :idPedido", nativeQuery = true)
    void guardarContenidoPdf(@Param("idPedido") Integer idPedido, @Param("base64Pdf") String base64Pdf);

    @Query(value = "SELECT comprobante_pdf FROM pedidos WHERE id_pedido = :idPedido", nativeQuery = true)
    String obtenerContenidoPdf(@Param("idPedido") Integer idPedido);
}