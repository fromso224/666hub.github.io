const room = new WebsimSocket();

// DOM Elements
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
const usernameDisplay = document.getElementById('username');
const coinCountDisplay = document.getElementById('coin-count');
// const updateBannerText = document.getElementById('update-banner-text'); // Removed

// Shop Buttons
const buyNukeButton = document.getElementById('buy-nuke');
const buyFreezeButton = document.getElementById('buy-freeze');
const buyGlitchButton = document.getElementById('buy-glitch');
const buySharkAttackButton = document.getElementById('buy-shark');
const buyFloodButton = document.getElementById('buy-flood');
const buyMoneyDropButton = document.getElementById('buy-money-drop');
const buyAcidButton = document.getElementById('buy-acid');
const buyShootingStarButton = document.getElementById('buy-shooting-star');
const buyRainingButton = document.getElementById('buy-raining');
const buyLavaButton = document.getElementById('buy-lava');

// Shop Tabs
const showEventsTabButton = document.getElementById('show-events-tab');
const showSkinsTabButton = document.getElementById('show-skins-tab');
const showCratesTabButton = document.getElementById('show-crates-tab');
const shopEventsSection = document.getElementById('shop-events');
const shopSkinsSection = document.getElementById('shop-skins');
const shopCratesSection = document.getElementById('shop-crates');

// Effect Elements
const nukeFlash = document.getElementById('nuke-flash');
const nukeExplosion = document.getElementById('nuke-explosion');
const nukeSmoke = document.getElementById('nuke-smoke');
const floodWater = document.getElementById('flood-water');
const freezeOverlay = document.getElementById('freeze-overlay');
const acidOverlay = document.getElementById('acid-overlay');
const sharkAttackOverlay = document.getElementById('shark-attack-overlay');
const shootingStarOverlay = document.getElementById('shooting-star-overlay');
const rainingOverlay = document.getElementById('raining-overlay');
const rainContainer = document.getElementById('rain-container');
const risingWater = document.getElementById('rising-water');
const crateRewardOverlay = document.getElementById('crate-reward-overlay');
const crateRewardItem = document.getElementById('crate-reward-item');
const lavaOverlay = document.getElementById('lava-overlay');
const body = document.body;

// New Elements for Money Crate
const buyMoneyCrateButton = document.getElementById('buy-money-crate');
const moneyRainOverlay = document.getElementById('money-rain-overlay');

// Game Promo Modal Elements
const gamePromoModal = document.getElementById('game-promo-modal');
const promoYesButton = document.getElementById('promo-yes-button');
const promoNoButton = document.getElementById('promo-no-button');

// --- State ---
let myClientId = null;
let likedMessages = new Set(); // Track messages liked by the current client locally
let glitchTimeout = null; // To store the timeout ID for glitch
let nukeTimeout = null; // To store the timeout ID for nuke
let floodTimeout = null; // To store the timeout ID for flood
let freezeTimeout = null; // To store the timeout ID for freeze
let acidTimeout = null; // To store the timeout ID for acid
let sharkAttackTimeout = null; // To store the timeout ID for shark attack
let shootingStarTimeout = null; // To store the timeout ID for shooting star
let rainingTimeout = null; // To store the timeout ID for raining
let crateRewardTimeout = null; // To store the timeout ID for crate reward display
let lavaTimeout = null;
let moneyRainTimeout = null; // Timeout for money rain event

// --- Constants ---
const COIN_REWARD_PER_LIKE = 10;
const MONEY_DROP_AMOUNT = 500;
const DEFAULT_SKIN = 'default';
const STORAGE_KEY = 'chatbloxUserData';
const MONEY_CRATE_COST = 20;
const MONEY_RAIN_EVENT_COIN_REWARD = 1000;

// --- Initialization ---
async function initializeApp() {
    await room.initialize();
    myClientId = room.clientId;

    // Load user data from localStorage
    const savedUserData = loadUserData();

    // Initialize presence if not set or missing fields
    const currentPresence = room.presence[myClientId] || {};
    let initialOwnedSkins = savedUserData.ownedSkins || { [DEFAULT_SKIN]: true };
    delete initialOwnedSkins['barn'];
    if ('coin' in initialOwnedSkins) { // Migration from 'coin' to 'gold'
        initialOwnedSkins['gold'] = initialOwnedSkins['coin'];
        delete initialOwnedSkins['coin'];
    }

    const defaultPresence = {
        coins: savedUserData.coins || 0,
        equippedSkin: savedUserData.equippedSkin === 'barn' ? DEFAULT_SKIN : (savedUserData.equippedSkin === 'coin' ? 'gold' : (savedUserData.equippedSkin || DEFAULT_SKIN)), // Migration for equippedSkin
        ownedSkins: initialOwnedSkins
    };
    room.updatePresence({ ...defaultPresence, ...currentPresence });

    // Initialize room state if not set
    const updatesToRoomState = {};
    if (!room.roomState.messages) {
        updatesToRoomState.messages = {};
    }

    if (Object.keys(updatesToRoomState).length > 0) {
        room.updateRoomState(updatesToRoomState);
    }

    usernameDisplay.textContent = room.peers[myClientId]?.username || 'User';

    // Enable chat now that we are initialized
    chatInput.disabled = false;
    sendButton.disabled = false;

    setupListeners();
    subscribeToUpdates();

    renderMessages(); // Initial render
    updateCoinDisplay(); // Initial render
    updateShopUI(); // Check initial button states and skin UI
    showGamePromoModal(); // Show the game promo modal
}

