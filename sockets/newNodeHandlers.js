const {v4: uuidv4} = require('uuid')
const {getDB} = require('../getClient.js')

module.exports = function(socket, io) {

    socket.on("newSiblingNode", async (data) => {
        if (!socket.data.authorized) return


        const id = uuidv4();
        const parentId = data.path.slice(-2)[0]
        const nodeId = data.path.slice(-1)[0]

        let sockets = Array.from(io.sockets.sockets)  
        sockets.forEach((s) => {
            if (s[1].data.documentId === socket.data.documentId && s[1] !== socket)
                s[1].emit("newSiblingNodeCreated", {path: data.path, before: data.before, creator: socket.data.username, id, locked: socket.data.username})
            else if (s[1].data.documentId === socket.data.documentId)
                s[1].emit("newNodeCompleted", {creator: socket.data.username, id, temporaryId: data.temporaryId})
        })

        const client = await getDB();

        await client.collection("nodes").bulkWrite([
            {
                updateOne: {
                    filter: { id: parentId, documentId: socket.data.documentId },
                    update: [
                        {
                            $set: {
                                children: {
                                    $let: {
                                        vars: {
                                            idx: { $indexOfArray: ["$children", nodeId] },
                                        },
                                        in: {
                                            $cond: {
                                                if: { $lt: [{$add: ["$$idx", data.before ? 0 : 1]}, 1] },
                                                then: {$concatArrays: [
                                                    [id],
                                                    "$children",
                                                ]},
                                                else: {
                                                    $concatArrays: [
                                                        { $slice: ["$children", 0, { $add: ["$$idx", data.before ? 0 : 1] }] },
                                                        [id],
                                                        { $slice: ["$children", { $add: ["$$idx", data.before ? 0 : 1] }, { $size: "$children" }] },
                                                    ],
                                                },
                                            }
                                        },
                                    },
                                },
                            },
                        },
                    ],
                },
            },
            {
                insertOne: {
                    document: {
                        id,
                        text: '',
                        documentId: socket.data.documentId,
                        creator: socket.data.username,
                    },
                },
            },
        ]);
        
        
    })


    socket.on("newChildNode", async (data) => {
        if (!socket.data.authorized) return
        const id = uuidv4();
        const nodeId = data.path.slice(-1)[0]
        let sockets = Array.from(io.sockets.sockets)  
        sockets.forEach((s) => {
            if (s[1].data.documentId === socket.data.documentId && s[1] !== socket)
                s[1].emit("newChildNodeCreated", {path: data.path, creator: socket.data.username, id, locked: socket.data.username})
            else if (s[1].data.documentId === socket.data.documentId)
                s[1].emit("newNodeCompleted", {creator: socket.data.username, id, temporaryId: data.temporaryId})
        })

        const client = await getDB();
        await client.collection("nodes").bulkWrite([
            // Update the parent's children array
            {
                updateOne: {
                    filter: { id: nodeId, documentId: socket.data.documentId },
                    update: { $push: { children: id } },
                },
            },
            // Insert the new node
            {
                insertOne: {
                    document: {
                        id,
                        text: '',
                        documentId: socket.data.documentId,
                        creator: socket.data.username,
                    },
                },
            },
        ]);
    })

    socket.on("appendChildNode", async (data) => {
        if (!socket.data.authorized) return


        const id = uuidv4();
        const nodeId = data.path.slice(-1)[0]

        let sockets = Array.from(io.sockets.sockets)  
        sockets.forEach((s) => {
            if (s[1].data.documentId === socket.data.documentId && s[1] !== socket)
                s[1].emit("newChildNodeAppended", {path: data.path,  creator: socket.data.username, id, locked: socket.data.username})
            else if (s[1].data.documentId === socket.data.documentId)
                s[1].emit("newNodeCompleted", {creator: socket.data.username, id, temporaryId: data.temporaryId})
        })

        const client = await getDB();

        await client.collection("nodes").bulkWrite([
            // Update the parent's children array by appending the new ID
            {
                updateOne: {
                    filter: { id: nodeId, documentId: socket.data.documentId },
                    update: { $push: { children: id } },
                },
            },
            // Insert the new node
            {
                insertOne: {
                    document: {
                        id,
                        text: '',
                        documentId: socket.data.documentId,
                        creator: socket.data.username,
                    },
                },
            },
        ]);
        
        
    })
}