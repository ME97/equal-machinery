import csv
from datetime import date
from data_types import Driver, Race, Teammates

driver_map: dict[int, Driver] = dict()
race_map: dict[int, Race] = dict()

def load_drivers(file_path: str) -> dict[int, Driver]:
    with open(file_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        map = {}
        for row in reader:
            y = date.fromisoformat(row['dob']).year
            if y < 1970:
                continue
            if row['number'] == r'\N':
                row['number'] = None
            map[int(row['driverId'])] = (Driver(**row))
        return map

def load_races(file_path: str) -> dict[int, Race]:
    map = {}
    with open(file_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            map[row['raceId']] = Race(**row)
    return map