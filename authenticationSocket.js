const jwt = require('jsonwebtoken');

const verifyToken = (socket, data) => {
    try {
      const token = data.token;
      if (!token) {
        console.log({ auth: false, message: 'No ws token provided.' })
        socket.emit("error", { auth: false, message: 'No ws token provided.' })
        return false
      } 
      return jwt.verify(token, socket.tokenkey, (err, decoded) => {
      if (err) {
        console.log(''+err)
        socket.emit("error", { auth: false, message: 'WS Token expired.' })
        return false;
      } 
        socket.data.username = decoded.username;
        socket.data.authorized = true
        return true;
    });
    } catch (e) {
        console.log(''+e);
        socket.emit("error", { auth: false, message: e.toString()})
    }
  }

  module.exports = verifyToken