package cl.iplacex.andesb2b.service;

import cl.iplacex.andesb2b.config.UsuarioPrincipal;
import cl.iplacex.andesb2b.model.Dtos.EmpresaDto;
import cl.iplacex.andesb2b.model.Dtos.UsuarioDto;
import cl.iplacex.andesb2b.model.Empresa;
import cl.iplacex.andesb2b.model.Rol;
import cl.iplacex.andesb2b.model.Usuario;
import cl.iplacex.andesb2b.repository.EmpresaRepository;
import cl.iplacex.andesb2b.repository.RolRepository;
import cl.iplacex.andesb2b.repository.UsuarioRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class AuthUsuarioService {

    private final UsuarioRepository usuarioRepo;
    private final EmpresaRepository empresaRepo;
    private final RolRepository rolRepo;
    private final PasswordEncoder passwordEncoder;

    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    private static final Pattern EMAIL_REGEX = Pattern.compile(
            "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
    );

    public AuthUsuarioService(UsuarioRepository usuarioRepo, EmpresaRepository empresaRepo,
                              RolRepository rolRepo, PasswordEncoder passwordEncoder) {
        this.usuarioRepo = usuarioRepo;
        this.empresaRepo = empresaRepo;
        this.rolRepo = rolRepo;
        this.passwordEncoder = passwordEncoder;
    }

    public boolean esEmailValido(String email) {
        return email != null && EMAIL_REGEX.matcher(email.trim()).matches();
    }

    public boolean esRutValido(String rut) {
        if (rut == null) return false;
        String limpio = rut.replace(".", "").replace("-", "").trim().toUpperCase();
        if (limpio.length() < 8 || limpio.length() > 9) return false;

        String cuerpo = limpio.substring(0, limpio.length() - 1);
        char dvIngresado = limpio.charAt(limpio.length() - 1);
        if (!cuerpo.matches("\\d+")) return false;

        int suma = 0;
        int multiplicador = 2;
        for (int i = cuerpo.length() - 1; i >= 0; i--) {
            suma += Character.getNumericValue(cuerpo.charAt(i)) * multiplicador;
            multiplicador = (multiplicador == 7) ? 2 : multiplicador + 1;
        }

        int resto = 11 - (suma % 11);
        char dvEsperado = (resto == 11) ? '0' : (resto == 10) ? 'K' : (char) ('0' + resto);
        return dvIngresado == dvEsperado;
    }

    @Transactional(readOnly = true)
    public Usuario autenticarEntidad(String email, String password) {
        if (!esEmailValido(email)) {
            throw new IllegalArgumentException("El formato del correo electrónico no es válido.");
        }
        Usuario u = usuarioRepo.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new IllegalArgumentException("Credenciales inválidas o correo no registrado."));
        if (!Boolean.TRUE.equals(u.getActivo())) {
            throw new IllegalArgumentException("La cuenta de usuario se encuentra suspendida.");
        }
        if (password == null || !passwordEncoder.matches(password, u.getPasswordHash())) {
            throw new IllegalArgumentException("Contraseña incorrecta.");
        }
        return u;
    }

    @Transactional(readOnly = true)
    public UsuarioDto obtenerPerfilActual(Integer idUsuario) {
        Usuario u = usuarioRepo.findById(idUsuario)
                .orElseThrow(() -> new IllegalArgumentException("Sesión no válida."));
        return UsuarioDto.from(u);
    }

    @Transactional
    public UsuarioDto registrarEmpresaYAdmin(Map< String, String > datos) {
        String rutEmpresa = datos.get("rutEmpresa");
        String rutUsuario = datos.get("rutUsuario");
        String email = datos.get("email") != null ? datos.get("email").trim().toLowerCase() : "";

        if (!esRutValido(rutEmpresa)) {
            throw new IllegalArgumentException("El RUT de la empresa no es válido (Módulo 11).");
        }
        if (!esRutValido(rutUsuario)) {
            throw new IllegalArgumentException("El RUT del representante no es válido (Módulo 11).");
        }
        if (!esEmailValido(email)) {
            throw new IllegalArgumentException("El correo electrónico debe incluir '@' y un dominio válido.");
        }
        if (empresaRepo.existsByRutEmpresa(rutEmpresa)) {
            throw new IllegalArgumentException("El RUT de la empresa ya se encuentra registrado.");
        }
        if (usuarioRepo.existsByRutUsuario(rutUsuario)) {
            throw new IllegalArgumentException("El RUT del representante ya se encuentra registrado.");
        }
        if (usuarioRepo.existsByEmail(email)) {
            throw new IllegalArgumentException("El correo electrónico ya está en uso.");
        }

        Empresa emp = new Empresa();
        emp.setRutEmpresa(rutEmpresa);
        emp.setRazonSocial(datos.get("razonSocial"));
        emp.setGiro(datos.get("giro"));
        emp.setRegion(datos.get("region"));
        emp.setDireccion(datos.get("direccion"));
        emp = empresaRepo.save(emp);

        Rol rolAdmin = rolRepo.findByNombreRol("Administrador")
                .orElseThrow(() -> new IllegalStateException("Rol Administrador no existe en la base de datos."));

        Usuario admin = new Usuario();
        admin.setEmpresa(emp);
        admin.setRol(rolAdmin);
        admin.setRutUsuario(rutUsuario);
        admin.setNombreCompleto(datos.get("nombreCompleto"));
        admin.setEmail(email);
        admin.setPasswordHash(passwordEncoder.encode(datos.get("password")));
        admin.setActivo(true);

        return UsuarioDto.from(usuarioRepo.save(admin));
    }

    @Transactional
    public String generarTokenRecuperacion(String email) {
        if (!esEmailValido(email)) {
            throw new IllegalArgumentException("Ingresa un correo electrónico válido.");
        }
        Usuario u = usuarioRepo.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new IllegalArgumentException("No existe una cuenta asociada a ese correo."));
        String token = "REC-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        u.setTokenRecuperacion(token);
        usuarioRepo.save(u);
        return token;
    }

    @Transactional
    public void restablecerPassword(String email, String token, String nuevaPassword) {
        Usuario u = usuarioRepo.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new IllegalArgumentException("Correo no encontrado."));
        if (u.getTokenRecuperacion() == null || !u.getTokenRecuperacion().equals(token)) {
            throw new IllegalArgumentException("Código de verificación inválido o expirado.");
        }
        u.setPasswordHash(passwordEncoder.encode(nuevaPassword));
        u.setTokenRecuperacion(null);
        usuarioRepo.save(u);
    }

    @Transactional(readOnly = true)
    public List< UsuarioDto > listarPorMiEmpresa(UsuarioPrincipal sesion) {
        return usuarioRepo.findByEmpresaIdEmpresa(sesion.idEmpresa())
                .stream().map(UsuarioDto::from).toList();
    }

    @Transactional
    public UsuarioDto crearUsuarioEnMiEmpresa(UsuarioPrincipal sesion, Map< String, String > datos) {
        if (sesion == null || !"Administrador".equals(sesion.rol())) {
            throw new SecurityException("Solo el Administrador puede registrar usuarios en la empresa.");
        }
        Empresa emp = empresaRepo.findById(sesion.idEmpresa())
                .orElseThrow(() -> new IllegalArgumentException("Empresa no encontrada."));

        String nombreCompleto = datos.get("nombreCompleto") != null ? datos.get("nombreCompleto").trim() : "";
        if (nombreCompleto.isEmpty()) {
            throw new IllegalArgumentException("El nombre completo del usuario es obligatorio.");
        }

        String rutUsuario = datos.get("rutUsuario") != null ? datos.get("rutUsuario").trim() : "";
        if (!esRutValido(rutUsuario)) {
            throw new IllegalArgumentException("El RUT del usuario no cumple con el dígito verificador Módulo 11.");
        }
        if (usuarioRepo.existsByRutUsuarioIgnoreCase(rutUsuario)) {
            throw new IllegalArgumentException("El RUT ingresado ya está registrado por otro usuario.");
        }

        String email = datos.get("email") != null ? datos.get("email").trim().toLowerCase() : "";
        if (email.isEmpty() || usuarioRepo.findByEmail(email).isPresent()) {
            throw new IllegalArgumentException("El correo electrónico es inválido o ya se encuentra registrado.");
        }

        String password = datos.get("password");
        if (password == null || password.trim().length() < 6) {
            throw new IllegalArgumentException("La contraseña inicial es obligatoria y debe tener al menos 6 caracteres.");
        }

        Rol rol = rolRepo.findByNombreRol(datos.get("nombreRol"))
                .orElseThrow(() -> new IllegalArgumentException("Rol inválido."));

        Usuario nuevo = new Usuario();
        nuevo.setEmpresa(emp);
        nuevo.setRol(rol);
        nuevo.setNombreCompleto(nombreCompleto);
        nuevo.setRutUsuario(rutUsuario);
        nuevo.setEmail(email);
        nuevo.setPasswordHash(passwordEncoder.encode(password));
        nuevo.setActivo(true);

        return UsuarioDto.from(usuarioRepo.save(nuevo));
    }

    @Transactional
    public UsuarioDto actualizarUsuarioDeMiEmpresa(UsuarioPrincipal sesion, Integer idUsuario, Map< String, Object > datos) {
        if (sesion == null || !"Administrador".equals(sesion.rol())) {
            throw new SecurityException("Solo el Administrador puede gestionar usuarios de la empresa.");
        }

        Usuario u = usuarioRepo.findById(idUsuario)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado."));

        if (!u.getEmpresa().getIdEmpresa().equals(sesion.idEmpresa())) {
            throw new SecurityException("No puedes modificar usuarios pertenecientes a otra empresa.");
        }

        if (datos.get("nombreCompleto") != null && !datos.get("nombreCompleto").toString().isBlank()) {
            u.setNombreCompleto(datos.get("nombreCompleto").toString().trim());
        }

        if (datos.get("rutUsuario") != null && !datos.get("rutUsuario").toString().isBlank()) {
            String nuevoRut = datos.get("rutUsuario").toString().trim();
            if (!esRutValido(nuevoRut)) {
                throw new IllegalArgumentException("El RUT ingresado no es válido según el algoritmo Módulo 11.");
            }
            if (usuarioRepo.existsByRutUsuarioIgnoreCaseAndIdUsuarioNot(nuevoRut, u.getIdUsuario())) {
                throw new IllegalArgumentException("El RUT ingresado ya pertenece a otro usuario registrado.");
            }
            u.setRutUsuario(nuevoRut);
        }

        if (datos.get("email") != null && !datos.get("email").toString().isBlank()) {
            String nuevoEmail = datos.get("email").toString().trim().toLowerCase();
            if (!nuevoEmail.equalsIgnoreCase(u.getEmail()) && usuarioRepo.findByEmail(nuevoEmail).isPresent()) {
                throw new IllegalArgumentException("El correo electrónico ya está registrado por otro usuario.");
            }
            u.setEmail(nuevoEmail);
        }

        if (datos.get("nombreRol") != null && !datos.get("nombreRol").toString().isBlank()) {
            String nuevoRolNombre = datos.get("nombreRol").toString().trim();
            if (u.getIdUsuario().equals(sesion.idUsuario()) && !"Administrador".equals(nuevoRolNombre)) {
                throw new IllegalArgumentException("No puedes quitarte a ti mismo el rol de Administrador.");
            }
            Rol nuevoRol = rolRepo.findByNombreRol(nuevoRolNombre)
                    .orElseThrow(() -> new IllegalArgumentException("Rol no válido: " + nuevoRolNombre));
            u.setRol(nuevoRol);
        }

        if (datos.get("password") != null && !datos.get("password").toString().isBlank()) {
            String nuevaPass = datos.get("password").toString();
            if (nuevaPass.length() < 6) {
                throw new IllegalArgumentException("La contraseña debe tener al menos 6 caracteres.");
            }
            u.setPasswordHash(passwordEncoder.encode(nuevaPass));
        }

        if (datos.containsKey("activo")) {
            boolean nuevoEstado = Boolean.parseBoolean(datos.get("activo").toString());
            if (u.getIdUsuario().equals(sesion.idUsuario()) && !nuevoEstado) {
                throw new IllegalArgumentException("Por seguridad, no puedes desactivar tu propia cuenta en sesión.");
            }
            u.setActivo(nuevoEstado);
        }

        return UsuarioDto.from(usuarioRepo.save(u));
    }

    @Transactional
    public void eliminarUsuarioDeMiEmpresa(UsuarioPrincipal sesion, Integer idUsuario) {
        if (sesion == null || !"Administrador".equals(sesion.rol())) {
            throw new SecurityException("Solo el Administrador puede eliminar usuarios.");
        }

        Usuario u = usuarioRepo.findById(idUsuario)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado."));

        if (!u.getEmpresa().getIdEmpresa().equals(sesion.idEmpresa())) {
            throw new SecurityException("No tienes permiso para eliminar usuarios de otra empresa.");
        }
        if (u.getIdUsuario().equals(sesion.idUsuario())) {
            throw new IllegalArgumentException("Por seguridad, no puedes eliminar tu propia cuenta en sesión.");
        }

        if (entityManager != null) {
            Long tienePedidos = entityManager.createQuery(
                    "SELECT COUNT(p) FROM Pedido p WHERE p.usuarioComprador.idUsuario = :id", Long.class)
                    .setParameter("id", idUsuario)
                    .getSingleResult();

            if (tienePedidos != null && tienePedidos > 0) {
                throw new IllegalArgumentException(
                    "El usuario '" + u.getNombreCompleto() + "' registra órdenes de compra históricas y no puede borrarse físicamente. Utiliza 'Desactivar'."
                );
            }

            Long tieneAuditoria = entityManager.createQuery(
                    "SELECT COUNT(l) FROM LogAuditoriaPrecio l WHERE l.usuario.idUsuario = :id", Long.class)
                    .setParameter("id", idUsuario)
                    .getSingleResult();

            if (tieneAuditoria != null && tieneAuditoria > 0) {
                throw new IllegalArgumentException(
                    "El usuario '" + u.getNombreCompleto() + "' figura como responsable en el historial inmutable de Auditoría de Precios. Utiliza 'Desactivar' para conservar la trazabilidad."
                );
            }
        }

        usuarioRepo.delete(u);
    }

    @Transactional
    public void cambiarPasswordEnSesion(UsuarioPrincipal sesion, String passwordActual, String nuevaPassword) {
        if (nuevaPassword == null || nuevaPassword.length() < 6) {
            throw new IllegalArgumentException("La nueva contraseña debe tener al menos 6 caracteres.");
        }
        Usuario u = usuarioRepo.findById(sesion.idUsuario())
                .orElseThrow(() -> new IllegalArgumentException("Usuario en sesión no encontrado."));

        if (passwordActual == null || !passwordEncoder.matches(passwordActual, u.getPasswordHash())) {
            throw new IllegalArgumentException("La contraseña actual ingresada es incorrecta.");
        }
        u.setPasswordHash(passwordEncoder.encode(nuevaPassword));
        usuarioRepo.save(u);
    }

    @Transactional
    public EmpresaDto actualizarDatosMiEmpresa(UsuarioPrincipal sesion, Map<String, String> datos) {
        if (!"Administrador".equals(sesion.rol())) {
            throw new IllegalArgumentException("Solo el Administrador puede modificar los datos comerciales de la empresa.");
        }
        Empresa emp = empresaRepo.findById(sesion.idEmpresa())
                .orElseThrow(() -> new IllegalArgumentException("Empresa no encontrada."));

        if (datos.get("giro") != null && !datos.get("giro").isBlank()) {
            emp.setGiro(datos.get("giro").trim());
        }
        if (datos.get("region") != null && !datos.get("region").isBlank()) {
            emp.setRegion(datos.get("region").trim());
        }
        if (datos.get("direccion") != null && !datos.get("direccion").isBlank()) {
            emp.setDireccion(datos.get("direccion").trim());
        }
        return EmpresaDto.from(empresaRepo.save(emp));
    }
}