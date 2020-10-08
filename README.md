Documentation for program.

1. npm install

2. 'node broad_test.js'
   Starts program and should output 'ready>' to indicate ready to take command inputs.

Program commands:

- 'list_routes'
  Question 1 answer. Lists all subway routes.
  I decided to use the api filter option instead of filtering locally because the api
  provides this functionality so they are likely doing something similar to what I would
  or using database filtering which would be faster than me trying to filter in memory. Also,
  loading all of the data and throwing most of it away is not a good use of memory.

- 'route_info'
  Question 2 answer.
  Lists name of subway route with most stops and count of stops,
  name of subway route with least stops and count of stops,
  list of stops connecting two or more subway routes and the routes each stop connects to.

- 'directions from (start stop) to (target stop)'
  Question 3 answer. Prints the route rails to get from the start stop to the target stop.
