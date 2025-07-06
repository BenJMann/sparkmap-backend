
function generateChildNodes() {
  return {}
}


// const { AzureOpenAI } = require("openai");

// // Configuration
// const resourceName = "benm-mbw50a5d-swedencentral";
// const deploymentName = "gpt-4.1";
// const apiKey = process.env.AZUREOPENAI_APIKEY;
// const apiVersion = "2024-02-15-preview"; // Use latest stable version

// // Create the client
// const client = new AzureOpenAI({
//   apiKey: apiKey,
//   endpoint: "https://benm-mbw50a5d-swedencentral.cognitiveservices.azure.com/",
//   apiVersion: apiVersion,
// });

// module.exports.client = () => client;

// async function generateChildNodes(depth, map, prompt) {
//   try {
//     const response = await client.chat.completions.create({
//       model: deploymentName,
//       messages: [
//         { 
//           role: "system", 
//           content: "You generate nested JSON structures where each node can have children of the same type." 
//         },
//         { 
//           role: "user", 
//           content: `
//             You are an AI that generates nested JSON mindmap structures.

//             Input:
//             - A mindmap JSON object is provided, representing a tree of nodes.
//             - Each node has "text" and "children" properties.
//             - You must generate additional nested child nodes extending the mindmap by exactly ${depth} levels,
//               starting from the node identified by "nodeToGenerateFrom".
//             - Do not repeat any existing nodes.
//             - The root node of your output should be the same node as "nodeToGenerateFrom" (with new children appended).
//             - The last level (deepest) of nodes should have full sentences in the "text" field.
//             - The number of children per level must follow these rules:
//               - Level 1 nodes: exactly 3 children
//               - Level 2 nodes: 2 to 3 children each
//               - Level 3 nodes: exactly 2 children each

//             Output:
//             - Return only the JSON object representing the root node (no extra explanation or text).
//             - The JSON must be valid and parseable.
//             - Ensure all children nodes follow the schema and constraints above.

//             Input mindmap JSON:

//             ${map}

//             ${prompt ? `Additional prompt:

//             ${prompt}` : ''}`
//         }
//       ],
//       tools: [{
//         type: "function",
//         function: {
//           name: "generate_nested_structure",
//           description: "Generates a nested JSON structure with parent-child relationships",
//           parameters: {
//             type: "object",
//             properties: {
//               root: {
//                 type: "array",
//                 items: {
//                   $ref: "#/definitions/node"
//                 }
//               }
//             },
//             definitions: {
//               node: {
//                 type: "object",
//                 properties: {
//                   text: { type: "string" },
//                   children: {
//                     type: "array",
//                     items: {
//                       $ref: "#/definitions/node" // Recursive reference
//                     }
//                   }
//                 },
//                 required: ["text"],
//                 additionalProperties: false
//               }
//             },
//             required: ["root"]
//           }
//         }
//       }],
//       tool_choice: {
//         type: "function",
//         function: { name: "generate_nested_structure" }
//       },
//       temperature: 0.7,
//       max_tokens: 2000
//     });

//     const args = response.choices[0].message.tool_calls[0].function.arguments;
//     const nestedData = JSON.parse(args);
//     console.log(JSON.stringify(nestedData, null, 2));
//     return nestedData;
//   } catch (error) {
//     console.error("Error:", error);
//   }
// }

module.exports.generateChildNodes = generateChildNodes;
// generateChildNodes(2, 3, "Give me some choices of things to do in the summer.");