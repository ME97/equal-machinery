import csv
import json
from datetime import date
from data_types import Driver, Race, Ctor, Result, DriverPair
from fastapi import FastAPI
from fastapi.responses import JSONResponse

driver_by_id: dict[int, Driver] = dict()
race_by_id: dict[int, Race] = dict()
ctor_by_id: dict[int, Ctor] = dict()
result_by_id: dict[int, Result] = dict()
driver_pair_by_id: dict[tuple[int, int], DriverPair] = dict()

def load_drivers(file_path: str) -> dict[int, Driver]:
    with open(file_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        map = {}
        for row in reader:
            if row['number'] == r'\N':
                row['number'] = None
            map[int(row['driverId'])] = (Driver(**row))
        return map


def load_results(file_path: str) -> dict[int, Result]:
    map = {}
    with open(file_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            map[int(row['resultId'])] = Result(**row)
    return map


def load_races(file_path: str) -> dict[int, Race]:
    map = {}
    with open(file_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            map[int(row['raceId'])] = Race(**row)
    return map


def load_ctors(file_path: str) -> dict[int, Ctor]:
    map = {}
    with open(file_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            map[int(row['constructorId'])] = Ctor(**row)
    return map


def process_results(race_by_id: dict[int, Race],
                    result_by_id: dict[int, Result],
                    driver_by_id: dict[int, Driver]):
    for result in result_by_id.values():
        race: Race = race_by_id[result.race_id]
        race.results.add(result.result_id)
        race.drivers.add(result.driver_id)
        race.ctors.add(result.constructor_id)
        driver_by_id[result.driver_id].years_active.add(race.date.year)


def populate_driver_pairings(race_by_id: dict[int, Race],
                             result_by_id: dict[int, Result],
                             driver_by_id: dict[int, Driver],
                             ctor_by_id: dict[int, Ctor],
                             ) -> dict[tuple[int, int], DriverPair]:
    driver_pair_by_id: dict[tuple[int, int], DriverPair] = dict()

    for race in race_by_id.values():
        for ctor_id in race.ctors:
            pair: list[int, int] = list()
            for result_id in race.results:
                result: Result = result_by_id[result_id]
                if result.constructor_id == ctor_id:
                    pair.append(result.driver_id)

            # temporary fix for if only one driver
            # TODO: Change this to add drivers that didn't race with teammates
            if len(pair) != 2:
                continue

            # smaller driver_id goes first, to avoid duplicates
            driver_id1 = min(pair)
            driver_id2 = max(pair)
            driver_pair_id = driver_id1, driver_id2

            driver_pair: DriverPair = driver_pair_by_id.setdefault(
                driver_pair_id, DriverPair(*driver_pair_id))

            # add current race info to pair
            driver_pair.race_ids.add(race.race_id)
            driver_pair.years_by_ctor.setdefault(
                ctor_id, set()).add(race.date.year)

            # link pair to drivers and ctor
            driver_by_id[driver_id1].driver_pairs.add(driver_pair_id)
            driver_by_id[driver_id2].driver_pairs.add(driver_pair_id)
            ctor_by_id[ctor_id].driver_pair_ids.add(driver_pair_id)

    return driver_pair_by_id


def to_cytoscape_data(driver_by_id: dict[int, Driver],
                      ctor_by_id: dict[int, Ctor],
                      driver_pair_by_id: dict[tuple[int, int], DriverPair],
                      min_year: int = 0, max_year: int = 9999) -> None:
    seen = set()  # used to only add edges with both drivers in year range
    nodes = []
    year_range: set[int] = set([i for i in range(min_year, max_year + 1)])

    for id in driver_by_id:
        driver: Driver = driver_by_id[id]
        if driver.years_active & year_range:
            nodes.append(
                {"data": {"id": str(id), 
                          "name": str(driver),
                          "codename": driver.codename,
                          "forename": driver.forename,
                          "surname": driver.surname,
                          "years_active": sorted(list(driver.years_active))}})
            seen.add(id)

    edges = [
        {"data": {"source": str(driver_pair.driver_id_1),
                  "target": str(driver_pair.driver_id_2),
                  "ctor_year": sorted([
            {"ctor": ctor_by_id[ctor_id].name, "year": year}
            for ctor_id, years in driver_pair.years_by_ctor.items()
            for year in years
        ],key=lambda pair: pair["year"])}}
        for driver_pair in driver_pair_by_id.values()
        if driver_pair.driver_id_1 in seen and driver_pair.driver_id_2 in seen
    ]
    return {"nodes": nodes, "edges": edges}


driver_by_id = load_drivers('data/drivers.csv')
ctor_by_id = load_ctors('data/constructors.csv')
result_by_id = load_results('data/results.csv')
race_by_id = load_races('data/races.csv')
process_results(race_by_id, result_by_id, driver_by_id)

driver_pair_by_id = populate_driver_pairings(
    race_by_id, result_by_id, driver_by_id, ctor_by_id)


app = FastAPI()


@app.get("/graph")
def get_graph():
    return to_cytoscape_data(driver_by_id, ctor_by_id, driver_pair_by_id, 2024, 2024)
