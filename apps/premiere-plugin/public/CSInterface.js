/**
 * CSInterface.js — Adobe CEP bridge library (minimal implementation)
 * Provides communication between the panel HTML/JS and the host application
 * via the __adobe_cep__ global injected by the CEP runtime.
 */

'use strict';

var CSInterface = (function () {
  function CSInterface() {}

  /**
   * Evaluate an ExtendScript string in the host application.
   * @param {string} script  ExtendScript to run (must return a string).
   * @param {function} [callback]  Called with the return value string.
   */
  CSInterface.prototype.evalScript = function (script, callback) {
    if (typeof __adobe_cep__ !== 'undefined') {
      __adobe_cep__.evalScript(script, function (result) {
        if (typeof callback === 'function') callback(result);
      });
    } else if (typeof callback === 'function') {
      // Outside the CEP runtime — return a safe error string so callers don't crash.
      callback(JSON.stringify({ error: 'CSInterface not available outside Premiere Pro' }));
    }
  };

  /** Add a listener for CSEvents dispatched from ExtendScript. */
  CSInterface.prototype.addEventListener = function (type, listener) {
    if (typeof __adobe_cep__ !== 'undefined') {
      __adobe_cep__.addEventListener(type, listener);
    }
  };

  /** Remove a previously added CSEvent listener. */
  CSInterface.prototype.removeEventListener = function (type, listener) {
    if (typeof __adobe_cep__ !== 'undefined') {
      __adobe_cep__.removeEventListener(type, listener);
    }
  };

  /** Dispatch a CSEvent to ExtendScript. */
  CSInterface.prototype.dispatchEvent = function (event) {
    if (typeof __adobe_cep__ !== 'undefined') {
      __adobe_cep__.dispatchEvent(event);
    }
  };

  /** Returns the host environment object (app name, locale, etc.). */
  CSInterface.prototype.getHostEnvironment = function () {
    if (typeof __adobe_cep__ !== 'undefined') {
      return JSON.parse(__adobe_cep__.getHostEnvironment());
    }
    return {};
  };

  /** Returns the current host application ID (e.g. "PPRO"). */
  CSInterface.prototype.getApplicationID = function () {
    var env = this.getHostEnvironment();
    return env.appId || '';
  };

  /** Closes the extension panel. */
  CSInterface.prototype.closeExtension = function () {
    if (typeof __adobe_cep__ !== 'undefined') {
      __adobe_cep__.closeExtension();
    }
  };

  return CSInterface;
})();
