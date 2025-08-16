from pydantic import BaseModel, field_validator, Field, ConfigDict
from typing import Optional
from datetime import date
from dataclasses import dataclass, field

def to_camel(string: str) -> str:
    parts = string.split('_')
    return parts[0] + ''.join(word.capitalize() for word in parts[1:])

class MyBaseModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True
    )

# TODO: Change this so that all ctors shared by driver are represnted 
#        - no more ctor_id, key will be [id_1, id_2], (id_1 < id_2)
#        - ctor is now list of ints
#        - years is now list of (ctor, year) tuples
#           - actually, maybe just a list of (ctor, year tuples, don't need the list of ints)
@dataclass
class DriverPair:
    driver_id_1: int # driverId1 < driverId2
    driver_id_2: int
    ctor_id: int
    years: set[int] = field(default_factory=set) # years the drivers appear in at least one result together
    raceIds: set[int] = field(default_factory=set)

class Driver(MyBaseModel):
    driver_id: int
    driver_ref: str
    number: Optional[int]
    code: str
    forename: str
    surname: str
    dob: date
    nationality: str
    years_active: set[int] = Field(default_factory=set) # years that driver appears in at least one result
    teammates: set[int] = Field(default_factory=set) # list of teammates by driverId
    driver_pairs: set[tuple[int, int, int]] = Field(default_factory=set)
    def __str__(self):
        return f"{self.forename} {self.surname}"
    # maybe make teamate list (driverId, constructorId)
    # teams (which teams they were on, and for which time periods)

# TODO: Add more fields to this (grid pos, finish pos, points, etc)
class Result(MyBaseModel):
    result_id: int
    race_id: int
    driver_id: int
    constructor_id: int
    position: Optional[int] # None if retired, DNF, etc (TODO: add field indicating this)
    
    @field_validator("position", mode="before")
    def handle_null(cls, v):
        if v == r"\N":  # raw string match
            return None
        return v

    def result_str(self, driver_by_id, race_by_id):
        if self.position:
            return f"{driver_by_id[self.driver_id]} finished in P{self.position} in the {race_by_id[self.race_id]}"
        else:
            return f"{driver_by_id[self.driver_id]} did not finish the {race_by_id[self.race_id]}"

class Race(MyBaseModel):
    race_id: int
    year: int
    circuit_id: int
    name: str
    date: date
    drivers: set[int] = Field(default_factory=set) # set of drivers who competed by driverId
    ctors: set[int] = Field(default_factory=set) # set of constructors by ctorId
    results: set[int] = Field(default_factory=set) # set of results by resultId
    def __str__(self):
        return f"{self.year} {self.name}"

class Ctor(MyBaseModel):
    constructor_id: int
    constructor_ref: str
    name: str
    nationality: str
    driver_pair_ids: set[tuple[int, int, int]] = Field(default_factory=set)



