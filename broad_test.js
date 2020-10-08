const axios = require('axios');
const readline = require('readline');

const apiInstance = axios.create({
  baseURL: 'https://api-v3.mbta.com',
  headers: { 'x-api-key': '71de95d00ec041f39d897679fbb68202' },
});

// Global variable forwardingTable for finding directions betweeen stops for question 3.
// Compute once per time the program is run.
let forwardingTable = undefined;

// Entry point to program
async function main() {
  try {
    await runCommand();
  } catch (e) {
    console.log('failed: ', e);
  }
}

// Command loop to continuously read input and execute corresponding function
function runCommand() {
  return new Promise((resolve, reject) => {
    let rl = readline.createInterface(process.stdin, process.stdout);
    rl.setPrompt('ready> ');
    rl.prompt();
    rl.on('line', async (line) => {
      if (line == 'exit') {
        rl.close();
        return;
      }

      if (line == 'list_routes') {
        await question1();
      } else if (line == 'route_info') {
        await question2();
      } else if (line.startsWith('directions')) {
        const split = line.split(' from ');
        const args = split[1].split(' to ');
        const from = args[0].trim();
        const to = args[1].trim();

        await question3(from, to);
      } else {
        console.log('unknown command');
      }
      rl.prompt();
    }).on('close', () => {
      console.log('bye');
      resolve(42);
    });
  });
}

// Question 1: List subway routes.
async function question1() {
  const subwayRoutes = (await apiInstance.get('/routes?filter[type]=0,1').catch((e) => console.log(e))).data.data;
  const longNames = subwayRoutes.map((route) => route.attributes.long_name).join(', ');

  console.log(longNames);
}

// Question 2:
// 1. Print name and number of stops of subway route with most stops
// 2. Print name and number of stops of subway route with fewest stops
// 3. Print list of stops that connect two or more subway routes and
//    route names that connect to the stop.
async function question2() {
  const subwayRoutes = (await apiInstance.get('/routes?filter[type]=0,1').catch((e) => console.log(e))).data.data;
  const stopToRoutes = {};

  // Keep track of the route with max and min stops as looping through routes
  let routeWithMaxStops = null;
  let routeWithMinStops = null;

  for (const route of subwayRoutes) {
    // Stops per subway route
    const stops = (await apiInstance.get('/stops?filter[route]=' + route.id).catch((e) => console.log(e))).data.data;
    const routeName = route.attributes.long_name;

    // Replace existing routeWithMaxStops and routeWithMinStops if new route has more or less stops.
    if (!routeWithMaxStops || stops.length > routeWithMaxStops.count) {
      routeWithMaxStops = { name: routeName, count: stops.length };
    }
    if (!routeWithMinStops || stops.length < routeWithMaxStops.count) {
      routeWithMinStops = { name: routeName, count: stops.length };
    }

    // Populate stopToRoutes mapping of stop name to array of routes stop connects to.
    stops.forEach((stop) => {
      const stopName = stop.attributes.name;
      stopToRoutes[stopName] ? stopToRoutes[stopName].push(routeName) : (stopToRoutes[stopName] = [routeName]);
    });
  }

  console.log(`${routeWithMaxStops.name} has the most stops: ${routeWithMaxStops.count}`);
  console.log(`${routeWithMinStops.name} has the least stops: ${routeWithMinStops.count}`);

  // Loops through stopToRoutes map and prints any stops and corresponding routes if the stop connects to more than one route.
  for (const stop in stopToRoutes) {
    if (stopToRoutes[stop].length > 1) {
      console.log(`${stop} stop connects to routes: ${stopToRoutes[stop].join(', ')}`);
    }
  }
}

