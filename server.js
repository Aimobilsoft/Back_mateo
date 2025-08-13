var app = require('./server/');
var debug = require('debug')('optica-back:server');
var http = require('http');
var APP = require('./constants');

let port = process.env.PORT || 3001;

//app.set('port', port);

var server = http.createServer(app);
server.listen(port, '0.0.0.0', function(err) {
  if(err) throw err;
  console.log("API corriendo en el puerto " + port);
});

server.on('error', onError);
server.on('listening', onListening);

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string' ?
    'Pipe ' + port :
    'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string' ?
    'pipe ' + addr :
    'port ' + addr.port;
  debug('Listening on ' + bind);
}