// src/components/DriverGraph.tsx

import { useEffect, useState, useRef } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import cytoscape, { Core, EventObject, NodeSingular } from "cytoscape";
import { trace } from "console";

type NodeData = {
  data: {
    id: string;
    name?: string;
    [key: string]: any;
  };
};

type EdgeData = {
  data: {
    source: string;
    target: string;
    team?: string;
    [key: string]: any;
  };
};

export default function DriverGraph() {
  const [elements, setElements] = useState<(NodeData | EdgeData)[]>([]);
  const [selectedInfo, setSelectedInfo] = useState<string | null>(null);
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);

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
      cyRef.current.layout({ name: "cose", animate: true }).run();
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
  };


  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <CytoscapeComponent
        elements={elements}
        style={{ width: "100%", height: "90%" }}
        layout={{
          name: "cose",
          animate: true,
          padding: 50,            // space around graph
          nodeRepulsion: 100000,    // more = more spread
          // idealEdgeLength: 1000,   // target edge length
          edgeElasticity: 0.1,
          nestingFactor: 1.2,
          componentSpacing: 100,  // spacing between connected clusters
          numIter: 1000,          // more iterations = better layout
          gravity: 5,
        }}
        stylesheet={[
          {
            selector: "node",
            style: {
              label: "data(name)",
              "background-color": "#0074D9",
              color: "#fff",
              "text-valign": "center",
              "text-halign": "center",
              width: "label", // makes size based on label
              height: "label",
              padding: "10px",
              "text-wrap": "wrap",
              "font-size": "10px",
              "shape": "roundrectangle",
              "text-margin-y": "5px",
              "text-max-width": "100px",
            },
          },
          {
            selector: "edge",
            style: {
              width: 2,
              "line-color": "#aaa",
              "target-arrow-color": "#aaa",
              label: "data(team)",
              "font-size": 8,
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
          // cy.on("tap", "node", (event: EventObject) => {
          //   const node = event.target;

          //   // First, clear previous styles
          //   cy.elements().removeClass("highlighted faded");

          //   // Get the node and its neighborhood
          //   const neighborhood = node.closedNeighborhood(); // includes node, neighbors, and edges

          //   // Highlight the neighborhood
          //   neighborhood.addClass("highlighted");

          //   // Dim everything else (i.e. not in the neighborhood)
          //   cy.elements().not(neighborhood).addClass("faded");
          //   setSelectedInfo(`Driver: ${node.data("name") || node.id()}`);
          // });

          if ((cy as any)._driverGraphEventsBound !== true) {
              (cy as any)._driverGraphEventsBound = true;
          cy.on("tap", "edge", (event: EventObject) => {
            const edge = event.target;
            const source = edge.source().data("name") || edge.source().id();
            const target = edge.target().data("name") || edge.target().id();
            const team = edge.data("team") || "Unknown Team";
            setSelectedInfo(`${source} & ${target} were teammates at ${team}`);
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
              console.log("here");
              console.log(selectedDriversRef.current.length);
              // Optionally show info like "First driver selected: Heidfeld"
              setSelectedInfo(`Selected: ${driverName}`);
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
