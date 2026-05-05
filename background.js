/**
 * Background Service Worker
 * Handles API calls and message routing
 * Runs in the background and can be terminated/restarted
 */

class SummarizationEngine {
  constructor() {
    this.setupMessageListener();
    console.log(' Background service worker initialized');
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log(' Background received:', request.action);

      if (request.action === 'summarize') {
        this.handleSummarizationRequest(request)
          .then(response => sendResponse(response))
          .catch(error => {
            console.error(' Summarization error:', error);
            sendResponse({
              success: false,
              error: error.message || 'Summarization failed'
            });
          });

        // Return true to indicate we'll send response asynchronously
        return true;
      }
    });
  }

  async handleSummarizationRequest(request) {
    const { content, url, title, options } = request;

    if (!content || content.length < 50) {
      throw new Error('Insufficient content to summarize');
    }

    console.log(' Processing summarization request', options);

    // Call the AI summarization service
    const summary = await this.callAISummarizationAPI(content, title, options);

    return {
      success: true,
      summary: summary
    };
  }

  async callAISummarizationAPI(content, title, options) {
    console.log(' Calling Proxy API...');

    try {
      const response = await fetch('https://page-summarizer-extension.vercel.app/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content.substring(0, 3000), // Slice to save bandwidth
          title: title,
          options: options
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Proxy returned ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
         throw new Error(data.error || 'Proxy summarization failed');
      }

      return data.summary;
    } catch (error) {
      console.error(' Proxy API failed:', error);
      throw error; // Let the UI handle the error screen
    }
  }

}

// Initialize the summarization engine
const engine = new SummarizationEngine();
