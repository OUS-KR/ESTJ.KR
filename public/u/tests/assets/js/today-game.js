// today-game.js - ESTJ - 효율적인 도시 경영 (Efficient City Management)

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

function getRandomValue(base, variance) {
    const min = base - variance;
    const max = base + variance;
    return Math.floor(currentRandFn() * (max - min + 1)) + min;
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

function showFeedback(isSuccess, message) {
    const feedbackMessage = document.getElementById('feedbackMessage');
    if (feedbackMessage) {
        feedbackMessage.innerText = message;
        feedbackMessage.className = `feedback-message ${isSuccess ? 'correct' : 'incorrect'}`;
    }
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
        leadership: 50,
        responsibility: 50,
        actionPoints: 10, // Internally actionPoints, but represents '행동력' in UI
        maxActionPoints: 10,
        resources: { budget: 10, materials: 10, labor: 5, administration: 0 },
        citizens: [
            { id: "mayor_kim", name: "김시장", personality: "성실한", skill: "행정", trust: 70 },
            { id: "engineer_lee", name: "이엔지", personality: "꼼꼼한", skill: "건설", trust: 60 }
        ],
        maxCitizens: 5,
        currentScenarioId: "intro",
        lastPlayedDate: new Date().toISOString().slice(0, 10),
        manualDayAdvances: 0,
        dailyEventTriggered: false,
        dailyBonus: { managementSuccess: 0 }, // Re-themed from gatheringSuccess
        dailyActions: { inspected: false, reported: false, collected: false, minigamePlayed: false }, // Re-themed
        cityInfrastructure: {
            warehouse: { built: false, durability: 100, name: "물류창고", description: "도시의 자재를 효율적으로 보관합니다.", effect_description: "자재 및 생산성 증가." },
            factory: { built: false, durability: 100, name: "공장", description: "다양한 물품을 생산하고 노동력을 활용합니다.", effect_description: "노동력 및 효율 증가." },
            cityHall: { built: false, durability: 100, name: "시청", description: "도시의 행정을 총괄하고 시민들을 관리합니다.", effect_description: "행정력 및 질서 증가." },
            planningDept: { built: false, durability: 100, name: "기획부", description: "도시의 미래를 계획하고 전략을 수립합니다.", effect_description: "리더십 및 효율 증가." },
            researchInstitute: { built: false, durability: 100, name: "연구소", description: "새로운 기술과 정책을 연구하여 도시를 발전시킵니다.", effect_description: "책임감 및 생산성 증가." }
        },
        cityLevel: 0, // Re-themed from toolsLevel
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
        // Patch for old save files
        if (!loaded.dailyBonus) loaded.dailyBonus = { managementSuccess: 0 };
        if (!loaded.citizens || loaded.citizens.length === 0) {
            loaded.citizens = [
                { id: "mayor_kim", name: "김시장", personality: "성실한", skill: "행정", trust: 70 },
                { id: "engineer_lee", name: "이엔지", personality: "꼼꼼한", skill: "건설", trust: 60 }
            ];
        }
        // Ensure new stats are initialized if loading old save
        if (loaded.efficiency === undefined) loaded.efficiency = 50;
        if (loaded.order === undefined) loaded.order = 50;
        if (loaded.productivity === undefined) loaded.productivity = 50;
        if (loaded.leadership === undefined) loaded.leadership = 50;
        if (loaded.responsibility === undefined) loaded.responsibility = 50;
        if (loaded.cityLevel === undefined) loaded.cityLevel = 0;

        Object.assign(gameState, loaded);

        // Always initialize currentRandFn after loading state
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
    const citizenListHtml = gameState.citizens.map(c => `<li>${c.name} (${c.skill}) - 신뢰도: ${c.trust}</li>`).join('');
    statsDiv.innerHTML = `
        <p><b>날짜:</b> ${gameState.day}일</p>
        <p><b>행동력:</b> ${gameState.actionPoints}/${gameState.maxActionPoints}</p>
        <p><b>효율:</b> ${gameState.efficiency} | <b>질서:</b> ${gameState.order} | <b>생산성:</b> ${gameState.productivity} | <b>리더십:</b> ${gameState.leadership} | <b>책임감:</b> ${gameState.responsibility}</p>
        <p><b>자원:</b> 예산 ${gameState.resources.budget}, 자재 ${gameState.resources.materials}, 노동력 ${gameState.resources.labor}, 행정력 ${gameState.resources.administration || 0}</p>
        <p><b>도시 레벨:</b> ${gameState.cityLevel}</p>
        <p><b>시민 (${gameState.citizens.length}/${gameState.maxCitizens}):</b></p>
        <ul>${citizenListHtml}</ul>
        <p><b>구축된 도시 기반시설:</b></p>
        <ul>${Object.values(gameState.cityInfrastructure).filter(i => i.built).map(i => `<li>${i.name} (내구도: ${i.durability}) - ${i.effect_description}</li>`).join('') || '없음'}</ul>
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
    } else if (gameState.currentScenarioId === 'action_infrastructure_management') {
        dynamicChoices = gameScenarios.action_infrastructure_management.choices ? [...gameScenarios.action_infrastructure_management.choices] : [];
        // Build options
        if (!gameState.cityInfrastructure.warehouse.built) dynamicChoices.push({ text: "물류창고 건설 (예산 50, 자재 20)", action: "build_warehouse" });
        if (!gameState.cityInfrastructure.factory.built) dynamicChoices.push({ text: "공장 건설 (자재 30, 노동력 30)", action: "build_factory" });
        if (!gameState.cityInfrastructure.cityHall.built) dynamicChoices.push({ text: "시청 건설 (예산 100, 자재 50, 노동력 50)", action: "build_cityHall" });
        if (!gameState.cityInfrastructure.planningDept.built) dynamicChoices.push({ text: "기획부 건설 (자재 80, 노동력 40)", action: "build_planningDept" });
        if (gameState.cityInfrastructure.factory.built && gameState.cityInfrastructure.factory.durability > 0 && !gameState.cityInfrastructure.researchInstitute.built) {
            dynamicChoices.push({ text: "연구소 건설 (자재 50, 노동력 100)", action: "build_researchInstitute" });
        }
        // Maintenance options
        Object.keys(gameState.cityInfrastructure).forEach(key => {
            const infra = gameState.cityInfrastructure[key];
            if (infra.built && infra.durability < 100) {
                dynamicChoices.push({ text: `${infra.name} 보수 (자재 10, 노동력 10)`, action: "maintain_infrastructure", params: { infra: key } });
            }
        });
        dynamicChoices.push({ text: "취소", action: "return_to_intro" });
    } else { // For any other scenario, use its predefined choices
        dynamicChoices = choices ? [...choices] : [];
    }

    choicesDiv.innerHTML = dynamicChoices.map(choice => `<button class="choice-btn" data-action="${choice.action}" data-params='${JSON.stringify(choice.params || {})}' >${choice.text}</button>`).join('');
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
    "intro": { text: "효율적인 도시 경영을 위해 무엇을 할까요?", choices: [
        { text: "도시 시찰", action: "inspect_city" },
        { text: "시민 보고", action: "report_to_citizens" },
        { text: "예산 감사", action: "audit_budget" },
        { text: "자원 징수", action: "show_resource_collection_options" },
        { text: "기반시설 관리", action: "show_infrastructure_management_options" },
        { text: "정책 검토", action: "show_policy_review_options" },
        { text: "오늘의 결단", action: "play_minigame" }
    ]},
    "daily_event_budget_audit": { 
        text: "", // Set by onTrigger
        choices: [{ text: "확인", action: "return_to_intro" }]
    },
    "daily_event_citizen_complaint": {
        text: "", // Set by onTrigger
        choices: [{ text: "확인", action: "return_to_intro" }]
    },
    "daily_event_construction_project": {
        text: "대규모 건설 프로젝트가 시작되었습니다. 도시의 생산성이 흔들리고 있습니다.",
        choices: [
            { text: "프로젝트를 효율적으로 관리한다 (행동력 1 소모)", action: "manage_project_efficiently" },
            { text: "프로젝트를 시민들에게 위임한다", action: "delegate_project" }
        ]
    },
    "daily_event_resource_shortage": {
        text: "", // Set by onTrigger
        choices: [{ text: "확인", action: "return_to_intro" }]
    },
    "daily_event_citizen_dispute": {
        text: "김시장과 이엔지 사이에 도시 정책에 대한 작은 의견 차이가 생겼습니다. 둘 다 당신의 판단을 기다리는 것 같습니다.",
        choices: [
            { text: "김시장의 관점을 먼저 들어준다.", action: "handle_citizen_dispute", params: { first: "mayor_kim", second: "engineer_lee" } },
            { text: "이엔지의 관점을 먼저 들어준다.", action: "handle_citizen_dispute", params: { first: "engineer_lee", second: "mayor_kim" } },
            { text: "둘을 불러 효율적인 해결책을 찾는다.", action: "mediate_citizen_dispute" },
            { text: "신경 쓰지 않는다.", action: "ignore_event" }
        ]
    },
    "daily_event_new_citizen": {
        choices: [
            { text: "유능한 시민을 영입한다.", action: "welcome_new_unique_citizen" },
            { text: "도시에 필요한지 좀 더 지켜본다.", action: "observe_citizen" },
            { text: "정중히 거절한다.", action: "reject_citizen" }
        ]
    },
    "daily_event_external_investment": {
        text: "외부 투자 기관에서 도시 개발 자금 지원을 제안했습니다. 그들은 [예산 50개]를 [행정력 5개]와 교환하자고 제안합니다.",
        choices: [
            { text: "제안을 수락한다", action: "accept_investment" },
            { text: "제안을 거절한다", action: "decline_investment" }
        ]
    },
    "daily_event_policy_failure": {
        text: "", // Set by onTrigger
        choices: [{ text: "확인", action: "return_to_intro" }]
    },
    "daily_event_leadership_crisis": {
        text: "도시의 리더십이 흔들리고 있습니다. 시민들의 신뢰가 떨어지는 것 같습니다.",
        choices: [
            { text: "강력한 리더십을 발휘하여 위기를 극복한다 (행동력 1 소모)", action: "assert_leadership" },
            { text: "시민들의 의견을 수렴하여 해결책을 찾는다", action: "seek_citizen_input" }
        ]
    },
    "game_over_efficiency": { text: "도시의 효율성이 바닥을 쳤습니다. 모든 업무가 마비되고 도시는 혼란에 빠졌습니다.", choices: [], final: true },
    "game_over_order": { text: "도시의 질서가 무너져 범죄가 만연하고 시민들이 불안해합니다. 도시는 무법천지가 되었습니다.", choices: [], final: true },
    "game_over_productivity": { text: "도시의 생산성이 고갈되어 더 이상 발전할 수 없습니다. 도시는 쇠퇴의 길을 걷습니다.", choices: [], final: true },
    "game_over_leadership": { text: "당신의 리더십이 사라져 시민들이 당신의 지시를 따르지 않습니다. 도시는 무정부 상태가 되었습니다.", choices: [], final: true },
    "game_over_responsibility": { text: "시장으로서의 책임감이 사라져 더 이상 도시를 경영할 수 없습니다. 당신은 시장직에서 물러났습니다.", choices: [], final: true },
    "game_over_resources": { text: "도시의 자원이 모두 고갈되어 더 이상 운영할 수 없습니다.", choices: [], final: true },
    "action_resource_collection": {
        text: "어떤 자원을 징수하시겠습니까?",
        choices: [
            { text: "예산 징수", action: "collect_budget" },
            { text: "자재 확보", action: "collect_materials" },
            { text: "노동력 모집", "action": "collect_labor" },
            { text: "취소", "action": "return_to_intro" }
        ]
    },
    "action_infrastructure_management": {
        text: "어떤 기반시설을 관리하시겠습니까?",
        choices: [] // Choices will be dynamically added in renderChoices
    },
    "resource_collection_result": {
        text: "", // Text will be set dynamically by updateGameDisplay
        choices: [{ text: "확인", action: "show_resource_collection_options" }] // Return to gathering menu
    },
    "infrastructure_management_result": {
        text: "", // Text will be set dynamically by updateGameDisplay
        choices: [{ text: "확인", action: "show_infrastructure_management_options" }] // Return to facility management menu
    },
    "citizen_dispute_resolution_result": {
        text: "", // This will be set dynamically
        choices: [{ text: "확인", action: "return_to_intro" }]
    },
    "project_management_result": {
        text: "", // This will be set dynamically
        choices: [{ text: "확인", action: "return_to_intro" }]
    },
    "policy_review_menu": {
        text: "어떤 정책을 검토하시겠습니까?",
        choices: [
            { text: "예산 분배 (행동력 1 소모)", action: "allocate_budget" },
            { text: "업무 프로세스 최적화 (행동력 1 소모)", action: "optimize_process" },
            { text: "취소", action: "return_to_intro" }
        ]
    },
};

const auditBudgetOutcomes = [
    {
        condition: (gs) => gs.efficiency < 40,
        weight: 40,
        effect: (gs) => {
            const efficiencyLoss = getRandomValue(10, 4);
            const orderLoss = getRandomValue(5, 2);
            const productivityLoss = getRandomValue(5, 2);
            return {
                changes: { efficiency: gs.efficiency - efficiencyLoss, order: gs.order - orderLoss, productivity: gs.productivity - productivityLoss },
                message: `예산 감사가 시작되자마자 시민들의 불만이 터져 나왔습니다. 낮은 효율성으로 인해 분위기가 험악합니다. (-${efficiencyLoss} 효율, -${orderLoss} 질서, -${productivityLoss} 생산성)`
            };
        }
    },
    {
        condition: (gs) => gs.leadership > 70 && gs.responsibility > 60,
        weight: 30,
        effect: (gs) => {
            const efficiencyGain = getRandomValue(15, 5);
            const orderGain = getRandomValue(10, 3);
            const productivityGain = getRandomValue(10, 3);
            return {
                changes: { efficiency: gs.efficiency + efficiencyGain, order: gs.order + orderGain, productivity: gs.productivity + productivityGain },
                message: `높은 리더십과 책임감을 바탕으로 건설적인 예산 감사가 진행되었습니다! (+${efficiencyGain} 효율, +${orderGain} 질서, +${productivityGain} 생산성)`
            };
        }
    },
    {
        condition: (gs) => gs.resources.budget < gs.citizens.length * 4,
        weight: 25,
        effect: (gs) => {
            const leadershipGain = getRandomValue(10, 3);
            const responsibilityGain = getRandomValue(5, 2);
            return {
                changes: { leadership: gs.leadership + leadershipGain, responsibility: gs.responsibility + responsibilityGain },
                message: `예산이 부족한 상황에 대해 논의했습니다. 모두가 효율적인 예산 관리에 동의하며 당신의 리더십을 신뢰했습니다. (+${leadershipGain} 리더십, +${responsibilityGain} 책임감)`
            };
        }
    },
    {
        condition: (gs) => gs.citizens.some(c => c.trust < 50),
        weight: 20,
        effect: (gs) => {
            const citizen = gs.citizens.find(c => c.trust < 50);
            const trustGain = getRandomValue(10, 4);
            const efficiencyGain = getRandomValue(5, 2);
            const leadershipGain = getRandomValue(5, 2);
            const updatedCitizens = gs.citizens.map(c => c.id === citizen.id ? { ...c, trust: Math.min(100, c.trust + trustGain) } : c);
            return {
                changes: { citizens: updatedCitizens, efficiency: gs.efficiency + efficiencyGain, leadership: gs.leadership + leadershipGain },
                message: `예산 감사 중, ${citizen.name}이(가) 조심스럽게 불만을 토로했습니다. 그의 의견을 존중하고 해결을 약속하자 신뢰를 얻었습니다. (+${trustGain} ${citizen.name} 신뢰도, +${efficiencyGain} 효율, +${leadershipGain} 리더십)`
            };
        }
    },
    {
        condition: () => true, // Default positive outcome
        weight: 20,
        effect: (gs) => {
            const orderGain = getRandomValue(5, 2);
            const productivityGain = getRandomValue(3, 1);
            return {
                changes: { order: gs.order + orderGain, productivity: gs.productivity + productivityGain },
                message: `평범한 예산 감사였지만, 모두가 한자리에 모여 의견을 나눈 것만으로도 의미가 있었습니다. (+${orderGain} 질서, +${productivityGain} 생산성)`
            };
        }
    },
    {
        condition: (gs) => gs.order < 40 || gs.productivity < 40,
        weight: 25, // Increased weight when conditions met
        effect: (gs) => {
            const efficiencyLoss = getRandomValue(5, 2);
            const orderLoss = getRandomValue(5, 2);
            const productivityLoss = getRandomValue(5, 2);
            return {
                changes: { efficiency: gs.efficiency - efficiencyLoss, order: gs.order - orderLoss, productivity: gs.productivity - productivityLoss },
                message: `예산 감사는 길어졌지만, 의견 차이만 확인하고 끝났습니다. 시민들의 효율과 질서, 당신의 생산성이 약간 감소했습니다. (-${efficiencyLoss} 효율, -${orderLoss} 질서, -${productivityLoss} 생산성)`
            };
        }
    }
];

const inspectCityOutcomes = [
    {
        condition: (gs) => gs.resources.budget < 20,
        weight: 30,
        effect: (gs) => {
            const budgetGain = getRandomValue(10, 5);
            return {
                changes: { resources: { ...gs.resources, budget: gs.resources.budget + budgetGain } },
                message: `도시 시찰 중 새로운 예산 확보 방안을 발견했습니다! (+${budgetGain} 예산)`
            };
        }
    },
    {
        condition: (gs) => gs.resources.materials < 20,
        weight: 25,
        effect: (gs) => {
            const materialsGain = getRandomValue(10, 5);
            return {
                changes: { resources: { ...gs.resources, materials: gs.resources.materials + materialsGain } },
                message: `도시 시찰 중 쓸만한 자재를 발견했습니다! (+${materialsGain} 자재)`
            };
        }
    },
    {
        condition: () => true, // General positive discovery
        weight: 20,
        effect: (gs) => {
            const leadershipGain = getRandomValue(5, 2);
            const responsibilityGain = getRandomValue(5, 2);
            return {
                changes: { leadership: gs.leadership + leadershipGain, responsibility: gs.responsibility + responsibilityGain },
                message: `도시를 시찰하며 새로운 리더십과 책임감을 얻었습니다. (+${leadershipGain} 리더십, +${responsibilityGain} 책임감)`
            };
        }
    },
    {
        condition: () => true, // Always possible
        weight: 25, // Increased weight for more frequent occurrence
        effect: (gs) => {
            const actionLoss = getRandomValue(2, 1);
            const efficiencyLoss = getRandomValue(5, 2);
            const orderLoss = getRandomValue(5, 2);
            return {
                changes: { actionPoints: gs.actionPoints - actionLoss, efficiency: gs.efficiency - efficiencyLoss, order: gs.order - orderLoss },
                message: `도시 시찰에 너무 깊이 빠져 행동력을 소모하고 효율과 질서가 감소했습니다. (-${actionLoss} 행동력, -${efficiencyLoss} 효율, -${orderLoss} 질서)`
            };
        }
    },
    {
        condition: () => true, // Always possible
        weight: 15, // Increased weight for more frequent occurrence
        effect: (gs) => {
            const productivityLoss = getRandomValue(5, 2);
            const leadershipLoss = getRandomValue(5, 2);
            return {
                changes: { productivity: gs.productivity - productivityLoss, leadership: gs.leadership - leadershipLoss },
                message: `도시 시찰 중 예상치 못한 문제에 부딪혀 생산성과 리더십이 약간 감소했습니다. (-${productivityLoss} 생산성, -${leadershipLoss} 리더십)`
            };
        }
    }
];

const reportToCitizensOutcomes = [
    {
        condition: (gs, citizen) => citizen.trust < 60,
        weight: 40,
        effect: (gs, citizen) => {
            const trustGain = getRandomValue(10, 5);
            const responsibilityGain = getRandomValue(5, 2);
            const leadershipGain = getRandomValue(5, 2);
            const updatedCitizens = gs.citizens.map(c => c.id === citizen.id ? { ...c, trust: Math.min(100, c.trust + trustGain) } : c);
            return {
                changes: { citizens: updatedCitizens, responsibility: gs.responsibility + responsibilityGain, leadership: gs.leadership + leadershipGain },
                message: `${citizen.name}${getWaGwaParticle(citizen.name)} 깊은 보고를 나누며 신뢰와 당신의 리더십을 얻었습니다. (+${trustGain} ${citizen.name} 신뢰도, +${responsibilityGain} 책임감, +${leadershipGain} 리더십)`
            };
        }
    },
    {
        condition: (gs, citizen) => citizen.personality === "성실한",
        weight: 20,
        effect: (gs, citizen) => {
            const productivityGain = getRandomValue(10, 3);
            const efficiencyGain = getRandomValue(5, 2);
            return {
                changes: { productivity: gs.productivity + productivityGain, efficiency: gs.efficiency + efficiencyGain },
                message: `${citizen.name}${getWaGwaParticle(citizen.name)}와 성실한 보고를 나누며 생산성과 효율성이 상승했습니다. (+${productivityGain} 생산성, +${efficiencyGain} 효율)`
            };
        }
    },
    {
        condition: (gs, citizen) => citizen.skill === "행정",
        weight: 15,
        effect: (gs, citizen) => {
            const administrationGain = getRandomValue(5, 2);
            return {
                changes: { resources: { ...gs.resources, administration: gs.resources.administration + administrationGain } },
                message: `${citizen.name}${getWaGwaParticle(citizen.name)}에게서 행정에 대한 유용한 정보를 얻어 행정력을 추가로 확보했습니다. (+${administrationGain} 행정력)`
            };
        }
    },
    {
        condition: (gs, citizen) => true, // Default positive outcome
        weight: 25,
        effect: (gs, citizen) => {
            const orderGain = getRandomValue(5, 2);
            const responsibilityGain = getRandomValue(3, 1);
            return {
                changes: { order: gs.order + orderGain, responsibility: gs.responsibility + responsibilityGain },
                message: `${citizen.name}${getWaGwaParticle(citizen.name)} 소소한 보고를 나누며 질서와 당신의 책임감이 조금 더 단단해졌습니다. (+${orderGain} 질서, +${responsibilityGain} 책임감)`
            };
        }
    },
    {
        condition: (gs, citizen) => gs.efficiency < 40 || citizen.trust < 40,
        weight: 20, // Increased weight when conditions met
        effect: (gs, citizen) => {
            const trustLoss = getRandomValue(10, 3);
            const efficiencyLoss = getRandomValue(5, 2);
            const leadershipLoss = getRandomValue(5, 2);
            const updatedCitizens = gs.citizens.map(c => c.id === citizen.id ? { ...c, trust: Math.max(0, c.trust - trustLoss) } : c);
            return {
                changes: { citizens: updatedCitizens, efficiency: gs.efficiency - efficiencyLoss, leadership: gs.leadership - leadershipLoss },
                message: `${citizen.name}${getWaGwaParticle(citizen.name)} 보고 중 오해를 사서 신뢰도와 효율성, 당신의 리더십이 감소했습니다. (-${trustLoss} ${citizen.name} 신뢰도, -${efficiencyLoss} 효율, -${leadershipLoss} 리더십)`
            };
        }
    },
    {
        condition: (gs) => gs.efficiency < 30,
        weight: 15, // Increased weight when conditions met
        effect: (gs, citizen) => {
            const actionLoss = getRandomValue(1, 0);
            const productivityLoss = getRandomValue(5, 2);
            return {
                changes: { actionPoints: gs.actionPoints - actionLoss, productivity: gs.productivity - productivityLoss },
                message: `${citizen.name}${getWaGwaParticle(citizen.name)} 보고가 길어졌지만, 특별한 소득은 없었습니다. 당신의 생산성이 감소했습니다. (-${actionLoss} 행동력, -${productivityLoss} 생산성)`
            };
        }
    }
];

function calculateMinigameReward(minigameName, score) {
    let rewards = { efficiency: 0, order: 0, productivity: 0, leadership: 0, responsibility: 0, message: "" };

    switch (minigameName) {
        case "보고서 핵심 내용 맞추기":
            if (score >= 51) {
                rewards.efficiency = 15;
                rewards.order = 10;
                rewards.productivity = 5;
                rewards.leadership = 5;
                rewards.message = `최고의 보고서 분석가가 되셨습니다! (+15 효율, +10 질서, +5 생산성, +5 리더십)`;
            } else if (score >= 21) {
                rewards.efficiency = 10;
                rewards.order = 5;
                rewards.productivity = 3;
                rewards.message = `훌륭한 보고서 분석입니다! (+10 효율, +5 질서, +3 생산성)`;
            } else if (score >= 0) {
                rewards.efficiency = 5;
                rewards.message = `보고서 핵심 내용 맞추기를 완료했습니다. (+5 효율)`;
            } else {
                rewards.message = `보고서 핵심 내용 맞추기를 완료했지만, 아쉽게도 보상은 없습니다.`;
            }
            break;
        case "예산 분배 시뮬레이션": // Placeholder for now, but re-themed
            rewards.order = 2;
            rewards.responsibility = 1;
            rewards.message = `예산 분배 시뮬레이션을 완료했습니다. (+2 질서, +1 책임감)`;
            break;
        case "업무 프로세스 개선": // Placeholder for now, but re-themed
            rewards.efficiency = 2;
            rewards.productivity = 1;
            rewards.message = `업무 프로세스 개선을 완료했습니다. (+2 효율, +1 생산성)`;
            break;
        case "규정 준수 퀴즈": // Placeholder for now, but re-themed
            rewards.responsibility = 2;
            rewards.order = 1;
            rewards.message = `규정 준수 퀴즈를 완료했습니다. (+2 책임감, +1 질서)`;
            break;
        case "자원 최적화 퍼즐": // Placeholder for now, but re-themed
            rewards.productivity = 2;
            rewards.efficiency = 1;
            rewards.message = `자원 최적화 퍼즐을 완료했습니다. (+2 생산성, +1 효율)`;
            break;
        default:
            rewards.message = `미니게임 ${minigameName}${getEulReParticle(minigameName)} 완료했습니다.`;
            break;
    }
    return rewards;
}

const minigames = [
    {
        name: "보고서 핵심 내용 맞추기",
        description: "주어진 보고서의 핵심 내용을 기억하고 정확하게 입력하세요. 단계가 올라갈수록 어려워집니다!",
        start: (gameArea, choicesDiv) => {
            const reportKeywords = ["예산", "효율", "생산성", "질서", "리더십", "책임감", "시민", "인프라", "정책", "성과"];
            gameState.minigameState = {
                currentSequence: [],
                playerInput: [],
                stage: 1,
                score: 0,
                showingSequence: false
            };
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
                <div class="keyword-pad">
                    ${["예산", "효율", "생산", "질서", "리더", "책임", "시민", "인프라", "정책", "성과"].map(kw => `<button class="choice-btn kw-btn" data-value="${kw}">${kw}</button>`).join('')}
                    <button class="choice-btn submit-btn" data-action="submitSequence">입력 완료</button>
                    <button class="choice-btn reset-btn" data-action="resetInput">초기화</button>
                </div>
            `;
            choicesDiv.querySelectorAll('.kw-btn').forEach(button => {
                button.addEventListener('click', () => minigames[0].processAction('addInput', button.dataset.value));
            });
            choicesDiv.querySelector('.submit-btn').addEventListener('click', () => minigames[0].processAction('submitSequence'));
            choicesDiv.querySelector('.reset-btn').addEventListener('click', () => minigames[0].processAction('resetInput'));
        },
        showSequence: () => {
            gameState.minigameState.showingSequence = true;
            gameState.minigameState.currentSequence = [];
            const keywords = ["예산", "효율", "생산", "질서", "리더", "책임", "시민", "인프라", "정책", "성과"];
            const sequenceLength = gameState.minigameState.stage + 2; // e.g., stage 1 -> 3 keywords
            for (let i = 0; i < sequenceLength; i++) {
                gameState.minigameState.currentSequence.push(keywords[Math.floor(currentRandFn() * keywords.length)]);
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
                gameState.minigameState.playerInput.push(value);
                document.getElementById('playerInputDisplay').innerText = gameState.minigameState.playerInput.join(' ');
            } else if (actionType === 'resetInput') {
                gameState.minigameState.playerInput = [];
                document.getElementById('playerInputDisplay').innerText = '';
            } else if (actionType === 'submitSequence') {
                const correct = gameState.minigameState.currentSequence.every((kw, i) => kw === gameState.minigameState.playerInput[i]);

                if (correct && gameState.minigameState.playerInput.length === gameState.minigameState.currentSequence.length) {
                    gameState.minigameState.score += gameState.minigameState.currentSequence.length * 10;
                    gameState.minigameState.stage++;
                    gameState.minigameState.playerInput = [];
                    updateGameDisplay("정답입니다! 다음 단계로 넘어갑니다.");
                    minigames[0].render(document.getElementById('gameArea'), document.getElementById('gameChoices'));
                    setTimeout(() => minigames[0].showSequence(), 1500);
                } else {
                    updateGameDisplay("틀렸습니다! 게임 종료.");
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
                leadership: gameState.leadership + rewards.leadership,
                responsibility: gameState.responsibility + rewards.responsibility,
                currentScenarioId: 'intro'
            }, rewards.message);
            gameState.minigameState = {};
        }
    },
    {
        name: "예산 분배 시뮬레이션",
        description: "제한된 예산을 각 부서에 효율적으로 분배하는 게임입니다.",
        start: (gameArea, choicesDiv) => {
            gameState.minigameState = { score: 10 };
            gameArea.innerHTML = `<p>${minigames[1].description}</p><p>게임을 시작합니다!</p>`;
            choicesDiv.innerHTML = `<button class="choice-btn" onclick="minigames[1].processAction('endGame')">게임 종료</button>`;
        },
        render: () {},
        processAction: (actionType) => {
            if (actionType === 'endGame') {
                minigames[1].end();
            }
        },
        end: () => {
            const rewards = calculateMinigameReward(minigames[1].name, gameState.minigameState.score);
            updateState({ 
                order: gameState.order + rewards.order,
                responsibility: gameState.responsibility + rewards.responsibility,
                currentScenarioId: 'intro'
            }, rewards.message);
            gameState.minigameState = {};
        }
    },
    {
        name: "업무 프로세스 개선",
        description: "비효율적인 업무 프로세스를 찾아내 개선하는 퍼즐입니다.",
        start: (gameArea, choicesDiv) => {
            gameState.minigameState = { score: 15 };
            gameArea.innerHTML = `<p>${minigames[2].description}</p><p>게임을 시작합니다!</p>`;
            choicesDiv.innerHTML = `<button class="choice-btn" onclick="minigames[2].processAction('endGame')">게임 종료</button>`;
        },
        render: () {},
        processAction: (actionType) => {
            if (actionType === 'endGame') {
                minigames[2].end();
            }
        },
        end: () => {
            const rewards = calculateMinigameReward(minigames[2].name, gameState.minigameState.score);
            updateState({ 
                efficiency: gameState.efficiency + rewards.efficiency,
                productivity: gameState.productivity + rewards.productivity,
                currentScenarioId: 'intro'
            }, rewards.message);
            gameState.minigameState = {};
        }
    },
    {
        name: "규정 준수 퀴즈",
        description: "주어진 상황에서 지켜야 할 규정을 맞추는 퀴즈입니다.",
        start: (gameArea, choicesDiv) => {
            gameState.minigameState = { score: 20 };
            gameArea.innerHTML = `<p>${minigames[3].description}</p><p>게임을 시작합니다!</p>`;
            choicesDiv.innerHTML = `<button class="choice-btn" onclick="minigames[3].processAction('endGame')">게임 종료</button>`;
        },
        render: () {},
        processAction: (actionType) => {
            if (actionType === 'endGame') {
                minigames[3].end();
            }
        },
        end: () => {
            const rewards = calculateMinigameReward(minigames[3].name, gameState.minigameState.score);
            updateState({
                responsibility: gameState.responsibility + rewards.responsibility,
                order: gameState.order + rewards.order,
                currentScenarioId: 'intro'
            }, rewards.message);
            gameState.minigameState = {};
        }
    },
    {
        name: "자원 최적화 퍼즐",
        description: "최소한의 자원으로 최대의 생산성을 내는 방법을 찾는 퍼즐입니다.",
        start: (gameArea, choicesDiv) => {
            gameState.minigameState = { score: 25 };
            gameArea.innerHTML = `<p>${minigames[4].description}</p><p>게임을 시작합니다!</p>`;
            choicesDiv.innerHTML = `<button class="choice-btn" onclick="minigames[4].processAction('endGame')">게임 종료</button>`;
        },
        render: () {},
        processAction: (actionType) => {
            if (actionType === 'endGame') {
                minigames[4].end();
            }
        },
        end: () => {
            const rewards = calculateMinigameReward(minigames[4].name, gameState.minigameState.score);
            updateState({
                productivity: gameState.productivity + rewards.productivity,
                efficiency: gameState.efficiency + rewards.efficiency,
                currentScenarioId: 'intro'
            }, rewards.message);
            gameState.minigameState = {};
        }
    }
];

