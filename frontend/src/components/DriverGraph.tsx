// src/components/DriverGraph.tsx

import { useEffect, useState, useRef, useMemo } from 'react';
import cytoscape, {
  Core,
  EdgeSingular,
  EventObject,
  NodeSingular,
} from 'cytoscape';
import CytoscapeComponent from 'react-cytoscapejs';
import coseBilkent from 'cytoscape-cose-bilkent';
import { NodeData, EdgeData, YearsByCtor } from './types';
import nodePositions from '../data/nodePositions.json';
import { Range, Direction, getTrackBackground } from 'react-range';

cytoscape.use(coseBilkent);

/* GLOBAL CONSTANTS */
const DEFAULT_MIN_DISPLAY_YEAR = 2020;
const DEFAULT_MAX_DISPLAY_YEAR = new Date().getFullYear();
const DEFAULT_MIN_DISPLAY_RACE_COUNT = 10;
const NODE_HOVER_SCALE = 1.5;
const DEFAULT_NODE_DIAMETER = computeNodeDiameter();
const TIMELINE_MIN_YEAR = 1970;
const TIMELINE_MAX_YEAR = new Date().getFullYear();
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
  'Racing Point': '#F596C8',
  'Toro Rosso': '#469BFF',
  AlphaTauri: '#00293F',
  Jordan: '#ffff00',
  'Manor Marussia': '#db1922',
  Marussia: '#db1922',
  'Lotus F1': '#b39759',
  Toyota: '#db3d4b',
  Ligier: '#0056ba',
  Minardi: '#0000',
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
    node.stop(true);
    node.animate({
      style: {
        backgroundColor: ctorColorMap[node.data('displayCtor')],
      },
      duration: 150,
    });

    const yearsByCtor: YearsByCtor[] = node.data('yearsByCtor');
    if (
      node.data('raceCount') >= minRaceCount &&
      yearsByCtor.some((ctor) =>
        ctor.years.some((year) => minYear <= year && year <= maxYear)
      )
    ) {
      node.show();
    } else {
      node.hide();
    }
  });
  cy.fit(cy.elements(':visible'), 30); // fit to visible elements
  const fitZoom = cy.zoom();
  cy.minZoom(fitZoom * 0.85);
  cy.maxZoom(fitZoom * 5);
}

// computes node diameter for styling
// TODO: Right now this is literally just a constant, maybe switch to parameters with defaults?
function computeNodeDiameter(): number {
  const length = 3;
  const fontSize = 14;
  const charWidth = fontSize * 0.6; // rough average
  const textWidth = length * charWidth;
  const textHeight = fontSize * 1.25; // account for vertical padding
  return Math.max(textWidth, textHeight) + 30; // add padding
}

