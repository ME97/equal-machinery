from pydantic import BaseModel, field_validator, Field
from typing import Optional
from datetime import date
from dataclasses import dataclass, field

#TODO: Change fields to snake_case
# like this:
# def to_camel(string: str) -> str:
#     parts = string.split('_')
#     return parts[0] + ''.join(word.capitalize() for word in parts[1:])

# class MyBaseModel(BaseModel):
#     model_config = ConfigDict(
#         alias_generator=to_camel,
#         populate_by_name=True
#     )

# class Driver(MyBaseModel):
#     driver_id: int
#     given_name: str
#     family_name: str

@dataclass
class DriverPair:
    driverId1: int # driverId1 < driverId2
    driverId2: int
    constructorId: int
    years: set[int] = field(default_factory=set) # years the drivers appear in at least one result together
    raceIds: set[int] = field(default_factory=set)

class Driver(BaseModel):
    driverId: int
    driverRef: str
    number: Optional[int]
    code: str
    forename: str
    surname: str
    dob: date
    nationality: str
    yearsActive: set[int] = Field(default_factory=set) # years that driver appears in at least one result
    teammates: set[int] = Field(default_factory=set) # list of teammates by driverId
    driverPairs: set[tuple[int, int, int]] = Field(default_factory=set)
    def __str__(self):
        return f"{self.forename} {self.surname}"
    # maybe make teamate list (driverId, constructorId)
    # teams (which teams they were on, and for which time periods)

# TODO: Add more fields to this (grid pos, finish pos, points, etc)
class Result(BaseModel):
    resultId: int
    raceId: int
    driverId: int
    constructorId: int
    position: Optional[int] # None if retired, DNF, etc (TODO: add field indicating this)
    
    @field_validator("position", mode="before")
    def handle_null(cls, v):
        if v == r"\N":  # raw string match
            return None
        return v

    def result_str(self, driver_by_Id, race_by_Id):
        if self.position:
            return f"{driver_by_Id[self.driverId]} finished in P{self.position} in the {race_by_Id[self.raceId]}"
        else:
            return f"{driver_by_Id[self.driverId]} did not finish the {race_by_Id[self.raceId]}"

class Race(BaseModel):
    raceId: int
    year: int
    circuitId: int
    name: str
    date: date
    drivers: set[int] = Field(default_factory=set) # set of drivers who competed by driverId
    ctors: set[int] = Field(default_factory=set) # set of constructors by ctorId
    results: set[int] = Field(default_factory=set) # set of results by resultId
    def __str__(self):
        return f"{self.year} {self.name}"

class Ctor(BaseModel):
    constructorId: int
    constructorRef: str
    name: str
    nationality: str
    driverPairIds: set[tuple[int, int, int]] = Field(default_factory=set)



