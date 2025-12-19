// public/client.js

const SUITS = ['s', 'h', 'd', 'c'];
const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const SUIT_SYMBOLS = {'s': '♠', 'h': '♥', 'd': '♦', 'c': '♣'};

let state = {
    myHand: [null, null],
    board: [null, null, null, null, null],
    opponents: [],
    nextOppId: 1,
    activeSelection: null,
    worker: null // 存储 Worker 实例
};

function init() {
    createSlots('board-container', 5, 'board');
    createSlots('my-hand-container', 2, 'my');
    renderPickerGrid();
    addOpponent();
    
    // 监听模拟次数变化
    document.getElementById('sim-input').onchange = () => startSimulation();
}

// --- 核心：Web Worker 管理 ---
function startSimulation() {
    // 1. 基础校验：必须有手牌
    if(!state.myHand[0] || !state.myHand[1]) {
        updateUI(null); // 清空数据
        return;
    }

    // 2. 终止旧的 Worker (如果正在跑)
    if (state.worker) {
        state.worker.terminate();
    }

    // 3. 创建新 Worker
    state.worker = new Worker('./worker.js');

    // 4. 显示加载状态
    document.getElementById('loading-indicator').style.display = 'inline';
    document.getElementById('loading-indicator').innerText = '计算中 0%';

    // 5. 发送数据给 Worker
    const simCount = parseInt(document.getElementById('sim-input').value) || 100000;
    state.worker.postMessage({
        myHand: state.myHand,
        board: state.board,
        opponents: state.opponents.map(o => ({ id: o.id, cards: o.cards })),
        simCount: simCount
    });

    // 6. 接收 Worker 反馈
    state.worker.onmessage = function(e) {
        const { type, completed, total, result } = e.data;

        if (type === 'progress') {
            // 更新进度条和实时胜率
            const pct = Math.round((completed / total) * 100);
            document.getElementById('loading-indicator').innerText = `计算中 ${pct}%`;
            
            // 实时更新UI数据
            updateUI(result);
        } 
        else if (type === 'done') {
            document.getElementById('loading-indicator').style.display = 'none';
        }
    };
}

function updateUI(data) {
    if(!data) {
        document.getElementById('my-win').innerText = '--%';
        document.getElementById('my-tie').innerText = '';
        state.opponents.forEach(o => {
            const el = document.getElementById(`win-opp-${o.id}`);
            if(el) el.innerText = '--%';
        });
        return;
    }

    const total = data.simulations;
    const p = (n) => ((n/total)*100).toFixed(1) + '%';

    // 我方
    const myWinEl = document.getElementById('my-win');
    myWinEl.innerText = p(data.my.win);
    myWinEl.style.color = (data.my.win/total > 0.5) ? '#2ecc71' : '#f1c40f';
    document.getElementById('my-tie').innerText = data.my.tie > 0 ? `平: ${p(data.my.tie)}` : '';

    // 对手
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

// --- 界面交互逻辑 ---

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

// 优化后的横向滚动选牌器
function renderPickerGrid() {
    const grid = document.getElementById('picker-grid');
    grid.innerHTML = '';
    
    SUITS.forEach(suit => {
        const row = document.createElement('div');
        row.className = 'suit-row';
        
        RANKS.forEach(rank => {
            const div = document.createElement('div');
            div.className = 'picker-card';
            const isRed = (suit === 'h' || suit === 'd');
            div.innerHTML = `${rank}<span style="color:${isRed ? '#e74c3c' : '#2c3e50'}">${SUIT_SYMBOLS[suit]}</span>`;
            div.onclick = () => selectCard(rank, suit);
            div.dataset.code = rank + suit;
            row.appendChild(div);
        });
        
        grid.appendChild(row);
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
    startSimulation(); // 添加对手后自动重算
}

function removeOpponent(id) {
    if(state.opponents.length <= 1) return;
    state.opponents = state.opponents.filter(o => o.id !== id);
    document.getElementById(`opp-row-${id}`).remove();
    startSimulation(); // 删除对手后自动重算
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
    
    // 当前正在选的这位置不禁用
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
    
    // 选完牌，立即触发 Worker 计算
    startSimulation();
}

function clearSlot() {
    const { type, index, oppId } = state.activeSelection;
    if(type === 'my') state.myHand[index] = null;
    else if(type === 'board') state.board[index] = null;
    else if(type === 'opp') state.opponents.find(o=>o.id===oppId).cards[index] = null;
    
    updateSlotUI(type, index, oppId, null);
    closePicker();
    startSimulation();
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
    location.reload();
}

init();