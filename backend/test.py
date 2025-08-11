import csv
from datetime import date
from data_types import Driver, Race, Ctor, Result, DriverPair

driver_by_Id: dict[int, Driver] = dict()
race_by_Id: dict[int, Race] = dict()
ctor_by_Id: dict[int, Ctor] = dict()
result_by_Id: dict[int, Result] = dict()
# returns dictionary with key as driverId, val as Driver object


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


def add_results_to_races(race_by_Id: dict[int, Race], result_by_Id: dict[int, Result]):
    for result in result_by_Id.values():
        race_by_Id[result.raceId].results.append(result)


if __name__ == '__main__':
    driver_by_Id = load_drivers('data/drivers.csv')
    ctor_by_Id = load_ctors('data/constructors.csv')
    result_by_Id = load_results('data/results.csv')
    race_by_Id = load_races('data/races.csv')
    add_results_to_races(race_by_Id, result_by_Id)

    driver_pair_by_tuple: dict[tuple[int, int, int], DriverPair] = dict()
    # TODO:
    # go over all results, define every driver pairing
    #  a driver pairing is defined as (driverId1, driverId2, ctorId)

    # for each result, need to pair up drivers for each constructor
    #   if the driver pairing already exists, update the first / last race
    #       and list of races
    # also add each driver pairing to each driver?
    for race in race_by_Id.values():
        for result1 in race.results:
            driverId1 = result1.driverId
            ctorId = result1.constructorId
            for result2 in race.results:
                driverId2 = result2.driverId
                if result1 is not result2 and ctorId == result2.constructorId:
                    if driverId1 > driverId2:
                        temp = driverId1
                        driverId1 = driverId2
                        driverId2 = temp

                    driverPairTuple = (driverId2, driverId1, ctorId)
                if driverPairTuple not in driver_pair_by_tuple:
                    driver_pair_by_tuple[driverPairTuple] = DriverPair(
                        driverId1, driverId2, ctorId, race.date, race.date, list())
