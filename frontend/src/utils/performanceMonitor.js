/**
 * Advanced Performance Monitoring Dashboard
 * Real-time tracking of all optimization metrics
 */

import { logger } from './logger';

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      renders: new Map(),
      memoryUsage: [],
      bundleMetrics: {},
      loadTimes: {},
      optimizations: {
        styledComponentsOptimized: 0,
        inlineCallbacksFixed: 0,
        memoryLeaksFixed: 0,
        assetsPreloaded: 0,
        audioOptimized: 0,
        unicornSceneInitialization: 0,
        unicornSceneLoaded: 0,
        unicornSceneError: 0,
        unicornSceneFallback: 0,
        unicornScriptDeduplication: 0
      }
    };
    
    this.isEnabled = process.env.NODE_ENV === 'development' || 
                    localStorage.getItem('performance-monitor') === 'true';
    
    if (this.isEnabled) {
      this.init();
    }
  }

  init() {
    this.monitorWebVitals();
    
    this.memoryTrackingInterval = setInterval(() => this.trackMemoryUsage(), 10000);
    
    this.monitorBundleLoading();
    
    this.setupPerformanceObserver();
    
    if (process.env.NODE_ENV === 'development') {
      window.performanceMonitor = this;
    }
  }
  
  // 🧹 MEMORY FIX: Cleanup method to stop intervals and remove globals
  destroy() {
    if (this.memoryTrackingInterval) {
      clearInterval(this.memoryTrackingInterval);
      this.memoryTrackingInterval = null;
    }
    
    if (window.performanceMonitor === this) {
      delete window.performanceMonitor;
    }
    
    this.clear();
  }

  trackRender(componentName, props = {}, renderTime = performance.now()) {
    if (!this.isEnabled) return;
    
    const renderData = this.metrics.renders.get(componentName) || {
      count: 0,
      totalTime: 0,
      lastRender: Date.now(),
      avgTime: 0,
      props: []
    };
    
    renderData.count++;
    renderData.totalTime += renderTime;
    renderData.avgTime = renderData.totalTime / renderData.count;
    renderData.lastRender = Date.now();
    renderData.props.push(this.serializeProps(props));
    
    // Keep only last 10 prop snapshots
    if (renderData.props.length > 10) {
      renderData.props = renderData.props.slice(-10);
    }
    
    this.metrics.renders.set(componentName, renderData);
    
    if (renderData.count > 50 && renderData.count % 10 === 0) {
      logger.warn(`🔄 HIGH RENDER COUNT: ${componentName} rendered ${renderData.count} times`, {
        averageTime: `${renderData.avgTime.toFixed(2)}ms`,
        totalTime: `${renderData.totalTime.toFixed(2)}ms`,
        recentProps: renderData.props.slice(-3)
      });
    }
    
    return renderData;
  }

  trackMemoryUsage() {
    if (!this.isEnabled || !performance.memory) return;
    
    const memory = performance.memory;
    const usage = {
      timestamp: Date.now(),
      used: memory.usedJSHeapSize / 1024 / 1024, // MB
      total: memory.totalJSHeapSize / 1024 / 1024, // MB
      limit: memory.jsHeapSizeLimit / 1024 / 1024 // MB
    };
    
    this.metrics.memoryUsage.push(usage);
    
    // Keep only last 100 measurements (16 minutes at 10s intervals)
    if (this.metrics.memoryUsage.length > 100) {
      this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-100);
    }
    
    this.detectMemoryLeaks(usage);
    
    return usage;
  }

  monitorWebVitals() {
    try {
      import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
        getCLS((metric) => this.recordWebVital('CLS', metric));
        getFID((metric) => this.recordWebVital('FID', metric));
        getFCP((metric) => this.recordWebVital('FCP', metric));
        getLCP((metric) => this.recordWebVital('LCP', metric));
        getTTFB((metric) => this.recordWebVital('TTFB', metric));
      });
    } catch (error) {
      console.warn('Web Vitals monitoring not available:', error);
    }
  }

  recordWebVital(name, metric) {
    const vitals = this.metrics.bundleMetrics.webVitals || {};
    vitals[name] = {
      value: metric.value,
      rating: this.getRating(name, metric.value),
      timestamp: Date.now()
    };
    this.metrics.bundleMetrics.webVitals = vitals;
    
    logger.info(`📊 ${name}: ${metric.value}${this.getUnit(name)} (${vitals[name].rating})`);
  }

  monitorBundleLoading() {
    // Track initial bundle load
    const navigationStart = performance.timing.navigationStart;
    const loadComplete = performance.timing.loadEventEnd;
    
    if (loadComplete > 0) {
      this.metrics.loadTimes.initial = loadComplete - navigationStart;
      logger.info(`🚀 Initial Bundle Load: ${this.metrics.loadTimes.initial}ms`);
    }
    
    // Track dynamic imports
    if (window.__webpack_require__) {
      const originalRequire = window.__webpack_require__;
      window.__webpack_require__ = (...args) => {
        const startTime = performance.now();
        const result = originalRequire.apply(this, args);
        
        if (result && result.then) {
          result.then(() => {
            const loadTime = performance.now() - startTime;
            logger.info(`📦 Chunk loaded in: ${loadTime.toFixed(2)}ms`);
          });
        }
        
        return result;
      };
    }
  }

  setupPerformanceObserver() {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'navigation') {
              this.trackNavigationTiming(entry);
            } else if (entry.entryType === 'resource') {
              this.trackResourceTiming(entry);
            }
          }
        });
        
        observer.observe({ entryTypes: ['navigation', 'resource'] });
      } catch (error) {
        console.warn('Performance Observer not supported:', error);
      }
    }
  }

  trackNavigationTiming(entry) {
    if (!this.isEnabled) return;
    
    const timing = {
      domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
      domComplete: entry.domComplete - entry.fetchStart,
      loadComplete: entry.loadEventEnd - entry.loadEventStart,
      firstPaint: entry.fetchStart,
      timestamp: Date.now()
    };
    
    this.metrics.loadTimes.navigation = timing;
    logger.info('🚀 Navigation Timing Recorded', timing);
  }

  trackResourceTiming(entry) {
    if (!this.isEnabled) return;
    
    // Only track important resources to reduce noise
    if (!entry.name.includes('.js') && !entry.name.includes('.css') && !entry.name.includes('unicornstudio')) return;
    
    const timing = {
      name: entry.name.split('/').pop(),
      duration: entry.duration,
      transferSize: entry.transferSize || 0,
      timestamp: Date.now()
    };
    
    // Store in loadTimes
    if (!this.metrics.loadTimes.resources) {
      this.metrics.loadTimes.resources = [];
    }
    
    this.metrics.loadTimes.resources.push(timing);
    
    // Keep only last 50 resources
    if (this.metrics.loadTimes.resources.length > 50) {
      this.metrics.loadTimes.resources = this.metrics.loadTimes.resources.slice(-50);
    }
    
    // Log slow resources
    if (timing.duration > 1000) {
      logger.warn(`🐌 Slow Resource: ${timing.name} took ${timing.duration.toFixed(2)}ms`);
    }
  }

  recordOptimization(type, details = {}) {
    if (!this.isEnabled) return;
    
    this.metrics.optimizations[type] = (this.metrics.optimizations[type] || 0) + 1;
    
    logger.info(`✅ OPTIMIZATION: ${type}`, details);
    
    // Track specific optimization impacts
    switch (type) {
      case 'styledComponentsOptimized':
        logger.info(`🎨 Styled Components: ${this.metrics.optimizations[type]} components optimized`);
        break;
      case 'inlineCallbacksFixed':
        logger.info(`🔄 Callbacks: ${this.metrics.optimizations[type]} inline functions memoized`);
        break;
      case 'memoryLeaksFixed':
        logger.info(`🧹 Memory: ${this.metrics.optimizations[type]} leaks prevented`);
        break;
      case 'assetsPreloaded':
        logger.info(`⚡ Assets: ${this.metrics.optimizations[type]} assets preloaded`);
        break;
      case 'audioOptimized':
        logger.info(`🔊 Audio: ${this.metrics.optimizations[type]} audio files optimized`);
        break;
      case 'unicornSceneInitialization':
        logger.info(`🦄 UnicornStudio: ${this.metrics.optimizations[type]} scenes initialized`);
        break;
      case 'unicornSceneLoaded':
        logger.info(`🎨 UnicornStudio: ${this.metrics.optimizations[type]} scenes loaded successfully`);
        break;
      case 'unicornSceneError':
        logger.warn(`⚠️ UnicornStudio: ${this.metrics.optimizations[type]} scenes failed to load`);
        break;
      case 'unicornSceneFallback':
        logger.info(`🎭 UnicornStudio: ${this.metrics.optimizations[type]} scenes using CSS fallback`);
        break;
    }
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      renders: Object.fromEntries(this.metrics.renders),
      memory: {
        current: this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1],
        peak: this.metrics.memoryUsage.reduce((max, curr) => 
          curr.used > max.used ? curr : max, { used: 0 }),
        average: this.metrics.memoryUsage.length > 0 
          ? this.metrics.memoryUsage.reduce((sum, curr) => sum + curr.used, 0) / this.metrics.memoryUsage.length
          : 0
      },
      webVitals: this.metrics.bundleMetrics.webVitals || {},
      optimizations: { ...this.metrics.optimizations },
      loadTimes: { ...this.metrics.loadTimes },
      recommendations: this.generateRecommendations()
    };
    
    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Check for excessive re-renders
    this.metrics.renders.forEach((data, component) => {
      if (data.count > 100) {
        recommendations.push({
          type: 'excessive-renders',
          component,
          count: data.count,
          suggestion: 'Consider memoization or props optimization'
        });
      }
    });
    
    // Check memory usage
    const currentMemory = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
    if (currentMemory && currentMemory.used > 100) {
      recommendations.push({
        type: 'high-memory',
        usage: `${currentMemory.used.toFixed(2)}MB`,
        suggestion: 'Check for memory leaks or large data structures'
      });
    }
    
    // Check Web Vitals
    const vitals = this.metrics.bundleMetrics.webVitals;
    if (vitals) {
      Object.entries(vitals).forEach(([metric, data]) => {
        if (data.rating === 'poor') {
          recommendations.push({
            type: 'poor-web-vital',
            metric,
            value: data.value,
            suggestion: this.getWebVitalSuggestion(metric)
          });
        }
      });
    }
    
    return recommendations;
  }

  // Utility methods
  serializeProps(props) {
    try {
      return JSON.stringify(props, null, 2).substring(0, 200);
    } catch {
      return '[Non-serializable props]';
    }
  }

  detectMemoryLeaks(usage) {
    const recent = this.metrics.memoryUsage.slice(-10);
    if (recent.length >= 10) {
      const trend = recent[recent.length - 1].used - recent[0].used;
      if (trend > 20) { // 20MB increase in last 10 measurements
        logger.warn(`🚨 POTENTIAL MEMORY LEAK: ${trend.toFixed(2)}MB increase detected`);
      }
    }
  }

  getRating(metric, value) {
    const thresholds = {
      CLS: { good: 0.1, poor: 0.25 },
      FID: { good: 100, poor: 300 },
      FCP: { good: 1800, poor: 3000 },
      LCP: { good: 2500, poor: 4000 },
      TTFB: { good: 800, poor: 1800 }
    };
    
    const threshold = thresholds[metric];
    if (!threshold) return 'unknown';
    
    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  }

  getUnit(metric) {
    return ['FID', 'FCP', 'LCP', 'TTFB'].includes(metric) ? 'ms' : '';
  }

  getWebVitalSuggestion(metric) {
    const suggestions = {
      CLS: 'Optimize layout stability - avoid dynamic content insertion',
      FID: 'Reduce JavaScript execution time and optimize event handlers',
      FCP: 'Optimize critical resource loading and reduce render-blocking',
      LCP: 'Optimize largest content element loading and image delivery',
      TTFB: 'Optimize server response time and network latency'
    };
    return suggestions[metric] || 'Optimize this metric for better performance';
  }

  // Public API methods
  getMetrics() { return this.metrics; }
  getReport() { return this.generateReport(); }
  clear() { 
    this.metrics.renders.clear();
    this.metrics.memoryUsage = [];
  }
}

// Singleton instance
const performanceMonitor = new PerformanceMonitor();

// Export for use in components
export const trackRender = (componentName, props, renderTime) => 
  performanceMonitor.trackRender(componentName, props, renderTime);

export const recordOptimization = (type, details) => 
  performanceMonitor.recordOptimization(type, details);

export const getPerformanceReport = () => 
  performanceMonitor.generateReport();

export default performanceMonitor; 