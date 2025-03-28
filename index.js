import http from 'node:http';
import { WebSocketServer } from 'ws';
import fs from 'node:fs';
import querystring from 'node:querystring';
import { open } from 'lmdb';

const config = {
  hostname: '127.0.0.1',
  port: 9000,
  ptr: 0,
  size: 100,
  period: 500,
  clients: {}
};

let distinctCache = {};

const wss = new WebSocketServer({ port: config.port + 1 });

config.myDB = open({
  path: 'my-stream-db',
  compression: true,
});

const collectDistinct = (value) => {
  for (let i of ['breed', 'is_good']) {
    if(!distinctCache[i]) {
      distinctCache[i] = {};
    }
    distinctCache[i][value[i]] = 1;
  }
}

const testCollectDistinct = () => {
  distinctCache = {};
  const records = [
    {'id': 1, 'breed': 'French Bulldog', 'is_good': true, 'name': 'Pierre'},
    {'id': 2, 'breed': 'Siberian Husky', 'is_good': true, 'name': 'Wolf'},
    {'id': 3, 'breed': 'Siberian Husky', 'is_good': true, 'name': 'Blake'}
  ];
  records.map((x) => {collectDistinct(x);});
  console.assert('breed' in distinctCache);
  console.assert('is_good' in distinctCache);
  console.assert(Object.keys(distinctCache['is_good'].length == 1));
  console.assert(Object.keys(distinctCache['breed'].length == 2));
  distinctCache = {};
}

const getRecords = (start, end, cb) => {
  let results =[];
  config.myDB.getRange({start: start, end: end, limit: 1000, asArray: true })
  // .filter(({ key, value }) => test(key)) // TODO
  .forEach(({ key, value }) => {
    collectDistinct(value);
    results.push({key: key, value: value});
  });
  cb && cb(results, results.length);
}

const streamChunk = () => {
  if (!Object.keys(config.clients).length > 0) {
    return;
  }
  console.log(`ptr: ${config.ptr}, size: ${config.size}, period: ${config.period}`);
  getRecords(config.ptr, config.ptr + config.size, (results, items) => {
    wss.clients.forEach(client => {
      client.send(JSON.stringify(results));
    });
    config.ptr += items;
    if (items < config.size) {
      config.ptr = 0;
    }
  });
  setTimeout(streamChunk, config.period);
}

wss.on('connection', (ws, req) => {
  // console.info(req.client);
  // console.info(req.url);
  ws.on('close', () => {
    console.log('Client has disconnected!');
    config.clients = {}; // FIXME figure out how to grab the client ID
  });
  ws.on('message', data => {
    console.log(`connected, clientId: ${data}`);
    if (!config.clients[data]) {
      config.clients[data] = 1;
      setTimeout(streamChunk, config.period);
    }
  });
  ws.onerror = () => {
    console.log('websocket error');
  };
});

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');

  if (req.url.startsWith('/log')) {
    console.log(req);
    return res.end('OK');
  }

  if (req.url == '/' || req.url == '/index.html') {
    res.setHeader('Content-Type', 'text/html');
    let index = fs.readFileSync('index.html');
    return res.end(index);
  }

  if (req.url == '/populate') {
    populateData(5000);
    res.end('OK');
    return;
  }

  if (req.url.startsWith('/rate')) {
    let query = querystring.parse(req.url.split('?')[1]);
    config.size = Number(query.size || 100);
    config.period = Number(query.period || 500);
    return res.end(JSON.stringify({
      size: config.size,
      period: config.period
    }));
  }

  if (req.url.startsWith('/stream')) {
    let query = querystring.parse(req.url.split('?')[1]);
    let start = Number(query.start || 0);
    let end = Number(query.end || 100);

    getRecords(start, end, (results, items) => {
      res.end(JSON.stringify(results));
    });
    return;
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

const populateData = (num = 1000) => {
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
  for(let i = 0; i < num; i += 1) {
    let record = {
        id: i,
        is_good: true,
        breed: breeds[i % breeds.length],
        ts: Date.now()
    };
    config.myDB.put(i, record);
  }
}

testCollectDistinct();

server.listen(config.port, config.hostname, () => {
  console.log(`Server running at http://${config.hostname}:${config.port}/`);
});
