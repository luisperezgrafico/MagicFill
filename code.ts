// Replace the existing 'figma.showUI' line with the following code
async function showMainUI() {
  figma.showUI(__html__, { width: 320, height: 300 });

  const apiKey = await figma.clientStorage.getAsync('openai_api_key');
  if (!apiKey) {
    figma.ui.postMessage({ type: 'show-api-key-modal' });
  } else {
    // Send the stored API key to the UI
    figma.ui.postMessage({ type: 'update-api-key', data: apiKey });
  }
}
showMainUI();


// Add this function to save the API key
async function saveAPIKey(apiKey: string) {
  if (apiKey.trim() !== '') {
    await figma.clientStorage.setAsync('openai_api_key', apiKey);
  } else {
    // Delete the stored value if the input field is empty
    await figma.clientStorage.deleteAsync('openai_api_key');
  }
  figma.ui.postMessage({ type: 'update-api-key', data: apiKey });
}

// Add this function to call the OpenAI API
async function openAIApi(requestBody: any): Promise<any> {
  const API_KEY = await figma.clientStorage.getAsync('openai_api_key');
  if (!API_KEY) {
    console.error('API key not found, please enter a valid API key.');
    figma.notify('API key not found, please enter a valid API key.');
    figma.ui.postMessage({ type: 'error', error: 'API key not found, please enter a valid API key.' });
    return null;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      const responseData = await response.json();
      let generatedText = responseData.choices[0].message.content.trim();
      generatedText = generatedText.replace(/(^["']|["']$)/g, '');
      generatedText = generatedText.replace(/\\n/g, '\n');
      return { generatedText: generatedText };
    } else {
      figma.ui.postMessage({ type: 'error', error: 'Error calling OpenAI API.' });
      return null;
    }
  } catch (error) {
    console.error('Error in openAIApi:', error);
    figma.ui.postMessage({ type: 'error', error: 'Error calling OpenAI API.' });
    return null;
  }
}

// Requests queried Items
function formatOpenAIRequest(selectedFormat: string, customFormat: string, replicateFormat: string): any {
  let prompt;

  if (selectedFormat === 'custom') {
    prompt = `Give me ${figma.currentPage.selection.length} random "${customFormat}"`;
  } else if (selectedFormat === 'replicate') {
    prompt = `Give me ${figma.currentPage.selection.length} variants similar to the format "${replicateFormat}"`;
  } else {
    prompt = `Give me a list of ${figma.currentPage.selection.length} random ${selectedFormat}`;
  }

  return {
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 100,
  };
}



figma.ui.onmessage = async (msg) => {
  // Add your existing code for handling other message types here

  if (msg.type === 'populate-text') {
    const { selectedFormat, customFormat, replicateFormat } = msg;
    const requestBody = formatOpenAIRequest(selectedFormat, customFormat, replicateFormat);
    const openAIResponse = await openAIApi(requestBody);

    if (openAIResponse) {
      const generatedText = openAIResponse.generatedText;
      const textNodes = figma.currentPage.selection.filter(node => node.type === 'TEXT') as Array<TextNode>;

      if (textNodes.length === 0) {
        figma.notify('Please select one or more text nodes to populate.');
        return;
      }

      const generatedItems = generatedText.split('\n').map((item: string) => item.trim().replace(/^\d+\.\s*/, ''));

      for (const [index, textNode] of textNodes.entries()) {
        const fontName = textNode.getRangeFontName(0, textNode.characters.length) as FontName;
        await figma.loadFontAsync(fontName);
        textNode.characters = generatedItems[index % generatedItems.length];
      }

      figma.notify('Text nodes populated successfully.');
    }
  } else if (msg.type === 'save-api-key') {
    const apiKey = msg.data;
    await saveAPIKey(apiKey);
    figma.ui.postMessage({ type: 'api-key-saved' });
    figma.notify('API Key Saved');
  } else if (msg.type === 'get-api-key') {
    const apiKey = await figma.clientStorage.getAsync('openai_api_key');
    figma.ui.postMessage({ type: 'api-key', data: apiKey });
  }
};

