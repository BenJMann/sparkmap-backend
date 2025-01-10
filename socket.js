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
            socket.emit("loggedIn", data.reload)
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
        await client.db(process.env.DATABASE_NAME).collection("nodes").insertMany([
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
        await client.db(process.env.DATABASE_NAME).collection("documents").insertOne({
            documentId,
            documentName,
            lastModified,
            user,
            shared: []
        })

        socket.emit("documentCreated", {documentId})
        await client.close();
    })


    function nestedToFlatArray(documentId, nested, creator) {
        const flatArray = [];
        const rootNodes = []
      
        function processNode(node) {
          const currentUuid = uuidv4();
          const { text, children } = node;
      
          // Create the MongoDB-style document
          const document = {
            documentId,
            id: currentUuid,
            text,
            children: [],
            creator
          };
      
          // Process each child recursively and add their UUIDs to the `children` array
            for (const child of children) {
                const childUuid = processNode(child, false);
                document.children.push(childUuid);
              }
          

          // Add the document to the flat array
          flatArray.push(document);
      
          return currentUuid;
        }
      
        // Process each root node
        for (const rootNode of nested) {
          const id = processNode(rootNode);
          rootNodes.push(id)
        }
      
        return {rootNodes, flatArray};
      }

    socket.on("loadCSV", async (data) => {
        if (!socket.data.authorized) return

        const documentId = makeid(12);
        const {rootNodes, flatArray} = nestedToFlatArray(documentId, JSON.parse(data.json), socket.data.username);

        const client = await getClient()

        await client.db(process.env.DATABASE_NAME).collection("nodes").insertMany([
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
        await client.db(process.env.DATABASE_NAME).collection("documents").insertOne({
            documentId,
            documentName,
            lastModified,
            user,
            shared: []
        })

        socket.emit("csvLoaded", {documentId})
        await client.close();
    })

    socket.on("getDocuments", async () => {
        if (!socket.data.authorized) return

        const client = await getClient()
        const documents = client.db(process.env.DATABASE_NAME).collection("documents").find({
           $or: [
            {user: socket.data.username},
            {shared: socket.data.username}
           ]
        })
        socket.emit("documentsGot", await documents.toArray())
        await client.close();
    })

    const loadDocument = async (client, documentId) => {
        const result2 = client.db(process.env.DATABASE_NAME).collection("nodes").find({documentId})
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

        const client = await getClient()
        const result = client.db(process.env.DATABASE_NAME).collection("documents").findOne({
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

        await client.close();
    })

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

        const client = await getClient();

        await client.db(process.env.DATABASE_NAME).collection("nodes").bulkWrite([
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
        
        await client.close();
        
        
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

        const client = await getClient();
        await client.db(process.env.DATABASE_NAME).collection("nodes").bulkWrite([
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
    
        await client.close();
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

        const client = await getClient();

        await client.db(process.env.DATABASE_NAME).collection("nodes").bulkWrite([
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
        
        await client.close();
        
    })

    socket.on("updateNodeText", async(data) => {
        if (!socket.data.authorized) return

        const nodeId = data.path.slice(-1)[0]
        let sockets = Array.from(io.sockets.sockets)  
        sockets.forEach((s) => {
            if (s[1].data.documentId === socket.data.documentId && s[1] !== socket)
                s[1].emit("nodeTextUpdated", {path: data.path, text: data.text, creator: socket.data.username})
        })

        const client = await getClient()
        await client.db(process.env.DATABASE_NAME).collection("nodes").updateOne({id: nodeId, documentId: socket.data.documentId}, {$set: {text: data.text, creator: socket.data.username}})

        await client.close();
    })

    socket.on("lockCell", async(data) => {
        if (!socket.data.authorized) return

        let sockets = Array.from(io.sockets.sockets)  
        sockets.forEach((s) => {
            if (s[1].data.documentId === socket.data.documentId && s[1] !== socket)
                s[1].emit("cellLocked", {path: data.path, locked: socket.data.username})
        })
    })

    socket.on("deleteCell", async(data) => {
        if (!socket.data.authorized) return

        let sockets = Array.from(io.sockets.sockets)  
        sockets.forEach((s) => {
            if (s[1].data.documentId === socket.data.documentId && s[1] !== socket)
                s[1].emit("cellDeleted", {path: data.path})
        })

        const nodeId = data.path.slice(-1)[0]
        const client = await getClient()
        const node = await client.db(process.env.DATABASE_NAME).collection("nodes").findOne({id: nodeId, documentId: socket.data.documentId})
        const children = node.children;
        const parent = await client.db(process.env.DATABASE_NAME).collection("nodes").findOne({id: data.parent, documentId: socket.data.documentId})
        let parentChildren = parent.children;

        const idx = parentChildren.indexOf(nodeId);
        if (children) {
            parentChildren = [...parentChildren.slice(0, idx), ...children, ...parentChildren.slice(idx+1, parentChildren.length)]
        }
        else {
            if (parentChildren.length >= 2)
                parentChildren = [...parentChildren.slice(0, idx), ...parentChildren.slice(idx+1, parentChildren.length)]
            else
                parentChildren = []
        }  
        await client.db(process.env.DATABASE_NAME).collection("nodes").updateOne({id: parent.id, documentId: socket.data.documentId}, {$set: {children: parentChildren}})
        await client.db(process.env.DATABASE_NAME).collection("nodes").deleteOne({id: nodeId, documentId: socket.data.documentId})
        await client.close();
    })

    socket.on("shareDocument", async(data) => {
        if (!socket.data.authorized) return

        const client = await getClient()
        const user = await client.db(process.env.DATABASE_NAME).collection("users").findOne({username: data.username})
        if (!user) {
            socket.emit("documentShared", {error: true, message: 'User does not exist.'})
            return
        }
        await client.db(process.env.DATABASE_NAME).collection("documents").updateOne({documentId: socket.data.documentId}, {$push: {shared: data.username}})
        socket.emit("documentShared", {error: false})

        await client.close();
    })
  };