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
        race_by_Id[result.raceId].results.add(result.resultId)
        race_by_Id[result.raceId].drivers.add(result.driverId)
        race_by_Id[result.raceId].ctors.add(result.constructorId)


if __name__ == '__main__':
    driver_by_Id = load_drivers('data/drivers.csv')
    ctor_by_Id = load_ctors('data/constructors.csv')
    result_by_Id = load_results('data/results.csv')
    race_by_Id = load_races('data/races.csv')
    add_results_to_races(race_by_Id, result_by_Id)

    driverPairByTuple: dict[tuple[int, int, int], DriverPair] = dict()

    for race in race_by_Id.values():
        for ctorId in race.ctors:
            pair: list[int, int] = list()
            for resultId in race.results:
                result: Result = result_by_Id[resultId]
                if result.constructorId == ctorId:
                    pair.append(result.driverId)

            # smaller driverId goes first, to avoid duplicates
            driverId1 = min(pair)
            driverId2 = max(pair)
            driverPairId = driverId1, driverId2, ctorId

            if driverPairId not in driverPairByTuple:
                driverPairByTuple[driverPairId] = DriverPair(
                    driverId1, driverId2, ctorId, race.date, race.date)

            driverPair: DriverPair = driverPairByTuple[driverPairId]
            driver_by_Id[driverId1].driverPairs.add(driverPairId)
            driver_by_Id[driverId2].driverPairs.add(driverPairId)
            ctor_by_Id[ctorId].driverPairIds.add(driverPairId)

            driverPair.raceIds.add(race.raceId)
            if driverPair.firstRaceDate > race.date:
                driverPair.firstRaceDate = race.date
            if driverPair.lastRaceDate < race.date:
                driverPair.lastRaceDate = race.date

for pairId in driver_by_Id[1].driverPairs:
    pair: DriverPair = driverPairByTuple[pairId]
    print(
        f"{driver_by_Id[pair.driverId1]} was teammates with {driver_by_Id[pair.driverId2]}\
 at {ctor_by_Id[pair.constructorId].name} from {pair.firstRaceDate} to {pair.lastRaceDate}")
