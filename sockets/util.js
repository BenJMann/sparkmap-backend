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

module.exports.makeid = makeid;

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

module.exports.nestedToFlatArray = nestedToFlatArray