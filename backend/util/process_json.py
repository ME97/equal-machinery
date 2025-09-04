import csv
import json

#TODO:
# Do for each race, and then do each result in the race
# Might need to look up ctor by identifier

# Input files
CSV_FILE = "data/races.csv"
JSON_FILE = "data/2025/races.json"
OUTPUT_FILE = "races_out.csv"

# Load existing CSV to find max raceId
with open(CSV_FILE, newline="", encoding="utf-8") as f:
    reader = csv.reader(f)
    rows = list(reader)

header = rows[0]
data = rows[1:]
max_race_id = max(int(r[0]) for r in data if r[0].isdigit())

# Load JSON races
with open(JSON_FILE, encoding="utf-8") as f:
    races_json = json.load(f)

new_rows = []
race_id = max_race_id

for race in races_json["Races"]:
    race_id += 1
    season = race.get("season")
    round_ = race.get("round")
    race_name = race.get("raceName")
    url = race.get("url")
    date = race.get("date")
    time = race.get("time", None)  # Some JSONs include "time"

    # For consistency with your example CSV structure
    # Adjust indexes if your CSV has more columns
    row = [
        str(race_id),  # raceId
        season,  # season
        round_,  # round
        round_,  # some CSVs repeat round twice
        race_name,  # raceName
        date,  # race date
        time or "\\N",  # race time
        url,  # wikipedia URL
        "\\N",
        "\\N",  # FP1 date/time
        "\\N",
        "\\N",  # FP2 date/time
        "\\N",
        "\\N",  # FP3 date/time
        "\\N",
        "\\N",  # Quali date/time
        "\\N",
        "\\N",  # Sprint date/time
    ]
    new_rows.append(row)

# Write back out with new races appended
with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(header)
    writer.writerows(data + new_rows)

print(f"Appended {len(new_rows)} races. New file written to {OUTPUT_FILE}")
