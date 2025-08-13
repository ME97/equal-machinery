from networkx.algorithms.shortest_paths.generic import shortest_path_length
import csv
import networkx as nx
from datetime import date
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from data_types import Driver, Race, Teammates

# GLOBAL DATA
drivers = {}
races = {}
results = {}

def load_races(file_path: str) -> dict[int, Race]:
    map = {}
    with open(file_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            map[row['raceId']] = Race(**row)
    return map
            
def load_drivers(file_path: str) -> dict[int, Driver]:
    with open(file_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        drivers = {}
        for row in reader:
            y = date.fromisoformat(row['dob']).year
            if y < 1970:
                continue
            if row['number'] == r'\N':
                row['number'] = None
            drivers[int(row['driverId'])] = (Driver(**row))
        return drivers


def add_teammates(race: list[tuple[int, int]]) -> None:
    done_set = set()
    for d1, c1 in race:
        if d1 not in done_set:
            for d2, c2 in race:
                if (c1 == c2) and (d1 != d2):
                    if d1 in drivers and d2 in drivers:
                        drivers[d1].teammates.add(d2)
                        drivers[d2].teammates.add(d1)
    pass


def build_graph() -> nx.Graph:
    G = nx.Graph()

    for id, driver in drivers.items():
        G.add_node(id, name=drivers[id].driverRef)

        for tm_id in driver.teammates:
            if id < tm_id:
                G.add_edge(id, tm_id)

    return G


# largest_cc = max(nx.connected_components(G), key=len)
# subgraph = G.subgraph(largest_cc)
# diameter = nx.diameter(subgraph)
# print(diameter)

# Find the node pair with the max shortest path length

def longest_shortest_path(G):
    # Optionally limit to largest connected component
    if not nx.is_connected(G):
        G = G.subgraph(max(nx.connected_components(G), key=len))

    all_pairs = dict(nx.all_pairs_shortest_path_length(G))
    max_len = -1
    pair = (None, None)

    for u in all_pairs:
        for v, dist in all_pairs[u].items():
            if dist > max_len:
                max_len = dist
                pair = (u, v)

    path = nx.shortest_path(G, source=pair[0], target=pair[1])
    return path


def longest_simple_path(G: nx.Graph, source, target) -> list[int]:
    longest_path = []

    def dfs(path, visited):
        nonlocal longest_path
        current = path[-1]

        if current == target:
            if len(path) > len(longest_path):
                longest_path = path[:]
            return

        for neighbor in G.neighbors(current):
            if neighbor not in visited:
                visited.add(neighbor)
                path.append(neighbor)
                dfs(path, visited)
                path.pop()
                visited.remove(neighbor)

    dfs([source], {source})
    return longest_path


seen = set()


def print_teammates(driverId: int, depth: int = 1, indent: int = 0) -> None:
    if depth == 0 or driverId in seen:
        return
    seen.add(driverId)

    for tm in drivers[driverId].teammates:
        for _ in range(indent):
            print(' ', end='')
        print(drivers[tm].driverRef)
        print_teammates(tm, depth - 1, indent + 2)

def to_cytoscape_data(G):
    nodes = [
        {"data": {"id": str(n), **G.nodes[n]}}
        for n in G.nodes
    ]
    edges = [
        {"data": {"source": str(u), "target": str(v), **G.edges[u, v]}}
        for u, v in G.edges
    ]
    return {"nodes": nodes, "edges": edges}

app = FastAPI()



# @app.get("/")
# async def root():
#     return {"message": "Hello World"}

    
drivers = load_drivers('data/drivers.csv')

# key will be raceId, val will be list of (driverId, constructorId)
def load_results(filename: str) -> dict[int, tuple[int,int]]:
    map = {}
    with open(filename, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for row in reader:
            map.setdefault(int(row['raceId']), []).append(
                (int(row['driverId']), int(row['constructorId'])))
        return map

races = load_races('data/races.csv')
results = load_results('data/results.csv')
for result in results.values():
    add_teammates(result)

# G = build_graph()
# path = nx.shortest_path(G, source=835, target=592)
# # path = longest_shortest_path(G)
# for id in path:
#     print(drivers[id].forename + ' ' + drivers[id].surname)




@app.get("/graph")
def get_graph():
    G = build_graph()  # your graph-building function
    data = to_cytoscape_data(G)
    return JSONResponse(content=data)