import cytoscape, { Core, NodeSingular, EdgeSingular, Collection } from 'cytoscape';

declare module 'cytoscape' {
  interface NodeSingular {
    hide(): void;
    show(): void;
    hidden(): boolean;
    neighbors(selector?: string): cytoscape.CollectionReturnValue;
  }

  interface EdgeSingular {
    hide(): void;
    show(): void;
    hidden(): boolean;
  }

  interface Collection {
    hide(): void;
    show(): void;
  }
}