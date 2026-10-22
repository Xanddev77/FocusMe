// Ponte entre o site do FocusMe e a extensão.
// Só age em páginas que se identificam com <meta name="focusme-app">.
(() => {
    'use strict';
    if (!document.querySelector('meta[name="focusme-app"]')) return;

    const origem = location.origin === 'null' ? '*' : location.origin;

    function paraOSite(tipo, extra = {}) {
        window.postMessage({ source: 'focusme-extension', type: tipo, ...extra }, origem);
    }

    async function perguntar(mensagem) {
        try {
            return await chrome.runtime.sendMessage(mensagem);
        } catch (erro) {
            return null; // extensão recarregada/atualizada: a aba precisa ser recarregada
        }
    }

    window.addEventListener('message', async (evento) => {
        if (evento.source !== window) return;
        const dados = evento.data;
        if (!dados || dados.source !== 'focusme-app') return;

        if (dados.type === 'FOCUSME_PING') {
            const status = await perguntar({ type: 'STATUS' });
            if (status) paraOSite('FOCUSME_READY', { status });
        }

        if (dados.type === 'FOCUSME_STATE') {
            const status = await perguntar({ type: 'FOCUSME_STATE', payload: dados.payload });
            if (status) paraOSite('FOCUSME_STATUS', { status });
        }
    });

    try {
        chrome.runtime.onMessage.addListener((mensagem) => {
            if (mensagem && mensagem.type === 'STATUS_CHANGED') {
                paraOSite('FOCUSME_STATUS', { status: mensagem.status });
            }
        });
    } catch (erro) { /* contexto invalidado */ }

    perguntar({ type: 'STATUS' }).then((status) => {
        if (status) paraOSite('FOCUSME_READY', { status });
    });
})();
