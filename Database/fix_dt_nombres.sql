-- Corrección de DTs desactualizados (API-Football tiene datos viejos para selecciones)
-- DTs reales al 2026

-- Uruguay: Tabárez salió en 2021, Bielsa desde 2023
UPDATE pais SET dt_nombre = 'Marcelo Bielsa', dt_foto_url = 'https://media.api-sports.io/football/coachs/105.png' WHERE codigo = 'URU';

-- Alemania: Löw salió en 2021, Nagelsmann desde 2023
UPDATE pais SET dt_nombre = 'Julian Nagelsmann', dt_foto_url = 'https://media.api-sports.io/football/coachs/1545.png' WHERE codigo = 'GER';

-- Marruecos: Halilhodžić salió en 2022, Regragui desde 2022
UPDATE pais SET dt_nombre = 'Walid Regragui', dt_foto_url = 'https://media.api-sports.io/football/coachs/2645.png' WHERE codigo = 'MAR';

-- Noruega: Lagerbäck salió en 2020, Solbakken desde 2022
UPDATE pais SET dt_nombre = 'Ståle Solbakken', dt_foto_url = 'https://media.api-sports.io/football/coachs/1675.png' WHERE codigo = 'NOR';

-- Suecia: Hamrén salió hace años, Tomasson desde 2024
UPDATE pais SET dt_nombre = 'Jon Dahl Tomasson', dt_foto_url = 'https://media.api-sports.io/football/coachs/7682.png' WHERE codigo = 'SWE';

-- Escocia: McLeish salió hace años, Steve Clarke desde 2019
UPDATE pais SET dt_nombre = 'Steve Clarke', dt_foto_url = 'https://media.api-sports.io/football/coachs/76.png' WHERE codigo = 'SCO';

-- Sudáfrica: Ntseki salió en 2021, Hugo Broos desde 2021
UPDATE pais SET dt_nombre = 'Hugo Broos', dt_foto_url = 'https://media.api-sports.io/football/coachs/2883.png' WHERE codigo = 'RSA';

-- Ghana: Rajevac salió en 2022, Otto Addo asumió como interino y luego DT
UPDATE pais SET dt_nombre = 'Otto Addo', dt_foto_url = 'https://media.api-sports.io/football/coachs/11492.png' WHERE codigo = 'GHA';

-- Senegal: Aliou Cissé fue DT desde 2015 hasta 2024
UPDATE pais SET dt_nombre = 'Pape Thiaw', dt_foto_url = 'https://media.api-sports.io/football/coachs/340.png' WHERE codigo = 'SEN';

-- Bosnia: Hadžibegić salió, Sergej Barbarež desde 2024
UPDATE pais SET dt_nombre = 'Sergej Barbarež', dt_foto_url = 'https://media.api-sports.io/football/coachs/361.png' WHERE codigo = 'BIH';