// --- Local Storage Utilities ---
function saveUserData() {
    const presence = room.presence[myClientId];
    if (!presence) return;

    const ownedSkinsToSave = {...(presence.ownedSkins || { [DEFAULT_SKIN]: true })};
    delete ownedSkinsToSave['barn'];
    // Ensure new skins are included if they exist
    if (ownedSkinsToSave['gold'] === undefined && presence.ownedSkins?.['gold']) ownedSkinsToSave['gold'] = true; // Renamed from 'coin'
    if (ownedSkinsToSave['dollarbill'] === undefined && presence.ownedSkins?.['dollarbill']) ownedSkinsToSave['dollarbill'] = true;
    if ('coin' in ownedSkinsToSave) { // Migration
        delete ownedSkinsToSave['coin'];
    }

    let equippedSkinToSave = presence.equippedSkin === 'barn' ? DEFAULT_SKIN : (presence.equippedSkin || DEFAULT_SKIN);
    if (equippedSkinToSave === 'coin') equippedSkinToSave = 'gold'; // Migration

    const userData = {
        coins: presence.coins || 0,
        equippedSkin: equippedSkinToSave,
        ownedSkins: ownedSkinsToSave
    };

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
        console.log('User data saved to localStorage');
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
}

function loadUserData() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            const userData = JSON.parse(data);
            if (userData.ownedSkins) {
                delete userData.ownedSkins['barn'];
                if ('coin' in userData.ownedSkins) { // Migration
                    userData.ownedSkins['gold'] = userData.ownedSkins['coin'];
                    delete userData.ownedSkins['coin'];
                }
            }
            if (userData.equippedSkin === 'barn') {
                userData.equippedSkin = DEFAULT_SKIN;
            } else if (userData.equippedSkin === 'coin') { // Migration
                 userData.equippedSkin = 'gold';
            }
            // Ensure new skins are loaded correctly or defaulted
            if (!userData.ownedSkins) userData.ownedSkins = {};
            if (userData.ownedSkins.gold === undefined) userData.ownedSkins.gold = false; // Renamed from 'coin'
            if (userData.ownedSkins.dollarbill === undefined) userData.ownedSkins.dollarbill = false;

            console.log('User data loaded from localStorage');
            return userData;
        }
    } catch (error) {
        console.error('Error loading from localStorage:', error);
    }
    // Default values for new skins if not present
    const defaultOwnedSkins = { [DEFAULT_SKIN]: true, 'gold': false, 'dollarbill': false }; // Renamed 'coin' to 'gold'
    return { coins: 0, equippedSkin: DEFAULT_SKIN, ownedSkins: defaultOwnedSkins };
}

// --- Event Listeners & Subscriptions ---
function setupListeners() {
    sendButton.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Shop Event Buttons
    buyMoneyDropButton.addEventListener('click', handleBuyEvent);
    buyNukeButton.addEventListener('click', handleBuyEvent);
    buyFreezeButton.addEventListener('click', handleBuyEvent);
    buyGlitchButton.addEventListener('click', handleBuyEvent);
    buyAcidButton.addEventListener('click', handleBuyEvent);
    buySharkAttackButton.addEventListener('click', handleBuyEvent);
    buyFloodButton.addEventListener('click', handleBuyEvent);
    buyShootingStarButton.addEventListener('click', handleBuyEvent);
    buyRainingButton.addEventListener('click', handleBuyEvent);
    buyLavaButton.addEventListener('click', handleBuyEvent);

    // Shop Crate Buttons
    if (buyMoneyCrateButton) {
        buyMoneyCrateButton.addEventListener('click', handleBuyMoneyCrate);
    }

    // Shop Tab Buttons
    showEventsTabButton.addEventListener('click', () => showShopSection('events'));
    showSkinsTabButton.addEventListener('click', () => showShopSection('skins'));
    showCratesTabButton.addEventListener('click', () => showShopSection('crates'));

    // Shop Skin Buttons (using event delegation on the container)
    shopSkinsSection.addEventListener('click', (event) => {
        if (event.target.classList.contains('buy-skin-button')) {
            handleBuySkin(event.target);
        } else if (event.target.classList.contains('equip-skin-button')) {
            handleEquipSkin(event.target);
        }
    });

    // Game Promo Modal Buttons
    if (promoYesButton) {
        promoYesButton.addEventListener('click', handlePromoYes);
    }
    if (promoNoButton) {
        promoNoButton.addEventListener('click', handlePromoNo);
    }
}

function subscribeToUpdates() {
    room.subscribePresence(handlePresenceUpdate);
    room.subscribeRoomState(handleRoomStateUpdate);
    room.subscribePresenceUpdateRequests(handlePresenceUpdateRequest);
    room.onmessage = handleBroadcastEvent;
}

