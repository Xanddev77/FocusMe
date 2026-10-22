'use strict';
const $ = (id) => document.getElementById(id);
const SITES_PADRAO = ['instagram.com', 'tiktok.com', 'facebook.com', 'x.com', 'twitter.com', 'youtube.com', 'kwai.com', 'reddit.com', 'pinterest.com', 'snapchat.com', 'threads.net', 'twitch.tv'];
let dados = { config: { ativada: true, sites: SITES_PADRAO }, sessao: {}, stats: {}, appUrl: null, appTabId: null };

async function carregar() {
    const d = await chrome.storage.local.get(['config', 'sessao', 'stats', 'appUrl', 'appTabId']);
    const hoje = new Date().toLocaleDateString('sv-SE');
    dados = {
        config: { ativada: true, sites: SITES_PADRAO, ...(d.config || {}) },
        sessao: d.sessao || {},
        stats: d.stats && d.stats.dia === hoje ? d.stats : { tentativas: 0 },
        appUrl: d.appUrl || null,
        appTabId: d.appTabId ?? null
    };
    desenhar();
}

function formatar(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function desenhar() {
    const { config, sessao, stats } = dados;
    const bloqueando = config.ativada && sessao.bloqueando && Date.now() < (sessao.expiraEm || 0);

    $('ativada').checked = config.ativada;
    $('ligaTexto').textContent = config.ativada ? 'Ativada' : 'Desativada';
    $('nSites').textContent = config.sites.length;
    $('nTentativas').textContent = stats.tentativas || 0;

    const caixa = $('estado');
    if (!config.ativada) {
        caixa.dataset.estado = 'off';
        $('estadoTitulo').textContent = 'Extensão desativada';
        $('estadoTexto').textContent = 'Ligue o botão acima para voltar a bloquear.';
        $('estadoTempo').textContent = '';
    } else if (bloqueando) {
        caixa.dataset.estado = 'ativo';
        $('estadoTitulo').textContent = 'Redes bloqueadas';
        $('estadoTexto').textContent = sessao.pausado ? 'Foco pausado — continue no FocusMe.' : 'Seu foco termina em:';
        $('estadoTempo').textContent = !sessao.pausado && sessao.fimEm ? formatar(sessao.fimEm - Date.now()) : '';
    } else {
        caixa.dataset.estado = 'pronto';
        $('estadoTitulo').textContent = 'Redes liberadas';
        $('estadoTexto').textContent = 'O bloqueio começa quando o foco iniciar.';
        $('estadoTempo').textContent = '';
    }

    const chips = config.sites.slice(0, 8).map((s) => `<span>${s}</span>`);
    if (config.sites.length > 8) chips.push(`<span>+${config.sites.length - 8}</span>`);
    $('chips').innerHTML = chips.join('');
}

$('ativada').addEventListener('change', async (e) => {
    dados.config.ativada = e.target.checked;
    await chrome.storage.local.set({ config: dados.config });
    desenhar();
});

$('btnConfig').addEventListener('click', () => { chrome.runtime.openOptionsPage(); window.close(); });

$('btnApp').addEventListener('click', async () => {
    try {
        if (dados.appTabId != null) {
            const aba = await chrome.tabs.update(dados.appTabId, { active: true });
            await chrome.windows.update(aba.windowId, { focused: true });
            return window.close();
        }
    } catch (erro) { /* aba antiga fechada */ }
    if (dados.appUrl) chrome.tabs.create({ url: dados.appUrl });
    else chrome.runtime.openOptionsPage();
    window.close();
});

chrome.storage.onChanged.addListener(carregar);
setInterval(desenhar, 1000);
carregar();
