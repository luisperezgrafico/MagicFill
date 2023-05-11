async function showMainUI() {
  figma.showUI(__html__, { width: 250, height: 368 });

  // Retrieve the stored API key and model from Figma client storage
  const apiKey = await figma.clientStorage.getAsync("openai_api_key");
  let selectedModel = await figma.clientStorage.getAsync(
    "openai_selected_model"
  );

  // If selectedModel is undefined, set it to the default model
  if (!selectedModel) {
    selectedModel = "gpt-3.5-turbo";
    await figma.clientStorage.setAsync("openai_selected_model", selectedModel);
  }

  // console.log("Retrieved API Key:", apiKey);
  // console.log("Retrieved Model:", selectedModel);

  // Check if API key exists
  if (!apiKey) {
    // If API key doesn't exist, show the API Key modal
    // console.log("API Key not found. Showing API Key modal.");
    figma.ui.postMessage({ type: "show-api-key-modal" });
  } else {
    // If API key exists, send the stored API key and model to the UI
    // console.log("Sending stored API Key to UI:", apiKey);
    // console.log("Sending stored Model to UI:", selectedModel);
    figma.ui.postMessage({
      type: "update-api-key",
      data: { apiKey, selectedModel },
    });
    figma.ui.postMessage({ type: "hide-api-key-modal" });
  }
}

showMainUI();

let userId = figma.currentUser?.id ?? "default_id";
let userName = figma.currentUser?.name ?? "default_name";

async function saveAPIKey(data: { apiKey: string; selectedModel: string }) {
  const { apiKey, selectedModel } = data;

  if (apiKey.trim() !== "") {
    await figma.clientStorage.setAsync("openai_api_key", apiKey);
    // console.log("API Key saved:", apiKey);
  } else {
    // Delete the stored value if the input field is empty
    await figma.clientStorage.deleteAsync("openai_api_key");
    // console.log("API Key deleted.");
  }

  if (selectedModel.trim() !== "") {
    await figma.clientStorage.setAsync("openai_selected_model", selectedModel);
    // console.log("Model saved:", selectedModel);
  } else {
    // Delete the stored value if the input field is empty
    await figma.clientStorage.deleteAsync("openai_selected_model");
    // console.log("Model deleted.");
  }

  figma.ui.postMessage({
    type: "update-api-key",
    data: { apiKey, selectedModel },
  });
}