// --- Update Handlers ---
function handlePresenceUpdate(presence) {
    if (presence[myClientId]) {
        const currentEquipped = presence[myClientId].equippedSkin;
        const ownedSkins = presence[myClientId].ownedSkins || {};
        
        let effectiveEquippedSkin = currentEquipped;
        if (currentEquipped === 'coin') effectiveEquippedSkin = 'gold'; // Migration

        if (effectiveEquippedSkin === 'barn' || !ownedSkins[effectiveEquippedSkin]) {
            room.updatePresence({ equippedSkin: DEFAULT_SKIN });
        } else {
            updateCoinDisplay();
            updateShopUI(); 
            saveUserData(); 
        }
    }
    renderMessages();
}

function handleRoomStateUpdate(roomState) {
    if (roomState.messages) {
        renderMessages();
    }
}

function handlePresenceUpdateRequest(updateRequest, fromClientId) {
    if (updateRequest.type === 'addCoins') {
        const currentCoins = room.presence[myClientId]?.coins || 0;
        const amount = updateRequest.amount || 0;
        room.updatePresence({ coins: currentCoins + amount });
    }
}

function handleBroadcastEvent(event) {
    const data = event.data;
    console.log("Received broadcast:", data); 
    switch (data.type) {
        case 'moneyDrop':
            triggerMoneyDropEffect(data.amount || MONEY_DROP_AMOUNT, data.buyerName);
            break;
        case 'nuke':
            triggerNukeEffect();
            break;
        case 'glitch':
            triggerGlitchEffect();
            break;
        case 'flood':
            triggerFloodEffect();
            break;
        case 'freeze':
            triggerFreezeEffect();
            break;
        case 'acid':
            triggerAcidEffect();
            break;
        case 'sharkAttack':
            triggerSharkAttackEffect();
            break;
        case 'shootingStar':
            triggerShootingStarEffect();
            break;
        case 'raining':
            triggerRainingEffect();
            break;
        case 'lava':
            triggerLavaEffect();
            break;
        case 'moneyRain':
            triggerMoneyRainEffect(data.buyerName);
            break;
        case 'connected':
            console.log(`User connected: ${data.username}`);
            // Check if the connected user is the current client to avoid duplicate messages
            // or decide if this message is still valuable.
            // For simplicity, let's assume system messages are fine for all connections.
            // addSystemMessage(`${data.username} joined the chat.`);
            break;
        case 'disconnected':
            console.log(`User disconnected: ${data.username}`);
            addSystemMessage(`${data.username} left the chat.`);
            break;
        default:
            console.log('Received unknown event:', data);
    }
}

// --- Core Logic ---
function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    const messageId = `${myClientId}-${Date.now()}`;
    const authorInfo = room.peers[myClientId] || { username: 'Unknown' };

    const newMessage = {
        text: text,
        authorId: myClientId,
        authorName: authorInfo.username,
        likes: 0,
        timestamp: Date.now(),
    };

    const currentMessages = room.roomState.messages || {};
    room.updateRoomState({
        messages: {
            ...currentMessages,
            [messageId]: newMessage
        }
    });

    chatInput.value = '';
    chatInput.focus();
}

function addSystemMessage(text) {
    const messageId = `system-${Date.now()}`;
    const systemMessage = {
        text: text,
        authorId: 'system',
        authorName: 'System',
        timestamp: Date.now(),
        isSystem: true, 
    };
    const currentMessages = room.roomState.messages || {};
    room.updateRoomState({
        messages: {
            ...currentMessages,
            [messageId]: systemMessage
        }
    });
}

function likeMessage(messageId) {
    const message = room.roomState.messages[messageId];
    if (!message || message.authorId === myClientId || likedMessages.has(messageId) || message.authorId === 'system') {
        console.log("Cannot like own message, system message or already liked message.");
        return;
    }

    likedMessages.add(messageId); 

    room.updateRoomState({
        messages: {
            [messageId]: { 
                likes: (message.likes || 0) + 1
            }
        }
    });

    room.requestPresenceUpdate(message.authorId, { type: 'addCoins', amount: COIN_REWARD_PER_LIKE });

    renderMessages(); 
}

function handleBuyEvent(event) {
    const button = event.target;
    const cost = parseInt(button.dataset.cost, 10);
    const eventType = button.dataset.event;
    const currentCoins = room.presence[myClientId]?.coins || 0;
    const myUsername = room.peers[myClientId]?.username || 'Someone';

    if (currentCoins >= cost) {
        room.updatePresence({ coins: currentCoins - cost });

        const eventData = { type: eventType };
        if (eventType === 'moneyDrop') {
            eventData.amount = MONEY_DROP_AMOUNT;
            eventData.buyerName = myUsername;
        } else if (eventType === 'lava') {
            // No extra data needed for lava event
        }
        // Note: 'moneyRain' event is handled by handleBuyMoneyCrate and then broadcasted

        room.send(eventData);

    } else {
        alert("Not enough coins!");
    }
}

