from pydantic import BaseModel, field_validator, Field, ConfigDict, ValidationInfo
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

@dataclass
class DriverPair:
    driver_id_1: int # driverId1 < driverId2
    driver_id_2: int
    race_ids: set[int] = field(default_factory=set)
    years_by_ctor: dict[int, set[int]] = field(default_factory=dict) # mapping from ctor_id to list of years drivers drove together for that ctor

class Driver(MyBaseModel):
    driver_id: int
    driver_ref: str
    number: Optional[int]
    forename: str
    surname: str
    codename: str = Field(alias="code")
    dob: date
    nationality: str
    years_active: set[int] = Field(default_factory=set) # years that driver appears in at least one result
    years_by_ctor: dict[int, set[int]] = Field(default_factory=dict) # mapping from ctor_id to list of years drivers drove together for that ctor
    teammates: set[int] = Field(default_factory=set) # set of teammates by driverId
    driver_pairs: set[tuple[int, int]] = Field(default_factory=set)
    race_ids: set[int] = Field(default_factory=set) # set of races driver has results in
    @field_validator("codename", mode="before")
    def handle_null(cls, v, info: ValidationInfo):
        if v == r"\N":  # raw string match
            v = info.data.get("surname", "ERROR").split(" ")
            v = v[-1][:3].upper() # first 3 characters of last part of last name (e.g "de matta" -> MAT)
        return v
    def __str__(self):
        return f"{self.forename} {self.surname}"

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
    constructor_ref: str # one word identifier e.g. 'alpine'
    name: str # full name e.g. 'Alpine F1 Team'
    nationality: str
    driver_pair_ids: set[tuple[int, int]] = Field(default_factory=set)
    colour: str | None