// --- Game Actions ---
function spendActionPoint() {
    if (gameState.actionPoints <= 0) {
        updateGameDisplay("행동력이 부족합니다.");
        return false;
    }
    updateState({ actionPoints: gameState.actionPoints - 1 });
    return true;
}

const gameActions = {
    inspect_city: () => {
        if (!spendActionPoint()) return;

        const possibleOutcomes = inspectCityOutcomes.filter(outcome => outcome.condition(gameState));
        const totalWeight = possibleOutcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
        const rand = currentRandFn() * totalWeight;

        let cumulativeWeight = 0;
        let chosenOutcome = possibleOutcomes.find(outcome => {
            cumulativeWeight += outcome.weight;
            return rand < cumulativeWeight;
        });

        if (!chosenOutcome) { // Fallback to default if something goes wrong
            chosenOutcome = inspectCityOutcomes.find(o => o.condition());
        }

        const result = chosenOutcome.effect(gameState);
        updateState({ ...result.changes, dailyActions: { ...gameState.dailyActions, inspected: true } }, result.message);
    },
    report_to_citizens: () => {
        if (!spendActionPoint()) return;
        const citizen = gameState.citizens[Math.floor(currentRandFn() * gameState.citizens.length)];
        if (gameState.dailyActions.reported) { updateState({ dailyActions: { ...gameState.dailyActions, reported: true } }, `${citizen.name}${getWaGwaParticle(citizen.name)} 이미 충분히 보고했습니다.`); return; }

        const possibleOutcomes = reportToCitizensOutcomes.filter(outcome => outcome.condition(gameState, citizen));
        const totalWeight = possibleOutcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
        const rand = currentRandFn() * totalWeight;

        let cumulativeWeight = 0;
        let chosenOutcome = possibleOutcomes.find(outcome => {
            cumulativeWeight += outcome.weight;
            return rand < cumulativeWeight;
        });

        if (!chosenOutcome) { // Fallback to default if something goes wrong
            chosenOutcome = reportToCitizensOutcomes.find(o => o.condition());
        }

        const result = chosenOutcome.effect(gameState, citizen);
        updateState({ ...result.changes, dailyActions: { ...gameState.dailyActions, reported: true } }, result.message);
    },
    audit_budget: () => {
        if (!spendActionPoint()) return;

        const possibleOutcomes = auditBudgetOutcomes.filter(outcome => outcome.condition(gameState));
        const totalWeight = possibleOutcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
        const rand = currentRandFn() * totalWeight;

        let cumulativeWeight = 0;
        let chosenOutcome = possibleOutcomes.find(outcome => {
            cumulativeWeight += outcome.weight;
            return rand < cumulativeWeight;
        });

        if (!chosenOutcome) { // Fallback to default if something goes wrong
            chosenOutcome = auditBudgetOutcomes.find(o => o.condition());
        }

        const result = chosenOutcome.effect(gameState);
        updateState(result.changes, result.message);
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
    handle_citizen_dispute: (params) => {
        if (!spendActionPoint()) return;
        const { first, second } = params;
        let message = "";
        let reward = { efficiency: 0, order: 0, leadership: 0 };

        const trustGain = getRandomValue(10, 3);
        const trustLoss = getRandomValue(5, 2);
        const efficiencyGain = getRandomValue(5, 2);
        const leadershipGain = getRandomValue(5, 2);

        const updatedCitizens = gameState.citizens.map(c => {
            if (c.id === first) {
                c.trust = Math.min(100, c.trust + trustGain);
                message += `${c.name}의 관점을 먼저 들어주었습니다. ${c.name}의 신뢰도가 상승했습니다. `; 
                reward.efficiency += efficiencyGain;
                reward.leadership += leadershipGain;
            } else if (c.id === second) {
                c.trust = Math.max(0, c.trust - trustLoss);
                message += `${second}의 신뢰도가 약간 하락했습니다. `; 
            }
            return c;
        });

        updateState({ ...reward, citizens: updatedCitizens, currentScenarioId: 'citizen_dispute_resolution_result' }, message);
    },
    mediate_citizen_dispute: () => {
        if (!spendActionPoint()) return;
        const orderGain = getRandomValue(10, 3);
        const productivityGain = getRandomValue(5, 2);
        const leadershipGain = getRandomValue(5, 2);
        const message = `당신의 효율적인 중재로 김시장과 이엔지의 의견 차이가 해결되었습니다. 도시의 질서와 당신의 리더십이 강화되었습니다! (+${orderGain} 질서, +${productivityGain} 생산성, +${leadershipGain} 리더십)`;
        updateState({ order: gameState.order + orderGain, productivity: gameState.productivity + productivityGain, leadership: gameState.leadership + leadershipGain, currentScenarioId: 'citizen_dispute_resolution_result' }, message);
    },
    ignore_event: () => {
        if (!spendActionPoint()) return;
        const orderLoss = getRandomValue(10, 3);
        const productivityLoss = getRandomValue(5, 2);
        const message = `의견 차이를 무시했습니다. 시민들의 불만이 커지고 도시의 분위기가 침체됩니다. (-${orderLoss} 질서, -${productivityLoss} 생산성)`
        const updatedCitizens = gameState.citizens.map(c => {
            c.trust = Math.max(0, c.trust - 5);
            return c;
        });
        updateState({ order: gameState.order - orderLoss, productivity: gameState.productivity - productivityLoss, citizens: updatedCitizens, currentScenarioId: 'citizen_dispute_resolution_result' }, message);
    },
    manage_project_efficiently: () => {
        if (!spendActionPoint()) return;
        const cost = 1; // Action point cost
        let message = "";
        let changes = {};
        if (gameState.actionPoints >= cost) {
            const efficiencyGain = getRandomValue(10, 3);
            const productivityGain = getRandomValue(5, 2);
            message = `프로젝트를 효율적으로 관리했습니다. 도시의 효율과 생산성이 상승합니다. (+${efficiencyGain} 효율, +${productivityGain} 생산성)`;
            changes.efficiency = gameState.efficiency + efficiencyGain;
            changes.productivity = gameState.productivity + productivityGain;
            changes.actionPoints = gameState.actionPoints - cost;
        } else {
            message = "프로젝트를 관리할 행동력이 부족합니다.";
        }
        updateState({ ...changes, currentScenarioId: 'project_management_result' }, message);
    },
    delegate_project: () => {
        if (!spendActionPoint()) return;
        const efficiencyLoss = getRandomValue(10, 3);
        const orderLoss = getRandomValue(5, 2);
        updateState({ efficiency: gameState.efficiency - efficiencyLoss, order: gameState.order - orderLoss, currentScenarioId: 'project_management_result' }, `프로젝트를 시민들에게 위임했습니다. (-${efficiencyLoss} 효율, -${orderLoss} 질서)`);
    },
    assert_leadership: () => {
        if (!spendActionPoint()) return;
        const cost = 1; // Action point cost
        let message = "";
        let changes = {};
        if (gameState.actionPoints >= cost) {
            const leadershipGain = getRandomValue(10, 3);
            const responsibilityGain = getRandomValue(5, 2);
            message = `강력한 리더십을 발휘하여 위기를 극복했습니다. 당신의 리더십과 책임감이 상승합니다. (+${leadershipGain} 리더십, +${responsibilityGain} 책임감)`;
            changes.leadership = gameState.leadership + leadershipGain;
            changes.responsibility = gameState.responsibility + responsibilityGain;
            changes.actionPoints = gameState.actionPoints - cost;
        } else {
            message = "리더십을 발휘할 행동력이 부족합니다.";
        }
        updateState({ ...changes, currentScenarioId: 'intro' }, message);
    },
    seek_citizen_input: () => {
        if (!spendActionPoint()) return;
        const leadershipLoss = getRandomValue(10, 3);
        const orderLoss = getRandomValue(5, 2);
        updateState({ leadership: gameState.leadership - leadershipLoss, order: gameState.order - orderLoss, currentScenarioId: 'intro' }, `시민들의 의견을 수렴했지만, 리더십과 질서가 감소했습니다. (-${leadershipLoss} 리더십, -${orderLoss} 질서)`);
    },
    welcome_new_unique_citizen: () => {
        if (!spendActionPoint()) return;
        let message = "";
        let changes = {};
        if (gameState.citizens.length < gameState.maxCitizens && gameState.pendingNewCitizen) {
            const efficiencyGain = getRandomValue(10, 3);
            const orderGain = getRandomValue(5, 2);
            const productivityGain = getRandomValue(5, 2);
            gameState.citizens.push(gameState.pendingNewCitizen);
            message = `새로운 시민 ${gameState.pendingNewCitizen.name}을(를) 유능한 인재로 영입했습니다! 도시의 효율과 질서, 생산성이 상승합니다. (+${efficiencyGain} 효율, +${orderGain} 질서, +${productivityGain} 생산성)`;
            changes.efficiency = gameState.efficiency + efficiencyGain;
            changes.order = gameState.order + orderGain;
            changes.productivity = gameState.productivity + productivityGain;
            changes.pendingNewCitizen = null;
        } else {
            message = "새로운 시민을 영입할 수 없습니다.";
        }
        updateState({ ...changes, currentScenarioId: 'intro' }, message);
    },
    observe_citizen: () => {
        if (!spendActionPoint()) return;
        let message = "";
        let changes = {};
        const rand = currentRandFn();
        if (rand < 0.7) {
            const productivityGain = getRandomValue(5, 2);
            message = `새로운 시민을 관찰하며 흥미로운 점을 발견했습니다. 당신의 생산성이 상승합니다. (+${productivityGain} 생산성)`;
            changes.productivity = gameState.productivity + productivityGain;
        } else {
            const efficiencyLoss = getRandomValue(5, 2);
            message = `시민을 관찰하는 동안, 당신의 우유부단함이 도시에 좋지 않은 인상을 주었습니다. (-${efficiencyLoss} 효율)`;
            changes.efficiency = gameState.efficiency - efficiencyLoss;
        }
        changes.pendingNewCitizen = null;
        updateState({ ...changes, currentScenarioId: 'intro' }, message);
    },
    reject_citizen: () => {
        if (!spendActionPoint()) return;
        const efficiencyLoss = getRandomValue(10, 3);
        const orderLoss = getRandomValue(5, 2);
        const productivityLoss = getRandomValue(5, 2);
        message = `새로운 시민의 영입을 거절했습니다. 도시의 효율과 질서, 생산성이 감소합니다. (-${efficiencyLoss} 효율, -${orderLoss} 질서, -${productivityLoss} 생산성)`;
        updateState({ efficiency: gameState.efficiency - efficiencyLoss, order: gameState.order - orderLoss, productivity: gameState.productivity - productivityLoss, pendingNewCitizen: null, currentScenarioId: 'intro' }, message);
    },
    accept_investment: () => {
        if (!spendActionPoint()) return;
        let message = "";
        let changes = {};
        if (gameState.resources.budget >= 50) {
            const administrationGain = getRandomValue(5, 2);
            message = `외부 투자 기관의 자금 지원을 수락하여 행정력을 얻었습니다! (+${administrationGain} 행정력)`;
            changes.resources = { ...gameState.resources, budget: gameState.resources.budget - 50, administration: (gameState.resources.administration || 0) + 5 };
            changes.administration = gameState.administration + administrationGain;
        } else {
            message = "자금 지원에 필요한 예산이 부족합니다.";
        }
        updateState({ ...changes, currentScenarioId: 'intro' }, message);
    },
    decline_investment: () => {
        if (!spendActionPoint()) return;
        const administrationLoss = getRandomValue(5, 2);
        updateState({ administration: gameState.administration - administrationLoss, currentScenarioId: 'intro' }, `자금 지원 제안을 거절했습니다. 외부 투자 기관은 아쉬워하며 떠났습니다. (-${administrationLoss} 행정력)`);
    },
    show_resource_collection_options: () => updateState({ currentScenarioId: 'action_resource_collection' }),
    show_infrastructure_management_options: () => updateState({ currentScenarioId: 'action_infrastructure_management' }),
    show_policy_review_options: () => updateState({ currentScenarioId: 'policy_review_menu' }),
    collect_budget: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.cityLevel * 0.1) + (gameState.dailyBonus.managementSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            const budgetGain = getRandomValue(5, 2);
            message = `예산을 성공적으로 징수했습니다! (+${budgetGain} 예산)`;
            changes.resources = { ...gameState.resources, budget: gameState.resources.budget + budgetGain };
        } else {
            message = "예산 징수에 실패했습니다.";
        }
        updateState(changes, message);
    },
    collect_materials: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.cityLevel * 0.1) + (gameState.dailyBonus.managementSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            const materialsGain = getRandomValue(5, 2);
            message = `자재를 성공적으로 확보했습니다! (+${materialsGain} 자재)`;
            changes.resources = { ...gameState.resources, materials: gameState.resources.materials + materialsGain };
        } else {
            message = "자재 확보에 실패했습니다.";
        }
        updateState(changes, message);
    },
    collect_labor: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.cityLevel * 0.1) + (gameState.dailyBonus.managementSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            const laborGain = getRandomValue(5, 2);
            message = `노동력을 성공적으로 모집했습니다! (+${laborGain} 노동력)`;
            changes.resources = { ...gameState.resources, labor: gameState.resources.labor + laborGain };
        } else {
            message = "노동력 모집에 실패했습니다.";
        }
        updateState(changes, message);
    },
    build_warehouse: () => {
        if (!spendActionPoint()) return;
        const cost = { budget: 50, materials: 20 };
        let message = "";
        let changes = {};
        if (gameState.resources.budget >= cost.budget && gameState.resources.materials >= cost.materials) {
            gameState.cityInfrastructure.warehouse.built = true;
            const productivityGain = getRandomValue(10, 3);
            message = `물류창고를 건설했습니다! (+${productivityGain} 생산성)`;
            changes.productivity = gameState.productivity + productivityGain;
            changes.resources = { ...gameState.resources, budget: gameState.resources.budget - cost.budget, materials: gameState.resources.materials - cost.materials };
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
            gameState.cityInfrastructure.factory.built = true;
            const efficiencyGain = getRandomValue(10, 3);
            message = `공장을 건설했습니다! (+${efficiencyGain} 효율)`;
            changes.efficiency = gameState.efficiency + efficiencyGain;
            changes.resources = { ...gameState.resources, materials: gameState.resources.materials - cost.materials, labor: gameState.resources.labor - cost.labor };
        } else {
            message = "자원이 부족하여 건설할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_cityHall: () => {
        if (!spendActionPoint()) return;
        const cost = { budget: 100, materials: 50, labor: 50 };
        let message = "";
        let changes = {};
        if (gameState.resources.budget >= cost.budget && gameState.resources.materials >= cost.materials && gameState.resources.labor >= cost.labor) {
            gameState.cityInfrastructure.cityHall.built = true;
            const orderGain = getRandomValue(20, 5);
            const leadershipGain = getRandomValue(20, 5);
            message = `시청을 건설했습니다! (+${orderGain} 질서, +${leadershipGain} 리더십)`;
            changes.order = gameState.order + orderGain;
            changes.leadership = gameState.leadership + leadershipGain;
            changes.resources = { ...gameState.resources, budget: gameState.resources.budget - cost.budget, materials: gameState.resources.materials - cost.materials, labor: gameState.resources.labor - cost.labor };
        } else {
            message = "자원이 부족하여 건설할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_planningDept: () => {
        if (!spendActionPoint()) return;
        const cost = { materials: 80, labor: 40 };
        let message = "";
        let changes = {};
        if (gameState.resources.materials >= cost.materials && gameState.resources.labor >= cost.labor) {
            gameState.cityInfrastructure.planningDept.built = true;
            const leadershipGain = getRandomValue(15, 5);
            const efficiencyGain = getRandomValue(10, 3);
            message = `기획부를 건설했습니다! (+${leadershipGain} 리더십, +${efficiencyGain} 효율)`;
            changes.leadership = gameState.leadership + leadershipGain;
            changes.efficiency = gameState.efficiency + efficiencyGain;
            changes.resources = { ...gameState.resources, materials: gameState.resources.materials - cost.materials, labor: gameState.resources.labor - cost.labor };
        } else {
            message = "자원이 부족하여 건설할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_researchInstitute: () => {
        if (!spendActionPoint()) return;
        const cost = { materials: 50, labor: 100 };
        let message = "";
        let changes = {};
        if (gameState.resources.materials >= cost.materials && gameState.resources.labor >= cost.labor) {
            gameState.cityInfrastructure.researchInstitute.built = true;
            message = "연구소를 건설했습니다!";
            changes.resources = { ...gameState.resources, materials: gameState.resources.materials - cost.materials, labor: gameState.resources.labor - cost.labor };
        } else {
            message = "자원이 부족하여 건설할 수 없습니다.";
        }
        updateState(changes, message);
    },
    maintain_infrastructure: (params) => {
        if (!spendActionPoint()) return;
        const infraKey = params.infra;
        const cost = { materials: 10, labor: 10 };
        let message = "";
        let changes = {};
        if (gameState.resources.materials >= cost.materials && gameState.resources.labor >= cost.labor) {
            gameState.cityInfrastructure[infraKey].durability = 100;
            message = `${gameState.cityInfrastructure[infraKey].name} 기반시설의 보수를 완료했습니다. 내구도가 100으로 회복되었습니다.`;
            changes.resources = { ...gameState.resources, materials: gameState.resources.materials - cost.materials, labor: gameState.resources.labor - cost.labor };
        } else {
            message = "보수에 필요한 자원이 부족합니다.";
        }
        updateState(changes, message);
    },
    allocate_budget: () => {
        if (!spendActionPoint()) return;
        let message = "";
        let changes = {};
        const rand = currentRandFn();

        if (rand < 0.1) { // Big Win
            const budgetGain = getRandomValue(30, 10);
            const materialsGain = getRandomValue(20, 5);
            const laborGain = getRandomValue(15, 5);
            message = `예산 분배 대성공! 엄청난 자원을 얻었습니다! (+${budgetGain} 예산, +${materialsGain} 자재, +${laborGain} 노동력)`;
            changes.resources = { ...gameState.resources, budget: gameState.resources.budget + budgetGain, materials: gameState.resources.materials + materialsGain, labor: gameState.resources.labor + laborGain };
        } else if (rand < 0.4) { // Small Win
            const orderGain = getRandomValue(10, 5);
            message = `예산 분배 성공! 질서가 향상됩니다. (+${orderGain} 질서)`;
            changes.order = gameState.order + orderGain;
        } else if (rand < 0.7) { // Small Loss
            const orderLoss = getRandomValue(5, 2);
            message = `아쉽게도 분배 실패! 질서가 조금 떨어집니다. (-${orderLoss} 질서)`;
            changes.order = gameState.order - orderLoss;
        } else { // No Change
            message = `예산 분배 결과는 아무것도 아니었습니다.`;
        }
        updateState({ ...changes, currentScenarioId: 'policy_review_menu' }, message);
    },
    optimize_process: () => {
        if (!spendActionPoint()) return;
        let message = "";
        let changes = {};
        const rand = currentRandFn();

        if (rand < 0.2) { // Big Catch (Administration)
            const administrationGain = getRandomValue(3, 1);
            message = `업무 프로세스 최적화 대성공! 행정력을 얻었습니다! (+${administrationGain} 행정력)`;
            changes.resources = { ...gameState.resources, administration: (gameState.resources.administration || 0) + administrationGain };
        } else if (rand < 0.6) { // Normal Catch (Materials)
            const materialsGain = getRandomValue(10, 5);
            message = `자재를 얻었습니다! (+${materialsGain} 자재)`;
            changes.resources = { ...gameState.resources, materials: gameState.resources.materials + materialsGain };
        } else { // No Change
            message = `아쉽게도 아무것도 얻지 못했습니다.`;
        }
        updateState({ ...changes, currentScenarioId: 'policy_review_menu' }, message);
    },
    return_to_intro: () => updateState({ currentScenarioId: 'intro' }),
    play_minigame: () => {
        if (gameState.dailyActions.minigamePlayed) { updateGameDisplay("오늘의 결단은 이미 플레이했습니다."); return; }
        if (!spendActionPoint()) return;

        const minigameIndex = (gameState.day - 1) % minigames.length;
        const minigame = minigames[minigameIndex];

        gameState.currentScenarioId = `minigame_${minigame.name}`;

        updateState({ dailyActions: { ...gameState.dailyActions, minigamePlayed: true } });

        updateGameDisplay(minigame.description);
        minigame.start(document.getElementById('gameArea'), document.getElementById('gameChoices'));
    },
    show_resource_collection_options: () => updateState({ currentScenarioId: 'action_resource_collection' }),
    show_infrastructure_management_options: () => updateState({ currentScenarioId: 'action_infrastructure_management' }),
    show_policy_review_options: () => updateState({ currentScenarioId: 'policy_review_menu' }),
};

function applyStatEffects() {
    let message = "";
    // High Efficiency: Resource collection success chance increase
    if (gameState.efficiency >= 70) {
        gameState.dailyBonus.managementSuccess += 0.1;
        message += "높은 효율성 덕분에 자원 징수 성공률이 증가합니다. ";
    }
    // Low Efficiency: Order decrease
    if (gameState.efficiency < 30) {
        gameState.order = Math.max(0, gameState.order - getRandomValue(5, 2));
        message += "효율성 부족으로 질서가 감소합니다. ";
    }

    // High Order: Action points increase
    if (gameState.order >= 70) {
        gameState.maxActionPoints += 1;
        gameState.actionPoints = gameState.maxActionPoints;
        message += "넘치는 질서 덕분에 행동력이 증가합니다. ";
    }
    // Low Order: Action points decrease
    if (gameState.order < 30) {
        gameState.maxActionPoints = Math.max(5, gameState.maxActionPoints - 1);
        gameState.actionPoints = Math.min(gameState.actionPoints, gameState.maxActionPoints);
        message += "질서 부족으로 행동력이 감소합니다. ";
    }

    // High Productivity: Leadership and Responsibility boost
    if (gameState.productivity >= 70) {
        const leadershipGain = getRandomValue(5, 2);
        const responsibilityGain = getRandomValue(5, 2);
        gameState.leadership = Math.min(100, gameState.leadership + leadershipGain);
        gameState.responsibility = Math.min(100, gameState.responsibility + responsibilityGain);
        message += `당신의 높은 생산성 덕분에 도시의 리더십과 책임감이 향상됩니다! (+${leadershipGain} 리더십, +${responsibilityGain} 책임감) `;
    }
    // Low Productivity: Leadership and Responsibility decrease
    if (gameState.productivity < 30) {
        const leadershipLoss = getRandomValue(5, 2);
        const responsibilityLoss = getRandomValue(5, 2);
        gameState.leadership = Math.max(0, gameState.leadership - leadershipLoss);
        gameState.responsibility = Math.max(0, gameState.responsibility - responsibilityLoss);
        message += "생산성 부족으로 도시의 리더십과 책임감이 흐려집니다. (-${leadershipLoss} 리더십, -${responsibilityLoss} 책임감) ";
    }

    // High Leadership: Efficiency boost or rare resource discovery
    if (gameState.leadership >= 70) {
        const efficiencyGain = getRandomValue(5, 2);
        gameState.efficiency = Math.min(100, gameState.efficiency + efficiencyGain);
        message += "당신의 강력한 리더십 덕분에 새로운 효율성을 불러일으킵니다. (+${efficiencyGain} 효율) ";
        if (currentRandFn() < 0.2) { // 20% chance for administration discovery
            const amount = getRandomValue(1, 1);
            gameState.resources.administration += amount;
            message += `행정력을 발견했습니다! (+${amount} 행정력) `;
        }
    }
    // Low Leadership: Efficiency decrease or action point loss
    if (gameState.leadership < 30) {
        const efficiencyLoss = getRandomValue(5, 2);
        gameState.efficiency = Math.max(0, gameState.efficiency - efficiencyLoss);
        message += "리더십 부족으로 효율성이 감소합니다. (-${efficiencyLoss} 효율) ";
        if (currentRandFn() < 0.1) { // 10% chance for action point loss
            const actionLoss = getRandomValue(1, 0);
            gameState.actionPoints = Math.max(0, gameState.actionPoints - actionLoss);
            message += "비효율적인 경영으로 행동력을 낭비했습니다. (-${actionLoss} 행동력) ";
        }
    }

    // High Responsibility: Citizen trust increase
    if (gameState.responsibility >= 70) {
        gameState.citizens.forEach(c => c.trust = Math.min(100, c.trust + getRandomValue(2, 1)));
        message += "높은 책임감 덕분에 시민들의 신뢰가 깊어집니다. ";
    }
    // Low Responsibility: Citizen trust decrease
    if (gameState.responsibility < 30) {
        gameState.citizens.forEach(c => c.trust = Math.max(0, c.trust - getRandomValue(5, 2)));
        message += "낮은 책임감으로 인해 시민들의 신뢰가 하락합니다. ";
    }

    return message;
}

function generateRandomCitizen() {
    const names = ["존", "메리", "피터", "수잔", "마이클"];
    const personalities = ["성실한", "비판적인", "협력적인", "독립적인"];
    const skills = ["행정", "건설", "생산"];
    const randomId = Math.random().toString(36).substring(2, 9);

    return {
        id: randomId,
        name: names[Math.floor(currentRandFn() * names.length)],
        personality: personalities[Math.floor(currentRandFn() * personalities.length)],
        skill: skills[Math.floor(currentRandFn() * skills.length)],
        trust: 50
    };
}

// --- Daily/Initialization Logic ---
const weightedDailyEvents = [
    { id: "daily_event_budget_audit", weight: 10, condition: () => true, onTrigger: () => {
        const budgetLoss = getRandomValue(10, 5);
        gameScenarios.daily_event_budget_audit.text = `예산 감사 결과, 예산 일부가 삭감되었습니다. (-${budgetLoss} 예산)`;
        updateState({ resources: { ...gameState.resources, budget: Math.max(0, gameState.resources.budget - budgetLoss) } });
    } },
    { id: "daily_event_citizen_complaint", weight: 10, condition: () => true, onTrigger: () => {
        const orderLoss = getRandomValue(10, 5);
        gameScenarios.daily_event_citizen_complaint.text = `시민들의 불만이 폭주하여 도시의 질서가 감소합니다. (-${orderLoss} 질서)`;
        updateState({ order: Math.max(0, gameState.order - orderLoss) });
    } },
    { id: "daily_event_construction_project", weight: 15, condition: () => true },
    { id: "daily_event_resource_shortage", weight: 7, condition: () => true, onTrigger: () => {
        const materialsLoss = getRandomValue(10, 5);
        gameScenarios.daily_event_resource_shortage.text = `자재 부족으로 건설 프로젝트가 지연됩니다. (-${materialsLoss} 자재)`;
        updateState({ resources: { ...gameState.resources, materials: Math.max(0, gameState.resources.materials - materialsLoss) } });
    } },
    { id: "daily_event_citizen_dispute", weight: 15, condition: () => gameState.citizens.length >= 2 },
    { id: "daily_event_new_citizen", weight: 10, condition: () => gameState.cityInfrastructure.cityHall.built && gameState.citizens.length < gameState.maxCitizens, onTrigger: () => {
        const newCitizen = generateRandomCitizen();
        gameState.pendingNewCitizen = newCitizen;
        gameScenarios["daily_event_new_citizen"].text = `새로운 시민 ${newCitizen.name}(${newCitizen.personality}, ${newCitizen.skill})이(가) 도시에 정착하고 싶어 합니다. (현재 시민 수: ${gameState.citizens.length} / ${gameState.maxCitizens})`;
    }},
    { id: "daily_event_external_investment", weight: 10, condition: () => gameState.cityInfrastructure.cityHall.built },
    { id: "daily_event_policy_failure", weight: 15, condition: () => true, onTrigger: () => {
        const leadershipLoss = getRandomValue(10, 5);
        const responsibilityLoss = getRandomValue(5, 2);
        gameScenarios.daily_event_policy_failure.text = `새로운 정책이 실패하여 리더십과 책임감이 감소합니다. (-${leadershipLoss} 리더십, -${responsibilityLoss} 책임감)`;
        updateState({ leadership: Math.max(0, gameState.leadership - leadershipLoss), responsibility: Math.max(0, gameState.responsibility - responsibilityLoss) });
    } },
    { id: "daily_event_leadership_crisis", weight: 12, condition: () => gameState.leadership < 50 },
];

function processDailyEvents() {
    if (gameState.dailyEventTriggered) return;
    currentRandFn = mulberry32(getDailySeed() + gameState.day);

    // Reset daily actions and action points
    updateState({
        actionPoints: 10, // Reset to base maxActionPoints
        maxActionPoints: 10, // Reset maxActionPoints to base
        dailyActions: { inspected: false, reported: false, collected: false, minigamePlayed: false },
        dailyEventTriggered: true,
        dailyBonus: { managementSuccess: 0 } // Reset daily bonus
    });

    // Apply stat effects
    const statEffectMessage = applyStatEffects();

    let skillBonusMessage = "";
    let durabilityMessage = "";

    // Daily skill bonus & durability decay
    gameState.citizens.forEach(c => {
        if (c.skill === '행정') { gameState.resources.administration++; skillBonusMessage += `${c.name}의 행정 기술 덕분에 행정력을 추가로 얻었습니다. `; }
        else if (c.skill === '건설') { gameState.resources.materials++; skillBonusMessage += `${c.name}의 건설 기술 덕분에 자재를 추가로 얻었습니다. `; }
        else if (c.skill === '생산') { gameState.resources.labor++; skillBonusMessage += `${c.name}의 생산 기술 덕분에 노동력을 추가로 얻었습니다. `; }
    });

    Object.keys(gameState.cityInfrastructure).forEach(key => {
        const infra = gameState.cityInfrastructure[key];
        if(infra.built) {
            infra.durability -= 1;
            if(infra.durability <= 0) {
                infra.built = false;
                durabilityMessage += `${key} 기반시설이 파손되었습니다! 보수가 필요합니다. `; 
            }
        }
    });

    gameState.resources.budget -= gameState.citizens.length * 2; // Budget consumption
    let dailyMessage = "새로운 날이 시작되었습니다. ";
    dailyMessage += statEffectMessage + skillBonusMessage + durabilityMessage;
    if (gameState.resources.budget < 0) {
        gameState.efficiency -= 10;
        dailyMessage += "예산이 부족하여 시민들이 불합니다! (-10 효율)";
    } else {
        dailyMessage += "";
    }

    // Check for game over conditions
    if (gameState.efficiency <= 0) { gameState.currentScenarioId = "game_over_efficiency"; }
    else if (gameState.order <= 0) { gameState.currentScenarioId = "game_over_order"; }
    else if (gameState.productivity <= 0) { gameState.currentScenarioId = "game_over_productivity"; }
    else if (gameState.leadership <= 0) { gameState.currentScenarioId = "game_over_leadership"; }
    else if (gameState.responsibility <= 0) { gameState.currentScenarioId = "game_over_responsibility"; }
    else if (gameState.resources.budget < -(gameState.citizens.length * 5)) { gameState.currentScenarioId = "game_over_resources"; }

    // --- New Weighted Random Event Logic ---
    let eventId = "intro";
    const possibleEvents = weightedDailyEvents.filter(event => !event.condition || event.condition());
    const totalWeight = possibleEvents.reduce((sum, event) => sum + event.weight, 0);
    const rand = currentRandFn() * totalWeight;

    let cumulativeWeight = 0;
    let chosenEvent = null;

    for (const event of possibleEvents) {
        cumulativeWeight += event.weight;
        if (rand < cumulativeWeight) {
            chosenEvent = event;
            break;
        }
    }

    if (chosenEvent) {
        eventId = chosenEvent.id;
        if (chosenEvent.onTrigger) {
            chosenEvent.onTrigger();
        }
    }

    gameState.currentScenarioId = eventId;
    updateGameDisplay(dailyMessage + (gameScenarios[eventId]?.text || ''));
    renderChoices(gameScenarios[eventId].choices);
    saveGameState();
}

function initDailyGame() {
    loadGameState();
}

function resetGame() {
    if (confirm("정말로 도시 경영을 포기하시겠습니까? 모든 노력이 사라집니다.")) {
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