function handleBuySkin(button) {
    const cost = parseInt(button.dataset.cost, 10);
    const skinId = button.dataset.skinId;
    const currentPresence = room.presence[myClientId];
    const currentCoins = currentPresence?.coins || 0;
    let currentOwnedSkins = currentPresence?.ownedSkins || { [DEFAULT_SKIN]: true }; 

    // Ensure new skins are part of the check, though they are primarily crate rewards
    if (currentOwnedSkins.gold === undefined) currentOwnedSkins.gold = false; // Renamed from 'coin'
    if (currentOwnedSkins.dollarbill === undefined) currentOwnedSkins.dollarbill = false;

    if (skinId === 'barn' || skinId === 'barn-run') return;

    if (!currentOwnedSkins[skinId] && currentCoins >= cost) { 
        const newOwnedSkins = { ...currentOwnedSkins, [skinId]: true };
        const updates = {
            coins: currentCoins - cost,
            ownedSkins: newOwnedSkins
        };

        if (!currentPresence.equippedSkin || currentPresence.equippedSkin === DEFAULT_SKIN) {
            updates.equippedSkin = skinId;
        }

        if (updates.equippedSkin === 'coin') updates.equippedSkin = 'gold'; // Migration
        room.updatePresence(updates);
        // Add to shop UI if not already there (updateShopUI should handle this mostly)
        // For crate-exclusive skins, ensure they are added if won.
        const skinDetails = {
            'gold': { name: 'Gold Skin', cost: 0 }, // Renamed from 'coin'
            'dollarbill': { name: 'Dollar Bill Skin', cost: 0 }
        };
        if (skinDetails[skinId] && !shopSkinsSection.querySelector(`.skin-item[data-skin-id="${skinId}"]`)) {
             addSkinToShop(skinId, skinDetails[skinId].name, skinDetails[skinId].cost, true);
        }
    } else if (currentOwnedSkins[skinId]) {
        console.log("Skin already owned.");
        if (currentPresence.equippedSkin !== skinId) {
            handleEquipSkin(button);
        }
    } else {
        alert("Not enough coins!");
    }
}

function handleEquipSkin(button) {
    const skinId = button.dataset.skinId;
    const currentPresence = room.presence[myClientId];

    if (skinId === 'barn' || skinId === 'barn-run') return;
    // Ensure new skins can be equipped
    if (currentPresence?.ownedSkins?.[skinId] && currentPresence.equippedSkin !== skinId) {
        if (skinId === 'coin') skinId = 'gold'; // Migration
        room.updatePresence({ equippedSkin: skinId });
    }
}

// --- Crate Logic ---
function handleBuyMoneyCrate() {
    const currentCoins = room.presence[myClientId]?.coins || 0;
    const myUsername = room.peers[myClientId]?.username || 'Someone';

    if (currentCoins >= MONEY_CRATE_COST) {
        room.updatePresence({ coins: currentCoins - MONEY_CRATE_COST });

        const rand = Math.random();
        let rewardType, rewardName, rewardDetailsClass, rewardAction;

        if (rand < 0.05) { // 5% chance for Money Rain Event
            rewardType = 'event';
            rewardName = 'Money Rain Event!';
            rewardDetailsClass = 'reward-rare reward-event';
            rewardAction = () => {
                room.send({ type: 'moneyRain', buyerName: myUsername });
            };
        } else if (rand < 0.20) { // 15% chance for Dollar Bill Skin (0.05 + 0.15 = 0.20)
            rewardType = 'skin';
            rewardName = 'Dollar Bill Skin';
            rewardDetailsClass = 'reward-rare reward-skin';
            rewardAction = () => awardSkin('dollarbill');
        } else if (rand < 0.50) { // 30% chance for Gold Skin (0.20 + 0.30 = 0.50)
            rewardType = 'skin';
            rewardName = 'Gold Skin'; // Renamed from Coin Skin
            rewardDetailsClass = 'reward-skin';
            rewardAction = () => awardSkin('gold'); // Renamed from 'coin'
        } else { // 50% chance for 50 Coins
            rewardType = 'coins';
            rewardName = '50 Coins';
            rewardDetailsClass = 'reward-coins';
            rewardAction = () => {
                const currentCoins = room.presence[myClientId]?.coins || 0;
                room.updatePresence({ coins: currentCoins + 50 });
            };
        }

        displayCrateReward(rewardName, rewardDetailsClass);
        if (rewardAction) rewardAction();

    } else {
        alert("Not enough coins for Money Crate!");
    }
}

function awardSkin(skinId) {
    const currentPresence = room.presence[myClientId];
    let currentOwnedSkins = currentPresence?.ownedSkins || { [DEFAULT_SKIN]: true };

    if (!currentOwnedSkins[skinId]) {
        const newOwnedSkins = { ...currentOwnedSkins, [skinId]: true };
        const updates = { ownedSkins: newOwnedSkins };
        // Optionally auto-equip new skin if default is equipped or no skin
        if (!currentPresence.equippedSkin || currentPresence.equippedSkin === DEFAULT_SKIN) {
            updates.equippedSkin = skinId;
        }
        room.updatePresence(updates);
        // Add to shop UI if not already there (updateShopUI should handle this mostly)
        // For crate-exclusive skins, ensure they are added if won.
        const skinDetails = {
            'gold': { name: 'Gold Skin', cost: 0 }, // Renamed from 'coin'
            'dollarbill': { name: 'Dollar Bill Skin', cost: 0 }
        };
        if (skinDetails[skinId] && !shopSkinsSection.querySelector(`.skin-item[data-skin-id="${skinId}"]`)) {
             addSkinToShop(skinId, skinDetails[skinId].name, skinDetails[skinId].cost, true);
        }
    }
}

