const TOKEN = "6893cc98ce1a170014115708";
const URL_FUNIS = "https://n8n.360xpand.com/webhook/rd-funis";
const URL_RESPONSAVEIS = "https://n8n.360xpand.com/webhook/rd-responsaveis";
const URL_MOTIVOS = "https://n8n.360xpand.com/webhook/rd-motivos-perda";
const URL_CONTATOS = "https://n8n.360xpand.com/webhook/rd-buscar-contatos";
const URL_DISPARADOR = "/disparador.html";

const swalBase = Swal.mixin({
  background: '#ffffff',
  color: '#0f172a',
  confirmButtonColor: getComputedStyle(document.documentElement).getPropertyValue('--brand')?.trim() || '#22c55e',
  cancelButtonColor: '#64748b',
  showClass: { popup: 'swal2-noanimation' },
  hideClass: { popup: '' }
});
const swalError = (title, text = '') => swalBase.fire({ icon: 'error', title, text });
const swalWarn = (title, text = '') => swalBase.fire({ icon: 'warning', title, text });
const swalInfo = (title, text = '') => swalBase.fire({ icon: 'info', title, text });

let contatosFiltrados = [];
let termoBusca = '';
let selectedIds = new Set();
let leadsById = new Map();
let paginaAtual = 1;

let etapasDisponiveis = [];
let selectedEtapas = [];
let responsaveisDisponiveis = [];
let selectedResponsaveis = [];
let motivosDisponiveis = [];
let selectedMotivos = [];

function toggleLoading(isLoading) {
  const btn = document.getElementById('filtrarContatos');
  const txt = btn?.querySelector('.btn-text');
  const spinner = document.getElementById('loadingBtn');
  if (!btn || !txt || !spinner) return;
  btn.disabled = isLoading;
  spinner.classList.toggle('d-none', !isLoading);
  txt.textContent = isLoading ? 'Buscando...' : 'Buscar leads';
}

function atualizarBotaoProximaEtapa() {
  const btn = document.getElementById('irParaDisparador');
  if (btn) btn.disabled = selectedIds.size < 2;
}

function phoneFmt(value) {
  return value || '—';
}

function closeAllMenus(exceptId = null) {
  document.querySelectorAll('.multi-select__menu').forEach(menu => {
    if (menu.id !== exceptId) menu.classList.remove('active');
  });
}

function toggleMenu(menuId) {
  const menu = document.getElementById(menuId);
  if (!menu) return;
  const wrapper = menu.closest('.multi-select');
  if (wrapper?.classList.contains('disabled')) return;
  const isActive = menu.classList.contains('active');
  closeAllMenus(menuId);
  if (!isActive) menu.classList.add('active');
  else menu.classList.remove('active');
}

document.addEventListener('click', (event) => {
  const inside = event.target.closest('.multi-select');
  if (!inside) closeAllMenus();
});

