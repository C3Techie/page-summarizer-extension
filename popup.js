/**
 * Popup Script
 * Manages the UI and user interactions for the summarizer popup
 */

class PopupManager {
  constructor() {
    this.currentUrl = '';
    this.init();
  }

  init() {
    this.cacheElements();
    this.attachEventListeners();
    this.displayPageInfo();
  }

  cacheElements() {
    // States
    this.initialState = document.getElementById('initialState');
    this.loadingState = document.getElementById('loadingState');
    this.resultsState = document.getElementById('resultsState');
    this.errorState = document.getElementById('errorState');
    this.settingsPanel = document.getElementById('settingsPanel');

    // UI Elements
    this.pageTitle = document.getElementById('pageTitle');
    this.summarizeBtn = document.getElementById('summarizeBtn');
    this.settingsBtn = document.getElementById('settingsBtn');
    this.saveSettingsBtn = document.getElementById('saveSettingsBtn');
    this.closeSettingsBtn = document.getElementById('closeSettingsBtn');
    this.apiKeyInput = document.getElementById('apiKey');
    this.shortSummaryCheckbox = document.getElementById('shortSummary');
    this.copyBtn = document.getElementById('copyBtn');
    this.highlightBtn = document.getElementById('highlightBtn');
    this.resetBtn = document.getElementById('resetBtn');
    this.retryBtn = document.getElementById('retryBtn');
    this.readingTime = document.getElementById('readingTime');
    this.summaryList = document.getElementById('summaryList');
    this.insights = document.getElementById('insights');
    this.errorMessage = document.getElementById('errorMessage');
  }

  attachEventListeners() {
    this.summarizeBtn.addEventListener('click', () => this.handleSummarize());
    this.copyBtn.addEventListener('click', () => this.handleCopy());
    this.highlightBtn.addEventListener('click', () => this.handleHighlight());
    this.resetBtn.addEventListener('click', () => this.handleReset());
    this.retryBtn.addEventListener('click', () => this.handleSummarize());
    
    // Settings events
    this.settingsBtn.addEventListener('click', () => this.setState('settings'));
    this.closeSettingsBtn.addEventListener('click', () => this.setState('initial'));
    this.saveSettingsBtn.addEventListener('click', () => this.handleSaveSettings());
  }

  async displayPageInfo() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentUrl = tab.url;
      this.pageTitle.textContent = tab.title || 'Untitled Page';

      // Check if we have a cached summary
      const cached = await StorageManager.getSummary(this.currentUrl);
      if (cached) {
        this.displayResults(cached);
      }

