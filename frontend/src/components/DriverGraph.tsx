// src/components/DriverGraph.tsx

import { useEffect, useState, useRef } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import cytoscape, { Core, EventObject, NodeSingular } from "cytoscape";
import coseBilkent from "cytoscape-cose-bilkent";

cytoscape.use(coseBilkent);

type NodeData = {
  data: {
    id: string;
    name?: string;
    years_active: number[]
    [key: string]: any;
  };
};

type EdgeYearInfo = {
  ctor: string
  year: number;
};

type EdgeData = {
  data: {
    source: string;
    target: string;
    // ctor: string; // TODO: some driver pairs have multiple ctors (like zhou and bottas at alfa romeo / sauber)
    //               //  - need a way to identify which ctor corresponds to which years
    //               //  - e.g bottas and zhou were teammates at alfa romeo (2022-2023) and sauber (2024)
    //               // Plan:
    //               //    - change ctor to ctors [array of strings], one per ctor shared by drivers
    //               //    - change years to array of tuples (ctor, year)
    // years: number[];

    // TODO: looks for occurences of ctor and year and replace accorudingly
    //    OR we could keep that info?
    ctor_year: EdgeYearInfo[]; // sorted by year
    [key: string]: any;
  };
};

export default function DriverGraph() {
  const [elements, setElements] = useState<(NodeData | EdgeData)[]>([]);
  const [selectedInfo, setSelectedInfo] = useState<string | null>(null);
  // const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);

  const selectedDriversRef = useRef<string[]>([]);
  const cyRef = useRef<Core | null>(null);


  useEffect(() => {
    fetch("/graph")  // if backend runs on another port, you may need a proxy (see bottom)
      .then((res) => res.json())
      .then((data) => setElements([...data.nodes, ...data.edges]))
      .catch((err) => console.error("Error fetching graph:", err));
  }, []);

  useEffect(() => {
    if (cyRef.current && elements.length > 0) {
      const cy = cyRef.current;

      // set up edge labels TODO: maybe move this to it's own hook
      //  - it will be triggered on target year change
      //  - display most recent ctor that is in year range
      //    - (or if none are in range, just most recent)
      const min_year = 2024; // dummy vars for testing
      const max_year = 2024;
      cy.edges().forEach((edge) => {
        const ctor_year: EdgeYearInfo[] = edge.data("ctor_year");
        const filteredYears: EdgeYearInfo[] = ctor_year.filter(
          (y: EdgeYearInfo) => y.year >= min_year && y.year <= max_year
        );

        let label: string | undefined;

        if (filteredYears.length !== 0) {
          label = filteredYears.at(-1)!.ctor;
        } else if (ctor_year.length !== 0) {
          label = ctor_year.at(-1)!.ctor;
        } else {
          label = undefined;
        }
        edge.data("label", label ? label : "");
      });

      // Right now this is not being used, because we just do a cose-bilkent layout after
      //  But the idea is to arrange nodes chronologically
      //  Ideally we would do this initial setup, and then let cose-bilkent move them around a bit
      //    But so far trying that has not worked...
      const years = cy.nodes().map(n => Math.min(...n.data('years_active')));
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

      /* Uncomment this to use the chronological ordering */
      // cy.layout({
      //   name: 'preset',
      //   positions
      // }
      // ).run();

      // cose-bilkent default options
      const coseBilkentDefaultOptions = {
        // Called on `layoutready`
        ready: function () {
        },
        // Called on `layoutstop`
        stop: function () {
        },
        // 'draft', 'default' or 'proof" 
        // - 'draft' fast cooling rate 
        // - 'default' moderate cooling rate 
        // - "proof" slow cooling rate
        quality: 'default',
        // Whether to include labels in node dimensions. Useful for avoiding label overlap
        nodeDimensionsIncludeLabels: true,
        // number of ticks per frame; higher is faster but more jerky
        refresh: 30,
        // Whether to fit the network view after when done
        fit: true,
        // Padding on fit
        padding: 10,
        // Whether to enable incremental mode
        randomize: true,
        // Node repulsion (non overlapping) multiplier
        nodeRepulsion: 4500,
        // Ideal (intra-graph) edge length
        idealEdgeLength: 100,
        // Divisor to compute edge forces
        edgeElasticity: 0.45,
        // Nesting factor (multiplier) to compute ideal edge length for inter-graph edges
        nestingFactor: 0.1,
        // Gravity force (constant)
        gravity: 0.25,
        // Maximum number of iterations to perform
        numIter: 2500,
        // Whether to tile disconnected nodes
        tile: true,
        // Type of layout animation. The option set is {'during', 'end', false}
        animate: 'end',
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
        initialEnergyOnIncremental: 0.5
      };

      cy.layout({
        name: "cose-bilkent", ...coseBilkentDefaultOptions
      }).run();

      // compute the size neede for circles
      // TODO: Get rid of magic numbers in this section
      cy.nodes().forEach(node => {
        // const label = node.data('name');
        const first_and_last = node.data('name').split(' ');
        const length = 3; //Math.max(first_and_last[0].length, first_and_last[1].length);
        const fontSize = 14;
        const charWidth = fontSize * 0.6; // rough average
        // const textWidth = label.length * charWidth;
        const textWidth = length * charWidth;
        const textHeight = fontSize * 1.25; // account for vertical padding

        const diameter = Math.max(textWidth, textHeight) + 20; // add padding

        node.style({
          width: diameter,
          height: diameter
        });
      });

      cy.style()
        .selector('node')
        .style({
          shape: 'ellipse',
          label: (ele: NodeSingular) => {
            const [first, last] = ele.data('name').split(' ');
            return last.slice(0, 3); // TODO: change this to actual 3 letter code
            // return `${first}\n${last}`;
          },
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': 14,
          'background-color': '#0074D9',
          color: '#fff',
          'text-wrap': 'wrap'
        })
        .update();

    }
  }, [elements]);

  const highlightShortestPathInBrowser = (sourceId: string, targetId: string) => {
    const cy = cyRef.current;
    if (!cy) return;

    // Clear previous highlighting
    cy.elements().removeClass("highlighted faded");

    // Use built-in Dijkstra (or use .aStar() if you want heuristics)
    const dijkstra = cy.elements().dijkstra({ root: `#${sourceId}` });
    const path = dijkstra.pathTo(cy.getElementById(targetId));


    if (path.length === 0) {
      alert("No path found.");
      return;
    }

    // Highlight the path
    path.addClass("highlighted");

    // Fade everything else
    cy.elements().not(path).addClass("faded");

    // Optional: show number of steps
    const sourceName: string = cy.getElementById(`${sourceId}`).data("name");
    const targetName: string = cy.getElementById(`${targetId}`).data("name");
    setSelectedInfo(`Shortest path from ${sourceName} to ${targetName} is ${Math.floor(path.length / 2)} steps`);

    const parts = [];

    for (var i = 0; i < path.length; ++i) {
      const ele = path[i];
      if (ele.isNode()) {
        parts.push(ele.data("name"));
      }
      if (ele.isEdge()) {
        // TODO: update this to be correct for the given year (maybe this is already handled with how label is set)
        parts.push(ele.data("label"));
      }
    }
    const pathString = parts.join(' -> ');
    console.log(pathString);
    setSelectedInfo(pathString);


  };


  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <CytoscapeComponent
        elements={elements}
        style={{ width: "100%", height: "90%" }}

        // for now we are running layout in useEffect
        // layout={{
        //   name: "cose",
        //   animate: true,
        //   padding: 50,            // space around graph
        //   nodeRepulsion: 100000,    // more = more spread
        //   idealEdgeLength: 100,   // target edge length
        //   edgeElasticity: 0.1,
        //   nestingFactor: 1.2,
        //   componentSpacing: 100,  // spacing between connected clusters
        //   numIter: 1000,          // more iterations = better layout
        //   gravity: 5,
        // }}
        stylesheet={[
          {
            selector: "node",
            style: {
              // label: "data(name)",
              "background-color": "#0074D9",
              label: (ele: NodeSingular) => {
                const [first, last] = ele.data('name').split(' ');
                return last.slice(0, 3);
                // return `${first}\n${last}`;
              },
              color: "#fff",
              "text-valign": "center",
              "text-halign": "center",
              // width: "label", // makes size based on label
              // height: "width",
              // padding: "10px",
              "text-wrap": "wrap",
              "font-size": "14px",
              "shape": "ellipse",
              "text-margin-y": "5px",
              "text-max-width": "100px",
            },
          },
          {
            selector: "edge",
            style: {
              width: 10,
              "line-color": "#aaa",
              "target-arrow-color": "#aaa",
              label: "data(ctor)",
              "font-size": 12,
              "text-rotation": "autorotate"
            },
          }, {
            selector: ".highlighted",
            style: {
              "background-color": "#FF4136",
              "line-color": "#FF4136",
              "target-arrow-color": "#FF4136",
              "transition-property": "background-color, line-color",
              "transition-duration": "0.3s",
            },
          },

          // 🌫️ Faded nodes and edges
          {
            selector: ".faded",
            style: {
              opacity: 0.8,
              "text-opacity": 0.8,
            },
          },

        ]}
        cy={(cy: Core) => {
          cyRef.current = cy;

          if ((cy as any)._driverGraphEventsBound !== true) {
            (cy as any)._driverGraphEventsBound = true; // gaurd against binding duplicate listeners
            cy.on("tap", "edge", (event: EventObject) => {
              const edge = event.target;
              const source = edge.source().data("name") || edge.source().id();
              const target = edge.target().data("name") || edge.target().id();
              const team = edge.data("label") || "Unknown Team";
              console.log(edge.data())
              const years = edge.data.map((ctor_year: EdgeYearInfo) => ctor_year.year).join(", ")

              setSelectedInfo(`${source} & ${target} were teammates at ${team} during ${years}`);
            });

            cy.on("tap", (event) => {
              if (event.target === cy) {
                cy.elements().removeClass("faded highlighted");
                setSelectedInfo(null);
                selectedDriversRef.current = [];
              }
            });

            cy.on("tap", "node", (event: EventObject) => {
              const node = event.target;
              const driverId = node.id();
              const driverName = node.data("name")
              if (selectedDriversRef.current.length === 2) {
                selectedDriversRef.current = []
                cy.elements().removeClass("highlighted faded");
              }

              // Prevent duplicate selection
              if (selectedDriversRef.current.includes(driverId)) return;

              selectedDriversRef.current = selectedDriversRef.current.concat(driverId);
              node.addClass("highlighted")

              if (selectedDriversRef.current.length === 2) {
                const [sourceId, targetId] = selectedDriversRef.current;
                highlightShortestPathInBrowser(sourceId, targetId);

                // Clear selection for next time
                // selectedDriversRef.current = [];
              } else {
                // Optionally show info like "First driver selected: Heidfeld"
                const years_active = node.data("years_active").join(', ')
                setSelectedInfo(`Selected: ${driverName}, active during ${years_active}`);
              }
            });
          }
        }}
      />
      {selectedInfo && (
        <div style={{ padding: "1rem", background: "#f4f4f4", textAlign: "center" }}>
          {selectedInfo}
        </div>
      )}
    </div>
  );
}