function makeMenu({ menuId, items, allId, classItem, onChange, countId, hiddenSelectId, selectWrapperId }) {
  const menu = document.getElementById(menuId);
  const hidden = document.getElementById(hiddenSelectId);
  const countSpan = document.getElementById(countId);
  const wrapper = document.getElementById(selectWrapperId);
  const selectEl = wrapper ? wrapper.querySelector('select') : null;

  if (!menu || !hidden) return;

  menu.innerHTML = '';
  hidden.innerHTML = '';
  menu.classList.remove('active');
  menu.onchange = null;

  if (!items.length) {
    menu.innerHTML = '<div class="empty-state" style="padding: 16px; font-size: 13px;">Sem opções disponíveis</div>';
    if (wrapper) wrapper.classList.add('disabled');
    if (selectEl) selectEl.disabled = true;
    if (countSpan) {
      countSpan.textContent = '';
      countSpan.classList.remove('success');
    }
    return;
  }

  if (wrapper) wrapper.classList.remove('disabled');
  if (selectEl) selectEl.disabled = false;

  const selectAll = document.createElement('div');
  selectAll.className = 'form-check';
  selectAll.innerHTML = `
    <input class="form-check-input" type="checkbox" id="${allId}">
    <label class="form-check-label" for="${allId}"><strong>Selecionar todos</strong></label>`;
  menu.appendChild(selectAll);

  items.forEach(item => {
    const id = `${classItem}_${item.id}`;
    const wrapperOption = document.createElement('div');
    wrapperOption.className = 'form-check';
    wrapperOption.innerHTML = `
      <input class="form-check-input ${classItem}-checkbox" type="checkbox" value="${item.id}" id="${id}">
      <label class="form-check-label" for="${id}">${item.name}</label>`;
    menu.appendChild(wrapperOption);

    const option = document.createElement('option');
    option.value = item.id;
    hidden.appendChild(option);
  });

  menu.onchange = (event) => {
    if (event.target.id === allId) {
      const mark = event.target.checked;
      menu.querySelectorAll(`.${classItem}-checkbox`).forEach(cb => {
        cb.checked = mark;
      });
      onChange(getCheckedIds(menu, `.${classItem}-checkbox`), true);
      updateHiddenFromMenu(menu, hidden, `.${classItem}-checkbox`);
      updateCount(countSpan, menu, `.${classItem}-checkbox`);
      return;
    }

    if (event.target.classList.contains(`${classItem}-checkbox`)) {
      onChange(getCheckedIds(menu, `.${classItem}-checkbox`), false);
      updateHiddenFromMenu(menu, hidden, `.${classItem}-checkbox`);
      updateAllMaster(menu, allId, `.${classItem}-checkbox`);
      updateCount(countSpan, menu, `.${classItem}-checkbox`);
    }
  };

  updateCount(countSpan, menu, `.${classItem}-checkbox`);
}

function getCheckedIds(menu, selector) {
  return Array.from(menu.querySelectorAll(`${selector}:checked`)).map(cb => cb.value);
}

function updateHiddenFromMenu(menu, hidden, selector) {
  const checked = getCheckedIds(menu, selector);
  hidden.querySelectorAll('option').forEach(opt => {
    opt.selected = checked.includes(opt.value);
  });
}

function updateAllMaster(menu, allId, selector) {
  const all = menu.querySelectorAll(selector);
  const master = document.getElementById(allId);
  if (!master) return;
  const allChecked = all.length > 0 && Array.from(all).every(cb => cb.checked);
  master.checked = allChecked;
}

function updateCount(span, menu, selector) {
  if (!span) return;
  const count = menu.querySelectorAll(`${selector}:checked`).length;
  span.textContent = count ? `${count} selecionado${count > 1 ? 's' : ''}` : '';
  span.classList.toggle('success', count > 0);
}

