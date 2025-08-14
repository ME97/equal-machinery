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
driver_pair_by_id: dict[tuple[int, int, int], DriverPair] = dict()
# returns dictionary with key as driver_id, val as Driver object


def load_drivers(file_path: str) -> dict[int, Driver]:
    with open(file_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        map = {}
        for row in reader:
            # y = date.fromisoformat(row['dob']).year
            # if y < 1970:
            #     continue
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
                             ) -> dict[tuple[int, int, int], DriverPair]:
    driver_pair_by_id: dict[tuple[int, int, int], DriverPair] = dict()

    for race in race_by_id.values():
        for ctorId in race.ctors:
            pair: list[int, int] = list()
            for result_id in race.results:
                result: Result = result_by_id[result_id]
                if result.constructor_id == ctorId:
                    pair.append(result.driver_id)

            # temporary fix for if only one driver
            if len(pair) != 2:
                continue

            # smaller driver_id goes first, to avoid duplicates
            driver_id1 = min(pair)
            driver_id2 = max(pair)
            driver_pair_id = driver_id1, driver_id2, ctorId

            if driver_pair_id not in driver_pair_by_id:
                driver_pair_by_id[driver_pair_id] = DriverPair(
                    driver_id1, driver_id2, ctorId)

            driver_pair: DriverPair = driver_pair_by_id[driver_pair_id]
            driver_by_id[driver_id1].driver_pairs.add(driver_pair_id)
            driver_by_id[driver_id2].driver_pairs.add(driver_pair_id)
            ctor_by_id[ctorId].driver_pair_ids.add(driver_pair_id)

            driver_pair.raceIds.add(race.race_id)
            driver_pair.years.add(race.date.year)

    return driver_pair_by_id


def to_cytoscape_data(driver_by_id: dict[int, Driver],
                      ctor_by_id: dict[int, Ctor],
                      driver_pair_by_id: dict[int, DriverPair],
                      min_year: int = 0, max_year: int = 9999) -> None:
    seen = set()
    nodes = []
    for id in driver_by_id:
        year_range: set[int] = set([i for i in range(min_year, max_year + 1)])
        # if min_year < min(driver_by_id[id].years_active) and max(driver_by_id[id].years_active) < max_year:
        if driver_by_id[id].years_active & year_range:
            nodes.append(
                {"data": {"id": str(id), "name": str(driver_by_id[id]), 
                          "years_active": sorted(list(driver_by_id[id].years_active))}})
            seen.add(id)

    # TODO: What happens if teammates are together on different teams?
    edges = [
        {"data": {"source": str(driver_id_1), "target": str(
            driver_id_2), "ctor": ctor_by_id[ctor_id].name, "years": sorted(list(driver_pair_by_id[driver_id_1, driver_id_2, ctor_id].years))}}
        for driver_id_1, driver_id_2, ctor_id in driver_pair_by_id if (driver_id_1 in seen and driver_id_2 in seen)
    ]
    return {"nodes": nodes, "edges": edges}


driver_by_id = load_drivers('data/drivers.csv')
ctor_by_id = load_ctors('data/constructors.csv')
result_by_id = load_results('data/results.csv')
race_by_id = load_races('data/races.csv')
process_results(race_by_id, result_by_id, driver_by_id)

driver_pair_by_id = populate_driver_pairings(
    race_by_id, result_by_id, driver_by_id, ctor_by_id)

# print(json.dumps(to_cytoscape_data(driver_by_id,
#       ctor_by_id, driver_pair_by_id, 2019, 2025)))

app = FastAPI()


@app.get("/graph")
def get_graph():
    return to_cytoscape_data(driver_by_id, ctor_by_id, driver_pair_by_id, 2010, 2025)
