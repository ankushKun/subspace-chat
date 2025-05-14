// This file is used during development
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', {
        scope: './',
        type: 'module'
    })
}