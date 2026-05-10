const simpleDDP = require('simpleddp');
const WebSocket = require('isomorphic-ws');
const config = require('./config');

const server = new simpleDDP({
  endpoint: config.meteorDdpEndpoint,
  SocketConstructor: WebSocket,
  reconnectInterval: 10000,
});

let connectPromise = null;

function connectMeteor() {
  if (server.connected) return Promise.resolve(server);
  if (connectPromise) return connectPromise;

  connectPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      connectPromise = null;
      reject(new Error(`No se pudo conectar a Meteor DDP: ${config.meteorDdpEndpoint}`));
    }, 15000);

    const cleanup = () => {
      clearTimeout(timeout);
      server.off?.('connected', onConnected);
      server.off?.('error', onError);
    };

    const onConnected = () => {
      cleanup();
      console.log(`Conectado a Meteor DDP: ${config.meteorDdpEndpoint}`);
      resolve(server);
    };

    const onError = (error) => {
      cleanup();
      connectPromise = null;
      reject(error);
    };

    server.on('connected', onConnected);
    server.on('error', onError);

    try {
      server.connect();
    } catch (error) {
      cleanup();
      connectPromise = null;
      reject(error);
    }
  });

  return connectPromise;
}

server.on('disconnected', () => {
  console.warn('Desconectado de Meteor DDP');
  connectPromise = null;
});

server.on('error', (error) => {
  console.error('Error global de Meteor DDP:', error?.message || error);
});

async function callMeteor(methodName, ...params) {
  const ddp = await connectMeteor();
  return ddp.call(methodName, ...params);
}

module.exports = {
  callMeteor,
  connectMeteor,
  server,
};