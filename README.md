# AndesB2B 

Plataforma transaccional B2B para la conexión comercial y logística entre pequeñas y medianas empresas (Pymes). Proyecto de Título - IPLACEX.

## Stack Tecnológico
* **Frontend:** HTML5, CSS, JavaScript
* **Backend:** Java 21, Spring Boot 4.1.2, Spring Security
* **Base de Datos:** PostgreSQL 18
* **Despliegue Cloud:** Render + Docker

## Organización del Repositorio
* `/database`: Scripts de inicialización (`schema.sql`) y diagrama de la base de datos (ER).
* `/backend`: Código fuente del servidor (Controllers, Services, Repositories, Models).
* `/frontend`: Vistas estáticas y assets del cliente web.

## Características Técnicas
* Arquitectura Cliente-Servidor Multicapa.
* Modelo relacional en 3FN con transacciones ACID la consistencia global de los datos.
* Autenticación y control de acceso basado en roles (RBAC) con contraseñas encriptadas.
* Registro inmutable de auditoría para la trazabilidad automática de variaciones de precios en el catálogo.