/**
 * 葱搭 任务详情「预览」iframe 内联桥：在预览页中加载，使 _blank / window.open
 * 通过 parent.postMessage 通知主应用，从而在本面板内开新标签。
 * 在预览入口 HTML 中加入:
 *   <script src="https://<主应用 origin>/preview-iframe-bridge.js" defer><\/script>
 * 本地主应用为 http://localhost:5173 时替换为对应 origin。
 */
;(function initAinativePreviewBridge() {
  'use strict'
  if (window.__AINATIVE_PREVIEW_BRIDGE__) {
    return
  }
  window.__AINATIVE_PREVIEW_BRIDGE__ = true

  var TYPE = 'ainative:preview:openInTab'
  var DIAG_TYPE = 'ainative:preview:diagnostic'

  var inFrame = (function inIframe() {
    try {
      return window.self !== window.top
    } catch {
      return true
    }
  })()
  if (!inFrame) {
    return
  }

  function postToParent(absoluteUrl, title) {
    var payload = { type: TYPE, url: absoluteUrl }
    if (title) {
      payload.title = title
    }
    window.parent.postMessage(payload, '*')
  }

  function postDiagnostic(kind, detail) {
    try {
      window.parent.postMessage(
        { type: DIAG_TYPE, kind: kind, detail: detail || null },
        '*',
      )
    } catch {
      /* ignore */
    }
  }

  function clampText(value, maxLength) {
    var text = String(value == null ? '' : value).trim()
    if (!text) {
      return ''
    }
    if (text.length <= maxLength) {
      return text
    }
    return text.slice(0, maxLength - 1) + '…'
  }

  function safeUrl(value) {
    if (typeof value !== 'string' || !value.trim()) {
      return null
    }
    try {
      var parsed = new URL(value, document.baseURI)
      return parsed.origin + parsed.pathname
    } catch {
      return clampText(value, 512)
    }
  }

  function inferRawKind(value) {
    if (value === null) {
      return 'null'
    }
    if (Array.isArray(value)) {
      return 'array'
    }
    return typeof value
  }

  function sanitizePlainObject(value, depth, seen) {
    if (!value || typeof value !== 'object') {
      return null
    }
    if (seen.indexOf(value) >= 0) {
      return '[Circular]'
    }
    if (depth <= 0) {
      return '[Object]'
    }
    seen.push(value)
    var result = {}
    var preferredKeys = ['message', 'name', 'code', 'status', 'errMsg', 'path', 'url']
    for (var i = 0; i < preferredKeys.length; i += 1) {
      var key = preferredKeys[i]
      var entry = value[key]
      if (entry == null || typeof entry === 'object' || typeof entry === 'function') {
        continue
      }
      if (key === 'url' || key === 'path') {
        result[key] = safeUrl(String(entry))
      } else {
        result[key] = clampText(String(entry), 512)
      }
    }
    if (!Object.keys(result).length) {
      var allKeys = Object.keys(value).slice(0, 6)
      for (var j = 0; j < allKeys.length; j += 1) {
        var candidateKey = allKeys[j]
        if (
          candidateKey === 'token' ||
          candidateKey === 'authorization' ||
          candidateKey === 'headers' ||
          candidateKey === 'cookie' ||
          candidateKey === 'localStorage' ||
          candidateKey === 'response' ||
          candidateKey === 'data' ||
          candidateKey === 'body'
        ) {
          continue
        }
        var candidateValue = value[candidateKey]
        if (
          candidateValue == null ||
          typeof candidateValue === 'object' ||
          typeof candidateValue === 'function'
        ) {
          continue
        }
        result[candidateKey] = clampText(String(candidateValue), 256)
      }
    }
    seen.pop()
    return Object.keys(result).length ? result : null
  }

  function summarizeReason(reason) {
    var detail = {
      rawKind: inferRawKind(reason),
    }

    if (reason && typeof reason === 'object') {
      if (typeof reason.message === 'string' && reason.message.trim()) {
        detail.message = clampText(reason.message, 1024)
      }
      if (typeof reason.name === 'string' && reason.name.trim()) {
        detail.name = clampText(reason.name, 256)
      }
      if (typeof reason.code === 'string' || typeof reason.code === 'number') {
        detail.code = String(reason.code)
      }
      if (typeof reason.status === 'string' || typeof reason.status === 'number') {
        detail.status = String(reason.status)
      }
      if (typeof reason.errMsg === 'string' && reason.errMsg.trim()) {
        detail.errMsg = clampText(reason.errMsg, 512)
      }
      if (typeof reason.stack === 'string' && reason.stack.trim()) {
        detail.stack = clampText(reason.stack, 4000)
      }
      if (typeof reason.filename === 'string' && reason.filename.trim()) {
        detail.filename = safeUrl(reason.filename)
      }
      var objectSummary = sanitizePlainObject(reason, 2, [])
      if (objectSummary) {
        detail.objectSummary = objectSummary
      }
    } else if (reason != null) {
      detail.message = clampText(String(reason), 1024)
    }

    detail.summary =
      detail.message ||
      detail.errMsg ||
      (detail.objectSummary ? clampText(JSON.stringify(detail.objectSummary), 1024) : '') ||
      'Unhandled promise rejection'

    return detail
  }

  function samePreviewOrigin(absolute) {
    try {
      return new URL(absolute).origin === window.location.origin
    } catch {
      return false
    }
  }

  function makeShimForBlankOpen() {
    var locState = { _h: 'about:blank' }
    var loc = {}
    Object.defineProperty(loc, 'href', {
      get: function getHref() {
        return locState._h
      },
      set: function setHref(h) {
        if (!h) {
          return
        }
        try {
          var o = new URL(h, document.baseURI)
          if (samePreviewOrigin(o.href)) {
            postToParent(o.href, undefined)
            locState._h = o.href
          }
        } catch {
          /* ignore */
        }
      },
    })
    loc.replace = function replace(h) {
      loc.href = h
    }
    loc.assign = function assign(h) {
      loc.href = h
    }
    return {
      closed: false,
      get opener() {
        return null
      },
      set opener(_v) {
        /* lock */
      },
      get location() {
        return loc
      },
      set location(v) {
        if (v) {
          loc.href = String(v)
        }
      },
      close: function close() {
        this.closed = true
      },
    }
  }

  var openOrig = window.open
  window.open = function patchedOpen(url) {
    var str = url === undefined || url === null ? '' : String(url)
    if (str === '' || str === 'about:blank') {
      return makeShimForBlankOpen()
    }
    try {
      var abs = new URL(str, document.baseURI).href
      if (samePreviewOrigin(abs)) {
        postToParent(abs, undefined)
        return null
      }
    } catch {
      /* fall through */
    }
    return openOrig.apply(this, arguments)
  }

  document.addEventListener(
    'click',
    function onCaptureClick(e) {
      if (e.defaultPrevented || e.button !== 0) {
        return
      }
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return
      }
      var t = e.target
      if (!t || !t.closest) {
        return
      }
      var a = t.closest('a[href]')
      if (!a) {
        return
      }
      var href = a.getAttribute('href') || ''
      if (href.indexOf('javascript:') === 0 || href.indexOf('mailto:') === 0) {
        return
      }
      if (a.getAttribute('download') != null) {
        return
      }
      var target = (a.getAttribute('target') || '').toLowerCase()
      if (target !== '_blank') {
        return
      }
      e.preventDefault()
      var title
      if (a.textContent && a.textContent.trim()) {
        title = a.textContent.trim()
      } else {
        var at = a.getAttribute('title')
        title = at && at.trim() ? at.trim() : undefined
      }
      try {
        var abs2 = new URL(a.href, document.baseURI).href
        if (samePreviewOrigin(abs2)) {
          postToParent(abs2, title)
        }
      } catch {
        /* ignore */
      }
    },
    true,
  )

  window.addEventListener(
    'error',
    function onWindowError(event) {
      postDiagnostic('workspace-runtime-error', {
        source: 'error',
        message: event && event.message ? clampText(String(event.message), 1024) : null,
        summary: event && event.message ? clampText(String(event.message), 1024) : 'Window error',
        filename: event && event.filename ? safeUrl(String(event.filename)) : null,
        stack:
          event &&
          event.error &&
          typeof event.error.stack === 'string' &&
          event.error.stack.trim()
            ? clampText(String(event.error.stack), 4000)
            : null,
        rawKind: event && event.error ? inferRawKind(event.error) : inferRawKind(event),
      })
    },
    true,
  )

  window.addEventListener('unhandledrejection', function onUnhandledRejection(event) {
    var reason = event && 'reason' in event ? event.reason : null
    var detail = summarizeReason(reason)
    detail.source = 'unhandledrejection'
    postDiagnostic('workspace-runtime-error', detail)
  })
})()