async function carregarFunis() {
  const funilSelect = document.getElementById('funil');
  try {
    const response = await fetch(`${URL_FUNIS}?token=${TOKEN}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const funis = data.funis || [];

    funilSelect.innerHTML = '<option value="">Selecione um funil</option>';
    funis.forEach(funil => {
      const option = document.createElement('option');
      option.value = funil.id;
      option.textContent = funil.name;
      option.dataset.stages = JSON.stringify(funil.deal_stages || []);
      funilSelect.appendChild(option);
    });

    funilSelect.addEventListener('change', () => {
      const selected = funilSelect.options[funilSelect.selectedIndex];
      const etapas = JSON.parse(selected?.dataset?.stages || '[]');
      etapasDisponiveis = etapas.map(etapa => ({ id: String(etapa.id), name: etapa.name }));
      selectedEtapas = [];
      makeMenu({
        menuId: 'etapasMenu',
        items: etapasDisponiveis,
        allId: 'etapas_all',
        classItem: 'etapas',
        onChange: (ids) => { selectedEtapas = ids; },
        countId: 'etapasCount',
        hiddenSelectId: 'etapaHidden',
        selectWrapperId: 'etapasSelectBox'
      });
    });
  } catch (error) {
    swalError('Falha ao carregar Funis', 'Tente novamente em alguns instantes. Detalhe: ' + error.message);
  }
}

async function carregarResponsaveis() {
  try {
    const response = await fetch(`${URL_RESPONSAVEIS}?token=${TOKEN}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const responsaveis = data.responsaveis || [];
    responsaveisDisponiveis = responsaveis.map(resp => ({ id: String(resp.id), name: resp.name }));
    selectedResponsaveis = [];
    makeMenu({
      menuId: 'respMenu',
      items: responsaveisDisponiveis,
      allId: 'resp_all',
      classItem: 'resp',
      onChange: (ids) => { selectedResponsaveis = ids; },
      countId: 'respCount',
      hiddenSelectId: 'respHidden',
      selectWrapperId: 'respSelectBox'
    });
  } catch (error) {
    swalError('Falha ao carregar Responsáveis', 'Tente novamente em alguns instantes. Detalhe: ' + error.message);
  }
}

async function carregarMotivosPerda() {
  try {
    const response = await fetch(`${URL_MOTIVOS}?token=${TOKEN}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const motivos = data.deal_lost_reasons || data || [];
    motivosDisponiveis = motivos.map(motivo => ({ id: String(motivo._id || motivo.id || ''), name: motivo.name || motivo.title || '' }));
    selectedMotivos = [];
    makeMenu({
      menuId: 'motivoMenu',
      items: motivosDisponiveis,
      allId: 'motivo_all',
      classItem: 'motivo',
      onChange: (ids) => { selectedMotivos = ids; },
      countId: 'motivoCount',
      hiddenSelectId: 'motivoHidden',
      selectWrapperId: 'motivoSelectBox'
    });
    setMotivoEnabled(false);
  } catch (error) {
    swalError('Falha ao carregar Motivos de Perda', 'Tente novamente em alguns instantes. Detalhe: ' + error.message);
  }
}

function setMotivoEnabled(enabled) {
  const wrapper = document.getElementById('motivoSelectBox');
  const select = document.getElementById('motivoSelect');
  const menu = document.getElementById('motivoMenu');
  const hidden = document.getElementById('motivoHidden');
  const badge = document.getElementById('motivoCount');
  if (!wrapper || !select || !menu || !hidden) return;

  if (enabled) {
    wrapper.classList.remove('disabled');
    select.disabled = false;
  } else {
    wrapper.classList.add('disabled');
    select.disabled = true;
    menu.classList.remove('active');
    selectedMotivos = [];
    menu.querySelectorAll('.motivo-checkbox')?.forEach?.(cb => (cb.checked = false));
    const master = document.getElementById('motivo_all');
    if (master) master.checked = false;
    hidden.querySelectorAll('option').forEach(option => (option.selected = false));
    if (badge) {
      badge.textContent = '';
      badge.classList.remove('success');
    }
  }
}

async function buscarContatos() {
  const statusVal = document.getElementById('status')?.value;
  const motivosParaEnviar = (statusVal === 'false') ? selectedMotivos : [];

  const payload = {
    funil: document.getElementById('funil')?.value,
    etapa: selectedEtapas,
    status: statusVal,
    dataInicio: document.getElementById('dataInicio')?.value,
    dataFim: document.getElementById('dataFim')?.value,
    responsavel: selectedResponsaveis,
    motivoPerda: motivosParaEnviar,
    token: TOKEN
  };

  const response = await fetch(URL_CONTATOS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const result = await response.json();
  return result.contatos || [];
}

function getResultadosFiltrados() {
  if (!termoBusca.trim()) return [...contatosFiltrados];
  const termo = termoBusca.trim().toLowerCase();
  return contatosFiltrados.filter(contato => {
    const comparaveis = [
      contato.titulo,
      contato.responsavel,
      contato.telefone,
      contato.motivo_perda
    ];
    return comparaveis.some(valor => (valor || '').toString().toLowerCase().includes(termo));
  });
}

function renderizarLeads() {
  const lista = document.getElementById('listaContatos');
  const paginacaoInfo = document.getElementById('paginacaoInfo');
  if (!lista || !paginacaoInfo) return;

  const porPagina = parseInt(document.getElementById('quantidadePorPagina')?.value || '50', 10);
  const todos = getResultadosFiltrados();
  const totalPaginas = todos.length ? Math.ceil(todos.length / porPagina) : 1;
  if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;
  if (!todos.length) paginaAtual = 1;

  const inicio = (paginaAtual - 1) * porPagina;
  const leadsPagina = todos.slice(inicio, inicio + porPagina);

  lista.innerHTML = '';

  if (!leadsPagina.length) {
    const vazio = document.createElement('div');
    vazio.className = 'empty-state';
    vazio.textContent = 'Nenhum lead encontrado com os filtros atuais.';
    lista.appendChild(vazio);
  } else {
    leadsPagina.forEach(contato => {
      const id = String(contato.id || '');
      const label = document.createElement('label');
      label.className = `lead-card${selectedIds.has(id) ? ' is-selected' : ''}`;
      label.setAttribute('role', 'listitem');
      label.innerHTML = `
        <input type="checkbox" class="checkboxLead" data-id="${id}" ${selectedIds.has(id) ? 'checked' : ''}>
        <div class="lead-card__body">
          <div class="lead-card__title">${contato.titulo || 'Sem título'}</div>
          <div class="lead-card__meta">
            <span title="Telefone">📞 ${phoneFmt(contato.telefone)}</span>
            <span title="Responsável">👤 ${contato.responsavel || 'Sem responsável'}</span>
          </div>
        </div>
        <span class="lead-card__badge" title="Motivo de perda">${contato.motivo_perda || 'Sem motivo'}</span>
      `;
      lista.appendChild(label);
    });
  }

  paginacaoInfo.textContent = todos.length ? `Página ${paginaAtual} de ${totalPaginas}` : 'Página 0 de 0';
  atualizarInformacoes();
}

function atualizarInformacoes() {
  const info = document.getElementById('infoTotalLeads');
  const badgeSelecionados = document.getElementById('contadorSelecionados');
  const btnSelecionarTudo = document.getElementById('btnSelecionarTudo');
  const btnLimpar = document.getElementById('btnLimparSelecao');

  const visiveis = getResultadosFiltrados();
  const totalVisiveis = visiveis.length;
  const selecionados = selectedIds.size;

  if (info) info.textContent = `${totalVisiveis} lead${totalVisiveis === 1 ? '' : 's'} disponíveis • ${selecionados} selecionado${selecionados === 1 ? '' : 's'}`;
  if (badgeSelecionados) badgeSelecionados.textContent = `${selecionados} selecionado${selecionados === 1 ? '' : 's'}`;
  if (btnLimpar) btnLimpar.disabled = selecionados === 0;

  if (btnSelecionarTudo) {
    btnSelecionarTudo.disabled = totalVisiveis === 0;
    const todosSelecionados = totalVisiveis > 0 && visiveis.every(contato => selectedIds.has(String(contato.id)));
    btnSelecionarTudo.textContent = todosSelecionados ? 'Limpar visíveis' : 'Selecionar tudo';
  }
}

function atualizarSelecao() {
  const textarea = document.getElementById('contatos');
  if (!textarea) return;

  const linhas = [];
  selectedIds.forEach(id => {
    const lead = leadsById.get(String(id));
    if (lead) {
      linhas.push(`${lead.id};${lead.nome || lead.titulo || ''};${phoneFmt(lead.telefone)};${lead.responsavel || ''};${lead.motivo_perda || ''}`);
    }
  });

  textarea.value = linhas.join('\n');
  atualizarBotaoProximaEtapa();
  atualizarInformacoes();
}

async function exibirContatos() {
  if (!document.getElementById('funil')?.value) {
    swalWarn('Selecione um funil', 'Escolha um funil antes de buscar os leads.');
    return;
  }

  try {
    toggleLoading(true);
    contatosFiltrados = await buscarContatos();
    leadsById.clear();
    contatosFiltrados.forEach(contato => leadsById.set(String(contato.id), contato));
    selectedIds.clear();
    termoBusca = '';
    const campoBusca = document.getElementById('buscaLeads');
    if (campoBusca) campoBusca.value = '';
    paginaAtual = 1;
    renderizarLeads();
    atualizarSelecao();

    if (!contatosFiltrados.length) {
      swalInfo('Nenhum lead encontrado', 'Ajuste os filtros (etapas, período, responsável, status) e tente novamente.');
    }
  } catch (error) {
    swalError('Erro ao buscar contatos', 'Por favor, tente novamente. Detalhe: ' + error.message);
  } finally {
    toggleLoading(false);
  }
}

function irParaDisparador() {
  const selecionados = Array.from(selectedIds)
    .map(id => leadsById.get(String(id)))
    .filter(Boolean);
  try {
    sessionStorage.setItem('contatosSelecionados', JSON.stringify(selecionados));
  } catch (error) {
    console.error('Falha ao salvar contatos na sessionStorage', error);
  }
  if (URL_DISPARADOR) window.location.href = URL_DISPARADOR;
}

function inicializarEventos() {
  document.getElementById('quantidadePorPagina')?.addEventListener('change', () => {
    paginaAtual = 1;
    renderizarLeads();
  });

  document.getElementById('btnAnterior')?.addEventListener('click', () => {
    if (paginaAtual > 1) {
      paginaAtual--;
      renderizarLeads();
    }
  });

  document.getElementById('btnProximo')?.addEventListener('click', () => {
    const porPagina = parseInt(document.getElementById('quantidadePorPagina')?.value || '50', 10);
    const totalPaginas = Math.ceil(getResultadosFiltrados().length / porPagina) || 1;
    if (paginaAtual < totalPaginas) {
      paginaAtual++;
      renderizarLeads();
    }
  });

  document.getElementById('status')?.addEventListener('change', (event) => {
    const statusVal = event.target.value;
    setMotivoEnabled(statusVal === 'false');
  });

  document.getElementById('filtrarContatos')?.addEventListener('click', exibirContatos);
  document.getElementById('irParaDisparador')?.addEventListener('click', irParaDisparador);

  document.getElementById('listaContatos')?.addEventListener('change', (event) => {
    if (!event.target.classList.contains('checkboxLead')) return;
    const id = String(event.target.dataset.id);
    if (event.target.checked) selectedIds.add(id);
    else selectedIds.delete(id);
    const card = event.target.closest('.lead-card');
    if (card) card.classList.toggle('is-selected', event.target.checked);
    atualizarSelecao();
  });

  document.getElementById('buscaLeads')?.addEventListener('input', (event) => {
    termoBusca = event.target.value || '';
    paginaAtual = 1;
    renderizarLeads();
  });

  document.getElementById('btnSelecionarTudo')?.addEventListener('click', () => {
    const visiveis = getResultadosFiltrados();
    const todosSelecionados = visiveis.length > 0 && visiveis.every(contato => selectedIds.has(String(contato.id)));
    if (todosSelecionados) visiveis.forEach(contato => selectedIds.delete(String(contato.id)));
    else visiveis.forEach(contato => selectedIds.add(String(contato.id)));
    atualizarSelecao();
    renderizarLeads();
  });

  document.getElementById('btnLimparSelecao')?.addEventListener('click', () => {
    if (!selectedIds.size) return;
    selectedIds.clear();
    atualizarSelecao();
    renderizarLeads();
  });
}

window.addEventListener('load', () => {
  carregarFunis();
  carregarResponsaveis();
  carregarMotivosPerda();
  inicializarEventos();
  renderizarLeads();
  atualizarSelecao();
});
