-- Incluye las visitas sin recolección en el dashboard de Programas.
create or replace view public.vaciados_publico as
  select tablero, edificio, fecha, bolsones, destino
  from public.vaciados;
