package com.mundial2026.service;

import com.mundial2026.model.Usuario;
import com.mundial2026.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Collections;

/**
 * Implementación de UserDetailsService para Spring Security.
 * Busca al usuario por user_name O por email (permite login con cualquiera de los dos).
 */
@Service
@RequiredArgsConstructor
public class UsuarioDetailsService implements UserDetailsService {

    private final UsuarioRepository usuarioRepository;

    @Override
    public UserDetails loadUserByUsername(String identifier) throws UsernameNotFoundException {
        // Intentar por user_name primero, luego por email
        Usuario usuario = usuarioRepository.findByUser(identifier)
                .or(() -> usuarioRepository.findByEmail(identifier))
                .orElseThrow(() -> new UsernameNotFoundException(
                        "Usuario no encontrado: " + identifier
                ));

        return new User(
                usuario.getUser(),
                usuario.getPassword(),
                Collections.emptyList()   // Roles: vacío por ahora, se agrega luego
        );
    }
}
