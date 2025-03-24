import http from 'node:http';
import fs from 'node:fs';
import querystring from 'node:querystring';
import { open } from 'lmdb';

let myDB = open({
  path: 'my-stream-db',
  compression: true,
});

const hostname = '127.0.0.1';
const port = 9000;
let distinctCache = {};

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');

  if (req.url.startsWith('/log')) {
    console.log(req);
    res.end('OK');
    return;
  }

  if (req.url == '/' || req.url == '/index.html') {
    res.setHeader('Content-Type', 'text/html');
    let index = fs.readFileSync('index.html');
    res.end(index);
    return;
  }

  if (req.url == '/populate') {
    populateData();
    res.end('OK');
    return;
  }

  if (req.url.startsWith('/stream')) {
    let query = querystring.parse(req.url.split('?')[1]);
    let start = Number(query.start || 0);
    let end = Number(query.end || 100);
    // let results = myDB.getRange({start: start, end: end, limit: 1000, sArray: true });
    let results =[];
    myDB.getRange({start: start, end: end, limit: 1000, sArray: true })
      // .filter(({ key, value }) => test(key)) // TODO
      .forEach(({ key, value }) => {
        for (let i of ['breed', 'is_good']) {
          if(!distinctCache[i]) {
            distinctCache[i] = {};
          }
          distinctCache[i][value[i]] = 1;
        }
        results.push({key: key, value: value})
      });
    res.end(JSON.stringify(results));
    return;

    // response.write() response.writeContinue() - https://nodejs.org/api/http.html#responsewritechunk-encoding-callback
  }

  if (req.url.startsWith('/distinct')) {
    let key = req.url.split('/distinct/')[1];
    if (key in distinctCache) {
      res.end(JSON.stringify(Object.keys(distinctCache[key])));
      return;
    }
    res.end('');
    return;
  }

  res.statusCode = 404;
  res.end('unknown endpoint');
});

function populateData() {
  const breeds = [
    'German Shepherd',
    'Bulldog',
    'Labrador Retriever',
    'Golden Retriever',
    'French Bulldog',
    'Siberian Husky',
    'Beagle',
    'Alaskan Malamute',
    'Poodle',
    'Chihuahua',
    'Australian Cattle Dog',
    'Dachshund'
  ]
  for(let i = 1000; i < 2000; i += 1) {
    let record = {
        id: i,
        is_good: true,
        breed: breeds[i % breeds.length],
        ts: Date.now()
    };
    myDB.put(i, record);
  }
}

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