function displayCrateReward(rewardName, rewardDetailsClass) {
    if (crateRewardTimeout) clearTimeout(crateRewardTimeout);
    crateRewardOverlay.classList.remove('hidden');
    crateRewardItem.innerHTML = `<span class="${rewardDetailsClass}">${rewardName}</span>`;

    // Trigger reflow for animation restart if overlay was already visible
    crateRewardOverlay.style.animation = 'none';
    void crateRewardOverlay.offsetHeight; // Trigger reflow
    crateRewardOverlay.style.animation = null;

    const rewardContainer = crateRewardOverlay.querySelector('#crate-reward-container');
    if (rewardContainer) {
        rewardContainer.style.animation = 'none';
        void rewardContainer.offsetHeight;
        rewardContainer.style.animation = null; // Restart shine animations
    }

    crateRewardTimeout = setTimeout(() => {
        crateRewardOverlay.classList.add('hidden');
    }, 5000);
}

// --- UI Updates ---
function showShopSection(section) {
    shopEventsSection.classList.add('hidden');
    shopSkinsSection.classList.add('hidden');
    shopCratesSection.classList.add('hidden');

    showEventsTabButton.classList.remove('active');
    showSkinsTabButton.classList.remove('active');
    showCratesTabButton.classList.remove('active');

    if (section === 'events') {
        shopEventsSection.classList.remove('hidden');
        showEventsTabButton.classList.add('active');
    } else if (section === 'skins') {
        shopSkinsSection.classList.remove('hidden');
        showSkinsTabButton.classList.add('active');
    } else if (section === 'crates') {
        shopCratesSection.classList.remove('hidden');
        showCratesTabButton.classList.add('active');
    }
}

