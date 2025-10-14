// today-game.js - 효율적인 도시 경영 (Efficient City Management)

// --- Utility Functions ---
function getDailySeed() {
    const today = new Date();
    return today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
}

function mulberry32(seed) {
    return function() {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) | 0;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function getEulReParticle(word) {
    if (!word || word.length === 0) return "";
    const lastChar = word[word.length - 1];
    const uni = lastChar.charCodeAt(0);
    if (uni < 0xAC00 || uni > 0xD7A3) return "를";
    return (uni - 0xAC00) % 28 > 0 ? "을" : "를";
}

function getWaGwaParticle(word) {
    if (!word || word.length === 0) return "";
    const lastChar = word[word.length - 1];
    const uni = lastChar.charCodeAt(0);
    if (uni < 0xAC00 || uni > 0xD7A3) return "와";
    return (uni - 0xAC00) % 28 > 0 ? "과" : "와";
}

// --- Game State Management ---
let gameState = {};
let currentRandFn = null;

function resetGameState() {
    gameState = {
        day: 1,
        efficiency: 50,
        order: 50,
        productivity: 50,
        actionPoints: 10,
        maxActionPoints: 10,
        resources: { budget: 100, materials: 50, labor: 50, admin_power: 0 },
        citizens: [
            { id: "manager_kim", name: "김 과장", personality: "성실한", skill: "행정", compliance: 80 },
            { id: "engineer_lee", name: "이 주임", personality: "현실적인", skill: "건설", compliance: 70 }
        ],
        maxCitizens: 5,
        currentScenarioId: "intro",
        lastPlayedDate: new Date().toISOString().slice(0, 10),
        manualDayAdvances: 0,
        dailyEventTriggered: false,
        dailyBonus: { projectSuccess: 0 },
        dailyActions: { inspected: false, reportReceived: false, talkedTo: [], minigamePlayed: false },
        infrastructure: {
            warehouse: { built: false, durability: 100 },
            factory: { built: false, durability: 100 },
            cityHall: { built: false, durability: 100 },
            planningDept: { built: false, durability: 100 },
            researchLab: { built: false, durability: 100 }
        },
        cityLevel: 0,
        minigameState: {}
    };
    currentRandFn = mulberry32(getDailySeed() + gameState.day);
}

function saveGameState() {
    localStorage.setItem('estjCityGame', JSON.stringify(gameState));
}

function loadGameState() {
    const savedState = localStorage.getItem('estjCityGame');
    const today = new Date().toISOString().slice(0, 10);
    if (savedState) {
        let loaded = JSON.parse(savedState);
        if (!loaded.dailyBonus) loaded.dailyBonus = { projectSuccess: 0 };
        if (!loaded.citizens || loaded.citizens.length === 0) {
            loaded.citizens = [
                { id: "manager_kim", name: "김 과장", personality: "성실한", skill: "행정", compliance: 80 },
                { id: "engineer_lee", name: "이 주임", personality: "현실적인", skill: "건설", compliance: 70 }
            ];
        }
        Object.assign(gameState, loaded);

        currentRandFn = mulberry32(getDailySeed() + gameState.day);

        if (gameState.lastPlayedDate !== today) {
            gameState.day += 1;
            gameState.lastPlayedDate = today;
            gameState.manualDayAdvances = 0;
            gameState.dailyEventTriggered = false;
            processDailyEvents();
        }
    } else {
        resetGameState();
        processDailyEvents();
    }
    renderAll();
}

function updateState(changes, displayMessage = null) {
    Object.keys(changes).forEach(key => {
        if (typeof changes[key] === 'object' && changes[key] !== null && !Array.isArray(changes[key])) {
            gameState[key] = { ...gameState[key], ...changes[key] };
        } else {
            gameState[key] = changes[key];
        }
    });
    saveGameState();
    renderAll(displayMessage);
}

// --- UI Rendering ---
function updateGameDisplay(text) {
    const gameArea = document.getElementById('gameArea');
    if(gameArea && text) gameArea.innerHTML = `<p>${text.replace(/\n/g, '<br>')}</p>`;
}

function renderStats() {
    const statsDiv = document.getElementById('gameStats');
    if (!statsDiv) return;
    const citizenListHtml = gameState.citizens.map(c => `<li>${c.name} (${c.skill}) - 준수도: ${c.compliance}</li>`).join('');
    statsDiv.innerHTML = `
        <p><b>임기:</b> ${gameState.day}일차</p>
        <p><b>행정력:</b> ${gameState.actionPoints}/${gameState.maxActionPoints}</p>
        <p><b>효율:</b> ${gameState.efficiency} | <b>질서:</b> ${gameState.order} | <b>생산성:</b> ${gameState.productivity}</p>
        <p><b>자원:</b> 예산 ${gameState.resources.budget}, 자재 ${gameState.resources.materials}, 노동력 ${gameState.resources.labor}, 행정력 ${gameState.resources.admin_power || 0}</p>
        <p><b>도시 레벨:</b> ${gameState.cityLevel}</p>
        <p><b>핵심 인력 (${gameState.citizens.length}/${gameState.maxCitizens}):</b></p>
        <ul>${citizenListHtml}</ul>
    `;
    const manualDayCounter = document.getElementById('manualDayCounter');
    if(manualDayCounter) manualDayCounter.innerText = gameState.manualDayAdvances;
}

function renderChoices(choices) {
    const choicesDiv = document.getElementById('gameChoices');
    if (!choicesDiv) return;
    let dynamicChoices = [];

    if (gameState.currentScenarioId === 'intro') {
        dynamicChoices = gameScenarios.intro.choices;
    } else if (gameState.currentScenarioId === 'action_facility_management') {
        dynamicChoices = gameScenarios.action_facility_management.choices ? [...gameScenarios.action_facility_management.choices] : [];
        if (!gameState.infrastructure.warehouse.built) dynamicChoices.push({ text: "물류창고 건설 (예산 50, 자재 20)", action: "build_warehouse" });
        if (!gameState.infrastructure.factory.built) dynamicChoices.push({ text: "공장 건설 (자재 30, 노동력 30)", action: "build_factory" });
        if (!gameState.infrastructure.cityHall.built) dynamicChoices.push({ text: "시청 건설 (예산 100, 자재 50, 노동력 50)", action: "build_city_hall" });
        if (!gameState.infrastructure.planningDept.built) dynamicChoices.push({ text: "기획부 신설 (자재 80, 노동력 40)", action: "build_planning_dept" });
        if (gameState.infrastructure.factory.built && gameState.infrastructure.factory.durability > 0 && !gameState.infrastructure.researchLab.built) {
            dynamicChoices.push({ text: "연구소 설립 (자재 50, 노동력 100)", action: "build_research_lab" });
        }
        Object.keys(gameState.infrastructure).forEach(key => {
            const facility = gameState.infrastructure[key];
            if (facility.built && facility.durability < 100) {
                dynamicChoices.push({ text: `${key} 보수 (자재 10, 노동력 10)`, action: "maintain_facility", params: { facility: key } });
            }
        });
        dynamicChoices.push({ text: "취소", action: "return_to_intro" });
    } else {
        dynamicChoices = choices ? [...choices] : [];
    }

    choicesDiv.innerHTML = dynamicChoices.map(choice => `<button class="choice-btn" data-action="${choice.action}" data-params='${JSON.stringify(choice.params || {})}''">${choice.text}</button>`).join('');
    choicesDiv.querySelectorAll('.choice-btn').forEach(button => {
        button.addEventListener('click', () => {
            const action = button.dataset.action;
            if (gameActions[action]) {
                gameActions[action](JSON.parse(button.dataset.params || '{}'));
            }
        });
    });
}

function renderAll(customDisplayMessage = null) {
    const desc = document.getElementById('gameDescription');
    if (desc) desc.style.display = 'none';
    renderStats();
    
    if (!gameState.currentScenarioId.startsWith('minigame_')) {
        const scenario = gameScenarios[gameState.currentScenarioId] || gameScenarios.intro;
        updateGameDisplay(customDisplayMessage || scenario.text);
        renderChoices(scenario.choices);
    }
}

// --- Game Data ---
const gameScenarios = {
    "intro": { text: "오늘의 시정 업무는 무엇입니까?", choices: [
        { text: "현장 시찰", action: "inspect" },
        { text: "핵심 인력과 면담", action: "talk_to_citizens" },
        { text: "시정 보고회 개최", action: "hold_meeting" },
        { text: "자원 징수", action: "show_resource_collection_options" },
        { text: "도시 기반시설 관리", action: "show_facility_options" },
        { text: "오늘의 미니게임", action: "play_minigame" }
    ]},
    "daily_event_complaint": {
        text: "시민들 사이에서 행정 처리가 비효율적이라는 민원이 발생했습니다. 어떻게 해결하시겠습니까?",
        choices: [
            { text: "김 과장의 의견을 따른다.", action: "handle_complaint", params: { first: "manager_kim", second: "engineer_lee" } },
            { text: "이 주임의 의견을 따른다.", action: "handle_complaint", params: { first: "engineer_lee", second: "manager_kim" } },
            { text: "두 사람을 모아 프로세스를 재검토한다.", action: "mediate_complaint" },
            { text: "원칙대로 처리하라고 지시한다.", action: "ignore_event" }
        ]
    },
    "daily_event_audit": { text: "예산 감사가 예정되어 있습니다. 모든 장부를 투명하게 공개해야 합니다. (-10 노동력)", choices: [{ text: "확인", action: "return_to_intro" }] },
    "daily_event_shortage": { text: "건설 자재가 부족하여 프로젝트가 지연되고 있습니다. (-10 자재)", choices: [{ text: "확인", action: "return_to_intro" }] },
    "daily_event_investment": {
        text: "외부 투자자가 대규모 건설 프로젝트를 제안했습니다. [예산 50]을 투자하면 [행정력]을 얻을 수 있습니다.",
        choices: [
            { text: "투자를 유치한다", action: "accept_investment" },
            { text: "다음에 하겠다", action: "decline_investment" }
        ]
    },
    "daily_event_new_citizen": {
        choices: [
            { text: "능력을 보고 즉시 채용한다.", action: "welcome_new_unique_citizen" },
            { text: "기존 인력과의 효율성을 지켜본다.", action: "observe_citizen" },
            { text: "우리 시와는 맞지 않는 것 같다.", action: "reject_citizen" }
        ]
    },
    "game_over_efficiency": { text: "도시의 효율성이 최악입니다. 모든 시스템이 마비되었습니다.", choices: [], final: true },
    "game_over_order": { text: "도시의 질서가 무너졌습니다. 혼란 속에서 도시는 기능을 상실합니다.", choices: [], final: true },
    "game_over_productivity": { text: "생산성이 바닥을 쳤습니다. 도시는 더 이상 성장할 수 없습니다.", choices: [], final: true },
    "game_over_resources": { text: "도시의 자원이 고갈되어 더 이상 운영할 수 없습니다.", choices: [], final: true },
    "action_resource_collection": {
        text: "어떤 자원을 징수하시겠습니까?",
        choices: [
            { text: "세금 징수 (예산)", action: "perform_collect_budget" },
            { text: "자재 확보 (자재)", action: "perform_get_materials" },
            { text: "노동력 동원 (노동력)", "action": "perform_mobilize_labor" },
            { text: "취소", "action": "return_to_intro" }
        ]
    },
    "action_facility_management": {
        text: "어떤 기반시설을 관리하시겠습니까?",
        choices: []
    },
    "resource_collection_result": {
        text: "",
        choices: [{ text: "확인", action: "show_resource_collection_options" }]
    },
    "facility_management_result": {
        text: "",
        choices: [{ text: "확인", action: "show_facility_options" }]
    },
    "complaint_resolution_result": {
        text: "",
        choices: [{ text: "확인", action: "return_to_intro" }]
    }
};

function calculateMinigameReward(minigameName, score) {
    let rewards = { efficiency: 0, order: 0, productivity: 0, message: "" };

    switch (minigameName) {
        case "기억력 순서 맞추기":
            if (score >= 51) {
                rewards.efficiency = 15;
                rewards.order = 10;
                rewards.productivity = 5;
                rewards.message = "완벽한 기억력입니다! 보고서의 모든 내용을 기억하고 있습니다. (+15 효율, +10 질서, +5 생산성)";
            } else if (score >= 21) {
                rewards.efficiency = 10;
                rewards.order = 5;
                rewards.message = "훌륭한 기억력입니다. (+10 효율, +5 질서)";
            } else if (score >= 0) {
                rewards.efficiency = 5;
                rewards.message = "보고서의 핵심 내용을 기억했습니다. (+5 효율)";
            } else {
                rewards.message = "훈련을 완료했지만, 아쉽게도 보상은 없습니다.";
            }
            break;
        case "예산 분배 시뮬레이션":
            rewards.efficiency = 10;
            rewards.message = "효율적인 예산 분배입니다! (+10 효율)";
            break;
        case "업무 프로세스 개선":
            rewards.productivity = 10;
            rewards.message = "업무 프로세스가 개선되어 생산성이 향상되었습니다. (+10 생산성)";
            break;
        case "규정 준수 퀴즈":
            rewards.order = 10;
            rewards.message = "모든 규정을 완벽하게 숙지하고 있습니다! (+10 질서)";
            break;
        case "자원 최적화 퍼즐":
            rewards.efficiency = 5;
            rewards.productivity = 5;
            rewards.message = "자원을 최적화하여 효율과 생산성을 모두 높였습니다. (+5 효율, +5 생산성)";
            break;
        default:
            rewards.message = `미니게임 ${minigameName}을(를) 완료했습니다.`;
            break;
    }
    return rewards;
}

const minigames = [
    {
        name: "기억력 순서 맞추기",
        description: "화면에 나타나는 보고서의 핵심 내용 순서를 기억하고 정확하게 입력하세요. 단계가 올라갈수록 어려워집니다!",
        start: (gameArea, choicesDiv) => {
            gameState.minigameState = { currentSequence: [], playerInput: [], stage: 1, score: 0, showingSequence: false };
            minigames[0].render(gameArea, choicesDiv);
            minigames[0].showSequence();
        },
        render: (gameArea, choicesDiv) => {
            gameArea.innerHTML = `
                <p><b>단계:</b> ${gameState.minigameState.stage} | <b>점수:</b> ${gameState.minigameState.score}</p>
                <p id="sequenceDisplay" style="font-size: 2em; font-weight: bold; min-height: 1.5em;"></p>
                <p>순서를 기억하고 입력하세요:</p>
                <div id="playerInputDisplay" style="font-size: 1.5em; min-height: 1.5em;">${gameState.minigameState.playerInput.join(' ')}</div>
            `;
            choicesDiv.innerHTML = `
                <div class="number-pad">
                    ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => `<button class="choice-btn num-btn" data-value="${num}">${num}</button>`).join('')}
                    <button class="choice-btn num-btn" data-value="0">0</button>
                    <button class="choice-btn submit-btn" data-action="submitSequence">입력 완료</button>
                    <button class="choice-btn reset-btn" data-action="resetInput">초기화</button>
                </div>
            `;
            choicesDiv.querySelectorAll('.num-btn').forEach(button => {
                button.addEventListener('click', () => minigames[0].processAction('addInput', button.dataset.value));
            });
            choicesDiv.querySelector('.submit-btn').addEventListener('click', () => minigames[0].processAction('submitSequence'));
            choicesDiv.querySelector('.reset-btn').addEventListener('click', () => minigames[0].processAction('resetInput'));
        },
        showSequence: () => {
            gameState.minigameState.showingSequence = true;
            gameState.minigameState.currentSequence = [];
            const sequenceLength = gameState.minigameState.stage + 2;
            for (let i = 0; i < sequenceLength; i++) {
                gameState.minigameState.currentSequence.push(Math.floor(currentRandFn() * 10));
            }

            const sequenceDisplay = document.getElementById('sequenceDisplay');
            let i = 0;
            const interval = setInterval(() => {
                if (i < gameState.minigameState.currentSequence.length) {
                    sequenceDisplay.innerText = gameState.minigameState.currentSequence[i];
                    i++;
                } else {
                    clearInterval(interval);
                    sequenceDisplay.innerText = "입력하세요!";
                    gameState.minigameState.showingSequence = false;
                }
            }, 800);
        },
        processAction: (actionType, value = null) => {
            if (gameState.minigameState.showingSequence) return;

            if (actionType === 'addInput') {
                gameState.minigameState.playerInput.push(parseInt(value));
                document.getElementById('playerInputDisplay').innerText = gameState.minigameState.playerInput.join(' ');
            } else if (actionType === 'resetInput') {
                gameState.minigameState.playerInput = [];
                document.getElementById('playerInputDisplay').innerText = '';
            } else if (actionType === 'submitSequence') {
                const correct = gameState.minigameState.currentSequence.every((num, i) => num === gameState.minigameState.playerInput[i]);

                if (correct && gameState.minigameState.playerInput.length === gameState.minigameState.currentSequence.length) {
                    gameState.minigameState.score += gameState.minigameState.currentSequence.length * 10;
                    gameState.minigameState.stage++;
                    gameState.minigameState.playerInput = [];
                    updateGameDisplay("정답입니다! 다음 단계로 넘어갑니다.");
                    minigames[0].render(document.getElementById('gameArea'), document.getElementById('gameChoices'));
                    setTimeout(() => minigames[0].showSequence(), 1500);
                } else {
                    updateGameDisplay("오답입니다. 게임 종료.");
                    minigames[0].end();
                }
            }
        },
        end: () => {
            const rewards = calculateMinigameReward(minigames[0].name, gameState.minigameState.score);
            updateState({
                efficiency: gameState.efficiency + rewards.efficiency,
                order: gameState.order + rewards.order,
                productivity: gameState.productivity + rewards.productivity,
                currentScenarioId: 'intro'
            }, rewards.message);
            gameState.minigameState = {};
        }
    },
    { name: "예산 분배 시뮬레이션", description: "제한된 예산을 각 부서에 효율적으로 분배하여 최대의 효과를 내세요.", start: (ga, cd) => { ga.innerHTML = "<p>예산 분배 시뮬레이션 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[1].end()'>종료</button>"; gameState.minigameState = { score: 10 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[1].name, gameState.minigameState.score); updateState({ efficiency: gameState.efficiency + r.efficiency, order: gameState.order + r.order, productivity: gameState.productivity + r.productivity, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } },
    { name: "업무 프로세스 개선", description: "비효율적인 업무 프로세스를 찾아내 개선하여 생산성을 높이세요.", start: (ga, cd) => { ga.innerHTML = "<p>업무 프로세스 개선 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[2].end()'>종료</button>"; gameState.minigameState = { score: 15 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[2].name, gameState.minigameState.score); updateState({ efficiency: gameState.efficiency + r.efficiency, order: gameState.order + r.order, productivity: gameState.productivity + r.productivity, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } },
    { name: "규정 준수 퀴즈", description: "주어진 상황에서 지켜야 할 규정을 정확히 맞추세요.", start: (ga, cd) => { ga.innerHTML = "<p>규정 준수 퀴즈 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[3].end()'>종료</button>"; gameState.minigameState = { score: 20 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[3].name, gameState.minigameState.score); updateState({ efficiency: gameState.efficiency + r.efficiency, order: gameState.order + r.order, productivity: gameState.productivity + r.productivity, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } },
    { name: "자원 최적화 퍼즐", description: "최소한의 자원으로 최대의 생산성을 내는 방법을 찾아내세요.", start: (ga, cd) => { ga.innerHTML = "<p>자원 최적화 퍼즐 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[4].end()'>종료</button>"; gameState.minigameState = { score: 25 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[4].name, gameState.minigameState.score); updateState({ efficiency: gameState.efficiency + r.efficiency, order: gameState.order + r.order, productivity: gameState.productivity + r.productivity, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } }
];

// --- Game Actions ---
function spendActionPoint() {
    if (gameState.actionPoints <= 0) {
        updateGameDisplay("행정력이 부족합니다.");
        return false;
    }
    updateState({ actionPoints: gameState.actionPoints - 1 });
    return true;
}

const gameActions = {
    inspect: () => {
        if (!spendActionPoint()) return;
        if (gameState.dailyActions.inspected) { updateState({ dailyActions: { ...gameState.dailyActions, inspected: true } }, "오늘은 이미 모든 현장을 시찰했습니다."); return; }
        
        let changes = { dailyActions: { ...gameState.dailyActions, inspected: true } };
        let message = "도시의 기반시설을 시찰했습니다.";
        const rand = currentRandFn();
        if (rand < 0.3) { message += " 비효율적인 부분을 발견하여 개선했습니다. (+2 효율)"; changes.efficiency = gameState.efficiency + 2; }
        else if (rand < 0.6) { message += " 시민들의 불편 사항을 접수했습니다. (-2 질서)"; changes.order = gameState.order - 2; }
        else { message += " 특별한 문제는 발견되지 않았습니다."; }
        
        updateState(changes, message);
    },
    talk_to_citizens: () => {
        if (!spendActionPoint()) return;
        const citizen = gameState.citizens[Math.floor(currentRandFn() * gameState.citizens.length)];
        if (gameState.dailyActions.talkedTo.includes(citizen.id)) { updateState({ dailyActions: { ...gameState.dailyActions, talkedTo: [...gameState.dailyActions.talkedTo, citizen.id] } }, `${citizen.name}${getWaGwaParticle(citizen.name)} 이미 면담했습니다.`); return; }
        
        let changes = { dailyActions: { ...gameState.dailyActions, talkedTo: [...gameState.dailyActions.talkedTo, citizen.id] } };
        let message = `${citizen.name}${getWaGwaParticle(citizen.name)} 면담했습니다. `;
        if (citizen.compliance > 80) { message += `그는 당신의 리더십을 칭찬하며 도시 발전에 대한 아이디어를 제안했습니다. (+5 생산성)`; changes.productivity = gameState.productivity + 5; }
        else if (citizen.compliance < 40) { message += `그는 시정에 불만을 품고 있습니다. 더 많은 관리가 필요합니다. (-5 질서)`; changes.order = gameState.order - 5; }
        else { message += `그는 묵묵히 자신의 역할을 수행하고 있습니다. (+2 질서)`; changes.order = gameState.order + 2; }
        
        updateState(changes, message);
    },
    hold_meeting: () => {
        if (!spendActionPoint()) return;
        if (gameState.dailyActions.reportReceived) {
            const message = "오늘은 이미 시정 보고회를 개최했습니다. 잦은 보고는 행정력 낭비입니다. (-5 효율)";
            gameState.efficiency -= 5;
            updateState({ efficiency: gameState.efficiency }, message);
            return;
        }
        updateState({ dailyActions: { ...gameState.dailyActions, reportReceived: true } });
        const rand = currentRandFn();
        let message = "시정 보고회를 개최했습니다. ";
        if (rand < 0.5) { message += "각 부서의 보고를 통해 도시의 생산성이 향상되었습니다. (+10 생산성, +5 효율)"; updateState({ productivity: gameState.productivity + 10, efficiency: gameState.efficiency + 5 }); }
        else { message += "보고 과정에서 작은 실수가 발견되었지만, 즉시 시정되었습니다. (+5 효율)"; updateState({ efficiency: gameState.efficiency + 5 }); }
        updateGameDisplay(message);
    },
    manualNextDay: () => {
        if (gameState.manualDayAdvances >= 5) { updateGameDisplay("오늘은 더 이상 수동으로 날짜를 넘길 수 없습니다. 내일 다시 시도해주세요."); return; }
        updateState({
            manualDayAdvances: gameState.manualDayAdvances + 1,
            day: gameState.day + 1,
            lastPlayedDate: new Date().toISOString().slice(0, 10),
            dailyEventTriggered: false
        });
        processDailyEvents();
    },
    handle_complaint: (params) => {
        if (!spendActionPoint()) return;
        const { first, second } = params;
        let message = "";
        let reward = { efficiency: 0, order: 0, productivity: 0 };
        
        const updatedCitizens = gameState.citizens.map(c => {
            if (c.id === first) {
                c.compliance = Math.min(100, c.compliance + 10);
                message += `${c.name}의 의견을 수용했습니다. 그의 준수도가 상승합니다. `;
                reward.efficiency += 5;
            } else if (c.id === second) {
                c.compliance = Math.max(0, c.compliance - 5);
                message += `${second}의 불만이 쌓입니다. `;
            }
            return c;
        });
        
        updateState({ ...reward, citizens: updatedCitizens, currentScenarioId: 'complaint_resolution_result' }, message);
    },
    mediate_complaint: () => {
        if (!spendActionPoint()) return;
        const message = "당신의 중재로 비효율적인 프로세스가 개선되었습니다. 도시의 효율성이 향상됩니다! (+10 효율, +5 생산성)";
        updateState({ efficiency: gameState.efficiency + 10, productivity: gameState.productivity + 5, currentScenarioId: 'complaint_resolution_result' }, message);
    },
    ignore_event: () => {
        if (!spendActionPoint()) return;
        const message = "민원을 무시했습니다. 시민들의 불만이 커지고 도시의 질서가 무너집니다. (-10 질서, -5 효율)";
        const updatedCitizens = gameState.citizens.map(c => {
            c.compliance = Math.max(0, c.compliance - 5);
            return c;
        });
        updateState({ order: gameState.order - 10, efficiency: gameState.efficiency - 5, citizens: updatedCitizens, currentScenarioId: 'complaint_resolution_result' }, message);
    },
    show_resource_collection_options: () => updateState({ currentScenarioId: 'action_resource_collection' }),
    show_facility_options: () => updateState({ currentScenarioId: 'action_facility_management' }),
    perform_collect_budget: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.cityLevel * 0.1) + (gameState.dailyBonus.projectSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            message = "세금 징수에 성공했습니다! (+10 예산)";
            changes.resources = { ...gameState.resources, budget: gameState.resources.budget + 10 };
        } else {
            message = "세금 징수에 실패했습니다.";
        }
        updateState(changes, message);
    },
    perform_get_materials: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.cityLevel * 0.1) + (gameState.dailyBonus.projectSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            message = "자재 확보에 성공했습니다! (+5 자재)";
            changes.resources = { ...gameState.resources, materials: gameState.resources.materials + 5 };
        } else {
            message = "자재 확보에 실패했습니다.";
        }
        updateState(changes, message);
    },
    perform_mobilize_labor: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.cityLevel * 0.1) + (gameState.dailyBonus.projectSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            message = "노동력 동원에 성공했습니다! (+5 노동력)";
            changes.resources = { ...gameState.resources, labor: gameState.resources.labor + 5 };
        } else {
            message = "노동력 동원에 실패했습니다.";
        }
        updateState(changes, message);
    },
    build_warehouse: () => {
        if (!spendActionPoint()) return;
        const cost = { budget: 50, materials: 20 };
        let message = "";
        let changes = {};
        if (gameState.resources.materials >= cost.materials && gameState.resources.budget >= cost.budget) {
            gameState.infrastructure.warehouse.built = true;
            message = "물류창고를 건설했습니다!";
            changes.productivity = gameState.productivity + 10;
            changes.resources = { ...gameState.resources, materials: gameState.resources.materials - cost.materials, budget: gameState.resources.budget - cost.budget };
        } else {
            message = "자원이 부족하여 건설할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_factory: () => {
        if (!spendActionPoint()) return;
        const cost = { materials: 30, labor: 30 };
        let message = "";
        let changes = {};
        if (gameState.resources.materials >= cost.materials && gameState.resources.labor >= cost.labor) {
            gameState.infrastructure.factory.built = true;
            message = "공장을 건설했습니다!";
            changes.efficiency = gameState.efficiency + 10;
            changes.resources = { ...gameState.resources, materials: gameState.resources.materials - cost.materials, labor: gameState.resources.labor - cost.labor };
        } else {
            message = "자원이 부족하여 건설할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_city_hall: () => {
        if (!spendActionPoint()) return;
        const cost = { budget: 100, materials: 50, labor: 50 };
        let message = "";
        let changes = {};
        if (gameState.resources.materials >= cost.materials && gameState.resources.labor >= cost.labor && gameState.resources.budget >= cost.budget) {
            gameState.infrastructure.cityHall.built = true;
            message = "시청을 건설했습니다!";
            changes.productivity = gameState.productivity + 20;
            changes.efficiency = gameState.efficiency + 20;
            changes.resources = { ...gameState.resources, materials: gameState.resources.materials - cost.materials, labor: gameState.resources.labor - cost.labor, budget: gameState.resources.budget - cost.budget };
        } else {
            message = "자원이 부족하여 건설할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_planning_dept: () => {
        if (!spendActionPoint()) return;
        const cost = { materials: 80, labor: 40 };
        let message = "";
        let changes = {};
        if (gameState.resources.materials >= cost.materials && gameState.resources.labor >= cost.labor) {
            gameState.infrastructure.planningDept.built = true;
            message = "기획부를 신설했습니다!";
            changes.order = gameState.order + 15;
            changes.productivity = gameState.productivity + 10;
            changes.resources = { ...gameState.resources, materials: gameState.resources.materials - cost.materials, labor: gameState.resources.labor - cost.labor };
        } else {
            message = "자원이 부족하여 신설할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_research_lab: () => {
        if (!spendActionPoint()) return;
        const cost = { materials: 50, labor: 100 };
        let message = "";
        let changes = {};
        if (gameState.resources.materials >= cost.materials && gameState.resources.labor >= cost.labor) {
            gameState.infrastructure.researchLab.built = true;
            message = "연구소를 설립했습니다!";
            changes.resources = { ...gameState.resources, materials: gameState.resources.materials - cost.materials, labor: gameState.resources.labor - cost.labor };
        } else {
            message = "자원이 부족하여 설립할 수 없습니다.";
        }
        updateState(changes, message);
    },
    maintain_facility: (params) => {
        if (!spendActionPoint()) return;
        const facilityKey = params.facility;
        const cost = { materials: 10, labor: 10 };
        let message = "";
        let changes = {};
        if (gameState.resources.materials >= cost.materials && gameState.resources.labor >= cost.labor) {
            gameState.infrastructure[facilityKey].durability = 100;
            message = `${facilityKey} 시설의 보수를 완료했습니다. 내구도가 100으로 회복되었습니다.`;
            changes.resources = { ...gameState.resources, materials: gameState.resources.materials - cost.materials, labor: gameState.resources.labor - cost.labor };
        } else {
            message = "보수에 필요한 자원이 부족합니다.";
        }
        updateState(changes, message);
    },
    upgrade_city: () => {
        if (!spendActionPoint()) return;
        const cost = 20 * (gameState.cityLevel + 1);
        if (gameState.resources.materials >= cost && gameState.resources.labor >= cost) {
            gameState.cityLevel++;
            updateState({ resources: { ...gameState.resources, materials: gameState.resources.materials - cost, labor: gameState.resources.labor - cost }, cityLevel: gameState.cityLevel });
            updateGameDisplay(`도시를 업그레이드했습니다! 모든 프로젝트 성공률이 10% 증가합니다. (현재 레벨: ${gameState.cityLevel})`);
        } else { updateGameDisplay(`업그레이드에 필요한 자원이 부족합니다. (자재 ${cost}, 노동력 ${cost} 필요)`); }
        updateState({ currentScenarioId: 'intro' });
    },
    review_reports: () => {
        if (!spendActionPoint()) return;
        const rand = currentRandFn();
        if (rand < 0.3) { updateState({ resources: { ...gameState.resources, materials: gameState.resources.materials + 20, labor: gameState.resources.labor + 20 } }); updateGameDisplay("보고서 검토 중 누락된 자원을 발견했습니다! (+20 자재, +20 노동력)"); }
        else if (rand < 0.5) { updateState({ order: gameState.order + 10, productivity: gameState.productivity + 10 }); updateGameDisplay("과거 보고서에서 도시의 질서를 바로잡을 지혜를 발견했습니다. (+10 질서, +10 생산성)"); }
        else { updateGameDisplay("보고서를 검토했지만, 특별한 것은 발견하지 못했습니다."); }
        updateState({ currentScenarioId: 'intro' });
    },
    accept_investment: () => {
        if (!spendActionPoint()) return;
        if (gameState.resources.budget >= 50) {
            updateState({ resources: { ...gameState.resources, budget: gameState.resources.budget - 50, admin_power: (gameState.resources.admin_power || 0) + 10 } });
            updateGameDisplay("투자를 유치하여 행정력을 얻었습니다! 도시 발전에 큰 도움이 될 것입니다.");
        } else { updateGameDisplay("투자에 필요한 예산이 부족합니다."); }
        updateState({ currentScenarioId: 'intro' });
    },
    decline_investment: () => {
        if (!spendActionPoint()) return;
        updateGameDisplay("투자 제안을 거절했습니다. 다음 기회를 노려봐야겠습니다.");
        updateState({ currentScenarioId: 'intro' });
    },
    return_to_intro: () => updateState({ currentScenarioId: 'intro' }),
    play_minigame: () => {
        if (gameState.dailyActions.minigamePlayed) { updateGameDisplay("오늘의 미니게임은 이미 플레이했습니다."); return; }
        if (!spendActionPoint()) return;
        
        const minigameIndex = (gameState.day - 1) % minigames.length;
        const minigame = minigames[minigameIndex];
        
        gameState.currentScenarioId = `minigame_${minigame.name}`;
        
        updateState({ dailyActions: { ...gameState.dailyActions, minigamePlayed: true } }); 
        
        updateGameDisplay(minigame.description);
        minigame.start(document.getElementById('gameArea'), document.getElementById('gameChoices'));
    }
};

function applyStatEffects() {
    let message = "";
    if (gameState.efficiency >= 70) {
        gameState.dailyBonus.projectSuccess += 0.1;
        message += "높은 효율성 덕분에 프로젝트 성공률이 증가합니다. ";
    }
    if (gameState.efficiency < 30) {
        gameState.citizens.forEach(c => c.compliance = Math.max(0, c.compliance - 5));
        message += "낮은 효율성으로 인해 시민들의 준수도가 하락합니다. ";
    }

    if (gameState.order >= 70) {
        gameState.maxActionPoints += 1;
        gameState.actionPoints = gameState.maxActionPoints;
        message += "확립된 질서 덕분에 행정력이 증가합니다. ";
    }
    if (gameState.order < 30) {
        gameState.maxActionPoints = Math.max(5, gameState.maxActionPoints - 1);
        gameState.actionPoints = Math.min(gameState.actionPoints, gameState.maxActionPoints);
        message += "무너진 질서로 인해 행정력이 감소합니다. ";
    }

    if (gameState.productivity >= 70) {
        Object.keys(gameState.infrastructure).forEach(key => {
            if (gameState.infrastructure[key].built) gameState.infrastructure[key].durability = Math.min(100, gameState.infrastructure[key].durability + 1);
        });
        message += "높은 생산성 덕분에 기반시설 관리가 더 잘 이루어집니다. ";
    }
    if (gameState.productivity < 30) {
        Object.keys(gameState.infrastructure).forEach(key => {
            if (gameState.infrastructure[key].built) gameState.infrastructure[key].durability = Math.max(0, gameState.infrastructure[key].durability - 2);
        });
        message += "생산성이 약화되어 기반시설이 빠르게 노후화됩니다. ";
    }
    return message;
}

function generateRandomCitizen() {
    const names = ["박 사무관", "최 기술관", "정 행정관", "윤 연구원"];
    const personalities = ["원칙주의적인", "현실적인", "분석적인", "꼼꼼한"];
    const skills = ["행정", "건설", "생산", "연구"];
    const randomId = Math.random().toString(36).substring(2, 9);

    return {
        id: randomId,
        name: names[Math.floor(currentRandFn() * names.length)],
        personality: personalities[Math.floor(currentRandFn() * personalities.length)],
        skill: skills[Math.floor(currentRandFn() * skills.length)],
        compliance: 50
    };
}

// --- Daily/Initialization Logic ---
function processDailyEvents() {
    if (gameState.dailyEventTriggered) return;
    currentRandFn = mulberry32(getDailySeed() + gameState.day);

    updateState({
        actionPoints: 10,
        maxActionPoints: 10,
        dailyActions: { inspected: false, reportReceived: false, talkedTo: [], minigamePlayed: false },
        dailyEventTriggered: true,
        dailyBonus: { projectSuccess: 0 }
    });

    const statEffectMessage = applyStatEffects();

    let skillBonusMessage = "";
    let durabilityMessage = "";

    gameState.citizens.forEach(c => {
        if (c.skill === '행정') { gameState.resources.budget++; skillBonusMessage += `${c.name}의 능력 덕분에 예산을 추가로 확보했습니다. `; }
        else if (c.skill === '건설') { gameState.resources.materials++; skillBonusMessage += `${c.name}의 도움으로 자재를 추가로 확보했습니다. `; }
        else if (c.skill === '생산') { gameState.resources.labor++; skillBonusMessage += `${c.name} 덕분에 노동력이 +1 증가했습니다. `; }
    });

    Object.keys(gameState.infrastructure).forEach(key => {
        const facility = gameState.infrastructure[key];
        if(facility.built) {
            facility.durability -= 1;
            if(facility.durability <= 0) {
                facility.built = false;
                durabilityMessage += `${key} 시설이 파손되었습니다! 보수가 필요합니다. `;
            }
        }
    });

    gameState.resources.budget -= gameState.citizens.length * 2;
    let dailyMessage = "새로운 임기가 시작되었습니다. ";
    dailyMessage += statEffectMessage + skillBonusMessage + durabilityMessage;
    if (gameState.resources.budget < 0) {
        gameState.order -= 10;
        dailyMessage += "예산이 부족하여 도시 질서가 흔들립니다! (-10 질서)";
    }
    
    const rand = currentRandFn();
    let eventId = "intro";
    if (rand < 0.15) { eventId = "daily_event_audit"; updateState({resources: {...gameState.resources, labor: Math.max(0, gameState.resources.labor - 10)}}); }
    else if (rand < 0.30) { eventId = "daily_event_shortage"; updateState({resources: {...gameState.resources, materials: Math.max(0, gameState.resources.materials - 10)}}); }
    else if (rand < 0.5 && gameState.citizens.length >= 2) { eventId = "daily_event_complaint"; }
    else if (rand < 0.7 && gameState.infrastructure.cityHall.built && gameState.citizens.length < gameState.maxCitizens) {
        eventId = "daily_event_new_citizen";
        const newCitizen = generateRandomCitizen();
        gameState.pendingNewCitizen = newCitizen;
        gameScenarios["daily_event_new_citizen"].text = `새로운 인재 ${newCitizen.name}(${newCitizen.personality}, ${newCitizen.skill})이(가) 시정에 참여하고 싶어 합니다. (현재 인력: ${gameState.citizens.length} / ${gameState.maxCitizens})`;
    }
    else if (rand < 0.85 && gameState.infrastructure.cityHall.built) { eventId = "daily_event_investment"; }
    
    gameState.currentScenarioId = eventId;
    updateGameDisplay(dailyMessage + (gameScenarios[eventId]?.text || ''));
    renderChoices(gameScenarios[eventId].choices);
    saveGameState();
}

function initDailyGame() {
    loadGameState();
}

function resetGame() {
    if (confirm("정말로 도시를 초기화하시겠습니까? 모든 진행 상황이 사라집니다.")) {
        localStorage.removeItem('estjCityGame');
        resetGameState();
        saveGameState();
        location.reload();
    }
}

window.onload = function() {
    try {
        initDailyGame();
        document.getElementById('resetGameBtn').addEventListener('click', resetGame);
        document.getElementById('nextDayBtn').addEventListener('click', gameActions.manualNextDay);
    } catch (e) {
        console.error("오늘의 게임 생성 중 오류 발생:", e);
        document.getElementById('gameDescription').innerText = "콘텐츠를 불러오는 데 실패했습니다. 페이지를 새로고침해 주세요.";
    }
};