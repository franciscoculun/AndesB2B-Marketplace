-- ========================================================
-- ANDESB2B - SCRIPT DE BASE DE DATOS
-- ========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS documentos_cobro CASCADE;
DROP TABLE IF EXISTS detalle_pedidos CASCADE;
DROP TABLE IF EXISTS detalle_pedido CASCADE;
DROP TABLE IF EXISTS pedidos CASCADE;
DROP TABLE IF EXISTS log_auditoria_precios CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS empresas CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- 1. Tabla Roles
CREATE TABLE roles (
    id_rol SERIAL PRIMARY KEY,
    nombre_rol VARCHAR(50) NOT NULL UNIQUE,
    descripcion VARCHAR(200)
);

-- 2. Tabla Empresas
CREATE TABLE empresas (
    id_empresa SERIAL PRIMARY KEY,
    rut_empresa VARCHAR(20) NOT NULL UNIQUE,
    razon_social VARCHAR(150) NOT NULL,
    giro VARCHAR(150) NOT NULL,
    region VARCHAR(100) NOT NULL,
    direccion VARCHAR(255) NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla Usuarios
CREATE TABLE usuarios (
    id_usuario SERIAL PRIMARY KEY,
    id_empresa INTEGER NOT NULL REFERENCES empresas(id_empresa) ON DELETE RESTRICT,
    id_rol INTEGER NOT NULL REFERENCES roles(id_rol) ON DELETE RESTRICT,
    nombre_completo VARCHAR(120) NOT NULL,
    rut_usuario VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    token_recuperacion VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabla Categorias
CREATE TABLE categorias (
    id_categoria SERIAL PRIMARY KEY,
    nombre_categoria VARCHAR(100) NOT NULL UNIQUE,
    descripcion_rubro VARCHAR(200)
);

-- 5. Tabla Productos
CREATE TABLE productos (
    id_producto SERIAL PRIMARY KEY,
    id_empresa_vendedora INTEGER NOT NULL REFERENCES empresas(id_empresa) ON DELETE RESTRICT,
    id_categoria INTEGER NOT NULL REFERENCES categorias(id_categoria) ON DELETE RESTRICT,
    sku VARCHAR(50) NOT NULL UNIQUE,
    nombre_producto VARCHAR(150) NOT NULL,
    precio_unitario NUMERIC(12, 2) NOT NULL CHECK (precio_unitario >= 0),
    stock_disponible INTEGER NOT NULL DEFAULT 0 CHECK (stock_disponible >= 0),
    visible BOOLEAN NOT NULL DEFAULT FALSE
);

-- 6. Tabla Log_Auditoria_Precios
CREATE TABLE log_auditoria_precios (
    id_log SERIAL PRIMARY KEY,
    id_producto INTEGER NOT NULL REFERENCES productos(id_producto) ON DELETE RESTRICT,
    id_usuario INTEGER REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
    precio_anterior NUMERIC(12, 2) NOT NULL,
    precio_nuevo NUMERIC(12, 2) NOT NULL,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Tabla Pedidos (incluye datos de despacho y comprobante PDF)
CREATE TABLE pedidos (
    id_pedido SERIAL PRIMARY KEY,
    id_empresa_compradora INTEGER NOT NULL REFERENCES empresas(id_empresa) ON DELETE RESTRICT,
    id_empresa_vendedora INTEGER NOT NULL REFERENCES empresas(id_empresa) ON DELETE RESTRICT,
    id_usuario_comprador INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
    estado_pedido VARCHAR(30) NOT NULL DEFAULT 'COTIZANDO_ENVIO'
        CHECK (estado_pedido IN ('COTIZANDO_ENVIO', 'COMPRA_CONFIRMADA', 'EN_TRANSITO', 'FINALIZADO', 'RECHAZADO')),
    medio_transporte VARCHAR(120),
    costo_envio NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (costo_envio >= 0),
    codigo_seguimiento VARCHAR(80),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    nombre_receptor VARCHAR(120),
    telefono_contacto VARCHAR(40),
    direccion_destino VARCHAR(255),
    tiempo_estimado_envio VARCHAR(80),
    comprobante_pdf TEXT,
    nombre_archivo_pdf VARCHAR(255),
    estado_pago VARCHAR(30) NOT NULL DEFAULT 'SIN_COMPROBANTE'
        CHECK (estado_pago IN ('SIN_COMPROBANTE', 'EN_REVISION', 'VERIFICADO', 'OBSERVADO')),
    CONSTRAINT chk_empresas_distintas CHECK (id_empresa_vendedora <> id_empresa_compradora)
);

-- 8. Tabla Detalle_Pedidos (subtotal_linea es columna generada)
CREATE TABLE detalle_pedidos (
    id_detalle SERIAL PRIMARY KEY,
    id_pedido INTEGER NOT NULL REFERENCES pedidos(id_pedido) ON DELETE CASCADE,
    id_producto INTEGER NOT NULL REFERENCES productos(id_producto) ON DELETE RESTRICT,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario_fijo NUMERIC(12, 2) NOT NULL CHECK (precio_unitario_fijo >= 0),
    subtotal_linea NUMERIC(12, 2) GENERATED ALWAYS AS (cantidad * precio_unitario_fijo) STORED
);

-- 9. Tabla Documentos_Cobro
CREATE TABLE documentos_cobro (
    id_documento SERIAL PRIMARY KEY,
    id_pedido INTEGER NOT NULL UNIQUE REFERENCES pedidos(id_pedido) ON DELETE RESTRICT,
    subtotal_productos NUMERIC(12, 2) NOT NULL CHECK (subtotal_productos >= 0),
    monto_envio NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (monto_envio >= 0),
    comision NUMERIC(12, 2) NOT NULL CHECK (comision >= 0),
    total_operacion NUMERIC(12, 2) NOT NULL CHECK (total_operacion >= 0),
    estado_cobro VARCHAR(40) NOT NULL DEFAULT 'PENDIENTE_LIQUIDACION'
        CHECK (estado_cobro IN ('PENDIENTE_LIQUIDACION', 'PAGADO_VERIFICADO', 'PAGADO', 'ANULADO')),
    fecha_emision TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Funcion y trigger de auditoria automatica de cambios de precio
CREATE OR REPLACE FUNCTION fn_auditar_precio()
RETURNS TRIGGER AS $$
DECLARE
    v_id_usuario INTEGER;
BEGIN
    IF OLD.precio_unitario IS DISTINCT FROM NEW.precio_unitario THEN
        BEGIN
            v_id_usuario := NULLIF(current_setting('app.id_usuario', true), '')::INTEGER;
        EXCEPTION WHEN OTHERS THEN
            v_id_usuario := NULL;
        END;

        INSERT INTO log_auditoria_precios (id_producto, id_usuario, precio_anterior, precio_nuevo, fecha_modificacion)
        VALUES (NEW.id_producto, v_id_usuario, OLD.precio_unitario, NEW.precio_unitario, CURRENT_TIMESTAMP);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auditoria_precio ON productos;
CREATE TRIGGER trg_auditoria_precio
AFTER UPDATE OF precio_unitario ON productos
FOR EACH ROW
EXECUTE FUNCTION fn_auditar_precio();

-- Datos semilla (contraseña inicial de los usuarios de prueba: Andes2026!)
INSERT INTO roles (nombre_rol, descripcion) VALUES
('Administrador', 'Gestiona usuarios, datos de la empresa y auditoria'),
('Vendedor', 'Gestiona catalogo, pedidos recibidos y despachos'),
('Comprador', 'Explora el catalogo y emite ordenes de compra');

INSERT INTO categorias (nombre_categoria, descripcion_rubro) VALUES
('Acero y Metalurgia', 'Perfiles estructurales, planchas y fierro estriado'),
('Herramientas Electricas', 'Equipos de soldadura, corte y perforacion industrial'),
('Materiales y Fijaciones', 'Pernos de anclaje, electrodos y fijaciones estructurales');

INSERT INTO empresas (rut_empresa, razon_social, giro, region, direccion) VALUES
('76.123.456-0', 'Maestranza y Suministros Austral Ltda.', 'Fabricacion y venta mayorista de insumos metalurgicos', 'Los Lagos', 'Parque Industrial Cardonal Sitio 14, Puerto Montt'),
('76.543.210-3', 'Constructora del Sur SpA', 'Obras civiles, montaje industrial y edificacion', 'Los Lagos', 'Av. Diego Portales 1240, Puerto Montt');

INSERT INTO usuarios (id_empresa, id_rol, nombre_completo, rut_usuario, email, password_hash, activo) VALUES
(1, 1, 'Carlos Rojas', '15.432.198-5', 'crojas@maestranzaaustral.cl', crypt('Andes2026!', gen_salt('bf', 10)), true),
(1, 2, 'Pedro Vargas', '17.222.333-8', 'pvargas@maestranzaaustral.cl', crypt('Andes2026!', gen_salt('bf', 10)), true),
(2, 3, 'Maria Soto', '18.333.444-1', 'msoto@constructorasur.cl', crypt('Andes2026!', gen_salt('bf', 10)), true),
(2, 1, 'Roberto Munoz', '14.444.444-2', 'rmunoz@constructorasur.cl', crypt('Andes2026!', gen_salt('bf', 10)), true);

INSERT INTO productos (id_empresa_vendedora, id_categoria, sku, nombre_producto, precio_unitario, stock_disponible, visible) VALUES
(1, 1, 'SKU-101', 'Perfil Acero Costanera 100x50x15x3mm (6m)', 38500, 120, true),
(1, 2, 'SKU-118', 'Esmeril Angular Industrial 9 Pulgadas 2400W', 129000, 35, true),
(1, 3, 'SKU-305', 'Caja Electrodo Punto Azul 6011 1/8 (20 kg)', 64000, 80, true);