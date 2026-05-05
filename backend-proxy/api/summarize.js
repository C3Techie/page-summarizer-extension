export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // Allow the extension to call this
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { content, title, options } = req.body;
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Server configuration error: Missing API Key' });
    }

    const numBullets = options?.shortSummary ? 3 : 5;
    
    const prompt = `
      Summarize the following article titled "${title}".
      
      Provide your response in JSON format with the following keys:
      - "bullets": An array of exactly ${numBullets} clear, concise bullet points highlighting the most important facts.
      - "insights": An array of 3 objects, each with "title" and "content" keys, providing deeper analysis or interesting metrics from the text.
      - "keyTakeaway": A single sentence summarizing the core message.
      
      Article content:
      ${content}
    `;

    // Fetch models and pick one
    const modelsResponse = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    
    let modelToUse = 'mixtral-8x7b-32768';
    if (modelsResponse.ok) {
      const modelsData = await modelsResponse.json();
      const activeModel = modelsData.data.find(m => 
        (m.id.includes('llama') || m.id.includes('mixtral')) && 
        !m.id.includes('whisper') && 
        !m.id.includes('guard') &&
        !m.id.includes('vision')
      );
      if (activeModel) {
        modelToUse = activeModel.id;
      }
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: [
          { role: 'system', content: 'You are a helpful assistant that provides structured JSON summaries of webpages.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Groq API request failed');
    }

    const data = await response.json();
    let resultText = data.choices[0].message.content;
    
    // Clean up the response
    const startIndex = resultText.indexOf('{');
    const endIndex = resultText.lastIndexOf('}');
    
    if (startIndex !== -1 && endIndex !== -1) {
      resultText = resultText.substring(startIndex, endIndex + 1);
    }
    
    const parsedResult = JSON.parse(resultText);

    res.status(200).json({
      success: true,
      summary: {
        fullText: content,
        bullets: parsedResult.bullets || [],
        insights: parsedResult.insights || [],
        keyTakeaway: parsedResult.keyTakeaway || '',
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
