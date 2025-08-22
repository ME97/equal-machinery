import 'cytoscape';

declare module 'cytoscape' {
  interface SingularElementReturnValue {
    hide(): this;
    show(): this;
    visible(): boolean;
  }
}
