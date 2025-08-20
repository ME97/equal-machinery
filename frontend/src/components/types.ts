export type YearsByCtor = {
  ctor: string;
  years: number[]; // sorted array of years driver pair raced together on team [ctor]
};

export type NodeData = {
  data: {
    id: string;
    name?: string;
    codename: string;
    forename: string;
    surname: string;
    yearsActive: number[]; // TODO: We waste a lot of space by having this AND yearsByCtor
    yearsByCtor: YearsByCtor[]; // TODO: We hold this info in nodes and edges
    displayCtor: string; // ctor used for node colouring
    primaryCtor?: string; // ctor that was raced for the most number of seasons, or most recent
    [key: string]: any;
  };
};

export type EdgeData = {
  data: {
    source: string;
    target: string;
    yearsByCtor: YearsByCtor[]; // This can be map from ctor to array of years
    // Then, easy to display what years pair was on which team
    // Also, to check which team to display, just iterate over each and check if years in range
    [key: string]: any;
  };
};
