// El tablero cerro reúne los vaciados de los programas de Municipio A.
(function () {
  const cerro = [
    { nombre: 'Plaza Débora Céspedes', dir: 'EGIPTO esq. SUECIA', color: '#1baf7a' },
    { nombre: 'Federación FOICA', dir: 'HOLANDA 1715', color: '#2a78d6' },
    { nombre: 'Plaza de Deportes N11', dir: 'PORTUGAL esq. AUSTRIA', color: '#eb6834' },
    { nombre: 'Seccional N24', dir: 'PRUSIA 1895', color: '#8b5cf6' },
    { nombre: 'Escuela Luisa Casteran', dir: 'CHINA 1898', color: '#e0457b', escuela: true },
    { nombre: 'Formativas de Rampla', dir: 'TURQUIA 3335', color: '#d99a00' },
    { nombre: 'Club de Pesca', dir: 'GRECIA 3152', color: '#14a3b8' },
    { nombre: 'Escuela N29', dir: 'PORTUGAL 3325', color: '#a0663a', escuela: true },
    { nombre: 'Club Verdirrojo', dir: 'PRUSIA 1621', color: '#5b6b82' },
    { nombre: 'TATA Grecia', dir: 'GRECIA 3396', color: '#65a30d' },
  ];
  const municipios = [
    { nombre: 'A', tablero: 'cerro', destino: 'La Paloma', barrios: [
      { nombre: 'Cerro', programas: [
        { id: 'cerro', nombre: 'Barrios Sustentables', lugares: cerro.filter(l => !l.escuela) },
        { id: 'escuelas', nombre: 'Escuelas Sustentables', lugares: cerro.filter(l => l.escuela) },
      ] },
      { nombre: '3 de Abril', programas: [
        { id: '3-de-abril', nombre: 'Barrios Sustentables', lugares: [
          { nombre: 'Cooperativa Mesa 4', dir: 'Av. Luis Batlle Berres 5870', color: '#1baf7a' },
        ] },
      ] },
      { nombre: 'Las Torres', programas: [
        { id: 'las-torres', nombre: 'Barrios Sustentables', lugares: [
          { nombre: 'Colegio Centro Infantil Kala – Bethuel', dir: 'Av. Cibils 5878', color: '#2a78d6' },
          { nombre: 'Colegio Kala Infantil', dir: 'Fray Luis de León 2458', color: '#eb6834' },
          { nombre: 'Sede Social Las Torres Tomkinson', dir: 'Francisco de Quevedo 6081', color: '#8b5cf6' },
          { nombre: 'CAIF Anacahuita', dir: 'Las Lilas esq. Los Lirios', color: '#e0457b' },
          { nombre: 'Club Baby Fútbol Naranja Mecánica', dir: 'Costanera Parque Tomkinson esq. Los Plátanos', color: '#14a3b8' },
        ] },
        { id: 'escuelas-las-torres', nombre: 'Escuelas Sustentables', lugares: [
          { nombre: 'Escuela 188', dir: 'Camino Cibils 6221 esq. Mirunga', color: '#1baf7a' },
        ] },
      ] },
    ] },
    { nombre: 'B', tablero: 'im', destino: 'Géminis', barrios: [
      { nombre: 'Centro', programas: [
        { id: 'im', nombre: 'Eco Oficinas', lugares: [
          { nombre: 'Edificio IM', dir: 'Av. 18 de Julio 1360', color: '#1baf7a' },
        ] },
      ] },
    ] },
  ];

  function buscar(id) {
    for (const municipio of municipios) for (const barrio of municipio.barrios) for (const p of barrio.programas) {
      if (p.id === id) {
        const titulo = municipio.tablero === 'im' ? p.nombre : `${p.nombre}: ${barrio.nombre}`;
        return { ...p, titulo, tablero: municipio.tablero, destino: municipio.destino };
      }
    }
    return null;
  }

  window.ProgramasCarga = { municipios, buscar, cerro };
})();
