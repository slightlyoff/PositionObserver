(function() {
  // TODO: rootMargin are completely ignored for now

  // Constructor
  window.IntersectionObserver = function(callback, options) {
    options = options || {};

    if(!(callback instanceof Function)) {
      throw('callback needs to be a function');
    }

    if(options.root && !(options.root instanceof HTMLElement)) {
      throw('Target needs to be an HTMLelement');
    }

    this._callback = callback;
    this._root = options.root || null;
    this._rootMargin = options.rootMargin || [0, 0, 0, 0];
    this._thresholds = options.threshold || 0;
    this._init();
  };

  window.IntersectionObserver.prototype = {
    //
    // Public API
    //
    get root() {
      return this._root || document;
    },

    get rootMargin() {
      return '0';
    },

    get thresholds() {
      // 0 means call callback on every change
      // See note at http://rawgit.com/WICG/IntersectionObserver/master/index.html#intersection-observer-init
      if(this._thresholds === 0) {
        return 0;
      }
      if(this._thresholds instanceof Array) {
        return this._thresholds;
      }
      return [this._thresholds];
    },

    observe: function(target) {
      if(!(target instanceof HTMLElement)) {
        throw('Target needs to be an HTMLelement');
      }

      var root = this.root;
      var ancestor = target.parentNode;
      while (ancestor != root) {
        if (!ancestor) {
          throw('Target must be decendant of root');
        }
        ancestor = ancestor.parentNode;
      }

      this._observationTargets.set(target, {});
    },

    unobserve: function(target) {
      this._observationTargets.delete(target);
    },

    disconnect: function() {
      this._observationTargets.clear();
      this.root.removeEventListener('scroll', this._boundUpdate);
      window.clearInterval(this._timeoutId);
      this._descheduleCallback();
    },

    takeRecords: function() {
      this._update();
      this._descheduleCallback();
      var copy = this._queue.slice();
      this._queue = [];
      return copy;
    },

    //
    // Private API
    //
    _init: function() {
      this._observationTargets = new Map();
      this._boundUpdate = this._update.bind(this);
      this.root.addEventListener('scroll', this._boundUpdate);
      this._intervalId = window.setInterval(this._boundUpdate, 100);
      this._queue = [];
    },

    _update: function() {
      var rootRect = this._rootRect();
      this._observationTargets.forEach(function(oldIntersectionEntry, target) {
        var targetRect = target.getBoundingClientRect();
        var intersectionRect = intersectRects(rootRect, targetRect);
        if(!intersectionRect) {
          return;
        }
        var targetArea = targetRect.width * targetRect.height;
        var intersectionArea = intersectionRect.width * intersectionRect.height;
        var intersectionRatio = intersectionArea / targetArea;
        if(!this._hasCrossedThreshold(oldIntersectionEntry.intersectionRatio, intersectionRatio)) {
          return;
        }
        var intersectionEntry = {
          time: window.performance.now(),
          rootBounds: rootRect,
          boundingClientRect: targetRect,
          intersectionRect: intersectionRect,
          intersectionRatio: intersectionRatio,
          target: target
        };
        Object.freeze(intersectionEntry);
        this._queue.push(intersectionEntry);
        this._scheduleCallback();
        this._observationTargets.set(target, intersectionEntry);
      }.bind(this));
    },

    _scheduleCallback: function() {
      if(this._idleCallbackId) {
        return;
      }
      this._idleCallbackId = window.requestIdleCallback(function() {
        this._descheduleCallback();
        this._callback(this._queue, this);
        this._queue = [];
      }.bind(this), {timeout: 100});
    },

    _descheduleCallback: function() {
      if(!this._idleCallbackId) {
        return;
      }
      window.cancelIdleCallback(this._idleCallbackId);
      this._idleCallbackId = null;
    },

    _rootRect: function() {
      if(this._root) {
        return this.root.getBoundingClientRect();
      }
      return {
        top: 0,
        left: 0,
        right: window.innerWidth,
        width: window.innerWidth,
        bottom: window.innerHeight,
        height: window.innerHeight
      };
    },

    // FIXME: so hack, much performance, very JSON
    _hasCrossedThreshold: function(oldRatio, newRatio) {
      if(this.thresholds === 0) {
        return newRatio != oldRatio;
      }
      var b1 = this.thresholds.map(function(threshold) {
        return threshold <= oldRatio;
      });
      var b2 = this.thresholds.map(function(threshold) {
        return threshold <= newRatio;
      });
      return JSON.stringify(b1) !== JSON.stringify(b2);
    }
  };

  var intersectRects = function(rect1, rect2) {
    var top = Math.max(rect1.top, rect2.top);
    var bottom = Math.min(rect1.bottom, rect2.bottom);
    var left = Math.max(rect1.left, rect2.left);
    var right = Math.min(rect1.right, rect2.right);
    var intersectionRect = {
      top: top,
      bottom: bottom,
      left: left,
      right: right,
      width: right-left,
      height: bottom-top
    };
    if(top > bottom) {
      intersectionRect.height = 0;
    }
    if(left > right) {
      intersectionRect.width = 0;
    }
    return intersectionRect;
  };
})();