async function openAIApi(requestBody: any): Promise<any> {
  // console.log("Payload:", JSON.stringify(requestBody, null, 2));

  const API_KEY = await figma.clientStorage.getAsync("openai_api_key");
  // console.log("API Key:", API_KEY); // Log the API key message

  if (!API_KEY) {
    console.error("API key not found, please enter a valid API key.");
    figma.notify("API key not found, please enter a valid API key.");
    figma.ui.postMessage({
      type: "error",
      error: "API key not found, please enter a valid API key.",
    });
    return null;
  }

  try {
    // console.log("Sending API Request...");
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    };
    // console.log("Headers:", headers); // Log the headers being sent

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: headers,
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      const responseData = await response.json();
      // console.log("API Response:", JSON.stringify(responseData, null, 2));

      let generatedText = responseData.choices[0].message.content.trim();
      generatedText = generatedText.replace(/(^["']|["']$)/g, "");
      generatedText = generatedText.replace(/\\n/g, "\n");
      return { generatedText: generatedText };
    } else {
      const errorResponse = await response.json();
      console.error(
        "API Error Response:",
        JSON.stringify(errorResponse, null, 2)
      );
      figma.ui.postMessage({
        type: "error",
        error: "Error calling OpenAI API.",
      });
      return null;
    }
  } catch (error) {
    console.error("Error in openAIApi:", error);
    figma.ui.postMessage({ type: "error", error: "Error calling OpenAI API." });
    return null;
  }
}

// Requests queried Items
async function formatOpenAIRequest(
  selectedFormat: string,
  customFormat: string,
  replicateFormat: string
): Promise<any> {
  let selectedModel: string; // Define the selectedModel variable

  try {
    selectedModel = await figma.clientStorage.getAsync("openai_selected_model");
  } catch (err) {
    console.error(err);
    return { error: "Failed to retrieve selected model from client" };
  }

  // console.log("Retrieved Model in formatOpenAIRequest:", selectedModel); // Check if the Selected Model is retrieved correctly

  // If selectedModel is undefined, set it to the default model
  if (!selectedModel) {
    selectedModel = "gpt-3.5-turbo";
    // console.log("Using default Model:", selectedModel); // Check if the default model is being used correctly
  }

  let prompt;

  if (selectedFormat === "custom") {
    prompt = `Generate ${figma.currentPage.selection.length} random items, related to '${customFormat}'. maintaining the SAME format for each variant and always one variant per line. Don't enumerate, list, etc; exclude any additional information or characters other than JUST the generated text and separate them with a newline`;
  } else if (selectedFormat === "replicate") {
    const formattedReplicateFormat = replicateFormat.replace(/\n/g, "\\n");

    prompt = `Given this format \n\n'${replicateFormat}'\n\n Create ${figma.currentPage.selection.length} variations of content, while maintaining the format structure (including line breaks). \n\nAnalyze the context and change EVERYTHING, except the words within square brackets []. For example, if the input format is '[City:]Vancouver', the output should be '[City:] Rome', notice that 'City:' was untouched because it was inside of '[]' \n\nSeparate the variants with the special character '§'. Don't add numbers, lits decoration or any character that was not being asked for`;
  } else {
    prompt = `Generate ${figma.currentPage.selection.length} random ${selectedFormat}, maintaining the SAME format for each variant and always one variant per line. Don't enumerate, list, etc; exclude any additional information or characters other than JUST the generated text and separate them with a newline`;
  }

  const payload = {
    model: selectedModel,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 800,
    temperature: 0.3,
  };

  // console.log("Payload:", JSON.stringify(payload, null, 2));

  return payload;
}

// Removes Square brackets from output

function removeSquareBrackets(text: string): string {
  return text.replace(/\[(.*?)\]/g, "$1");
}

figma.ui.onmessage = async (msg) => {
  // Add your existing code for handling other message types here

  if (msg.type === "populate-text") {
    const textNodes = figma.currentPage.selection.filter(
      (node) => node.type === "TEXT"
    ) as Array<TextNode>;

    if (textNodes.length === 0) {
      figma.notify("Please select one or more text nodes to populate.");
      return;
    }

    const { selectedFormat, customFormat, replicateFormat } = msg;

    const requestBody = await formatOpenAIRequest(
      selectedFormat,
      customFormat,
      replicateFormat
    );

    // Display a loading notification
    const loadingNotification = figma.notify("Generating data...", {
      timeout: Infinity,
    });
    const openAIResponse = await openAIApi(requestBody);
    loadingNotification.cancel();

    if (openAIResponse) {
      const generatedText = openAIResponse.generatedText;

      const generatedItems = generatedText
        .split(selectedFormat === "replicate" ? "§" : "\n")
        .map((item: string) => {
          item = item.trim().replace(/^\d+\.\s*/, "");
          return item.replace(/{(.*?)}/g, "$1");
        });

      for (const [index, textNode] of textNodes.entries()) {
        if (textNode.characters.length === 0) {
          continue;
        }
        const fontName = textNode.getRangeFontName(
          0,
          textNode.characters.length
        ) as FontName;
        await figma.loadFontAsync(fontName);
        // Call the removeSquareBrackets function before assigning the text
        textNode.characters = removeSquareBrackets(
          generatedItems[index % generatedItems.length]
        );
      }

      figma.notify("Text nodes populated successfully.");
    } else {
      console.error(
        "Failed to generate copy, please ensure your API key is valid."
      );
      figma.notify(
        "Failed to generate copy, please ensure your API key is valid."
      );
    }
  } else if (msg.type === "save-api-key") {
    const { apiKey, selectedModel } = msg.data; // destructuring the data object
    await saveAPIKey({ apiKey, selectedModel });
    // console.log("API Key saved:", apiKey);
    // console.log("Model saved:", selectedModel); // added a log for the selected model
    figma.ui.postMessage({ type: "api-key-saved" });
    figma.notify("API Key Saved");
  } else if (msg.type === "get-api-key") {
    const apiKey = await figma.clientStorage.getAsync("openai_api_key");
    // console.log("Retrieved API Key:", apiKey);
    figma.ui.postMessage({ type: "api-key", data: apiKey });
  }

  // Add your existing code for handling other message types here
};
