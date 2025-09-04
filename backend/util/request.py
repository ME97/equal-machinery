import requests


def fetch_and_save_results(url: str, output_filename: str = "results.json") -> None:
    try:
        response = requests.get(url)
        response.raise_for_status()  # Throw an error for bad HTTP status codes
    except requests.RequestException as e:
        print(f"Error fetching data from {url}: {e}")
        return

    try:
        data = response.json()
    except ValueError:
        print("Error: Response content is not valid JSON")
        return

    try:
        with open(output_filename, "w", encoding="utf-8") as f:
            import json

            json.dump(data, f, ensure_ascii=False, indent=4)
        print(f"JSON data successfully saved to {output_filename}")
    except IOError as e:
        print(f"Error writing to file '{output_filename}': {e}")

if __name__ == "__main__":
    api_url = "https://api.jolpi.ca/ergast/f1/2025/drivers.json?limit=100"
    fetch_and_save_results(api_url, "f1_2025_drivers.json")