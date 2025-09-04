/* CHRONOLOGICAL ORDERING START*/
// Right now this is not being used, because we just do a cose-bilkent layout after
//  But the idea is to arrange nodes chronologically
//  Ideally we would do this initial setup, and then let cose-bilkent move them around a bit
//    But so far trying that has not worked...
const years = cy.nodes().map((n) => Math.min(...n.data('years_active')));
const yearMin = Math.min(...years);
const yearMax = Math.max(...years);
const yearRange = yearMax - yearMin || 1;
const positions: cytoscape.NodePositionMap = {};

cy.nodes().forEach((node, i) => {
  const years: number[] = node.data('years_active') ?? [];
  const driver_start_year = years.length ? Math.min(...years) : yearMin;
  const x = ((driver_start_year - yearMin) / yearRange) * 800;
  const y = Math.random() * 500;
  positions[node.id()] = { x, y };
});

cy.layout({
  name: 'preset',
  positions,
}).run();
/* CHRONOLOGICAL ORDERING END */
