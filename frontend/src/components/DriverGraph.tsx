// src/components/DriverGraph.tsx

import { useEffect, useState, useRef } from 'react';
import cytoscape, { Core, EventObject, NodeSingular } from 'cytoscape';
import CytoscapeComponent from 'react-cytoscapejs';
import coseBilkent from 'cytoscape-cose-bilkent';
import { NodeData, EdgeData, YearsByCtor } from './types';

cytoscape.use(coseBilkent);

/* GLOBAL CONSTANTS */
const DEFAULT_MIN_DISPLAY_YEAR = 2020;
const DEFAULT_MAX_DISPLAY_YEAR = new Date().getFullYear();
const DEFAULT_MIN_DISPLAY_RACE_COUNT = 10;

const ctorColorMap: Record<string, string> = {
  Ferrari: '#ff2800',
  Mercedes: '#00D7B6',
  'Red Bull': '#0600ef',
  'Haas F1 Team': '#9C9FA2',
  'RB F1 Team': '#6C98FF',
  'Alpine F1 Team': '#00A1E8',
  'Aston Martin': '#229971',
  Sauber: '#01C00E',
  Williams: '#1868DB',
  McLaren: '#F47600',
  Renault: '#FFF500',
  'Force India': '#F596C8',
  'Alfa Romeo': '#981E32',
};

/* HELPER FUNCTIONS */
// TODO: Consider moving these to another file

// getMostCommonCtor(yearsByCtor, yearMin, yearMax)
//    returns the ctor with the most years in [yearMin, yearMax]
//    picks the most recent ctor in the case of a tie
function getMostCommonCtor(
  yearsByCtor: YearsByCtor[],
  yearMin: number = 0,
  yearMax: number = 9999
): string {
  let defaultCtor: string = 'DEFAULT_CTOR';
  if (yearsByCtor.length !== 0) {
    defaultCtor = yearsByCtor.at(-1)!.ctor;
    let maxCount = yearsByCtor
      .at(-1)!
      .years.filter((year) => yearMin <= year && year <= yearMax).length;

    for (let i = yearsByCtor.length - 2; i >= 0; --i) {
      let count = yearsByCtor[i].years.filter(
        (year) => yearMin <= year && year <= yearMax
      ).length;
      if (count > maxCount) {
        maxCount = count;
        defaultCtor = yearsByCtor[i].ctor;
      }
    }
  }

  return defaultCtor;
}

