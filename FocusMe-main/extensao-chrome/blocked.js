'use strict';
const $ = (id) => document.getElementById(id);
const parametros = new URLSearchParams(location.search);
const site = parametros.get('site') || 'Este site';
const urlOriginal = parametros.get('url');
const SITES_PADRAO = ['instagram.com', 'tiktok.com', 'facebook.com', 'x.com', 'twitter.com', 'youtube.com', 'kwai.com', 'reddit.com', 'pinterest.com', 'snapchat.com', 'threads.net', 'twitch.tv'];

const FRASES = [
    'Cada minuto aqui é uma tarefa mais perto de acabar.',
    'A rede social vai estar lá depois. O seu foco, não.',
    'Respira. Volta para a tarefa. Você já começou.',
    'Quem protege o foco, termina mais cedo.',
    'Só mais um pouco. A pausa é merecida e já já chega.'
];
$('siteNome').textContent = site;
$('frase').textContent = FRASES[Math.floor(Math.random() * FRASES.length)];
document.title = `${site} bloqueado — FocusMe`;

let liberando = false;
let estado = { config: { ativada: true, sites: SITES_PADRAO }, sessao: {}, stats: {}, appUrl: null, appTabId: null };

const formatar = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

function aindaBloqueando() {
    const { config, sessao } = estado;
    if (!config.ativada || !sessao.bloqueando || Date.now() >= (sessao.expiraEm || 0)) return false;
    return config.sites.some((s) => site === s || site.endsWith('.' + s));
}

function liberar() {
    if (liberando) return;
    liberando = true;
    document.body.classList.add('liberado');
    $('afTexto').textContent = 'Foco concluído';
    $('titulo').textContent = 'liberado! Voltando para você.';
    $('contagemRotulo').textContent = 'Boa pausa';
    $('contagemTempo').textContent = '✓';
    if (urlOriginal && /^https?:/i.test(urlOriginal)) setTimeout(() => location.replace(urlOriginal), 1500);
}

function desenhar() {
    if (liberando) return;
    if (!aindaBloqueando()) return liberar();
    const { sessao, stats } = estado;
    if (sessao.pausado || !sessao.fimEm) {
        $('contagemRotulo').textContent = 'Foco pausado';
        $('contagemTempo').textContent = '⏸';
    } else {
        $('contagemRotulo').textContent = 'Seu foco termina em';
        $('contagemTempo').textContent = formatar(sessao.fimEm - Date.now());
    }
    const n = stats.tentativas || 0;
    $('rodape').textContent = `Hoje o FocusMe já barrou ${n} ${n === 1 ? 'acesso' : 'acessos'}. Cada um deles foi foco protegido.`;
}

async function carregar() {
    const d = await chrome.storage.local.get(['config', 'sessao', 'stats', 'appUrl', 'appTabId']);
    const hoje = new Date().toLocaleDateString('sv-SE');
    estado = {
        config: { ativada: true, sites: SITES_PADRAO, ...(d.config || {}) },
        sessao: d.sessao || {},
        stats: d.stats && d.stats.dia === hoje ? d.stats : { tentativas: 0 },
        appUrl: d.appUrl || null,
        appTabId: d.appTabId ?? null
    };
    $('btnVoltar').classList.toggle('oculto', !estado.appUrl);
    desenhar();
}

$('btnVoltar').addEventListener('click', async () => {
    try {
        if (estado.appTabId != null) {
            const aba = await chrome.tabs.update(estado.appTabId, { active: true });
            await chrome.windows.update(aba.windowId, { focused: true });
            return;
        }
    } catch (erro) { /* aba do FocusMe foi fechada */ }
    if (estado.appUrl) chrome.tabs.create({ url: estado.appUrl });
});
$('btnLista').addEventListener('click', () => chrome.runtime.openOptionsPage());

chrome.storage.onChanged.addListener(carregar);
setInterval(desenhar, 500);
carregar();
