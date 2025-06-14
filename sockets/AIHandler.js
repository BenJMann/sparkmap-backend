const {getDB} = require('../getClient.js')
const {generateChildNodes} = require('../AIClient.js')

module.exports = function(socket, io) {
    socket.on("generateSuggestion", async(data) => {
        if (!socket.data.authorized) return

        const newNodes = await generateChildNodes(3, data.map);

        socket.emit("suggestionGenerated", {newNodes: JSON.stringify(newNodes), path: data.node})

        
    //     let sockets = Array.from(io.sockets.sockets)  
    //     sockets.forEach((s) => {
    //         if (s[1].data.documentId === socket.data.documentId && s[1] !== socket)
    //             s[1].emit("cellDeleted", {path: data.path})
    //     })

    //     const nodeId = data.path.slice(-1)[0]
    //     const client = await getDB()
    //     const session = client.client.startSession();
    //     try {

    //         await session.withTransaction( async() => {
    //             const node = await client.collection("nodes").findOne({id: nodeId, documentId: socket.data.documentId})
    //             const children = node.children;
    //             const parent = await client.collection("nodes").findOne({id: data.parent, documentId: socket.data.documentId})
    //             let parentChildren = parent.children;

    //             const idx = parentChildren.indexOf(nodeId);
    //             if (children) {
    //                 parentChildren = [...parentChildren.slice(0, idx), ...children, ...parentChildren.slice(idx+1, parentChildren.length)]
    //             }
    //             else if (parentChildren.length >= 2)
    //                     parentChildren = [...parentChildren.slice(0, idx), ...parentChildren.slice(idx+1, parentChildren.length)]
    //             else
    //                 parentChildren = []  
    //             await client.collection("nodes").updateOne({id: parent.id, documentId: socket.data.documentId}, {$set: {children: parentChildren}})
    //             await client.collection("nodes").deleteOne({id: nodeId, documentId: socket.data.documentId})
    //         })
            
    //     } catch (error) {
    //         console.error("Error in deleteCell:", error);
    //     } finally {
    //         session.endSession();
    //     }
    })
}