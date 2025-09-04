declare module 'cytoscape-cose-bilkent' {
  import cytoscape from 'cytoscape';

  type CoseBilkentLayoutOptions = cytoscape.LayoutOptions & {
    name: 'cose-bilkent';
    // You can add specific Cose-Bilkent options here if needed
    animate?: boolean;
    randomize?: boolean;
    fit?: boolean;
    padding?: number;
    nodeRepulsion?: number | ((node: cytoscape.NodeSingular) => number);
    idealEdgeLength?: number | ((edge: cytoscape.EdgeSingular) => number);
    // ...etc, from the docs (https://github.com/cytoscape/cytoscape.js-cose-bilkent)
  };

  const register: (cytoscape: typeof cytoscape) => void;
  export = register;
}