/**
 * 🚀 GLOBAL UNICORN SCRIPT MANAGER
 * Singleton pattern to prevent multiple script loading and main thread blocking
 */

import React from 'react';

let scriptLoadingPromise = null;
let scriptLoaded = false;
let scriptError = null;
let instanceCount = 0;

const SCRIPT_CONFIG = {
  version: '1.4.18',
  url: 'https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js',
  timeout: 10000,
  retryCount: 3,
  retryDelay: 2000
};

class UnicornScriptManager {
  constructor() {
    this.instances = new Map();
    this.loadingQueue = [];
    this.isProcessingQueue = false;
  }

  registerInstance(id, priority = 'low') {
    instanceCount++;
    this.instances.set(id, {
      priority,
      timestamp: Date.now(),
      status: 'pending'
    });
    
    // Sort by priority: high > medium > low
    this.sortLoadingQueue();
    
    return this.ensureScriptLoaded();
  }

  unregisterInstance(id) {
    if (this.instances.has(id)) {
      this.instances.delete(id);
      instanceCount--;
      
      // If no more instances, consider cleanup
      if (instanceCount === 0) {
        this.scheduleCleanup();
      }
    }
  }

  sortLoadingQueue() {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    
    this.loadingQueue.sort((a, b) => {
      const aPriority = priorityOrder[this.instances.get(a.id)?.priority || 'low'];
      const bPriority = priorityOrder[this.instances.get(b.id)?.priority || 'low'];
      return bPriority - aPriority;
    });
  }

  async ensureScriptLoaded() {
    // Return existing promise if loading
    if (scriptLoadingPromise) {
      return scriptLoadingPromise;
    }

    // Return immediately if already loaded
    if (scriptLoaded && window.UnicornStudio) {
      return window.UnicornStudio;
    }

    // Start loading process
    scriptLoadingPromise = this.loadScriptWithRetry();
    
    try {
      const result = await scriptLoadingPromise;
      scriptLoaded = true;
      scriptError = null;
      return result;
    } catch (error) {
      scriptError = error;
      scriptLoadingPromise = null;
      throw error;
    }
  }

  async loadScriptWithRetry(retryCount = 0) {
    return new Promise((resolve, reject) => {
      // Check if script already exists
      const existingScript = document.querySelector(
        'script[src*="unicornstudio.js"]'
      );

      if (existingScript && window.UnicornStudio) {
        resolve(window.UnicornStudio);
        return;
      }

      // Clean up any failed scripts
      if (existingScript && !window.UnicornStudio) {
        existingScript.remove();
      }

      const script = document.createElement('script');
      script.src = `${SCRIPT_CONFIG.url}@v${SCRIPT_CONFIG.version}/dist/unicornStudio.umd.min.js`;
      script.async = true;
      script.defer = true;
      script.id = `unicorn-studio-script-${Date.now()}`;
      
      const timeoutId = setTimeout(() => {
        cleanup();
        
        if (retryCount < SCRIPT_CONFIG.retryCount) {
          console.warn(`UnicornStudio script timeout, retrying... (${retryCount + 1}/${SCRIPT_CONFIG.retryCount})`);
          
          setTimeout(() => {
            this.loadScriptWithRetry(retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, SCRIPT_CONFIG.retryDelay);
        } else {
          reject(new Error('UnicornStudio script loading timeout after retries'));
        }
      }, SCRIPT_CONFIG.timeout);

      const handleSuccess = () => {
        cleanup();
        
        if (window.UnicornStudio) {
          resolve(window.UnicornStudio);
        } else {
          // Script loaded but UnicornStudio not available
          setTimeout(() => {
            if (window.UnicornStudio) {
              resolve(window.UnicornStudio);
            } else {
              reject(new Error('UnicornStudio object not available after script load'));
            }
          }, 500);
        }
      };

      const handleError = () => {
        cleanup();
        
        if (retryCount < SCRIPT_CONFIG.retryCount) {
          console.warn(`UnicornStudio script error, retrying... (${retryCount + 1}/${SCRIPT_CONFIG.retryCount})`);
          
          setTimeout(() => {
            this.loadScriptWithRetry(retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, SCRIPT_CONFIG.retryDelay);
        } else {
          reject(new Error('UnicornStudio script loading failed after retries'));
        }
      };

      const cleanup = () => {
        clearTimeout(timeoutId);
        script.removeEventListener('load', handleSuccess);
        script.removeEventListener('error', handleError);
      };

      script.addEventListener('load', handleSuccess);
      script.addEventListener('error', handleError);

      document.head.appendChild(script);
    });
  }

  // 🧹 CLEANUP: Schedule cleanup when no instances remain
  scheduleCleanup() {
    // Wait a bit before cleanup in case new instances register
    setTimeout(() => {
      if (instanceCount === 0) {
        this.performCleanup();
      }
    }, 5000);
  }

  performCleanup() {
    try {
      // Clear script loading state
      scriptLoadingPromise = null;
      scriptLoaded = false;
      scriptError = null;
      
      // Clear instances
      this.instances.clear();
      this.loadingQueue = [];
      
      // Remove script if exists (optional - can keep for caching)
      // const script = document.querySelector('script[src*="unicornstudio.js"]');
      // if (script) script.remove();
    } catch (error) {
      console.warn('Error during UnicornStudio cleanup:', error);
    }
  }

  getStats() {
    return {
      instanceCount,
      scriptLoaded,
      scriptError: scriptError?.message || null,
      activeInstances: Array.from(this.instances.keys()),
      queueLength: this.loadingQueue.length,
      loadingInProgress: !!scriptLoadingPromise
    };
  }
}

const globalScriptManager = new UnicornScriptManager();

export const useGlobalScriptManager = () => {
  const instanceId = React.useRef(`instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  
  const loadScript = React.useCallback(async (priority = 'low') => {
    return globalScriptManager.registerInstance(instanceId.current, priority);
  }, []);

  const getStats = React.useCallback(() => {
    return globalScriptManager.getStats();
  }, []);

  // 🧹 CLEANUP: Unregister on unmount
  React.useEffect(() => {
    return () => {
      globalScriptManager.unregisterInstance(instanceId.current);
    };
  }, []);

  return {
    loadScript,
    getStats,
    instanceId: instanceId.current
  };
};

export default globalScriptManager; 