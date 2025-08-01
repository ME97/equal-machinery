from pydantic import BaseModel, field_validator, Field
from typing import Optional
from datetime import date
from dataclasses import dataclass

class Driver(BaseModel):
    driverId: int
    driverRef: str
    number: Optional[int]
    code: str
    forename: str
    surname: str
    dob: date
    nationality: str
    teammates: set[int] = Field(default_factory=set) # list of teammates by driverId
    # maybe make teamate list (driverId, constructorId)
    # teams (which teams they were on, and for which time periods)


class Race(BaseModel):
    raceId: int
    year: int
    circuitId: int
    name: str
    date: date
    drivers: list[int] = Field(default_factory=list) # list of drivers who competed by driverId
    def __str__(self):
        return f"{self.year} {self.name}"

class Result(BaseModel):
    resultId: int
    raceId: int
    driverId: int
    constructorId: int
    grid: int # 1-20 for grid, 0 for pitlane (or maybe DNS?)
    position: Optional[int] = None # None for retirement (or maybe DQ?)
    positionOrder: int
    points: int
    statusId: int

@dataclass
class Teammates:
    driverId1: int
    driverId2: int
    constructorId: int
    firstRaceDate: date
    lastRaceDate: date
    races: list[Race]
    raceDelta: int # races won by D1 - races won by D2
    qualiMargin: float
    pointsMargin: int
