const {getDB} = require('../getClient.js')

module.exports = function(socket, io) {
    socket.on("updateNodeText", async(data) => {
        if (!socket.data.authorized) return

        const nodeId = data.path.slice(-1)[0]
        let sockets = Array.from(io.sockets.sockets)  
        sockets.forEach((s) => {
            if (s[1].data.documentId === socket.data.documentId && s[1] !== socket)
                s[1].emit("nodeTextUpdated", {path: data.path, text: data.text, creator: socket.data.username})
        })

        const client = await getDB()
        try {
            await client.collection("nodes").updateOne({id: nodeId, documentId: socket.data.documentId}, {$set: {text: data.text, creator: socket.data.username}})
        } catch (error) {
            console.error("Error in updateNodeText", error)
        }
    })

    socket.on("updateNodeStyle", async(data) => {
        if (!socket.data.authorized) return

        const nodeId = data.path.slice(-1)[0]
        let sockets = Array.from(io.sockets.sockets)  
        sockets.forEach((s) => {
            if (s[1].data.documentId === socket.data.documentId && s[1] !== socket)
                s[1].emit("nodeStyleUpdated", {path: data.path, property: data.property, value: data.value})
        })

        const client = await getDB()
        try {
            await client.collection("nodes").updateOne({id: nodeId, documentId: socket.data.documentId}, {$set: {[`style.${data.property}`]: data.value}})
        } catch (error) {
            console.error("Error in updateNodeStyle", error)
        }
    })

    socket.on("lockCell", async(data) => {
        if (!socket.data.authorized) return

        let sockets = Array.from(io.sockets.sockets)  
        sockets.forEach((s) => {
            if (s[1].data.documentId === socket.data.documentId && s[1] !== socket)
                s[1].emit("cellLocked", {path: data.path, locked: socket.data.username})
        })
    })
}