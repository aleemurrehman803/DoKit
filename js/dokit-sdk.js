/* DoKit Developer SDK — v1 (client library for the DoKit API).
 *
 * Works in BROWSERS and in NODE.JS (18+, which has global fetch/FormData/Blob).
 * UMD wrapper: `require("dokit-sdk")` in Node, or `window.DoKitSDK` via <script>.
 *
 * NOTE: The DoKit API backend is IN DEVELOPMENT. Endpoints are documented at
 * /api/docs.html. Calls will fail with a network error until the backend
 * (https://api.dokit.app) goes live. The SDK validates inputs locally first so
 * integration bugs surface early, before any network call is made.
 *
 * Usage:
 *   const dokit = new DoKitSDK({ apiKey: "dk_..." });
 *   const stats = await dokit.countWords("hello world"); // { words: 2, ... }
 *   const blob  = await dokit.compressImage(file, { quality: 0.8 });
 */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = factory();                       // Node.js / bundlers
  } else {
    root.DoKitSDK = factory();                        // <script> in browser
  }
}(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DEFAULT_BASE_URL = "https://api.dokit.app/v1";

  /**
   * Error thrown for API failures. Carries the HTTP status and the
   * machine-readable `code` from the API error body (see /api/docs.html).
   */
  function DoKitError(message, status, code, retryAfter) {
    var e = new Error(message);
    e.name = "DoKitError";
    e.status = status || 0;        // 0 = network failure (backend not live yet)
    e.code = code || "network_error";
    e.retryAfter = retryAfter || 0; // seconds; set on 429 rate-limit responses
    return e;
  }

  function isBrowser() {
    return typeof window !== "undefined" && typeof window.document !== "undefined";
  }

  function assert(cond, msg) {
    if (!cond) throw new DoKitError(msg, 0, "invalid_argument");
  }

  /**
   * Create an SDK client.
   * @param {Object} opts
   * @param {string} opts.apiKey  Your DoKit API key (starts with "dk_"). Required.
   * @param {string} [opts.baseUrl] Override the API base URL (default https://api.dokit.app/v1).
   */
  function DoKitSDK(opts) {
    opts = opts || {};
    assert(opts.apiKey && typeof opts.apiKey === "string", "apiKey is required");
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
  }

  /**
   * Low-level JSON request. Used by all endpoint methods.
   * @private
   */
  DoKitSDK.prototype._request = function (path, options) {
    var self = this;
    options = options || {};
    var headers = {
      "Authorization": "Bearer " + self.apiKey
    };
    var body = options.body;
    var isForm = typeof FormData !== "undefined" && body instanceof FormData;
    if (!isForm && body !== undefined && body !== null) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }
    return fetch(self.baseUrl + path, {
      method: options.method || "GET",
      headers: headers,
      body: body
    }).then(function (res) {
      var retryAfter = parseInt(res.headers.get("retry-after") || "0", 10) || 0;
      if (res.status === 429) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          throw DoKitError(
            (data && data.error && data.error.message) || "Rate limit exceeded",
            429, "rate_limited", retryAfter
          );
        });
      }
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          var err = (data && data.error) || {};
          throw DoKitError(err.message || ("Request failed (" + res.status + ")"),
            res.status, err.code || "request_failed", retryAfter);
        });
      }
      // Binary endpoints (image tools) return the file; JSON endpoints return data.
      if (options.binary) return res.blob();
      return res.json();
    }).catch(function (e) {
      if (e && e.name === "DoKitError") throw e;
      throw DoKitError("Network error: could not reach " + self.baseUrl +
        " (the DoKit API backend is in development)", 0, "network_error");
    });
  };

  /**
   * Build a multipart body holding an image file.
   * Accepts: File/Blob (browser), Buffer (Node — needs a filename).
   * @private
   */
  DoKitSDK.prototype._imageBody = function (file, params, filename) {
    assert(file, "An image file is required");
    var fd = new FormData();
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(file)) {
      fd.append("image", new Blob([file]), filename || "image.png");
    } else {
      fd.append("image", file, filename || (file.name || "image.png"));
    }
    Object.keys(params || {}).forEach(function (k) {
      if (params[k] !== undefined && params[k] !== null) fd.append(k, String(params[k]));
    });
    return fd;
  };

  /**
   * Resize an image. Returns a Blob of the resized image.
   * @param {File|Blob|Buffer} file
   * @param {Object} opts - { width, height, fit: "cover"|"contain"|"fill", format: "png"|"jpeg"|"webp" }
   * @returns {Promise<Blob>}
   */
  DoKitSDK.prototype.resizeImage = function (file, opts) {
    opts = opts || {};
    assert(opts.width > 0 || opts.height > 0, "width or height is required");
    return this._request("/image/resize", {
      method: "POST",
      binary: true,
      body: this._imageBody(file, {
        width: opts.width, height: opts.height,
        fit: opts.fit || "cover", format: opts.format || "png"
      })
    });
  };

  /**
   * Compress an image (JPEG/PNG/WebP). Returns a Blob of the compressed image.
   * @param {File|Blob|Buffer} file
   * @param {Object} opts - { quality: 0..1, maxSizeKB }
   * @returns {Promise<Blob>}
   */
  DoKitSDK.prototype.compressImage = function (file, opts) {
    opts = opts || {};
    if (opts.quality !== undefined) {
      assert(opts.quality > 0 && opts.quality <= 1, "quality must be between 0 and 1");
    }
    return this._request("/image/compress", {
      method: "POST",
      binary: true,
      body: this._imageBody(file, { quality: opts.quality, maxSizeKB: opts.maxSizeKB })
    });
  };

  /**
   * Convert an image between formats. Returns a Blob of the converted image.
   * @param {File|Blob|Buffer} file
   * @param {Object} opts - { format: "png"|"jpeg"|"webp" (required) }
   * @returns {Promise<Blob>}
   */
  DoKitSDK.prototype.convertImage = function (file, opts) {
    opts = opts || {};
    assert(["png", "jpeg", "webp"].indexOf(opts.format) !== -1,
      'format must be "png", "jpeg", or "webp"');
    return this._request("/image/convert", {
      method: "POST",
      binary: true,
      body: this._imageBody(file, { format: opts.format })
    });
  };

  /**
   * Count words/characters in text.
   * @param {string} text
   * @returns {Promise<{words:number, characters:number, charactersNoSpaces:number, sentences:number, readingTimeSec:number}>}
   */
  DoKitSDK.prototype.countWords = function (text) {
    assert(typeof text === "string" && text.length > 0, "text is required");
    assert(text.length <= 1000000, "text too long (max 1,000,000 characters)");
    return this._request("/text/wordcount", { method: "POST", body: { text: text } });
  };

  /**
   * Convert text case.
   * @param {string} text
   * @param {string} mode - "upper" | "lower" | "title" | "sentence" | "alternating" | "inverse"
   * @returns {Promise<{result:string}>}
   */
  DoKitSDK.prototype.convertCase = function (text, mode) {
    assert(typeof text === "string", "text is required");
    assert(["upper", "lower", "title", "sentence", "alternating", "inverse"].indexOf(mode) !== -1,
      "unknown case mode: " + mode);
    return this._request("/text/caseconvert", { method: "POST", body: { text: text, mode: mode } });
  };

  /**
   * Get the typing leaderboard.
   * @param {Object} opts - { game: "battle"|"test", limit }
   * @returns {Promise<{entries:Array}>}
   */
  DoKitSDK.prototype.getLeaderboard = function (opts) {
    opts = opts || {};
    var q = "?game=" + encodeURIComponent(opts.game || "battle") +
      "&limit=" + Math.min(Math.max(parseInt(opts.limit, 10) || 10, 1), 100);
    return this._request("/typing/leaderboard" + q);
  };

  /**
   * Get the profile of the API key owner.
   * @returns {Promise<{userId:string, plan:string, credits:number}>}
   */
  DoKitSDK.prototype.getProfile = function () {
    return this._request("/user/profile");
  };

  DoKitSDK.DoKitError = DoKitError;
  DoKitSDK.DEFAULT_BASE_URL = DEFAULT_BASE_URL;
  DoKitSDK.isBrowser = isBrowser;

  return DoKitSDK;
}));
