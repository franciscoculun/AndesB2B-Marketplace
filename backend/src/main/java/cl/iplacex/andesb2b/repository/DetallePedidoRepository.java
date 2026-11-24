package cl.iplacex.andesb2b.repository;

import cl.iplacex.andesb2b.model.DetallePedido;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DetallePedidoRepository extends JpaRepository<DetallePedido, Integer> {
    List<DetallePedido> findByPedidoIdPedido(Integer idPedido);

    // Unidades de un producto comprometidas en pedidos que aún esperan la respuesta del comprador
    @org.springframework.data.jpa.repository.Query(
            "SELECT COALESCE(SUM(d.cantidad), 0) FROM DetallePedido d "
          + "WHERE d.producto.idProducto = :idProducto AND d.pedido.estadoPedido = 'COTIZANDO_ENVIO'")
    Long unidadesReservadas(@org.springframework.data.repository.query.Param("idProducto") Integer idProducto);
}