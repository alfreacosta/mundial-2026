package com.mundial2026.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

@Configuration
@ConfigurationProperties(prefix = "api-football")
public class ApiFootballConfig {

    private String apiKey = "";
    private String baseUrl = "https://v3.football.api-sports.io";
    private int leagueId = 1;       // FIFA World Cup
    private int season = 2026;
    private long cacheTtlMinutes = 5;

    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }

    // Getters y Setters
    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }

    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }

    public int getLeagueId() { return leagueId; }
    public void setLeagueId(int leagueId) { this.leagueId = leagueId; }

    public int getSeason() { return season; }
    public void setSeason(int season) { this.season = season; }

    public long getCacheTtlMinutes() { return cacheTtlMinutes; }
    public void setCacheTtlMinutes(long cacheTtlMinutes) { this.cacheTtlMinutes = cacheTtlMinutes; }
}
