// core/logic.js

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = {'2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9, 'T':10, 'J':11, 'Q':12, 'K':13, 'A':14};
const SUITS = ['s', 'h', 'd', 'c'];

function evaluate7(cards) {
    // 将前端传来的牌数据标准化 (确保有 val 属性)
    const processedCards = cards.map(c => ({
        ...c,
        val: RANK_VALUES[c.rank] || c.val
    }));

    let suitCounts = {s:0, h:0, d:0, c:0};
    let ranks = [];
    for(let c of processedCards) {
        suitCounts[c.suit]++;
        ranks.push(c.val);
    }
    ranks.sort((a,b)=>b-a);

    let flushSuit = null;
    if(suitCounts.s >=5) flushSuit = 's';
    else if(suitCounts.h >=5) flushSuit = 'h';
    else if(suitCounts.d >=5) flushSuit = 'd';
    else if(suitCounts.c >=5) flushSuit = 'c';

    const getStraight = (vals) => {
        let v = [...new Set(vals)];
        if(v.length < 5) return 0;
        if(v.includes(14) && v.includes(2) && v.includes(3) && v.includes(4) && v.includes(5)) {
            let norm = 0;
            for(let i=0; i<=v.length-5; i++) if(v[i]-v[i+4]===4) { norm = v[i]; break; }
            return norm || 5; 
        }
        for(let i=0; i<=v.length-5; i++) if(v[i]-v[i+4]===4) return v[i];
        return 0;
    };

    if(flushSuit) {
        let fRanks = processedCards.filter(c=>c.suit===flushSuit).map(c=>c.val).sort((a,b)=>b-a);
        let sf = getStraight(fRanks);
        if(sf) return 8000000 + sf;
        return 5000000 + fRanks[0]*10000 + fRanks[1]*1000 + fRanks[2]*100 + fRanks[3]*10 + fRanks[4];
    }

    let counts = {};
    for(let r of ranks) counts[r] = (counts[r]||0)+1;
    
    let four=[], three=[], pair=[];
    let uniqueRanks = Object.keys(counts).map(Number).sort((a,b)=>b-a);
    for(let r of uniqueRanks) {
        let n = counts[r];
        if(n===4) four.push(r);
        else if(n===3) three.push(r);
        else if(n===2) pair.push(r);
    }

    if(four.length) {
        let k = ranks.find(r => r!==four[0]);
        return 7000000 + four[0]*100 + k;
    }
    if(three.length >= 2) return 6000000 + three[0]*100 + three[1];
    if(three.length && pair.length) return 6000000 + three[0]*100 + pair[0];

    let st = getStraight(ranks);
    if(st) return 4000000 + st;

    if(three.length) {
        let k = ranks.filter(r => r!==three[0]).slice(0,2);
        return 3000000 + three[0]*10000 + k[0]*100 + k[1];
    }

    if(pair.length >= 2) {
        let k = ranks.find(r => r!==pair[0] && r!==pair[1]);
        return 2000000 + pair[0]*10000 + pair[1]*100 + k;
    }

    if(pair.length) {
        let k = ranks.filter(r => r!==pair[0]).slice(0,3);
        return 1000000 + pair[0]*100000 + k[0]*1000 + k[1]*10 + k[2];
    }

    return ranks[0]*10000 + ranks[1]*1000 + ranks[2]*100 + ranks[3]*10 + ranks[4];
}

function runSimulation(data) {
    const { myHand, board, opponents, simCount } = data;
    const SIMULATIONS = Math.min(simCount || 20000, 200000); // 服务器端限制最大次数防止卡死

    let myStats = { win: 0, tie: 0 };
    let oppStats = {}; // { oppId: { win: 0, tie: 0 } }
    opponents.forEach(o => oppStats[o.id] = { win: 0, tie: 0 });

    // 1. 构建已用牌和牌堆
    let used = new Set();
    const addUsed = c => { if(c) used.add(c.rank+c.suit); };
    myHand.forEach(addUsed);
    board.forEach(addUsed);
    opponents.forEach(o => o.cards.forEach(addUsed));

    let deckTemplate = [];
    SUITS.forEach(s => {
        RANKS.forEach(r => {
            if(!used.has(r+s)) deckTemplate.push({ rank:r, suit:s, val:RANK_VALUES[r] });
        });
    });

    // 2. 模拟循环
    for(let i=0; i<SIMULATIONS; i++) {
        let deck = [...deckTemplate];
        let deckIdx = deck.length;
        
        // Fisher-Yates shuffle helper
        const draw = () => {
            let idx = Math.floor(Math.random() * deckIdx);
            deckIdx--;
            let temp = deck[idx];
            deck[idx] = deck[deckIdx];
            deck[deckIdx] = temp;
            return temp;
        };

        let simBoard = [...board];
        for(let k=0; k<5; k++) if(!simBoard[k]) simBoard[k] = draw();

        let simOppHands = [];
        opponents.forEach(o => {
            let h = [...o.cards];
            if(!h[0]) h[0] = draw();
            if(!h[1]) h[1] = draw();
            simOppHands.push({ id: o.id, hand: h });
        });

        let myScore = evaluate7([...myHand, ...simBoard]);
        let maxScore = myScore;
        let winners = ['my'];

        simOppHands.forEach(opp => {
            let s = evaluate7([...opp.hand, ...simBoard]);
            if(s > maxScore) {
                maxScore = s;
                winners = [opp.id];
            } else if (s === maxScore) {
                winners.push(opp.id);
            }
        });

        if(winners.length === 1) {
            if(winners[0] === 'my') myStats.win++;
            else oppStats[winners[0]].win++;
        } else {
            if(winners.includes('my')) myStats.tie++;
            winners.forEach(id => {
                if(id !== 'my') oppStats[id].tie++;
            });
        }
    }

    return {
        simulations: SIMULATIONS,
        my: myStats,
        opponents: oppStats
    };
}

module.exports = { runSimulation };