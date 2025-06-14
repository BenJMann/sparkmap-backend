const {getDB} = require('../getClient.js')

module.exports = function(socket, io) {


    socket.on("deleteCell", async(data) => {
        if (!socket.data.authorized) return

        let sockets = Array.from(io.sockets.sockets)  
        sockets.forEach((s) => {
            if (s[1].data.documentId === socket.data.documentId && s[1] !== socket)
                s[1].emit("cellDeleted", {path: data.path})
        })

        const nodeId = data.path.slice(-1)[0]
        const client = await getDB()
        const session = client.client.startSession();
        try {

            await session.withTransaction( async() => {
                const node = await client.collection("nodes").findOne({id: nodeId, documentId: socket.data.documentId})
                const children = node.children;
                const parent = await client.collection("nodes").findOne({id: data.parent, documentId: socket.data.documentId})
                let parentChildren = parent.children;

                const idx = parentChildren.indexOf(nodeId);
                if (children) {
                    parentChildren = [...parentChildren.slice(0, idx), ...children, ...parentChildren.slice(idx+1, parentChildren.length)]
                }
                else if (parentChildren.length >= 2)
                        parentChildren = [...parentChildren.slice(0, idx), ...parentChildren.slice(idx+1, parentChildren.length)]
                else
                    parentChildren = []  
                await client.collection("nodes").updateOne({id: parent.id, documentId: socket.data.documentId}, {$set: {children: parentChildren}})
                await client.collection("nodes").deleteOne({id: nodeId, documentId: socket.data.documentId})
            })
            
        } catch (error) {
            console.error("Error in deleteCell:", error);
        } finally {
            session.endSession();
        }
    })

    socket.on("pasteNode", async(data) => {
        const {before, toPath, fromPath} = data

        let sockets = Array.from(io.sockets.sockets)  
        sockets.forEach((s) => {
            if (s[1].data.documentId === socket.data.documentId && s[1] !== socket)
                s[1].emit("nodePasted", data)
        })

        const toId = toPath.slice(-1)[0]
        const fromId = fromPath.slice(-1)[0]

        const client = await getDB();
        const session = client.client.startSession();
        try {
            await session.withTransaction( async () => {
                const documents = client.collection('nodes');

                const nodeFrom = await documents.findOne({ id: fromId });
                const nodeTo = await documents.findOne({ id: toId });

                if (!nodeFrom || !nodeTo) {
                    throw new Error("Source or target node not found.");
                }

                // Prevent pasting a node as a child of itself
                if (await isNodeParentOf(documents, nodeTo, nodeFrom)) {
                    throw new Error("Cannot paste a node into one of its descendants.");
                }

                const toParent = await documents.findOne({ children: toId });
                const fromParent = await documents.findOne({ children: fromId });

                if (!toParent || !fromParent) {
                    throw new Error("Parent nodes not found.");
                }

                // Find insertion and removal indices
                const toIdx = toParent.children.indexOf(toId) + (!before ? 1 : 0);
                const fromIdx = fromParent.children.indexOf(fromId);

                if (toIdx === -1 || fromIdx === -1) {
                    throw new Error("Invalid node indices for paste operation.");
                }

                if (toParent.id == fromParent.id) {
                    // Reorder within the same parent
                    const children = [...fromParent.children];
                    const [movedNode] = children.splice(fromIdx, 1); // Remove nodeFrom
                    children.splice(toIdx > fromIdx ? toIdx - 1 : toIdx, 0, movedNode); // Insert at new index
                    await documents.updateOne({ id: fromParent.id }, { $set: { children } });
                } else {
                    // Move node between different parents
                    await documents.updateOne({ id: fromParent.id }, { $pull: { children: fromId } }); // Remove from old parent
                    await documents.updateOne({ id: toParent.id }, { $push: { children: { $each: [fromId], $position: toIdx } } }); // Add to new parent
                }
            })
            
        } catch (error) {
            console.error("Error in pasteNode:", error);
        } finally {
            session.endSession();
        }
    });

    socket.on("pasteNodeAsChild", async(data) => {
        const {before, toPath, fromPath} = data

        let sockets = Array.from(io.sockets.sockets)  
        sockets.forEach((s) => {
            if (s[1].data.documentId === socket.data.documentId && s[1] !== socket)
                s[1].emit("nodePastedAsChild", data)
        })

        const toId = toPath.slice(-1)[0]
        const fromId = fromPath.slice(-1)[0]

        const client = await getDB();
        const session = client.client.startSession();
        try {
            await session.withTransaction( async () => {
                const documents = client.collection('nodes');

                const nodeFrom = await documents.findOne({ id: fromId });
                const nodeTo = await documents.findOne({ id: toId });

                if (!nodeFrom || !nodeTo) {
                    throw new Error("Source or target node not found.");
                }

                // Prevent pasting a node as a child of itself
                if (await isNodeParentOf(documents, nodeTo, nodeFrom)) {
                    throw new Error("Cannot paste a node into one of its descendants.");
                }

                const fromParent = await documents.findOne({ children: fromId });

                if (!fromParent) {
                    throw new Error("Parent nodes not found.");
                }
                
                // Move node between different parents
                await documents.updateOne({ id: fromParent.id }, { $pull: { children: fromId } }); // Remove from old parent
                await documents.updateOne({ id: toId }, { $push: { children: fromId} }); // Add to new parent
            })
            
        } catch (error) {
            console.error("Error in pasteNode:", error);
        } finally {
            session.endSession();
        }
    });

    const isNodeParentOf = async (documents, node, parent) => {
        let curNode = await documents.findOne({ children: node.id });
        while (curNode) {
            if (curNode.id === parent.id) return true;
            curNode = await documents.findOne({ children: curNode.id });
        }
        return false;
    }
}