// --- Rendering ---
function renderMessages() {
    const messages = room.roomState.messages || {};
    const sortedMessageIds = Object.keys(messages).sort((a, b) => messages[a].timestamp - messages[b].timestamp);

    chatMessages.innerHTML = ''; 

    sortedMessageIds.forEach(id => {
        const msg = messages[id];
        if (!msg) return; 

        const messageEl = document.createElement('div');
        messageEl.classList.add('message');

        if (msg.isSystem) {
            messageEl.classList.add('system-message');
            const textEl = document.createElement('span');
            textEl.textContent = msg.text;
            messageEl.appendChild(textEl);
            chatMessages.appendChild(messageEl);
            return; 
        }

        const authorPresence = room.presence[msg.authorId];
        let equippedSkin = authorPresence?.equippedSkin || DEFAULT_SKIN;

        // Ensure skins like 'gold' or 'dollarbill' are valid even if not in the initial HTML list
        const validSkins = [DEFAULT_SKIN, 'rainbow', 'acid', 'starry', 'floody', 'lava', 'gold', 'dollarbill']; // Renamed 'coin' to 'gold'

        if (equippedSkin === 'barn' || equippedSkin === 'coin' || !authorPresence?.ownedSkins?.[equippedSkin] || !validSkins.includes(equippedSkin)) { 
            if (equippedSkin === 'coin' && authorPresence?.ownedSkins?.['gold']) { // Migration for display
                 equippedSkin = 'gold';
            } else {
                equippedSkin = DEFAULT_SKIN;
            }
        }
        const skinClass = `skin-${equippedSkin}`;

        messageEl.classList.add(skinClass);
        if (msg.authorId === myClientId) {
            messageEl.classList.add('own-message');
        }

        const authorEl = document.createElement('div');
        authorEl.classList.add('message-author');
        authorEl.textContent = msg.authorName || 'Unknown';

        const contentWrapper = document.createElement('div');
        contentWrapper.classList.add('message-content');

        const textEl = document.createElement('span');
        textEl.textContent = msg.text;

        const likeContainer = document.createElement('div');
        likeContainer.style.display = 'flex';
        likeContainer.style.alignItems = 'center';
        likeContainer.style.marginLeft = '10px';
        likeContainer.style.flexShrink = '0'; // Prevent shrinking

        const likeButton = document.createElement('button');
        likeButton.classList.add('like-button');
        likeButton.textContent = '❤️'; // Use heart emoji
        if (msg.authorId === myClientId || likedMessages.has(id) || msg.authorId === 'system') {
            likeButton.disabled = true;
            likeButton.style.cursor = 'default';
            if (likedMessages.has(id)) {
                 likeButton.classList.add('liked');
                 likeButton.style.opacity = '1'; // Ensure liked heart is visible
            } else if(msg.authorId === myClientId || msg.authorId === 'system') {
                likeButton.style.opacity = '0.5'; // Dim the heart for unlikable messages
            }
        } else {
            likeButton.onclick = () => likeMessage(id);
        }

        const likeCount = document.createElement('span');
        likeCount.classList.add('like-count');
        likeCount.textContent = `(${(msg.likes || 0)})`;

        likeContainer.appendChild(likeButton);
        likeContainer.appendChild(likeCount);

        contentWrapper.appendChild(textEl);
        contentWrapper.appendChild(likeContainer);

        messageEl.appendChild(authorEl);
        messageEl.appendChild(contentWrapper);

        chatMessages.appendChild(messageEl);
    });

    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateCoinDisplay() {
    const myCoins = room.presence[myClientId]?.coins || 0;
    coinCountDisplay.textContent = myCoins;
}

function updateShopUI() {
    const myPresence = room.presence[myClientId];
    if (!myPresence) return; 

    const myCoins = myPresence.coins || 0;
    let myOwnedSkins = myPresence.ownedSkins || {};
    const myEquippedSkin = myPresence.equippedSkin || DEFAULT_SKIN;

    // Ensure new skins are part of checks
    if (myOwnedSkins.gold === undefined) myOwnedSkins.gold = false; // Renamed from 'coin'
    if (myOwnedSkins.dollarbill === undefined) myOwnedSkins.dollarbill = false;
    if ('coin' in myOwnedSkins) { // Migration for shop UI
        myOwnedSkins.gold = myOwnedSkins.coin;
        delete myOwnedSkins.coin;
    }

    const eventButtons = shopEventsSection.querySelectorAll('button[data-cost][data-event]');
    eventButtons.forEach(button => {
        const cost = parseInt(button.dataset.cost, 10);
        button.disabled = myCoins < cost;
    });

    const skinItems = shopSkinsSection.querySelectorAll('.skin-item');
    skinItems.forEach(item => {
        const skinId = item.dataset.skinId;

        if (skinId === 'barn' || skinId === 'barn-run') {
            item.remove();
            return; 
        }
        // Add new skins to the shop if owned and not present
        if (myOwnedSkins['gold'] && skinId === 'gold' && !item.querySelector('.equip-skin-button')) { // Renamed from 'coin'
             if (!shopSkinsSection.querySelector(`.skin-item[data-skin-id="gold"]`)) { // Renamed from 'coin'
                addSkinToShop('gold', 'Gold Skin', 0, true); // Renamed from 'coin'
             }
        }
        if (myOwnedSkins['dollarbill'] && skinId === 'dollarbill' && !item.querySelector('.equip-skin-button')) {
             if (!shopSkinsSection.querySelector(`.skin-item[data-skin-id="dollarbill"]`)) {
                addSkinToShop('dollarbill', 'Dollar Bill Skin', 0, true);
             }
        }

        const buyButton = item.querySelector('.buy-skin-button');
        const equipButton = item.querySelector('.equip-skin-button');

        const isOwned = !!myOwnedSkins[skinId];
        const isEquipped = myEquippedSkin === skinId;

        if (buyButton) {
            const cost = parseInt(buyButton.dataset.cost, 10);
            buyButton.disabled = myCoins < cost || isOwned;
            buyButton.style.display = isOwned ? 'none' : 'inline-block';
            buyButton.textContent = `Buy (${cost})`;
        }

        if (equipButton) {
            equipButton.style.display = isOwned ? 'inline-block' : 'none';
            equipButton.disabled = isEquipped;
            equipButton.textContent = isEquipped ? 'Equipped' : 'Equip';
        }
    });

    const barnRunSkinId = 'barn-run';
    if (myOwnedSkins[barnRunSkinId] && !shopSkinsSection.querySelector(`.skin-item[data-skin-id="${barnRunSkinId}"]`)) {
        // This skin is no longer available through crates, but this logic remains if it were.
        // addSkinToShop(barnRunSkinId, 'Barn Run Skin', 0, true); 
    }

    // Handle Money Crate display
    const moneyCrateItem = shopCratesSection.querySelector('.shop-item[data-crate-id="moneyCrate"]');
    const noCratesMsg = shopCratesSection.querySelector('.no-crates-message');

    if (moneyCrateItem) {
        moneyCrateItem.style.display = 'flex'; // Show the money crate
        const buyMoneyCrateBtn = moneyCrateItem.querySelector('button');
        if (buyMoneyCrateBtn) {
            buyMoneyCrateBtn.disabled = myCoins < MONEY_CRATE_COST;
        }
        if (noCratesMsg) noCratesMsg.style.display = 'none'; // Hide "no crates" message
        // Hide the generic "Try your luck..." message if a specific crate is shown
        const genericCrateText = shopCratesSection.querySelector('p:first-of-type:not(.no-crates-message)');
        if(genericCrateText) genericCrateText.style.display = 'none';

    } else {
        if (noCratesMsg) noCratesMsg.style.display = 'block'; // Show "no crates" if money crate isn't defined
        const genericCrateText = shopCratesSection.querySelector('p:first-of-type:not(.no-crates-message)');
        if(genericCrateText) genericCrateText.style.display = 'block';

    }
}

function addSkinToShop(skinId, skinName, cost, alreadyOwned = false) {
    if (skinId === 'barn' || skinId === 'barn-run') return;

    if (shopSkinsSection.querySelector(`.skin-item[data-skin-id="${skinId}"]`)) {
        // If item exists, just update its state based on alreadyOwned
        const item = shopSkinsSection.querySelector(`.skin-item[data-skin-id="${skinId}"]`);
        const buyButton = item.querySelector('.buy-skin-button');
        const equipButton = item.querySelector('.equip-skin-button');
        if (alreadyOwned) {
            if (buyButton) buyButton.style.display = 'none';
            if (equipButton) equipButton.style.display = 'inline-block';
        }
        return; 
    }

    const skinItem = document.createElement('div');
    skinItem.className = 'shop-item skin-item';
    skinItem.dataset.skinId = skinId;

    let displayName = skinName;
    if (skinId === 'gold') displayName = 'Gold Skin'; // Ensure correct display name

    const nameSpan = document.createElement('span');
    nameSpan.textContent = displayName + (cost > 0 && !alreadyOwned ? ` (Cost: ${cost} Coins)` : (alreadyOwned && skinId === 'gold' ? ' (Crate Only)' : ''));
    if (skinId === 'dollarbill' && alreadyOwned) nameSpan.textContent = 'Dollar Bill Skin (Crate Only)';


    const equipButton = document.createElement('button');
    equipButton.className = 'equip-skin-button';
    equipButton.dataset.skinId = skinId;
    equipButton.textContent = 'Equip';
    equipButton.style.display = alreadyOwned ? 'inline-block' : 'none';
    
    let buyButton = null;
    if (!alreadyOwned && cost > 0) {
        buyButton = document.createElement('button');
        buyButton.className = 'buy-skin-button';
        buyButton.dataset.cost = cost;
        buyButton.dataset.skinId = skinId;
        buyButton.textContent = `Buy (${cost})`;
    }
    
    skinItem.appendChild(nameSpan);
    if (buyButton) skinItem.appendChild(buyButton);
    skinItem.appendChild(equipButton);
    
    shopSkinsSection.appendChild(skinItem);
}

// --- Visual Effects ---
function triggerMoneyDropEffect(amount, buyerName) {
    console.log(`Triggering Money Drop Effect (${amount} coins) initiated by ${buyerName}`);

    const coinShower = document.createElement('div');
    coinShower.classList.add('coin-shower');
    for (let i = 0; i < 30; i++) {
        const coin = document.createElement('div');
        coin.classList.add('coin');
        coin.style.left = `${Math.random() * 100}vw`;
        coin.style.animationDelay = `${Math.random() * 0.5}s`; 
        coin.style.animationDuration = `${4 + Math.random() * 0.8}s`; 
        coinShower.appendChild(coin);
    }
    document.body.appendChild(coinShower);

    setTimeout(() => {
        coinShower.remove();
    }, 5000); 

    setTimeout(() => {
        const currentCoins = room.presence[myClientId]?.coins || 0;
        room.updatePresence({ coins: currentCoins + amount });

        addSystemMessage(`${buyerName} initiated a Money Drop! Everyone received ${amount} coins!`);
    }, 5000); 
}

function triggerNukeEffect() {
    console.log("Triggering Nuke Effect (10 seconds)");
    if (nukeTimeout) clearTimeout(nukeTimeout);

    nukeFlash.classList.remove('hidden');
    nukeExplosion.classList.remove('hidden');
    nukeSmoke.classList.remove('hidden');

    body.classList.add('nuke-active');

    void nukeExplosion.offsetWidth;
    void nukeSmoke.offsetWidth;

    nukeTimeout = setTimeout(() => {
        nukeFlash.classList.add('hidden');
        nukeExplosion.classList.add('hidden');
        nukeSmoke.classList.add('hidden');
        body.classList.remove('nuke-active');
        nukeTimeout = null;
    }, 10000); 
}

function triggerGlitchEffect() {
    console.log("Triggering Glitch Effect (10 seconds)");
    if (glitchTimeout) clearTimeout(glitchTimeout);

    const x = (Math.random() - 0.5) * 10;
    const y = (Math.random() - 0.5) * 10;
    body.style.setProperty('--glitch-x', `${x}px`);
    body.style.setProperty('--glitch-y', `${y}px`);

    body.classList.add('glitch-active');

    glitchTimeout = setTimeout(() => {
        body.classList.remove('glitch-active');
        body.style.removeProperty('--glitch-x');
        body.style.removeProperty('--glitch-y');
        body.style.transform = '';
        body.style.filter = '';
        body.style.textShadow = '';
        glitchTimeout = null;
    }, 10000);
}

function triggerFloodEffect() {
    console.log("Triggering Flood Effect (15 seconds)");
    if (floodTimeout) clearTimeout(floodTimeout);

    floodWater.classList.remove('hidden');
    body.classList.add('flood-active');

    floodTimeout = setTimeout(() => {
        body.classList.remove('flood-active');
        floodWater.classList.add('hidden');
        floodTimeout = null;
    }, 15000);
}

function triggerFreezeEffect() {
    console.log("Triggering Freeze Effect (10 seconds)");
    if (freezeTimeout) clearTimeout(freezeTimeout);

    chatInput.disabled = true;
    sendButton.disabled = true;

    freezeOverlay.classList.remove('hidden');
    body.classList.add('freeze-active');

    freezeTimeout = setTimeout(() => {
        body.classList.remove('freeze-active');
        freezeOverlay.classList.add('hidden');

        if (!body.classList.contains('freeze-active') && !body.classList.contains('glitch-active')) {
            chatInput.disabled = false;
            sendButton.disabled = false;
        }
        freezeTimeout = null;
    }, 10000); 
}

function triggerAcidEffect() {
    console.log("Triggering Acid Effect (10 seconds)");
    if (acidTimeout) clearTimeout(acidTimeout);

    acidOverlay.classList.remove('hidden');
    body.classList.add('acid-active');

    void acidOverlay.offsetWidth;

    acidTimeout = setTimeout(() => {
        body.classList.remove('acid-active');
        acidOverlay.classList.add('hidden');
        acidTimeout = null;
    }, 10000); 
}

function triggerSharkAttackEffect() {
    console.log("Triggering Shark Attack Effect (10 seconds)");
    if (sharkAttackTimeout) clearTimeout(sharkAttackTimeout);

    sharkAttackOverlay.classList.remove('hidden');
    body.classList.add('shark-active');

    const sharks = sharkAttackOverlay.querySelectorAll('.shark');
    sharks.forEach(shark => void shark.offsetWidth);

    sharkAttackTimeout = setTimeout(() => {
        body.classList.remove('shark-active');
        sharkAttackOverlay.classList.add('hidden');
        sharkAttackTimeout = null;
    }, 10000);
}

function triggerShootingStarEffect() {
    console.log("Triggering Shooting Star Effect (10 seconds)");
    if (shootingStarTimeout) clearTimeout(shootingStarTimeout);

    shootingStarOverlay.classList.remove('hidden');
    body.classList.add('shooting-star-active');

    void shootingStarOverlay.offsetWidth;

    shootingStarTimeout = setTimeout(() => {
        body.classList.remove('shooting-star-active');
        shootingStarOverlay.classList.add('hidden');
        shootingStarTimeout = null;
    }, 10000); 
}

function triggerRainingEffect() {
    console.log("Triggering Raining Effect (20 seconds)");
    if (rainingTimeout) clearTimeout(rainingTimeout);

    rainContainer.innerHTML = ''; 
    rainingOverlay.classList.remove('hidden');
    body.classList.add('raining-active');

    for (let i = 0; i < 100; i++) {
        const raindrop = document.createElement('div');
        raindrop.classList.add('raindrop');
        raindrop.style.left = `${Math.random() * 100}%`;
        raindrop.style.animationDuration = `${0.5 + Math.random() * 0.5}s`; 
        raindrop.style.animationDelay = `${Math.random() * 20}s`; 
        rainContainer.appendChild(raindrop);
    }

    void risingWater.offsetWidth;

    rainingTimeout = setTimeout(() => {
        body.classList.remove('raining-active');
        rainingOverlay.classList.add('hidden');
        rainContainer.innerHTML = ''; 
        rainingTimeout = null;
    }, 20000); 
}

function triggerLavaEffect() {
    console.log("Triggering Lava Effect (10 seconds)");
    if (lavaTimeout) clearTimeout(lavaTimeout);

    lavaOverlay.classList.remove('hidden');
    body.classList.add('lava-active');

    const liquid = lavaOverlay.querySelector('.lava-liquid');
    const bubbles = lavaOverlay.querySelector('.lava-bubbles');

    void liquid.offsetWidth;
    void bubbles.offsetWidth;

    lavaTimeout = setTimeout(() => {
        body.classList.remove('lava-active');
        lavaOverlay.classList.add('hidden');
        lavaTimeout = null;
    }, 10000);
}

function triggerMoneyRainEffect(buyerName) {
    console.log(`Triggering Money Rain Effect initiated by ${buyerName}`);
    if (moneyRainTimeout) clearTimeout(moneyRainTimeout);

    moneyRainOverlay.innerHTML = ''; // Clear previous items
    moneyRainOverlay.classList.remove('hidden');
    body.classList.add('money-rain-active');

    void moneyRainOverlay.offsetWidth; // Trigger reflow for animation

    const itemsToCreate = 50; // Number of falling items
    for (let i = 0; i < itemsToCreate; i++) {
        const item = document.createElement('div');
        item.classList.add('money-rain-item');
        
        // Randomly choose coin or bill
        if (Math.random() > 0.5) {
            item.classList.add('coin-item');
            item.textContent = '💰'; // Or 🪙
        } else {
            item.classList.add('bill-item');
            item.textContent = '💵';
        }
        
        item.style.left = `${Math.random() * 100}vw`;
        item.style.animationDelay = `${Math.random() * 0.8}s`; // Stagger start times
        item.style.animationDuration = `${3 + Math.random() * 2}s`; // Vary fall speed
        item.style.fontSize = `${18 + Math.random() * 12}px`; // Vary size
        moneyRainOverlay.appendChild(item);
    }

    moneyRainTimeout = setTimeout(() => {
        body.classList.remove('money-rain-active');
        moneyRainOverlay.classList.add('hidden');
        moneyRainOverlay.innerHTML = ''; // Clear items
        moneyRainTimeout = null;

        // Award coins to everyone
        Object.keys(room.peers).forEach(peerId => {
            if (peerId === myClientId) { // Update self directly
                const currentCoins = room.presence[myClientId]?.coins || 0;
                room.updatePresence({ coins: currentCoins + MONEY_RAIN_EVENT_COIN_REWARD });
            } else { // Request update for others
                room.requestPresenceUpdate(peerId, { type: 'addCoins', amount: MONEY_RAIN_EVENT_COIN_REWARD });
            }
        });
        addSystemMessage(`${buyerName} triggered a Money Rain! Everyone received ${MONEY_RAIN_EVENT_COIN_REWARD} coins!`);

    }, 10000); // Duration of the effect
}

// --- Game Promo Modal Logic ---
function showGamePromoModal() {
    if (gamePromoModal) {
        gamePromoModal.classList.remove('hidden');
    }
}

function handlePromoYes() {
    window.location.href = 'https://websim.ai/@SuperBaconGamer/plants-rng';
}

function handlePromoNo() {
    if (gamePromoModal) {
        gamePromoModal.classList.add('hidden');
    }
}

// --- Start the app ---
initializeApp();