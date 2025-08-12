import csv
from datetime import date
from data_types import Driver, Race, Ctor, Result, DriverPair

driver_by_id: dict[int, Driver] = dict()
race_by_id: dict[int, Race] = dict()
ctor_by_id: dict[int, Ctor] = dict()
result_by_id: dict[int, Result] = dict()
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


if __name__ == '__main__':
    driver_by_id = load_drivers('data/drivers.csv')
    ctor_by_id = load_ctors('data/constructors.csv')
    result_by_id = load_results('data/results.csv')
    race_by_id = load_races('data/races.csv')
    process_results(race_by_id, result_by_id, driver_by_id)

    driver_pair_by_id: dict[tuple[int, int, int], DriverPair] = populate_driver_pairings(
        race_by_id, result_by_id, driver_by_id, ctor_by_id)

mclaren_drivers = [driver_pair_by_id[tup]
                  for tup in ctor_by_id[1].driver_pair_ids]
mclaren_drivers.sort(key=lambda p: min(p.years))
print(mclaren_drivers[0])

for pair in mclaren_drivers:
    print(
        f"{driver_by_id[pair.driver_id_1]} was teammates with {driver_by_id[pair.driver_id_2]}\
 at {ctor_by_id[pair.ctor_id].name} during {sorted(list(pair.years))}")


# TODO: Update graphing functions to create edges based on pairings
#       - then update frontend to show teams on edges
