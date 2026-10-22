'use strict';
const $ = (id) => document.getElementById(id);
const SITES_PADRAO = ['instagram.com', 'tiktok.com', 'facebook.com', 'x.com', 'twitter.com', 'youtube.com', 'kwai.com', 'reddit.com', 'pinterest.com', 'snapchat.com', 'threads.net', 'twitch.tv'];
const PRESETS = [
    ['instagram.com', 'Instagram'], ['tiktok.com', 'TikTok'], ['facebook.com', 'Facebook'], ['x.com', 'X'],
    ['twitter.com', 'Twitter'], ['youtube.com', 'YouTube'], ['kwai.com', 'Kwai'], ['reddit.com', 'Reddit'],
    ['pinterest.com', 'Pinterest'], ['snapchat.com', 'Snapchat'], ['threads.net', 'Threads'], ['twitch.tv', 'Twitch'],
    ['discord.com', 'Discord'], ['web.whatsapp.com', 'WhatsApp Web'], ['web.telegram.org', 'Telegram Web'],
    ['linkedin.com', 'LinkedIn'], ['netflix.com', 'Netflix'], ['9gag.com', '9GAG']
];
const dominiosPreset = new Set(PRESETS.map((p) => p[0]));
let config = { ativada: true, sites: [...SITES_PADRAO] };

async function carregar() {
    const d = await chrome.storage.local.get('config');
    config = { ativada: true, sites: [...SITES_PADRAO], ...(d.config || {}) };
    desenhar();
    desenharOrigens();
}

const salvar = () => chrome.storage.local.set({ config });

function normalizar(texto) {
    let s = texto.trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/^www\./, '');
    s = s.split(/[\/?#]/)[0].replace(/:\d+$/, '');
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) ? s : null;
}

function desenhar() {
    $('presets').innerHTML = PRESETS.map(([dominio, nome]) => `
        <button type="button" class="preset" data-site="${dominio}" aria-pressed="${config.sites.includes(dominio)}">
            <span class="letra">${nome.charAt(0)}</span>
            <span class="nome">${nome}<small>${dominio}</small></span>
            <span class="marca"></span>
        </button>`).join('');

    const proprios = config.sites.filter((s) => !dominiosPreset.has(s));
    $('personalizados').innerHTML = proprios.map((s) => `<span class="chip">${s}<button type="button" data-remover="${s}" aria-label="Remover ${s}">×</button></span>`).join('');
}

$('presets').addEventListener('click', async (e) => {
    const botao = e.target.closest('.preset');
    if (!botao) return;
    const site = botao.dataset.site;
    config.sites = config.sites.includes(site) ? config.sites.filter((s) => s !== site) : [...config.sites, site];
    await salvar();
    desenhar();
});

$('personalizados').addEventListener('click', async (e) => {
    const alvo = e.target.closest('[data-remover]');
    if (!alvo) return;
    config.sites = config.sites.filter((s) => s !== alvo.dataset.remover);
    await salvar();
    desenhar();
});

$('formAdd').addEventListener('submit', async (e) => {
    e.preventDefault();
    const site = normalizar($('novoSite').value);
    $('erroAdd').textContent = '';
    if (!site) { $('erroAdd').textContent = 'Digite um endereço válido, como exemplo.com.br.'; return; }
    if (!config.sites.includes(site)) config.sites.push(site);
    $('novoSite').value = '';
    await salvar();
    desenhar();
});

$('btnRestaurar').addEventListener('click', async () => {
    config.sites = [...SITES_PADRAO];
    await salvar();
    desenhar();
});

// --- Domínios próprios para o FocusMe (opcional) ---
async function desenharOrigens() {
    try {
        const scripts = await chrome.scripting.getRegisteredContentScripts();
        const meus = scripts.filter((s) => s.id.startsWith('focusme-'));
        $('origens').innerHTML = meus.map((s) => `<span class="chip">${s.matches[0].replace('/*', '')}<button type="button" data-origem="${s.id}" data-padrao="${s.matches[0]}" aria-label="Remover autorização">×</button></span>`).join('');
    } catch (erro) { $('origens').innerHTML = ''; }
}

$('formOrigem').addEventListener('submit', async (e) => {
    e.preventDefault();
    const erro = $('erroOrigem');
    erro.classList.remove('ok');
    erro.textContent = '';
    let origem;
    try { origem = new URL($('appUrl').value.trim()).origin; } catch (x) { origem = null; }
    if (!origem || !/^https?:\/\//.test(origem)) { erro.textContent = 'Digite o endereço completo, começando com https://'; return; }

    const padrao = `${origem}/*`;
    try {
        const concedida = await chrome.permissions.request({ origins: [padrao] });
        if (!concedida) { erro.textContent = 'Sem a permissão, a extensão não consegue falar com o seu site.'; return; }
        const id = 'focusme-' + origem.replace(/[^a-z0-9]/gi, '-').slice(0, 60);
        try { await chrome.scripting.unregisterContentScripts({ ids: [id] }); } catch (x) { /* ainda não existia */ }
        await chrome.scripting.registerContentScripts([{ id, matches: [padrao], js: ['content.js'], runAt: 'document_idle', persistAcrossSessions: true }]);
        $('appUrl').value = '';
        erro.classList.add('ok');
        erro.textContent = 'Pronto! Recarregue a aba do FocusMe para conectar.';
        desenharOrigens();
    } catch (x) {
        erro.textContent = 'Não foi possível autorizar este endereço.';
    }
});

$('origens').addEventListener('click', async (e) => {
    const alvo = e.target.closest('[data-origem]');
    if (!alvo) return;
    try {
        await chrome.scripting.unregisterContentScripts({ ids: [alvo.dataset.origem] });
        await chrome.permissions.remove({ origins: [alvo.dataset.padrao] });
    } catch (x) { /* nada a remover */ }
    desenharOrigens();
});

chrome.storage.onChanged.addListener((m, area) => { if (area === 'local' && m.config) carregar(); });
carregar();