// The main function to export the component
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
  const [sliderThumbValues, setSliderThumbValues] = useState([2020, 2025]); // initial slider values
  const cyRef = useRef<Core | null>(null);

  // saves current node positions to JSON file.
  //  used to tweak layout for preset
  function savePositions() {
    const cy = cyRef.current;
    if (!cy) return;

    const positions = cy.nodes().reduce((acc, node) => {
      acc[node.id()] = node.position(); // { x, y }
      return acc;
    }, {} as Record<string, { x: number; y: number }>);

    // Print to console so you can copy/paste into a JSON file
    // console.log(JSON.stringify(positions, null, 2));

    // Download as JSON file directly
    const blob = new Blob([JSON.stringify(positions, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nodePositions.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  // initial graph fetch
  useEffect(() => {
    fetch('/graph')
      .then((res) => res.json())
      .then((data) => setElements([...data.nodes, ...data.edges]))
      .catch((err) => console.error('Error fetching graph:', err));
  }, []);

  // run layout when elements are all loaded
  useEffect(() => {
    if (cyRef.current && elements.length > 0) {
      const cy = cyRef.current;

      const layout = cy.layout({
        name: 'preset',
        positions: nodePositions,
      });

      layout.on('layoutstop', () => {
        cy.fit(cy.elements(':visible'), 30);
        const fitZoom = cy.zoom();
        cy.minZoom(fitZoom * 0.85);
        cy.maxZoom(fitZoom * 5);
      });

      layout.run();

      // cose-bilkent default options
      // const coseBilkentDefaultOptions = {
      //   quality: 'default',
      //   // Whether to include labels in node dimensions. Useful for avoiding label overlap
      //   nodeDimensionsIncludeLabels: true,
      //   // number of ticks per frame; higher is faster but more jerky
      //   refresh: 30,
      //   // Whether to fit the network view after when done
      //   fit: true,
      //   // Padding on fit
      //   padding: 30,
      //   // Whether to enable incremental mode
      //   randomize: false,
      //   // Node repulsion (non overlapping) multiplier (default 4500, might need to bump higher with more nodes)
      //   nodeRepulsion: 1000,
      //   // Ideal (intra-graph) edge length
      //   idealEdgeLength: 200,
      //   // Divisor to compute edge forces
      //   edgeElasticity: 0.45,
      //   // Nesting factor (multiplier) to compute ideal edge length for inter-graph edges
      //   nestingFactor: 0.1,
      //   // Gravity force (constant), default 0.25
      //   gravity: 0.1,
      //   // Maximum number of iterations to perform
      //   numIter: 2500,
      //   // Whether to tile disconnected nodes
      //   tile: true,
      //   // Type of layout animation. The option set is {'during', 'end', false}
      //   animate: false,
      //   // Duration for animate:end
      //   animationDuration: 500,
      //   // Amount of vertical space to put between degree zero nodes during tiling (can also be a function)
      //   tilingPaddingVertical: 10,
      //   // Amount of horizontal space to put between degree zero nodes during tiling (can also be a function)
      //   tilingPaddingHorizontal: 10,
      //   // Gravity range (constant) for compounds
      //   gravityRangeCompound: 1.5,
      //   // Gravity force (constant) for compounds
      //   gravityCompound: 1.0,
      //   // Gravity range (constant)
      //   gravityRange: 3.8,
      //   // Initial cooling factor for incremental layout
      //   initialEnergyOnIncremental: 0.5,
      //   spacingFactor: 1.25,
      //   // nodeOverlap: diameter,
      // };

      // // layout using force directed algorithm (slow for entire graph)
      // cy.layout({
      //   name: 'cose-bilkent',
      //   ...coseBilkentDefaultOptions,
      // }).run();
    }
  }, [elements]);

  // handle driver selection
  // TODO: Bug where if a driver is selected but then the year range changes, they are still selected
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().removeClass('highlighted faded');

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

  // // update visible nodes on year range change
  useEffect(() => {
    const cy = cyRef.current;
    if (cy) {
      updateNodeVisibility(
        cy,
        minDisplayRaceCount,
        minDisplayYear,
        maxDisplayYear
      );

      cy.edges().forEach((edge: EdgeSingular) => {
        const ctor: string = getMostCommonCtor(
          edge.data('yearsByCtor'),
          minDisplayYear,
          maxDisplayYear
        );

        edge.data('label', ctor);
      });
    }
  }, [minDisplayYear, maxDisplayYear, minDisplayRaceCount, elements]);

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

    const sourceName: string = cy.getElementById(`${sourceId}`).data('name');
    const targetName: string = cy.getElementById(`${targetId}`).data('name');

    console.log(path[0].data('name'));

    // check if path was not found
    if (path.length === 1) {
      setSelectedInfo(`No path from ${sourceName} to ${targetName}`);
      return;
    }

    // Highlight the path
    path.addClass('highlighted');

    // Fade everything else
    cy.elements().not(path).addClass('faded');

    // Show number of steps
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
        parts.push('NO_TEAM');
      }
    }
    const pathString = parts.join(' -> ');
    console.log(pathString);
    setSelectedInfo(pathString);
  }

  const cyStylesheet = useMemo(
    () => [
      {
        selector: 'node',
        style: {
          backgroundColor: (ele: NodeSingular) =>
            ctorColorMap[ele.data('displayCtor')] || '#FFFF',
          label: 'data(codename)',
          color: 'white',
          'text-outline-color': 'black',
          'text-outline-width': 2,
          shape: 'ellipse',
          width: DEFAULT_NODE_DIAMETER,
          height: DEFAULT_NODE_DIAMETER,
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '14px',
          'text-margin-y': '5px',
          'text-max-width': '100px',
          'border-width': 4,
          'border-color': '#0000',
          'border-opacity': 1,
        },
      },
      {
        selector: 'node.hovered',
        style: {},
      },
      {
        selector: 'edge',
        style: {
          width: 4,
          'line-color': '#aaa',
          'target-arrow-color': '#aaa',
          'font-size': 12,
          'text-rotation': 'autorotate',
          color: 'white',
          'text-outline-color': 'black',
          'text-outline-width': 2,
        },
      },
      {
        selector: 'edge.highlighted',
        style: {
          width: 16,
          label: 'data(label)',
          'transition-property': 'background-color, line-color',
          'transition-duration': '0.3s',
          'z-index': 9999,
          'line-color': (ele: EdgeSingular) =>
            ctorColorMap[ele.data('label')] || '#FFFF',
        },
      },
      {
        selector: '.faded',
        style: {
          opacity: 0.6,
          'text-opacity': 0.6,
        },
      },
    ],
    []
  );

  const cyStyle = useMemo(
    () => ({ width: '100%', height: '100%', backgroundColor: '#f4f4f4' }),
    []
  );

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh', // full screen height
      }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Graph */}
        <div style={{ flex: 1 }}>
          <CytoscapeComponent
            elements={elements}
            style={cyStyle}
            stylesheet={cyStylesheet}
            cy={(cy: Core) => {
              cyRef.current = cy;

              if ((cy as any)._driverGraphEventsBound !== true) {
                (cy as any)._driverGraphEventsBound = true; // guard against binding duplicate listeners

                cy.on('grab', 'node', (e) => console.log('grab', e));
                cy.on('drag', 'node', (e) => console.log('drag', e));
                cy.on('free', 'node', (e) => console.log('free', e));
                cy.on('position', 'node', (e) =>
                  console.log('position', e.target.position())
                );

                /* EVENT LISTENERS */
                cy.on('tap', 'edge', (event: EventObject) => {
                  const edge: EdgeSingular = event.target;
                  const source: string =
                    edge.source().data('name') || edge.source().id();
                  const target: string =
                    edge.target().data('name') || edge.target().id();
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

                cy.on('tap', (event: EventObject) => {
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

                cy.on('mouseover', 'node', (event: EventObject) => {
                  const node: NodeSingular = event.target;
                  node.connectedEdges().addClass('highlighted');

                  // TODO: This is an attempted hack to render edges above other edges
                  //    - it is not working. Need to look into cytoscape.js repo
                  // (node as any)._private.grabbed = true; // <-- hack: mark as grabbed
                  // (node as any)._private.active = true;
                  (node as any)._private.rscratch.inDragLayer = true;
                  node.neighborhood().forEach((edge: any) => {
                    edge._private.rscratch.inDragLayer = true;
                  });
                  // cy.forceRender();

                  node.stop(true);
                  node.animate({
                    style: {
                      width: DEFAULT_NODE_DIAMETER * NODE_HOVER_SCALE,
                      height: DEFAULT_NODE_DIAMETER * NODE_HOVER_SCALE,
                      backgroundColor: ctorColorMap[node.data('displayCtor')],
                    },
                    duration: 150,
                    easing: 'ease-in-out',
                  });

                  node.neighborhood('node').forEach((neigbor: NodeSingular) => {
                    const edge: EdgeSingular = node.edgesWith(neigbor)[0];
                    neigbor.stop(true);
                    neigbor.animate({
                      style: {
                        width: DEFAULT_NODE_DIAMETER * 1.25,
                        height: DEFAULT_NODE_DIAMETER * 1.25,
                        backgroundColor: ctorColorMap[edge.data('label')],
                      },
                      duration: 150,
                      easing: 'ease-in-out',
                    });
                  });
                  cy.elements()
                    .not(node.neighborhood().union(node))
                    .addClass('faded');

                  // Highlight connected edges
                  node.connectedEdges().addClass('highlighted');
                });

                cy.on('mouseout', 'node', (event: EventObject) => {
                  cy.elements().removeClass('faded');
                  const node: NodeSingular = event.target;
                  node.connectedEdges().removeClass('highlighted');


                  // TODO: This is a hack. Try to find proper way to do it
                  (node as any)._private.rscratch.inDragLayer = false;
                  node.neighborhood().forEach((edge: any) => {
                    edge._private.rscratch.inDragLayer = false;
                  });

                  node.stop(true);
                  node.animate({
                    style: {
                      width: DEFAULT_NODE_DIAMETER,
                      height: DEFAULT_NODE_DIAMETER,
                    },
                    duration: 150,
                    easing: 'ease-in-out',
                  });
                  node.neighborhood('node').forEach((node: NodeSingular) => {
                    node.stop(true);
                    node.animate({
                      style: {
                        width: DEFAULT_NODE_DIAMETER,
                        height: DEFAULT_NODE_DIAMETER,
                        backgroundColor: ctorColorMap[node.data('displayCtor')],
                      },
                      duration: 150,
                      easing: 'ease-in-out',
                    });
                  });

                  node.animate({
                    style: {
                      backgroundColor: ctorColorMap[node.data('displayCtor')],
                    },
                    duration: 150,
                  });
                  node.connectedEdges().removeClass('highlighted');
                });

                cy.on('mouseover', 'edge', (event: EventObject) => {
                  const edge: EdgeSingular = event.target;
                  edge.connectedNodes().forEach((node: NodeSingular) => {
                    node.stop(true);
                    node.animate({
                      style: {
                        width: DEFAULT_NODE_DIAMETER * 1.25,
                        height: DEFAULT_NODE_DIAMETER * 1.25,
                        backgroundColor: ctorColorMap[edge.data('label')],
                      },
                      duration: 150,
                      easing: 'ease-in-out',
                    });
                  });
                  edge.addClass('highlighted');
                });

                cy.on('mouseout', 'edge', (event: EventObject) => {
                  const edge: EdgeSingular = event.target;
                  edge.connectedNodes().forEach((node: NodeSingular) => {
                    node.stop(true);
                    node.animate({
                      style: {
                        width: DEFAULT_NODE_DIAMETER,
                        height: DEFAULT_NODE_DIAMETER,
                        backgroundColor: ctorColorMap[node.data('displayCtor')],
                      },
                      duration: 150,
                      easing: 'ease-in-out',
                    });
                  });
                  edge.removeClass('highlighted');
                });
              }
            }}
          />
        </div>

        {/* Styling to prevent timeline thumbs from highlighting */}
        <style>
          {`
        .react-range__thumb {
          outline: none;
        }

        .react-range__thumb:focus-visible {
          outline: auto;
        }
      `}
        </style>

        {/* Timeline Slider */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            flexWrap: 'wrap',
            alignItems: 'center',
            height: '15%',
            width: '80%',

            // settings to allow timeline to float over graph
            background: 'transparent',
            position: 'absolute',
            bottom: '0px',
            left: '20px',
          }}
        >
          <Range
            allowOverlap={true}
            draggableTrack={true} // enabling this means can't click track to go to year
            direction={Direction.Right}
            values={sliderThumbValues}
            step={1}
            min={TIMELINE_MIN_YEAR}
            max={TIMELINE_MAX_YEAR}
            onChange={(newValues) => {
              if (newValues[0] > newValues[1]) {
                if (newValues[0] === sliderThumbValues[0]) {
                  newValues[0] = newValues[1];
                } else {
                  newValues[1] = newValues[0];
                }
              }
              setMinDisplayYear(newValues[0]);
              setMaxDisplayYear(newValues[1]);
              setSliderThumbValues(newValues);
            }}
            renderMark={({ props, index }) => (
              <div
                {...props}
                key={props.key}
                style={{
                  ...props.style,
                  width: '5px',
                  height: index % 5 === 0 ? '30px' : '20px',
                  backgroundColor:
                    sliderThumbValues[0] <= index + TIMELINE_MIN_YEAR &&
                    index + TIMELINE_MIN_YEAR <= sliderThumbValues[1]
                      ? 'black'
                      : '#ccc',
                }}
              />
            )}
            renderTrack={({ props, children }) => (
              <div
                onMouseDown={props.onMouseDown}
                onTouchStart={props.onTouchStart}
                style={{
                  ...props.style,
                  flexGrow: 1,
                  width: '90%',
                  display: 'flex',
                  height: '36px',
                }}
              >
                <div
                  ref={props.ref}
                  style={{
                    width: '100%',
                    height: '5px',
                    borderRadius: '4px',
                    background: getTrackBackground({
                      values: sliderThumbValues,
                      colors: ['#ccc', 'black', '#ccc'],
                      min: TIMELINE_MIN_YEAR,
                      max: TIMELINE_MAX_YEAR,
                    }),
                    alignSelf: 'center',
                  }}
                >
                  {children}
                </div>
              </div>
            )}
            renderThumb={({ index, props, isDragged }) => (
              <div
                {...props}
                key={props.key}
                style={{
                  ...props.style,
                  height: '42px',
                  width: '5px',
                  borderRadius: '4px',
                  backgroundColor: 'black',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  boxShadow: '0px 2px 6px #AAA',
                  top: index === 0 ? '65%' : '35%',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: index === 0 ? '30px' : '-13px', // TODO: get rid of hardcoded vals
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    fontFamily: 'Arial,Helvetica Neue,Helvetica,sans-serif',
                    padding: '4px',
                    borderRadius: '4px',
                    backgroundColor: 'black',
                  }}
                >
                  {sliderThumbValues[index]}
                </div>
                {/* <div
                  style={{
                    width: '16px',
                    height: '5px',
                    backgroundColor: isDragged ? '#548BF4' : '#CCC',
                  }}
                /> */}
              </div>
            )}
          />
        </div>
      </div>

      {/* Display Panel*/}
      <div
        style={{
          width: '15%', // quarter width
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
        <button onClick={savePositions}>Save Positions</button>
        {/* <div style={{ marginBottom: '1rem' }}>
          <label>Min Value:</label>
          <input
            type="number"
            value={minDisplayYear}
            onChange={(e) => {
              const newMin = Number(e.target.value);
              setMinDisplayYear(() => {
                return newMin <= maxDisplayYear ? newMin : minDisplayYear;
              });
            }}
            style={{ width: '25%', padding: '0.5rem', marginTop: '0.25rem' }}
          />
        </div>

        <div>
          <label>Max Value:</label>
          <input
            type="number"
            value={maxDisplayYear}
            onChange={(e) => {
              const newMax = Number(e.target.value);
              setMaxDisplayYear(() => {
                return newMax >= minDisplayYear ? newMax : minDisplayYear;
              });
            }}
            style={{ width: '25%', padding: '0.5rem', marginTop: '0.25rem' }}
          />
        </div> */}
      </div>
    </div>
  );
}
