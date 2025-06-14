const verifyToken = require('../authenticationSocket.js')

module.exports = function(socket, io) {
        socket.on("login", async (data) => {
        if (verifyToken(socket, data)) {
            console.log("Logged in", socket.id)
            socket.emit("loggedIn", data.reload)
        }

    })

    socket.on("recoveredLogin", async (data) => {
        if (verifyToken(socket, data)) {
            console.log("Recovered LoggedIn", socket.id)
            socket.emit("recoveredLoggedIn", data.reload)
        }

    })

    socket.on("logOut", async () => {
        socket.data.authorized = false;
        socket.emit("loggedOut")
    })
}