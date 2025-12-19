// public/client.js

const SUITS = ['s', 'h', 'd', 'c'];
const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const SUIT_SYMBOLS = {'s': '♠', 'h': '♥', 'd': '♦', 'c': '♣'};

let state = {
    myHand: [null, null],
    board: [null, null, null, null, null],
    opponents: [],
    nextOppId: 1,
    activeSelection: null
};

// 初始化
function init() {
    createSlots('board-container', 5, 'board');
    createSlots('my-hand-container', 2, 'my');
    renderPickerGrid();
    addOpponent();
}

// --- 核心网络请求 ---
async function requestCalculation() {
    const simCount = parseInt(document.getElementById('sim-input').value) || 20000;
    
    // 基础校验
    if(!state.myHand[0] || !state.myHand[1]) return;

    // UI Loading 状态
    document.getElementById('loading-indicator').style.display = 'inline';
    document.body.style.cursor = 'wait';

    try {
        const payload = {
            myHand: state.myHand,
            board: state.board,
            opponents: state.opponents.map(o => ({ id: o.id, cards: o.cards })),
            simCount: simCount
        };

        const response = await fetch('/api/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const resData = await response.json();

        if (resData.success) {
            updateUI(resData.data);
        } else {
            console.error(resData.error);
        }

    } catch (err) {
        console.error("请求失败", err);
        alert("服务器繁忙或网络错误");
    } finally {
        document.getElementById('loading-indicator').style.display = 'none';
        document.body.style.cursor = 'default';
    }
}

function updateUI(data) {
    const total = data.simulations;
    const p = (n) => ((n/total)*100).toFixed(1) + '%';

    // 更新自己
    const myWinEl = document.getElementById('my-win');
    myWinEl.innerText = p(data.my.win);
    myWinEl.style.color = (data.my.win/total > 0.5) ? '#2ecc71' : '#f1c40f';
    document.getElementById('my-tie').innerText = data.my.tie > 0 ? `平: ${p(data.my.tie)}` : '';

    // 更新对手
    for (let oppId in data.opponents) {
        const stats = data.opponents[oppId];
        const winEl = document.getElementById(`win-opp-${oppId}`);
        const tieEl = document.getElementById(`tie-opp-${oppId}`);
        if(winEl) {
            winEl.innerText = p(stats.win);
            let rate = stats.win / total;
            winEl.style.color = rate > 0.5 ? '#e74c3c' : (rate < 0.2 ? '#bdc3c7' : '#fff');
            tieEl.innerText = stats.tie > 0 ? `平: ${p(stats.tie)}` : '';
        }
    }
}

// --- 以下是界面逻辑 (与之前类似，但移除了本地计算) ---

function createSlots(id, count, type, oppId=null) {
    const el = document.getElementById(id);
    el.innerHTML = '';
    for(let i=0; i<count; i++) {
        let div = document.createElement('div');
        div.className = 'card-slot';
        div.innerHTML = '+';
        div.onclick = () => openPicker(type, i, oppId);
        div.id = `slot-${type}-${oppId?oppId+'-':''}${i}`;
        el.appendChild(div);
    }
}

function renderPickerGrid() {
    const grid = document.getElementById('picker-grid');
    grid.innerHTML = '';
    SUITS.forEach(suit => {
        RANKS.forEach(rank => {
            const div = document.createElement('div');
            div.className = 'picker-card';
            div.innerHTML = rank + (suit === 'h' || suit === 'd' ? `<span style="color:red">${SUIT_SYMBOLS[suit]}</span>` : `<span>${SUIT_SYMBOLS[suit]}</span>`);
            div.onclick = () => selectCard(rank, suit);
            div.dataset.code = rank + suit;
            grid.appendChild(div);
        });
    });
}

function addOpponent() {
    if(state.opponents.length >= 8) return alert('最多8个对手');
    const opp = { id: state.nextOppId++, cards: [null, null] };
    state.opponents.push(opp);
    
    const container = document.getElementById('opponents-list');
    const div = document.createElement('div');
    div.className = 'opp-item';
    div.id = `opp-row-${opp.id}`;
    div.innerHTML = `
        <div class="opp-info">
            <div class="btn-del" onclick="removeOpponent(${opp.id})">×</div>
            <div class="opp-label">对手${opp.id}</div>
            <div class="card-row" id="opp-slots-${opp.id}"></div>
        </div>
        <div style="text-align:right;">
            <div class="win-percent" id="win-opp-${opp.id}" style="font-size:18px;">--%</div>
            <div class="tie-percent" id="tie-opp-${opp.id}"></div>
        </div>
    `;
    container.appendChild(div);
    createSlots(`opp-slots-${opp.id}`, 2, 'opp', opp.id);
    // 每次变动不再自动计算，需要节省服务器资源，或你可以取消下面注释开启自动请求
    // requestCalculation(); 
}

function removeOpponent(id) {
    if(state.opponents.length <= 1) return;
    state.opponents = state.opponents.filter(o => o.id !== id);
    document.getElementById(`opp-row-${id}`).remove();
    requestCalculation();
}

function openPicker(type, index, oppId) {
    state.activeSelection = { type, index, oppId };
    updatePickerState();
    document.getElementById('picker-modal').style.display = 'flex';
}

function closePicker() {
    document.getElementById('picker-modal').style.display = 'none';
}

function updatePickerState() {
    const used = new Set();
    const add = c => { if(c) used.add(c.rank+c.suit); };
    state.myHand.forEach(add);
    state.board.forEach(add);
    state.opponents.forEach(o => o.cards.forEach(add));
    
    // 获取当前选中的牌（如果有）
    let current = null;
    const { type, index, oppId } = state.activeSelection;
    if(type === 'my') current = state.myHand[index];
    else if(type === 'board') current = state.board[index];
    else if(type === 'opp') current = state.opponents.find(o=>o.id===oppId).cards[index];
    const currentCode = current ? current.rank+current.suit : null;

    document.querySelectorAll('.picker-card').forEach(el => {
        const code = el.dataset.code;
        if(used.has(code) && code !== currentCode) el.classList.add('disabled');
        else el.classList.remove('disabled');
    });
}

function selectCard(rank, suit) {
    const card = { rank, suit };
    const { type, index, oppId } = state.activeSelection;
    if(type === 'my') state.myHand[index] = card;
    else if(type === 'board') state.board[index] = card;
    else if(type === 'opp') state.opponents.find(o=>o.id===oppId).cards[index] = card;
    
    updateSlotUI(type, index, oppId, card);
    closePicker();
    requestCalculation(); // 选完牌自动请求
}

function clearSlot() {
    const { type, index, oppId } = state.activeSelection;
    if(type === 'my') state.myHand[index] = null;
    else if(type === 'board') state.board[index] = null;
    else if(type === 'opp') state.opponents.find(o=>o.id===oppId).cards[index] = null;
    
    updateSlotUI(type, index, oppId, null);
    closePicker();
    requestCalculation();
}

function updateSlotUI(type, index, oppId, card) {
    const id = `slot-${type}-${oppId ? oppId+'-' : ''}${index}`;
    const el = document.getElementById(id);
    if(card) {
        const isRed = (card.suit === 'h' || card.suit === 'd');
        el.innerHTML = `${card.rank}<span style="font-size:70%; margin-left:2px">${SUIT_SYMBOLS[card.suit]}</span>`;
        el.className = `card-slot filled ${isRed?'red':'black'}`;
    } else {
        el.innerHTML = '+';
        el.className = 'card-slot';
    }
}

function resetAll() {
    state.myHand = [null, null];
    state.board = [null, null, null, null, null];
    state.opponents.forEach(o => { o.cards = [null, null]; });
    
    // 简单刷新页面即可，或者手动清空DOM
    location.reload();
}

init();