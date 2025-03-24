# Streaming

Solution for the Harper Node.js Engineer Challenge submitted by [vasil9v](https://github.com/vasil9v).

The solution wraps a simple node.js webserver around [lmdb-js](https://github.com/kriszyp/lmdb-js) to illustrate the streaming of records via a simple HTTP endpoint called `/streaming` which accepts optional `start` and `end` values which correspond to the parameters then passed to the lmdb-js `getRange()` [method](https://github.com/kriszyp/lmdb-js?tab=readme-ov-file#dbgetrangeoptions-rangeoptions-iterable-key-value-buffer-).

```
# fetch records with key values 200 to 399
curl -i "http://localhost:9000/stream?start=200&end=400"
```

The webserver also serves up a simple client app `index.html` page which polls the server using incrementing values of `start` and `end` to simulate a continuous stream of records to the client. The period at which the requests are made (`Period`) and the size (`Size`) of the range queried are both configurable at run time.

There is also a `/distinct` endpoint which serves the distinct values for two fields in the database. These are currently `breed` and `is_good`, and are populated by caching values from each record returned by `getRange()`. This means that the `/stream` endpoint needs to be called first for the distinct values to be populated.

```
curl -i "http://localhost:9000/distinct/breed"
curl -i "http://localhost:9000/distinct/is_good"

$ curl -i "http://localhost:9000/distinct/is_good"
HTTP/1.1 200 OK
Content-Type: application/json
Date: Mon, 24 Mar 2025 22:08:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Content-Length: 20

["true"]
```
In this database, as in real life, all dogs are good dogs.

## Install

```
npm install
```

## Run

```
node index.js &
curl -i "http://localhost:9000/populate"  # call this endpoint to populate the database with some sample data
open "http://localhost:9000/"  # or paste http://localhost:9000/ into a locally running browser
```
