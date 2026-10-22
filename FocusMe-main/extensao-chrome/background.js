'use strict';

// ---------------------------------------------------------------------------
// FocusMe — Bloqueio de Distrações (service worker)
// O site do FocusMe avisa quando o foco começa/termina; enquanto o foco está
// em andamento, qualquer navegação para um site da lista é desviada para a
// página de bloqueio. Nas pausas, tudo é liberado.
// ---------------------------------------------------------------------------

const SITES_PADRAO = [
    'instagram.com', 'tiktok.com', 'facebook.com', 'x.com', 'twitter.com', 'youtube.com',
    'kwai.com', 'reddit.com', 'pinterest.com', 'snapchat.com', 'threads.net', 'twitch.tv'
];
const CONFIG_PADRAO = { ativada: true, sites: SITES_PADRAO };
const GRACA_RODANDO_MS = 2 * 60 * 1000;   // depois do fim previsto do foco
const GRACA_PAUSADO_MS = 10 * 60 * 1000;  // sem sinal do site com o foco pausado

const diaDeHoje = () => new Date().toLocaleDateString('sv-SE');

async function ler() {
    const d = await chrome.storage.local.get(['config', 'sessao', 'stats', 'appUrl', 'appTabId']);
    const stats = d.stats && d.stats.dia === diaDeHoje() ? d.stats : { dia: diaDeHoje(), tentativas: 0, porSite: {} };
    return {
        config: { ...CONFIG_PADRAO, ...(d.config || {}) },
        sessao: d.sessao || { bloqueando: false },
        stats,
        appUrl: d.appUrl || null,
        appTabId: d.appTabId ?? null
    };
}

function dominioDaLista(url, sites) {
    try {
        const u = new URL(url);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
        const host = u.hostname.toLowerCase().replace(/^www\./, '');
        return sites.find((s) => host === s || host.endsWith('.' + s)) || null;
    } catch (erro) {
        return null;
    }
}

const deveBloquear = (e) => e.config.ativada && e.sessao.bloqueando && Date.now() < (e.sessao.expiraEm || 0);

async function montarStatus() {
    const e = await ler();
    return {
        versao: chrome.runtime.getManifest().version,
        ativada: e.config.ativada,
        bloqueando: deveBloquear(e),
        fase: e.sessao.fase || null,
        pausado: !!e.sessao.pausado,
        fimEm: e.sessao.fimEm || null,
        totalSites: e.config.sites.length,
        tentativasHoje: e.stats.tentativas
    };
}

async function atualizarBadge() {
    const e = await ler();
    const ligado = deveBloquear(e);
    await chrome.action.setBadgeText({ text: ligado ? 'ON' : '' });
    await chrome.action.setBadgeBackgroundColor({ color: '#0c5c7e' });
    await chrome.action.setTitle({ title: ligado ? 'FocusMe — redes sociais bloqueadas' : 'FocusMe' });
}

async function avisarSite() {
    const { appTabId } = await ler();
    if (appTabId == null) return;
    try {
        await chrome.tabs.sendMessage(appTabId, { type: 'STATUS_CHANGED', status: await montarStatus() });
    } catch (erro) { /* aba do FocusMe fechada */ }
}

// Desvia a aba para a página de bloqueio, se o endereço estiver na lista
async function verificarAba(tabId, url, estado, contar = true) {
    const e = estado || await ler();
    if (!deveBloquear(e)) return false;
    const site = dominioDaLista(url, e.config.sites);
    if (!site) return false;

    if (contar) {
        e.stats.tentativas += 1;
        e.stats.porSite[site] = (e.stats.porSite[site] || 0) + 1;
        await chrome.storage.local.set({ stats: e.stats });
    }
    const destino = chrome.runtime.getURL('blocked.html')
        + `?site=${encodeURIComponent(site)}&url=${encodeURIComponent(url)}`;
    try { await chrome.tabs.update(tabId, { url: destino }); } catch (erro) { /* aba fechada */ }
    return true;
}

async function varrerAbasAbertas() {
    const e = await ler();
    const abas = await chrome.tabs.query({});
    for (const aba of abas) {
        if (aba.url) await verificarAba(aba.id, aba.url, e, false);
    }
}

chrome.webNavigation.onBeforeNavigate.addListener((d) => {
    if (d.frameId === 0) verificarAba(d.tabId, d.url);
});
chrome.webNavigation.onHistoryStateUpdated.addListener((d) => {
    if (d.frameId === 0) verificarAba(d.tabId, d.url);
});

async function agendarExpiracao(sessao) {
    await chrome.alarms.clear('expirar');
    if (sessao.bloqueando && sessao.expiraEm > Date.now()) {
        chrome.alarms.create('expirar', { when: sessao.expiraEm });
    }
}

async function liberar() {
    const { sessao } = await ler();
    await chrome.storage.local.set({ sessao: { ...sessao, bloqueando: false, expiraEm: 0 } });
    await chrome.alarms.clear('expirar');
    await atualizarBadge();
    await avisarSite();
}

async function aplicarEstadoDoSite(p, remetente) {
    const antes = await ler();
    const agora = Date.now();
    const bloquear = !!(p && p.bloquear);
    const fimEm = bloquear && p.fimEm ? Number(p.fimEm) : null;

    const sessao = {
        bloqueando: bloquear,
        fase: (p && p.fase) || 'foco',
        pausado: !!(p && p.pausado),
        fimEm,
        expiraEm: bloquear ? Math.max(fimEm || 0, agora) + (fimEm ? GRACA_RODANDO_MS : GRACA_PAUSADO_MS) : 0,
        atualizadoEm: agora
    };
    const gravar = { sessao };
    if (remetente && remetente.tab) {
        if (remetente.tab.url) gravar.appUrl = remetente.tab.url;
        if (remetente.tab.id != null) gravar.appTabId = remetente.tab.id;
    }
    await chrome.storage.local.set(gravar);
    await agendarExpiracao(sessao);
    await atualizarBadge();

    if (bloquear && !antes.sessao.bloqueando && antes.config.ativada) await varrerAbasAbertas();
    return montarStatus();
}

chrome.runtime.onMessage.addListener((mensagem, remetente, responder) => {
    (async () => {
        if (mensagem.type === 'FOCUSME_STATE') responder(await aplicarEstadoDoSite(mensagem.payload, remetente));
        else if (mensagem.type === 'STATUS') responder(await montarStatus());
        else responder(null);
    })();
    return true;
});

chrome.alarms.onAlarm.addListener((alarme) => {
    if (alarme.name === 'expirar') liberar();
});

// Mudou algo (config, sessão): atualiza ícone e avisa a aba do FocusMe
chrome.storage.onChanged.addListener(async (mudancas, area) => {
    if (area !== 'local') return;
    if (mudancas.config || mudancas.sessao) {
        await atualizarBadge();
        await avisarSite();
        if (mudancas.config) {
            const e = await ler();
            if (deveBloquear(e)) await varrerAbasAbertas();
        }
    }
});

async function iniciar() {
    const { config } = await chrome.storage.local.get('config');
    if (!config) await chrome.storage.local.set({ config: CONFIG_PADRAO });
    const e = await ler();
    if (e.sessao.bloqueando && Date.now() >= (e.sessao.expiraEm || 0)) await liberar();
    else await agendarExpiracao(e.sessao);
    await atualizarBadge();
}

chrome.runtime.onInstalled.addListener(iniciar);
chrome.runtime.onStartup.addListener(iniciar);
