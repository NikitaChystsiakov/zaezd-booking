// Вставка формы бронирования на любой сайт:
// <div data-booking="slug"></div><script src="https://…/embed.js" async></script>
;(function () {
  var script = document.currentScript
  var origin = new URL(script ? script.src : location.href).origin
  var frames = []

  document.querySelectorAll('[data-booking]').forEach(function (el) {
    if (el.dataset.bookingReady) return
    el.dataset.bookingReady = '1'
    var iframe = document.createElement('iframe')
    iframe.src = origin + '/embed/' + encodeURIComponent(el.getAttribute('data-booking'))
    iframe.title = 'Бронирование'
    iframe.loading = 'lazy'
    iframe.style.cssText = 'width:100%;border:0;display:block;min-height:600px;background:transparent'
    iframe.setAttribute('allowtransparency', 'true')
    el.appendChild(iframe)
    frames.push(iframe)
  })

  window.addEventListener('message', function (e) {
    if (e.origin !== origin || !e.data || e.data.type !== 'booking:height') return
    frames.forEach(function (f) {
      if (f.contentWindow === e.source) f.style.height = e.data.height + 'px'
    })
  })
})()
