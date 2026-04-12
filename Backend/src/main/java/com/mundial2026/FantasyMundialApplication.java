package com.mundial2026;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableAsync
@EnableScheduling
public class FantasyMundialApplication {

    public static void main(String[] args) {
        SpringApplication.run(FantasyMundialApplication.class, args);
        System.out.println("=== MUNDIAL 2026 Backend iniciado ===");
    }
}
