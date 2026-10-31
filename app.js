(async () => {
  const DB = window.__DB__ || await (await fetch('data.json')).json();
  document.getElementById('updatedAt').textContent = new Date(DB.generatedAt).toLocaleString('pt-BR');

  // ---------- KPIs ----------
  const k = DB.kpis;
  const kpis = [
    { num: k.totalLeads, lbl: 'Leads cadastrados', sub: `${k.pending} aguardando 1º contato` },
    { num: k.email1, lbl: 'Primeiros contatos', sub: `${k.email2} follow-up 2 · ${k.email3} follow-up 3` },
    { num: k.responded, lbl: 'Respostas recebidas', sub: `ciclo ${k.maxCycle > 0 ? k.maxCycle : '1'} de prospecção` },
    { num: `${k.responseRate}%`, lbl: 'Taxa de resposta', sub: 'sobre o total de email1' },
    { num: k.onHold, lbl: 'Em hold (sem interesse)', sub: 'recontato após 8 meses', tone: 'neutral' },
    { num: k.bounces + k.invalid, lbl: 'Bounces / inválidos', sub: `${k.bounces} suprimidos automáticos`, tone: 'danger' },
    { num: k.followupsDue, lbl: 'Follow-ups a vencer', sub: 'email2/email3 pendentes' },
    { num: k.totalLeads - k.pending, lbl: 'Já contatados', sub: 'elegíveis + enviados', tone: 'highlight' }
  ];
  kpis.forEach((p, i) => { if (!p.tone) p.cls = 'c' + ((i % 6) + 1); else p.cls = 'tone-' + p.tone; });
  document.getElementById('kpiRow').innerHTML = kpis.map(p =>
    `<div class="kpi ${p.cls}"><div class="num">${p.num}</div><div class="lbl">${p.lbl}</div><div class="sub">${p.sub}</div></div>`
  ).join('');

  // ---------- Quota ----------
  const q = DB.quota;
  const pct = Math.min(100, Math.round((q.used / q.limit) * 100));
  document.getElementById('quotaText').textContent = `${q.used} de ${q.limit} enviados`;
  document.getElementById('quotaBar').style.width = pct + '%';

  // ---------- Funnel ----------
  const f = DB.funnel;
  const steps = [
    { label: 'Leads', v: f.leads, max: f.leads, color: '#B98AA0' },
    { label: 'Elegíveis', v: f.elegiveis, max: f.leads, color: '#9B3B69' },
    { label: 'Email1', v: f.email1, max: f.leads, color: '#772A53' },
    { label: 'Email2', v: f.email2, max: f.leads, color: '#F55600' },
    { label: 'Email3', v: f.email3, max: f.leads, color: '#FF8A2A' },
    { label: 'Respostas', v: f.responded, max: f.leads, color: '#00A7B5' }
  ];
  document.getElementById('funnel').innerHTML = steps.map((s, i) => {
    const w = Math.max(8, Math.round((s.v / s.max) * 100));
    const prev = steps[i - 1];
    const pctLoss = prev ? (prev.v ? Math.round(((prev.v - s.v) / prev.v) * 100) : 0) : null;
    return `<div class="funnel-step">
      <span class="funnel-label">${s.label}</span>
      <div class="funnel-bar" style="width:${w}%;background:${s.color}">${s.v}<small>  ${pctLoss !== null ? '-' + pctLoss + '%' : ''}</small></div>
    </div>`;
  }).join('');

  // ---------- Próximos ----------
  const nextBox = document.getElementById('nextBox');
  let html = '<div style="font-size:12px;color:var(--muted);margin-bottom:8px;">Follow-ups de email2 (D+2) pendentes:</div>';
  const due = DB.followupsDueAt || [];
  html += due.length
    ? due.map(d => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #F6EFF2;"><span>${d.name}</span><span class="muted">email1 em ${d.date}</span></div>`).join('')
    : '<div class="muted" style="font-size:12px;">Nenhum follow-up pendente agora.</div>';
  html += '<div style="font-size:12px;color:var(--muted);margin:14px 0 8px;">Leads em hold (sem interesse):</div>';
  const holds = DB.holds || [];
  html += holds.length
    ? holds.map(h => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #F6EFF2;"><span>${h.name}</span><span class="muted">recontato ${h.until}</span></div>`).join('')
    : '<div class="muted" style="font-size:12px;">Nenhum lead em hold.</div>';
  nextBox.innerHTML = html;

  // ---------- Timeline ----------
  const tl = DB.timeline || [];
  const dates = tl.map(d => d.date);
  function mk(series, color, type) {
    return { label: series, data: tl.map(d => d[series] || 0), backgroundColor: color, borderColor: color, type: type || 'bar', tension: .3, fill: false };
  }
  new Chart(document.getElementById('chartTimeline'), {
    data: {
      labels: dates,
      datasets: [
        mk('email1', '#772A53'),
        mk('email2', '#123B4A'),
        mk('email3', '#FF8A2A'),
        mk('responses', '#00A7B5', 'line')
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { boxWidth: 12, font: { size: 11 } } } },
      scales: { x: { ticks: { maxTicksLimit: 12 } } }
    }
  });

  // ---------- A/B ----------
  const ab = DB.ab || [];
  new Chart(document.getElementById('chartAB'), {
    type: 'doughnut',
    data: {
      labels: ab.map(a => a.label),
      datasets: [{
        data: ab.map(a => a.sent), backgroundColor: ['#772A53', '#123B4A', '#FF8A2A', '#9A8A90'],
        borderWidth: 2, borderColor: '#fff'
      }]
    },
    options: {
      responsive: true, cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => `${c.label}: ${c.parsed} enviados (${ab[c.dataIndex].responses} respostas, ${ab[c.dataIndex].responseRate}%)` } }
      }
    }
  });

  // ---------- Segmentos ----------
  const seg = (DB.segments || []).slice(0, 8);
  const SEG_PALETTE = ['#772A53', '#123B4A', '#F55600', '#FF8A2A', '#00A7B5', '#5A47B8', '#A8446F', '#B98AA0'];
  new Chart(document.getElementById('chartSeg'), {
    type: 'bar',
    data: {
      labels: seg.map(s => s.label),
      datasets: [{ label: 'Enviados', data: seg.map(s => s.sent), backgroundColor: seg.map((_, i) => SEG_PALETTE[i % SEG_PALETTE.length]) }]
    },
    options: {
      indexAxis: 'y', responsive: true, borderRadius: 6,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.parsed.x} de ${seg[c.dataIndex].total} leads` } } },
      scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });

  // ---------- Estados ----------
  renderStates(DB.states || []);

  // ---------- Tabela ----------
  const tableBody = document.getElementById('leadsTable');
  const searchInput = document.getElementById('search');
  const statusFilter = document.getElementById('statusFilter');
  const STATUS_OPTIONS = ['Todos', 'Aguardando primeiro contato', 'Primeiro contato enviado', 'Follow-up 2 enviado', 'Ciclo completo', 'Respondeu', 'Hold (sem interesse)', 'Bounce / suprimido', 'Email inválido'];
  statusFilter.innerHTML = STATUS_OPTIONS.map(s => `<option>${s}</option>`).join('');
  let rows = DB.leads || [];

  function toneChip(cls) { return cls && cls !== '' ? cls : ''; }
  function phaseTag(l) { return l.email3 ? 'email3' : l.email2 ? 'email2' : l.email1 ? 'email1' : '—'; }

  function render() {
    const term = searchInput.value.trim().toLowerCase();
    const st = statusFilter.value;
    let list = rows.filter(l => (term === '' || (l.name + ' ' + l.email + ' ' + l.city + ' ' + l.state + ' ' + l.typeLabel).toLowerCase().includes(term)));
    if (st !== 'Todos') list = list.filter(l => l.status === st);
    document.getElementById('tableCount').textContent = `(${list.length})`;
    tableBody.innerHTML = list.length
      ? list.slice(0, 200).map(l => `<tr>
          <td><b>${l.name}</b>${l.cycle > 0 ? `<span class="chip neutral" style="margin-left:6px;">ciclo ${l.cycle + 1}</span>` : ''}</td>
          <td><span class="tag">${l.typeLabel}</span>${l.state}</td>
          <td>${l.city}<span class="tag">${l.state}</span></td>
          <td>${l.email}</td>
          <td><span class="chip">${l.template}</span></td>
          <td>${phaseTag(l)}<span class="tag">${l.date1 || '—'}</span></td>
          <td><span class="chip ${toneChip(l.statusTone)}">${l.status}</span></td>
        </tr>`).join('')
      : '<tr class="empty"><td colspan="7">Nenhum lead encontrado.</td></tr>';
  }
  searchInput.addEventListener('input', render);
  statusFilter.addEventListener('change', render);
  render();
})();

// ---------- Mapa Brasil (choropleth) ----------
const UF_BY_NAME = {
  'Acre':'AC','Alagoas':'AL','Amapá':'AP','Amazonas':'AM','Bahia':'BA','Ceará':'CE','Distrito Federal':'DF',
  'Espírito Santo':'ES','Goiás':'GO','Maranhão':'MA','Mato Grosso':'MT','Mato Grosso do Sul':'MS','Minas Gerais':'MG',
  'Pará':'PA','Paraíba':'PB','Paraná':'PR','Pernambuco':'PE','Piauí':'PI','Rio de Janeiro':'RJ','Rio Grande do Norte':'RN',
  'Rio Grande do Sul':'RS','Rondônia':'RO','Roraima':'RR','Santa Catarina':'SC','São Paulo':'SP','Sergipe':'SE','Tocantins':'TO'
};

async function renderStates(states) {
  const box = document.getElementById('statesBox');
  const counts = {};
  states.forEach(s => counts[s.state] = s.total);
  const byUf = counts;

  const fallback = (title) => {
    box.innerHTML = `<div class="chips-fallback" title="${title || ''}">${
      states.map(s => `<span class="chip uf"><b>${s.state}</b> ${s.total}</span>`).join('')
    }</div>`;
  };

  try {
    const res = await fetch('https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson');
    if (!res.ok) throw new Error('geo');
    const geo = await res.json();
    if (!window.d3 || !geo.features) throw new Error('d3');
    const width = 340, height = 320;
    const projection = d3.geoMercator().fitExtent([[6, 6], [width - 6, height - 6]], geo);
    const path = d3.geoPath(projection);
    const max = Math.max(1, ...Object.values(byUf));
    const hexr = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const mix = (a, b, t) => { const A = hexr(a), B = hexr(b); return `rgb(${A.map((c, i) => Math.round(c + (B[i] - c) * t)).join(',')})`; };
    const LOW = '#F8E9EF', MID = '#FF8A2A', HIGH = '#772A53';
    const color = v => { const t = Math.min(1, v / max); return t < .5 ? mix(LOW, MID, t * 2) : mix(MID, HIGH, (t - .5) * 2); };
    const svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Mapa de leads por estado">
      ${geo.features.map(f => {
        const uf = UF_BY_NAME[f.properties.name] || null;
        const v = uf ? (byUf[uf] || 0) : 0;
        const fill = uf ? color(v) : '#EFE7EA';
        return `<path d="${path(f)}" fill="${fill}" stroke="#fff" stroke-width="0.8">
          <title>${f.properties.name}: ${v} leads</title>
        </path>`;
      }).join('')}
    </svg><div style="font-size:11px;color:var(--muted);margin-top:6px;">Intensidade = nº de leads. Total por UF abaixo:</div>
    <div class="chips-fallback" style="margin-top:8px;">${states.map(s => `<span class="chip uf"><b>${s.state}</b> ${s.total}</span>`).join('')}</div>`;
    box.innerHTML = svg;
  } catch (e) {
    fallback(e && e.message);
  }
}