      // Load API key
      this.loadSettings();
    } catch (error) {
      console.error(' Error getting page info:', error);
      this.showError('Failed to load page information');
    }
  }

  async handleSummarize() {
    try {
      this.showLoading();

      // Get content from the current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Send message to content script to extract content
      const response = await MessagingService.sendToContentScript(tab.id, {
        action: 'extractContent'
      });

      if (!response || !response.success) {
        throw new Error('Failed to extract page content');
      }

      console.log(' Content extracted, length:', response.content.length);

      // Send to background for AI summarization
      const summary = await MessagingService.sendToBackground({
        action: 'summarize',
        content: response.content,
        url: this.currentUrl,
        title: tab.title,
        options: {
          shortSummary: this.shortSummaryCheckbox.checked
        }
      });

      if (!summary || !summary.success) {
        throw new Error(summary?.error || 'Failed to generate summary');
      }

      console.log(' Summary received:', summary.summary);

      // Cache the result
      await StorageManager.saveSummary(this.currentUrl, summary.summary);

      // Display results
      this.displayResults(summary.summary);
    } catch (error) {
      console.error(' Error during summarization:', error);
      
      let friendlyMessage = error.message || 'Unable to summarize this page. Please try again.';
      
      // Specifically handle the "Receiving end does not exist" error
      if (friendlyMessage.includes('Could not establish connection') || friendlyMessage.includes('Receiving end does not exist')) {
        friendlyMessage = '⚠️ Extension updated! Please refresh this webpage to continue.';
      }
      
      this.showError(friendlyMessage);
    }
  }

  displayResults(summary) {
    // Calculate reading time
    const wordCount = summary.fullText.split(/\s+/).length;
    const readingTimeMinutes = Math.ceil(wordCount / 200);
    this.readingTime.textContent = `${readingTimeMinutes} min`;

    // Populate summary bullets
    this.summaryList.innerHTML = '';
    if (summary.bullets && summary.bullets.length > 0) {
      summary.bullets.forEach(bullet => {
        const li = document.createElement('li');
        li.textContent = bullet;
        this.summaryList.appendChild(li);
      });
    } else {
      const li = document.createElement('li');
      li.textContent = 'No bullet points generated';
      this.summaryList.appendChild(li);
    }

    // Populate insights
    if (summary.insights && summary.insights.length > 0) {
      this.insights.innerHTML = summary.insights.map(insight => 
        `<div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(0,0,0,0.1);">
          <strong>${insight.title}:</strong> ${insight.content}
        </div>`
      ).join('') + 
      `<div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.1);">
        <em>${summary.keyTakeaway || 'Summary generated successfully.'}</em>
      </div>`;
    } else {
      this.insights.innerHTML = '<p>No key insights available</p>';
    }

    // Store summary for copy/highlight
    this.currentSummary = summary;

    // Show results state
    this.setState('results');
  }

  handleCopy() {
    try {
      const text = this.currentSummary.bullets.join('\n');
      navigator.clipboard.writeText(text).then(() => {
        // Visual feedback
        const originalText = this.copyBtn.textContent;
        this.copyBtn.textContent = '✅ Copied!';
        this.copyBtn.disabled = true;
        setTimeout(() => {
          this.copyBtn.textContent = originalText;
          this.copyBtn.disabled = false;
        }, 2000);
      });
    } catch (error) {
      console.error(' Copy failed:', error);
      alert('Failed to copy to clipboard');
    }
  }

  async handleHighlight() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Send keywords to content script for highlighting
      const keywords = this.currentSummary.bullets.slice(0, 3);
      
      await MessagingService.sendToContentScript(tab.id, {
        action: 'highlightKeywords',
        keywords: keywords
      });

      // Visual feedback
      const originalText = this.highlightBtn.textContent;
      this.highlightBtn.textContent = '✅ Highlighted!';
      setTimeout(() => {
        this.highlightBtn.textContent = originalText;
      }, 2000);
    } catch (error) {
      console.error(' Highlight failed:', error);
    }
  }

  handleReset() {
    this.setState('initial');
    this.currentSummary = null;
  }

  showLoading() {
    this.setState('loading');
  }

  showError(message) {
    this.errorMessage.textContent = message;
    this.setState('error');
  }

  setState(state) {
    // Hide all states
    this.initialState.classList.add('hidden');
    this.loadingState.classList.add('hidden');
    this.resultsState.classList.add('hidden');
    this.errorState.classList.add('hidden');
    this.settingsPanel.classList.add('hidden');

    // Show selected state
    switch (state) {
      case 'initial':
        this.initialState.classList.remove('hidden');
        break;
      case 'loading':
        this.loadingState.classList.remove('hidden');
        break;
      case 'results':
        this.resultsState.classList.remove('hidden');
        break;
      case 'error':
        this.errorState.classList.remove('hidden');
        break;
      case 'settings':
        this.settingsPanel.classList.remove('hidden');
        break;
    }
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['groq_api_key']);
      if (result.groq_api_key) {
        this.apiKeyInput.value = result.groq_api_key;
      }
    } catch (error) {
      console.error(' Failed to load settings:', error);
    }
  }

  async handleSaveSettings() {
    try {
      const key = this.apiKeyInput.value.trim();
      await chrome.storage.local.set({ 'groq_api_key': key });
      
      // Visual feedback
      const originalText = this.saveSettingsBtn.textContent;
      this.saveSettingsBtn.textContent = '✅ Saved!';
      this.saveSettingsBtn.disabled = true;
      
      setTimeout(() => {
        this.saveSettingsBtn.textContent = originalText;
        this.saveSettingsBtn.disabled = false;
        this.setState('initial');
      }, 1000);
    } catch (error) {
      console.error(' Failed to save settings:', error);
      alert('Failed to save settings');
    }
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});
