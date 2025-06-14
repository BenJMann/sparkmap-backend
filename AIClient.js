
const { AzureOpenAI } = require("openai");

// Configuration
const resourceName = "benm-mbw50a5d-swedencentral";
const deploymentName = "gpt-4.1";
const apiKey = process.env.AZUREOPENAI_APIKEY;
const apiVersion = "2024-02-15-preview"; // Use latest stable version

// Create the client
const client = new AzureOpenAI({
  apiKey: apiKey,
  endpoint: "https://benm-mbw50a5d-swedencentral.cognitiveservices.azure.com/",
  apiVersion: apiVersion,
});

module.exports.client = () => client;

async function generateChildNodes(depth, map, prompt) {
  try {
    const response = await client.chat.completions.create({
      model: deploymentName,
      messages: [
        { 
          role: "system", 
          content: "You generate nested JSON structures where each node can have children of the same type." 
        },
        { 
          role: "user", 
          content: `<Instruction>
                      Complete the mindmap provided in JSON format, without repeating any nodes from the source. 
                      You should generate an additional  ${depth} levels, starting at the node flagged with the variable "nodeToGenerateFrom". 
                      Each node should have: text, and children array.

                      The root node should be the same as the nodeToGenerateFrom node

                      The last level should have full sentences for the text field.

                      Deserialize the mindmap provided, at look:
                        1. Broadly at the whole thing to get context
                        2. Very carefully around the nodeToGenerateFrom node, because this and it's immediate parents tell you what to talk about
                        3. VERY VERY Carefully at the nodeToGenerate node. This is your immediate prompt.
                   </Instruction>
                   <OutputShape>
                    The node at level 1 should have 3 children.
                    The nodes at level 2 should have 2 to 3 children.
                    The nodes at level 3 should have 2 children.
                   </OutputShape>
                  <MindMapToComplete>
                    ${map}
                  </MindMapToComplete>
                  ${prompt && `<Prompt>
                    ${prompt}
                  </Prompt>` }`
        }
      ],
      tools: [{
        type: "function",
        function: {
          name: "generate_nested_structure",
          description: "Generates a nested JSON structure with parent-child relationships",
          parameters: {
            type: "object",
            properties: {
              root: {
                type: "array",
                items: {
                  $ref: "#/definitions/node"
                }
              }
            },
            definitions: {
              node: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  children: {
                    type: "array",
                    items: {
                      $ref: "#/definitions/node" // Recursive reference
                    }
                  }
                },
                required: ["text"],
                additionalProperties: false
              }
            },
            required: ["root"]
          }
        }
      }],
      tool_choice: {
        type: "function",
        function: { name: "generate_nested_structure" }
      },
      temperature: 0.7,
      max_tokens: 2000
    });

    const args = response.choices[0].message.tool_calls[0].function.arguments;
    const nestedData = JSON.parse(args);
    console.log(JSON.stringify(nestedData, null, 2));
    return nestedData;
  } catch (error) {
    console.error("Error:", error);
  }
}

module.exports.generateChildNodes = generateChildNodes;
// generateChildNodes(2, 3, "Give me some choices of things to do in the summer.");