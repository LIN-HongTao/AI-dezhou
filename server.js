// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const { runSimulation } = require('./core/logic');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API 路由: 接收前端数据，返回计算结果
app.post('/api/calculate', (req, res) => {
    try {
        const { myHand, board, opponents, simCount } = req.body;
        
        // 简单验证
        if (!myHand || myHand.length !== 2 || !myHand[0] || !myHand[1]) {
            return res.status(400).json({ error: "请先设置好您的两张手牌" });
        }

        const startTime = Date.now();
        const result = runSimulation({ myHand, board, opponents, simCount });
        const endTime = Date.now();

        res.json({
            success: true,
            timeMs: endTime - startTime,
            data: result
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "服务器计算出错" });
    }
});

// 任何其他请求返回 index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});