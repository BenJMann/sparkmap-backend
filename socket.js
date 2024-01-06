const verifyToken = require('./authenticationSocket')
const {v4: uuidv4} = require('uuid')
const getClient = require('./getClient.js')


function makeid(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
}

module.exports = function(socket, io) {
    socket.on("login", async (data) => {
        if (verifyToken(socket, data)) {
            console.log("Logged in", socket.id)
            socket.emit("loggedIn")
        }

    })

    socket.on("loadSession", async (data) => {
        if (verifyToken(socket, data)) {
            console.log("Logged in", socket.id)
            socket.emit("sessionLoaded");
        }
    })

    socket.on("logOut", async () => {
        socket.data.authorized = false;
        socket.emit("loggedOut")
    })

    socket.on("disconnect", () => {
      console.log("Client disconnected", socket.id);
    });

    socket.on("newDocument", async (data) => {
        if (!socket.data.authorized) return

        const client = await getClient()
        const documentId = makeid(12);

        const rootId = uuidv4();
        const childId = uuidv4();
        await client.db("sparkmap").collection("nodes").insertMany([
            {
                documentId,
                root: true,
                id: rootId,
                children: [
                    childId
                ]
            },
            {
                documentId,
                id: childId,
                text: '',
            }
        ])

        const documentName = data.name;
        const lastModified = new Date()
        const user = socket.data.username;
        await client.db("sparkmap").collection("documents").insertOne({
            documentId,
            documentName,
            lastModified,
            user,
            shared: []
        })

        socket.emit("documentCreated", {documentId})
        await client.close();

    })

    socket.on("getDocuments", async () => {
        if (!socket.data.authorized) return

        const client = await getClient()
        const documents = client.db("sparkmap").collection("documents").find({
           $or: [
            {user: socket.data.username},
            {shared: socket.data.username}
           ]
        })
        socket.emit("documentsGot", await documents.toArray())
        await client.close();
    })

    socket.on("loadDocument", async(data) => {
        if (!socket.data.authorized) return

        const client = await getClient()
        const result = client.db("sparkmap").collection("documents").findOne({
            documentId: data.documentId,
            $or: [
                {user: socket.data.username},
                {shared: socket.data.username}
            ]
        })
        if (!result) {
            socket.emit("fatalError", {error: true, message: "You are not authorized to view this document, or it doesn't exist"})
            return
        }

        socket.data.documentId = data.documentId;

        const result2 = client.db("sparkmap").collection("nodes").find({documentId: data.documentId})

        const nodes = await result2.toArray();

        const rootNode = nodes.find((n) => n.root = true)

        const warnings = []

        function addChildren(node) {
            if (node.children) {
                node.children = node.children.map((id) => {
                    const resolvedChild = nodes.find((nc) => nc.id === id)
                    if (!resolvedChild) {warnings.push("Could not find child node"); return {text: 'NODE NOT FOUND'}}
                    else {
                        addChildren(resolvedChild);
                        return resolvedChild
                    }
                })
            }
        }
        addChildren(rootNode);

        socket.emit("documentLoaded", {warnings, nodes: [rootNode], document: result})

        await client.close();
    })

    socket.on("newSiblingNode", async (data) => {
        if (!socket.data.authorized) return

        const client = await getClient()
        const id = uuidv4();
        const parentId = data.path.slice(-2)[0]
        const nodeId = data.path.slice(-1)[0]
        const parent = await client.db("sparkmap").collection("nodes").findOne({id: parentId, documentId: socket.data.documentId})
        console.log(parent);
        const children = parent.children;
        const idx = children.indexOf(nodeId);
        const newChildren = [...children.slice(0, idx + (!data.before ? 1 : 0)), id, ...children.slice(idx + (!data.before ? 1 : 0), children.length)]
        console.log("ti", data.temporaryId)
       
        await client.db("sparkmap").collection("nodes").updateOne({id: parentId, documentId: socket.data.documentId}, {$set: {children: newChildren}})

        await client.db("sparkmap").collection("nodes").insertOne({id, text: '', documentId: socket.data.documentId, creator: socket.data.username})
        let sockets = Array.from(io.sockets.sockets)  
        sockets.forEach((s) => {
            if (s[1].data.documentId === socket.data.documentId && s[1] !== socket)
                s[1].emit("newSiblingNodeCreated", {path: data.path, before: data.before, creator: socket.data.username, id})
            else if (s[1].data.documentId === socket.data.documentId)
                s[1].emit("newNodeCompleted", {creator: socket.data.username, id, temporaryId: data.temporaryId})
        })
        await client.close();
    })

    socket.on("newChildNode", async (data) => {
        if (!socket.data.authorized) return

        const client = await getClient()
        const id = uuidv4();
        const nodeId = data.path.slice(-1)[0]
        await client.db("sparkmap").collection("nodes").updateOne({id: nodeId, documentId: socket.data.documentId}, {$set: {children: [id]}})
        await client.db("sparkmap").collection("nodes").insertOne({id, text: '', documentId: socket.data.documentId, creator: socket.data.username})
        let sockets = Array.from(io.sockets.sockets)  
        sockets.forEach((s) => {
            if (s[1].data.documentId === socket.data.documentId && s[1] !== socket)
                s[1].emit("newChildNodeCreated", {path: data.path, creator: socket.data.username, id})
            else if (s[1].data.documentId === socket.data.documentId)
                s[1].emit("newNodeCompleted", {creator: socket.data.username, id, temporaryId: data.temporaryId})
        })

        await client.close();
    })

    socket.on("updateNodeText", async(data) => {
        if (!socket.data.authorized) return

        const client = await getClient()
        const nodeId = data.path.slice(-1)[0]
        await client.db("sparkmap").collection("nodes").updateOne({id: nodeId, documentId: socket.data.documentId}, {$set: {text: data.text, creator: socket.data.username}})
        let sockets = Array.from(io.sockets.sockets)  
        sockets.forEach((s) => {
            if (s[1].data.documentId === socket.data.documentId && s[1] !== socket)
                s[1].emit("nodeTextUpdated", {path: data.path, text: data.text, creator: socket.data.username})
        })

        await client.close();
    })

    socket.on("shareDocument", async(data) => {
        if (!socket.data.authorized) return

        const client = await getClient()
        const user = await client.db("sparkmap").collection("users").findOne({username: data.username})
        if (!user) {
            socket.emit("documentShared", {error: true, message: 'User does not exist.'})
            return
        }
        await client.db("sparkmap").collection("documents").updateOne({documentId: socket.data.documentId}, {$push: {shared: data.username}})
        socket.emit("documentShared", {error: false})

        await client.close();
    })
  };