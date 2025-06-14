const verifyToken = require('../authenticationSocket.js')
const {v4: uuidv4} = require('uuid')
const {getDB, getClient} = require('../getClient.js')

const {makeid, nestedToFlatArray} = require("./util.js")

const authHandlers = require("./authHandlers.js")
const documentHandlers = require("./documentHandlers.js")
const newNodeHandlers = require("./newNodeHandlers.js")
const singleNodeOperations = require ("./singleNodeOperations.js")
const multiNodeOperations = require("./multiNodeOperations.js");
const AIHandlers = require("./AIHandler.js")


module.exports = function(socket, io) {

    authHandlers(socket, io);
    documentHandlers(socket, io);
    newNodeHandlers(socket, io);
    singleNodeOperations(socket, io);
    multiNodeOperations(socket, io);
    AIHandlers(socket, io);

    socket.on("disconnect", () => {
      console.log("Client disconnected", socket.id);
    });



}