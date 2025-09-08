export type YearsByCtor = {
  ctor: string;
  ctorId: string;
  years: number[]; // sorted array of years driver (or driver pair) raced on team [ctor]
};

export type TeammatesByYearByCtor= {
  ctorId: number;
  years: [number, number[]][]; // [year [teammate_id]]
};

export type NodeData = {
  data: {
    id: string;
    name?: string;
    codename: string;
    forename: string;
    surname: string;
    yearsByCtor: YearsByCtor[];
    teammatesByYearByCtor: TeammatesByYearByCtor[];
    displayCtor?: string; // ctor used for node colouring
    displayCtorId?: string;
    raceCount?: number; 
    [key: string]: any;
  };
};

export type EdgeData = {
  data: {
    source: string;
    target: string;
    displayCtorId?: string;
    yearsByCtor: YearsByCtor[]; 
    [key: string]: any;
  };
};

export type CtorData = {
    name: string;
    colorPrimary: string;
    colorSecondary?: string | null;
};
