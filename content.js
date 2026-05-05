/**
 * Content Script
 * Extracts meaningful content from webpages and highlights keywords
 * Runs in the context of the webpage
 */

class ContentExtractor {
  constructor() {
    this.setupMessageListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log(' Content script received:', request.action);

      if (request.action === 'extractContent') {
        try {
          const content = this.extractPageContent();
          sendResponse({
            success: true,
            content: content
          });
        } catch (error) {
          console.error(' Extraction error:', error);
          sendResponse({
            success: false,
            error: error.message
          });
        }
      } else if (request.action === 'highlightKeywords') {
        try {
          this.highlightKeywords(request.keywords);
          sendResponse({ success: true });
        } catch (error) {
          console.error(' Highlight error:', error);
          sendResponse({ success: false, error: error.message });
        }
      }

      return true; // Keep channel open for async response
    });
  }

  extractPageContent() {
    console.log(' Starting content extraction...');

    // Try to get content from semantic elements first
    let content = this.extractFromSemanticElements();

    if (!content || content.length < 100) {
      console.log(' Semantic extraction insufficient, using body text');
      content = this.extractFromBody();
    }

    console.log(' Extracted content length:', content.length);
    return content.substring(0, 15000); // Limit to 15k chars
  }

  extractFromSemanticElements() {
    const elements = [
      document.querySelector('article'),
      document.querySelector('main'),
      document.querySelector('[role="main"]'),
      document.querySelector('.content'),
      document.querySelector('.article'),
      document.querySelector('.post')
    ];

    for (const element of elements) {
      if (element) {
        const text = this.cleanText(element.innerText);
        if (text.length > 200) {
          return text;
        }
      }
    }

    return '';
  }

  extractFromBody() {
    const body = document.body.cloneNode(true);

    // Remove unwanted elements
    const selectorsToRemove = [
      'script',
      'style',
      'nav',
      'footer',
      '.navigation',
      '.sidebar',
      '.advertisement',
      '.ad',
      '[role="navigation"]',
      '[role="complementary"]',
      '.breadcrumb',
      '.comment',
      '.comments',
      '.social',
      '.social-share',
      '.related',
      '.recommendation'
    ];

    selectorsToRemove.forEach(selector => {
      body.querySelectorAll(selector).forEach(el => el.remove());
    });

    return this.cleanText(body.innerText);
  }

  cleanText(text) {
    return text
      .replace(/\s+/g, ' ')           // Multiple spaces to single space
      .replace(/\n\s*\n/g, '\n')      // Multiple newlines to single
      .trim();
  }

  highlightKeywords(keywords) {
    if (!keywords || keywords.length === 0) return;

    console.log(' Highlighting keywords:', keywords);

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Skip scripts, styles, and already highlighted elements
          const parent = node.parentNode.tagName.toLowerCase();
          if (['script', 'style', 'noscript', 'mark'].includes(parent)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodesToReplace = [];
    let node;

    while (node = walker.nextNode()) {
      const nodeText = node.nodeValue;
      let hasMatch = false;

      for (const keyword of keywords) {
        if (!keyword || keyword.length < 3) continue;
        const regex = new RegExp(`\\b${this.escapeRegex(keyword)}\\b`, 'gi');
        if (regex.test(nodeText)) {
          hasMatch = true;
          break;
        }
      }

      if (hasMatch) {
        nodesToReplace.push({ node, text: nodeText });
      }
    }

    nodesToReplace.forEach(({ node, text }) => {
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      
      // Combine all keywords into one regex for efficient splitting
      const escapedKeywords = keywords
        .filter(k => k && k.length >= 3)
        .map(k => this.escapeRegex(k))
        .join('|');
        
      if (!escapedKeywords) return;
      
      const regex = new RegExp(`\\b(${escapedKeywords})\\b`, 'gi');
      let match;

      while ((match = regex.exec(text)) !== null) {
        // Add text before match
        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
        }

        // Add highlighted match
        const mark = document.createElement('mark');
        mark.style.backgroundColor = '#FFFF00';
        mark.style.color = '#000000';
        mark.style.padding = '2px';
        mark.style.borderRadius = '2px';
        mark.textContent = match[0];
        fragment.appendChild(mark);

        lastIndex = regex.lastIndex;
      }

      // Add remaining text
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
      }

      node.parentNode.replaceChild(fragment, node);
    });

    console.log(' Highlighting complete');
  }

  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// Initialize content extractor
const extractor = new ContentExtractor();
console.log(' Content script initialized');
