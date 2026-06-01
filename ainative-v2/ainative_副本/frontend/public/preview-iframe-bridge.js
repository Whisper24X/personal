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
})()
