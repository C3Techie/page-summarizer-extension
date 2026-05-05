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
      const summary = await this.generateMockSummary(content, title, options);
      summary.keyTakeaway = `⚠️ Server Error: ${error.message}. (Showing local summary instead) `;
      return summary;
    }
  }

  async generateMockSummary(content, title, options) {
    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));

    console.log(' Generating mock summary...');

    const numBullets = options?.shortSummary ? 3 : 5;

    // Split content into sentences
    const sentences = content
      .match(/[^.!?]+[.!?]+/g) || [content]
      const cleanedSentences = sentences
      .map(s => s.trim())
      .filter(s => s.length > 10);

    // Generate bullet points from important sentences
    const bullets = this.extractKeyPoints(cleanedSentences, numBullets);

    // Generate insights
    const insights = this.generateKeyInsights(cleanedSentences, content);

    // Generate key takeaway
    const keyTakeaway = this.generateKeyTakeaway(title, bullets);

    return {
      fullText: content,
      bullets: bullets,
      insights: insights,
      keyTakeaway: keyTakeaway,
      generatedAt: new Date().toISOString()
    };
  }

  extractKeyPoints(sentences, limit = 5) {
    if (sentences.length === 0) return [];
    
    // Select sentences at different positions
    const points = [];
    const interval = Math.max(1, Math.floor(sentences.length / limit));

    // Add first sentence
    if (sentences[0]) {
      points.push(this.trimSentence(sentences[0]));
    }

    // Add sentences at intervals
    for (let i = interval; i < sentences.length && points.length < limit; i += interval) {
      if (sentences[i]) {
        points.push(this.trimSentence(sentences[i]));
      }
    }

    // Add last sentence if not already included
    if (sentences.length > 1 && points.length < limit) {
      const lastSentence = this.trimSentence(sentences[sentences.length - 1]);
      if (!points.includes(lastSentence)) {
        points.push(lastSentence);
      }
    }

    return points.slice(0, limit);
  }

  trimSentence(sentence) {
    return sentence
      .replace(/^[^a-zA-Z0-9]+/, '') // Remove leading punctuation
      .replace(/[^a-zA-Z0-9.!?]+$/, '') // Remove trailing punctuation except end marks
      .substring(0, 200); // Limit length
  }

  generateKeyInsights(sentences, content) {
    const insights = [];

    // Insight 1: Word count and length
    const wordCount = content.split(/\s+/).length;
    insights.push({
      title: 'Content Length',
      content: `${wordCount} words in the article`
    });

    // Insight 2: Density (unique words)
    const words = content.toLowerCase().match(/\b[\w']+\b/g) || [];
    const uniqueWords = new Set(words);
    const density = ((uniqueWords.size / words.length) * 100).toFixed(1);
    insights.push({
      title: 'Vocabulary Diversity',
      content: `${density}% of words are unique`
    });

    // Insight 3: Average sentence length
    if (sentences.length > 0) {
      const avgSentenceLength = Math.round(
        sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length
      );
      const complexity = avgSentenceLength > 20 ? 'Complex' : avgSentenceLength > 15 ? 'Moderate' : 'Simple';
      insights.push({
        title: 'Reading Complexity',
        content: `${complexity} (avg ${avgSentenceLength} words per sentence)`
      });
    }

    return insights.slice(0, 3);
  }

  generateKeyTakeaway(title, bullets) {
    const takeaways = [
      'This article provides a comprehensive overview of the topic.',
      'Key points have been extracted for quick reference.',
      'The content covers important aspects worth understanding.',
      'Summary generated to help you quickly grasp the main ideas.',
      'Essential information distilled from the full article.'
    ];

    // Use title length as seed for takeaway selection
    const index = title.length % takeaways.length;
    return takeaways[index];
  }
}

// Initialize the summarization engine
const engine = new SummarizationEngine();