// Question 3: Given two stops return the rail route from the first to the second
async function question3(startStop, targetStop) {
  const subwayRoutes = (await apiInstance.get('/routes?filter[type]=0,1').catch((e) => console.log(e))).data.data;
  const stopToRoutes = {};

  // Populates stopToRoutes, a map from stop name to an array of the routes it is on
  for (const route of subwayRoutes) {
    const stops = (await apiInstance.get('/stops?filter[route]=' + route.id).catch((e) => console.log(e))).data.data;
    const routeName = route.attributes.long_name;

    stops.forEach((stop) => {
      const stopName = stop.attributes.name;
      stopToRoutes[stopName] ? stopToRoutes[stopName].push(routeName) : (stopToRoutes[stopName] = [routeName]);
    });
  }

  // Make sure stops are valid by checking if found in map
  if (!stopToRoutes[startStop] || !stopToRoutes[targetStop]) {
    console.log('Invalid stop, pass in valid stop name');
    return;
  }

  // Return single route if the stops are on the same route.
  const commonRoute = stopToRoutes[startStop].find((route) => stopToRoutes[targetStop].includes(route));
  if (commonRoute) {
    console.log(commonRoute);
    return;
  }

  // Compute forwardingTable global variable if it has not been computed yet
  forwardingTable = forwardingTable == undefined ? computeForwardingTable(stopToRoutes) : forwardingTable;

  // Find route path from first stop to second using forwardingTable
  let railRoute = connect(stopToRoutes[startStop][0], stopToRoutes[targetStop][0], forwardingTable);

  console.log(railRoute.join(', '));
}

// Uses the forwarding table to connect the two routes and returns an array representing the path
function connect(route1, route2, forwardingTable) {
  const routePath = [route1];
  let nextRoute = forwardingTable[`${route1},${route2}`];
  routePath.push(nextRoute);

  // Follows forwardingTable next hop until it reaches target route (route2)
  while (nextRoute != route2) {
    nextRoute = forwardingTable[`${nextRoute},${route2}`];
    routePath.push(nextRoute);
  }

  return routePath;
}

// Returns a forwarding table that will allow routes to follow path from one route to next.
// Key of map is composite string of startRoute to targetRoute: "startRoute,targetRoute".
// Key value is next route to follow to get to targetRoute.
// Ex: If red connects to orange, orange connects to red and blue, and blue connects to orange, resulting table:
// {
//  'red,blue' => 'orange',
//  'red,orange' => 'orange'
//  'orange,blue' => 'blue',
//  'orange,red' => 'red',
//  'blue,red' => 'orange'
//  'blue,orange' => 'orange'
// }
function computeForwardingTable(stopToRoutes) {
  const connections = computeConnections(stopToRoutes);
  let routeForwardingTable = {};
  let possibleRoutes = Object.keys(connections);

  for (const route in connections) {
    const seenRoutes = new Set();
    seenRoutes.add(route);

    // Initialize forwarding to immediate connections.
    for (const r of connections[route]) {
      routeForwardingTable[`${route},${r}`] = r;
      seenRoutes.add(r);
    }

    // Runs loop until all routes are seen, works under assumption that there is a possible connection to
    // every other route.
    while (seenRoutes.size != possibleRoutes.length) {
      for (const next of possibleRoutes) {
        if (!seenRoutes.has(next)) {
          const connector = findConnector(connections[next], seenRoutes);
          if (connector) {
            routeForwardingTable[`${route},${next}`] = routeForwardingTable[`${route},${connector}`];
            seenRoutes.add(next);
          }
        }
      }
    }
  }

  return routeForwardingTable;
}

// Creates a map of each route and what that route can connect to
function computeConnections(stopToRoutes) {
  let routeToConnectingRoutes = {};

  for (const stop in stopToRoutes) {
    // Only look at stops that connect routes
    if (stopToRoutes[stop].length > 1) {
      // Connect route to every other route in stop listing
      for (const route of stopToRoutes[stop]) {
        if (routeToConnectingRoutes[route]) {
          stopToRoutes[stop].forEach((connectingRoute) => routeToConnectingRoutes[route].add(connectingRoute));
        } else {
          routeToConnectingRoutes[route] = new Set(stopToRoutes[stop]);
        }
      }
    }
  }

  return routeToConnectingRoutes;
}

// Returns a common route between the two sets of routes, undefined if there is none.
function findConnector(routes1, routes2) {
  let connector = undefined;
  for (const route of routes1) {
    if (routes2.has(route)) {
      connector = route;
      break;
    }
  }

  return connector;
}

main();