// updateNodeVisibility(cy, minRaceCount, minYear, maxYear)
//  Changes node visibility based on parameters
//    Visible nodes must have at least one active year in [minYear, maxYear],
//      and must have at least minRaceCount races (overall, not in year range)
//  Also updates which displayCtor (used for coloring)
function updateNodeVisibility(
  cy: cytoscape.Core,
  minRaceCount: number,
  minYear: number,
  maxYear: number
): void {
  cy.nodes().forEach((node: NodeSingular) => {
    const ctor: string = getMostCommonCtor(
      node.data('yearsByCtor'),
      minYear,
      maxYear
    );
    node.data('displayCtor', ctor);

    const yearsActive: number[] = node.data('yearsActive');
    const raceCount: number = node.data('raceCount');

    const visible =
      yearsActive.some(
        (year) => minYear <= year && year <= maxYear
      ) && raceCount >= minRaceCount;

    if (visible) {
      node.show();
    } else {
      node.hide();
    }
  });
}
export default function DriverGraph() {
  const [elements, setElements] = useState<(NodeData | EdgeData)[]>([]);
  const [selectedInfo, setSelectedInfo] = useState<string | null>(null);
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [minDisplayYear, setMinDisplayYear] = useState(
    DEFAULT_MIN_DISPLAY_YEAR
  );
  const [maxDisplayYear, setMaxDisplayYear] = useState(
    DEFAULT_MAX_DISPLAY_YEAR
  );
  const [minDisplayRaceCount, setMinDisplayRaceCount] = useState(
    DEFAULT_MIN_DISPLAY_RACE_COUNT
  );
  const cyRef = useRef<Core | null>(null);

  // initial graph fetch
  useEffect(() => {
    fetch('/graph')
      .then((res) => res.json())
      .then((data) => setElements([...data.nodes, ...data.edges]))
      .catch((err) => console.error('Error fetching graph:', err));
  }, []);

  // setup edge/node labelling and styles. This should only run once (when all elements are added)
  // TODO: Can we move this to the cy.ready() call?
  useEffect(() => {
    if (cyRef.current && elements.length > 0) {
      const cy = cyRef.current;

      // compute the size needed for circles
      // TODO: Remove magic numbers / refine this
      const length = 3;
      const fontSize = 14;
      const charWidth = fontSize * 0.6; // rough average
      const textWidth = length * charWidth;
      const textHeight = fontSize * 1.25; // account for vertical padding
      const diameter = Math.max(textWidth, textHeight) + 30; // add padding

      // cose-bilkent default options
      const coseBilkentDefaultOptions = {
        quality: 'default',
        // Whether to include labels in node dimensions. Useful for avoiding label overlap
        nodeDimensionsIncludeLabels: true,
        // number of ticks per frame; higher is faster but more jerky
        refresh: 30,
        // Whether to fit the network view after when done
        fit: true,
        // Padding on fit
        padding: 30,
        // Whether to enable incremental mode
        randomize: false,
        // Node repulsion (non overlapping) multiplier (default 4500, might need to bump higher with more nodes)
        nodeRepulsion: 10000,
        // Ideal (intra-graph) edge length
        idealEdgeLength: 100,
        // Divisor to compute edge forces
        edgeElasticity: 0.45,
        // Nesting factor (multiplier) to compute ideal edge length for inter-graph edges
        nestingFactor: 0.1,
        // Gravity force (constant), default 0.25
        gravity: 0.1,
        // Maximum number of iterations to perform
        numIter: 2500,
        // Whether to tile disconnected nodes
        tile: true,
        // Type of layout animation. The option set is {'during', 'end', false}
        animate: false,
        // Duration for animate:end
        animationDuration: 500,
        // Amount of vertical space to put between degree zero nodes during tiling (can also be a function)
        tilingPaddingVertical: 10,
        // Amount of horizontal space to put between degree zero nodes during tiling (can also be a function)
        tilingPaddingHorizontal: 10,
        // Gravity range (constant) for compounds
        gravityRangeCompound: 1.5,
        // Gravity force (constant) for compounds
        gravityCompound: 1.0,
        // Gravity range (constant)
        gravityRange: 3.8,
        // Initial cooling factor for incremental layout
        initialEnergyOnIncremental: 0.5,
        spacingFactor: 1.25,
        nodeOverlap: diameter,
      };

      cy.layout({
        name: 'cose-bilkent',
        ...coseBilkentDefaultOptions,
      }).run();

      cy.nodes().forEach((node) => {
        node.style({
          width: diameter,
          height: diameter,
        });
      });
    }
  }, [elements]);

  // handle driver selection
  // TODO: Bug where if a driver is selected but then the year range changes, they are still selected
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().removeClass('highlighted faded');

    if (selectedDrivers.length === 1) {
      const driverId = selectedDrivers.at(0)!;
      const node = cy.getElementById(driverId);
      node.addClass('highlighted');
      // const years_active = node.data('years_active').join(', ');
      // setSelectedInfo(
      //   `Selected: ${node.data('name')}, active during ${years_active}`
      // );
      const label = node
        .data('yearsByCtor')
        .map((pair: YearsByCtor) => `${pair.ctor}[${pair.years.join(' ,')}]`)
        .join(', ');
      setSelectedInfo(`Selected: ${node.data('name')}, raced for ${label}`);
    } else if (selectedDrivers.length === 2) {
      highlightShortestPathInBrowser(selectedDrivers[0], selectedDrivers[1]);
    } else if (selectedDrivers.length === 3) {
      setSelectedDrivers([selectedDrivers.at(-1)!]);
    } else {
      // selectedDrivers === 0
      return;
    }
  }, [selectedDrivers]);

  // update visible nodes on year range change
  useEffect(() => {
    if (cyRef.current) {
      updateNodeVisibility(
        cyRef.current,
        minDisplayRaceCount,
        minDisplayYear,
        maxDisplayYear
      );
      return;
    }
  }, [minDisplayYear, maxDisplayYear, minDisplayRaceCount]);

  //

  // compute shortest path between two drivers, and highlight nodes and edges on path
  // TODO: What if there are multiple shortest paths of same length?
  function highlightShortestPathInBrowser(
    sourceId: string,
    targetId: string
  ): void {
    const cy = cyRef.current;
    if (!cy) return;

    // Clear previous highlighting
    cy.elements().removeClass('highlighted faded');

    // Use built-in Dijkstra (or use .aStar() if you want heuristics)
    const dijkstra = cy.elements().dijkstra({ root: `#${sourceId}` });
    const path = dijkstra.pathTo(cy.getElementById(targetId));

    if (path.length === 0) {
      alert('No path found.');
      return;
    }

    // Highlight the path
    path.addClass('highlighted');

    // Fade everything else
    cy.elements().not(path).addClass('faded');

    // Optional: show number of steps
    const sourceName: string = cy.getElementById(`${sourceId}`).data('name');
    const targetName: string = cy.getElementById(`${targetId}`).data('name');
    setSelectedInfo(
      `Shortest path from ${sourceName} to ${targetName} is ${Math.floor(
        path.length / 2
      )} steps`
    );

    const parts = [];

    for (var i = 0; i < path.length; ++i) {
      const ele = path[i];
      if (ele.isNode()) {
        parts.push(ele.data('name'));
      }
      if (ele.isEdge()) {
        // TODO: update this to be correct for the given year (maybe this is already handled with how label is set)
        parts.push(ele.data('label'));
      }
    }
    const pathString = parts.join(' -> ');
    console.log(pathString);
    setSelectedInfo(pathString);
  }

  // return (
  //   <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
  //     <CytoscapeComponent
  //       elements={elements}
  //       style={{ width: '100%', height: '95%' , 'background-color': '#f4f4f4'}}
  //       stylesheet={[
  //         {
  //           selector: 'node',
  //           style: {
  //             'background-color': (ele: NodeSingular) =>
  //               ctorColors[ele.data('displayCtor')] || '#0074D9',
  //             label: 'data(codename)',
  //             color: '#000',
  //             shape: 'ellipse',
  //             'text-valign': 'center',
  //             'text-halign': 'center',
  //             'font-size': '14px',
  //             'text-margin-y': '5px',
  //             'text-max-width': '100px',
  //             'border-width': 2,
  //             'border-color': '#000', // black outline
  //             'border-opacity': 1,
  //           },
  //         },
  //         {
  //           selector: 'edge',
  //           style: {
  //             width: 4,
  //             'line-color': '#aaa',
  //             'target-arrow-color': '#aaa',
  //             // label: 'data(label)',
  //             'font-size': 12,
  //             'text-rotation': 'autorotate',
  //           },
  //         },
  //         {
  //           selector: '.highlighted',
  //           style: {
  //             'background-color': '#FF4136',
  //             'line-color': '#FF4136',
  //             'target-arrow-color': '#FF4136',
  //             'transition-property': 'background-color, line-color',
  //             'transition-duration': '0.3s',
  //           },
  //         },

  //         // 🌫️ Faded nodes and edges
  //         {
  //           selector: '.faded',
  //           style: {
  //             opacity: 0.8,
  //             'text-opacity': 0.8,
  //           },
  //         },
  //       ]}
  //       cy={(cy: Core) => {
  //         cyRef.current = cy;

  //         if ((cy as any)._driverGraphEventsBound !== true) {
  //           (cy as any)._driverGraphEventsBound = true; // gaurd against binding duplicate listeners
  //           cy.on('tap', 'edge', (event: EventObject) => {
  //             const edge = event.target;
  //             const source = edge.source().data('name') || edge.source().id();
  //             const target = edge.target().data('name') || edge.target().id();
  //             const label = edge
  //               .data('yearsByCtor')
  //               .map(
  //                 (pair: YearsByCtor) =>
  //                   `${pair.ctor}[${pair.years.join(' ,')}]`
  //               )
  //               .join(', ');

  //             setSelectedInfo(
  //               `${source} & ${target} were teammates at ${label}`
  //             );
  //           });

  //           cy.on('tap', (event) => {
  //             if (event.target === cy) {
  //               cy.elements().removeClass('faded highlighted');
  //               setSelectedInfo(null);
  //               setSelectedDrivers([]);
  //             }
  //           });

  //           cy.on('tap', 'node', (event: EventObject) => {
  //             const node = event.target;
  //             const driverId = node.id();

  //             // toggle driver selection
  //             setSelectedDrivers((prev) =>
  //               prev.includes(driverId)
  //                 ? prev.filter((item) => item !== driverId)
  //                 : [...prev, driverId]
  //             );
  //             return;
  //           });
  //         }
  //       }}
  //     />
  //     {(
  //       <div
  //         style={{
  //           padding: '1rem',
  //           background: '#f4f4f4',
  //           textAlign: 'center',
  //         }}
  //       >
  //         {selectedInfo}
  //       </div>
  //     )}
  //   </div>
  // );
  return (
    <div
      style={{
        display: 'flex',
        height: '100vh', // full screen height
      }}
    >
      {/* Graph */}
      <div style={{ flex: 1 }}>
        <CytoscapeComponent
          elements={elements}
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#f4f4f4',
          }}
          stylesheet={[
            {
              selector: 'node',
              style: {
                backgroundColor: (ele: NodeSingular) =>
                  ctorColorMap[ele.data('displayCtor')] || '#0074D9',
                label: 'data(codename)',
                color: '#000',
                shape: 'ellipse',
                'text-valign': 'center',
                'text-halign': 'center',
                'font-size': '14px',
                'text-margin-y': '5px',
                'text-max-width': '100px',
                'border-width': 2,
                'border-color': '#000', // black outline
                'border-opacity': 1,
              },
            },
            {
              selector: 'edge',
              style: {
                width: 4,
                'line-color': '#aaa',
                'target-arrow-color': '#aaa',
                // label: 'data(label)',
                'font-size': 12,
                'text-rotation': 'autorotate',
              },
            },
            {
              selector: '.highlighted',
              style: {
                backgroundColour: '#FF4136',
                'line-color': '#FF4136',
                'target-arrow-color': '#FF4136',
                'transition-property': 'background-color, line-color',
                'transition-duration': '0.3s',
              },
            },

            // 🌫️ Faded nodes and edges
            {
              selector: '.faded',
              style: {
                opacity: 0.8,
                'text-opacity': 0.8,
              },
            },
          ]}
          cy={(cy: Core) => {
            cyRef.current = cy;
            cy.ready(() => {
              updateNodeVisibility(
                cy,
                minDisplayRaceCount,
                minDisplayYear,
                maxDisplayYear
              );
            });

            if ((cy as any)._driverGraphEventsBound !== true) {
              (cy as any)._driverGraphEventsBound = true; // gaurd against binding duplicate listeners
              cy.on('tap', 'edge', (event: EventObject) => {
                const edge = event.target;
                const source = edge.source().data('name') || edge.source().id();
                const target = edge.target().data('name') || edge.target().id();
                const label = edge
                  .data('yearsByCtor')
                  .map(
                    (pair: YearsByCtor) =>
                      `${pair.ctor}[${pair.years.join(' ,')}]`
                  )
                  .join(', ');

                setSelectedInfo(
                  `${source} & ${target} were teammates at ${label}`
                );
              });

              cy.on('tap', (event) => {
                if (event.target === cy) {
                  cy.elements().removeClass('faded highlighted');
                  setSelectedInfo(null);
                  setSelectedDrivers([]);
                }
              });

              cy.on('tap', 'node', (event: EventObject) => {
                const node = event.target;
                const driverId = node.id();

                // toggle driver selection
                setSelectedDrivers((prev) =>
                  prev.includes(driverId)
                    ? prev.filter((item) => item !== driverId)
                    : [...prev, driverId]
                );
                return;
              });
            }
          }}
        />
      </div>

      {/* Display Panel*/}
      <div
        style={{
          width: '25%', // quarter width
          backgroundColor: '#fafafa',
          borderLeft: '1px solid #ddd',
          padding: '1rem',
          overflowY: 'auto',
        }}
      >
        <h2
          style={{
            fontSize: '1.2rem',
            fontWeight: 'bold',
            marginBottom: '0.5rem',
            textAlign: 'center',
          }}
        >
          Equal Machinery
        </h2>
        {selectedInfo}

        <div style={{ marginBottom: '1rem' }}>
          <label>Min Value:</label>
          <input
            type="number"
            value={minDisplayYear}
            onChange={(e) => setMinDisplayYear(Number(e.target.value))}
            style={{ width: '25%', padding: '0.5rem', marginTop: '0.25rem' }}
          />
        </div>

        <div>
          <label>Max Value:</label>
          <input
            type="number"
            value={maxDisplayYear}
            onChange={(e) => setMaxDisplayYear(Number(e.target.value))}
            style={{ width: '25%', padding: '0.5rem', marginTop: '0.25rem' }}
          />
        </div>
      </div>
    </div>
  );
}
