const {getDB} = require('../getClient.js')
const {generateChildNodes} = require('../AIClient.js')

module.exports = function(socket, io) {
    socket.on("generateSuggestion", async(data) => {
        if (!socket.data.authorized) return

        const newNodes = await generateChildNodes(3, data.map);

        socket.emit("suggestionGenerated", {newNodes: JSON.stringify(newNodes), path: data.node})
    });
}