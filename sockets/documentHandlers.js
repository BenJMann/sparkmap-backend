const {makeid, nestedToFlatArray} = require("./util.js")
const {v4: uuidv4} = require('uuid')
const {getDB} = require('../getClient.js')

module.exports = function(socket, io) {
//----------New Document Operations-----------------

    socket.on("newDocument", async (data) => {
        if (!socket.data.authorized) return

        const client = await getDB()
        const documentId = makeid(12);

        const rootId = uuidv4();
        const childId = uuidv4();
        await client.collection("nodes").insertMany([
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
        await client.collection("documents").insertOne({
            documentId,
            documentName,
            lastModified,
            user,
            shared: []
        })

        socket.emit("documentCreated", {documentId})
    })


    

    socket.on("loadCSV", async (data) => {
        if (!socket.data.authorized) return

        const documentId = makeid(12);
        const {rootNodes, flatArray} = nestedToFlatArray(documentId, JSON.parse(data.json), socket.data.username);

        const client = await getDB()

        await client.collection("nodes").insertMany([
            {
                documentId,
                id: uuidv4(),
                root: true,
                children: rootNodes,
                creator: socket.data.username
            },
            ...flatArray])

        const documentName = data.name;
        const lastModified = new Date()
        const user = socket.data.username;
        await client.collection("documents").insertOne({
            documentId,
            documentName,
            lastModified,
            user,
            shared: []
        })

        socket.emit("csvLoaded", {documentId})
    })

//--------------Get Documents-----------------------------
    socket.on("getDocuments", async () => {
        if (!socket.data.authorized) return

        const client = await getDB()
        const documents = client.collection("documents").find({
           $or: [
            {user: socket.data.username},
            {shared: socket.data.username}
           ]
        })
        socket.emit("documentsGot", await documents.toArray())
    })

    const loadDocument = async (client, documentId) => {
        const result2 = client.collection("nodes").find({documentId})
        const nodes = await result2.toArray();
        const rootNode = nodes.find((n) => n.root === true)
        console.log(rootNode)
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

        return {rootNode, warnings};
    }

    socket.on("loadDocument", async(data) => {
        if (!socket.data.authorized) return

        const client = await getDB()
        const result = client.collection("documents").findOne({
            documentId: data.documentId,
            $or: [
                {user: socket.data.username},
                {shared: socket.data.username}
            ]
        })

        const doc = await result;
        if (!doc) {
            socket.emit("fatalError", {error: true, message: "You are not authorized to view this document, or it doesn't exist"})
            return
        }

        socket.data.documentId = data.documentId;

        const {warnings, rootNode} = await loadDocument(client, data.documentId)

        socket.emit("documentLoaded", {warnings, nodes: [rootNode], document: doc})
    })

//------------Document Operations-----------------------

    socket.on("shareDocument", async(data) => {
        if (!socket.data.authorized) return

        const client = await getDB()
        const user = await client.collection("users").findOne({username: data.username})
        if (!user) {
            socket.emit("documentShared", {error: true, message: 'User does not exist.'})
            return
        }
        await client.collection("documents").updateOne({documentId: socket.data.documentId}, {$push: {shared: data.username}})
        socket.emit("documentShared", {error: false})
    })

    socket.on("renameDocument", async (data) => {
        if (!socket.data.authorized) return

        const client = await getDB()

        await client.collection("documents").updateOne({
            documentId: data.documentId,
            user: socket.data.username
        },     
            {$set: {documentName: data.newDocumentName}})

        const documents = client.collection("documents").find({
           $or: [
            {user: socket.data.username},
            {shared: socket.data.username}
           ]
        })
        socket.emit("documentsGot", await documents.toArray())
    })

    socket.on("deleteDocument", async (data) => {
        if (!socket.data.authorized) return

        const client = await getDB()

        await client.collection("documents").deleteOne({
            documentId: data.documentId,
            user: socket.data.username
        })

        await client.collection("nodes").deleteMany({
            documentId: data.documentId
        })

        const documents = client.collection("documents").find({
           $or: [
            {user: socket.data.username},
            {shared: socket.data.username}
           ]
        })
        socket.emit("documentsGot", await documents.toArray())
    })


}