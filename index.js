const room = new WebsimSocket();

// DOM Elements
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
const usernameDisplay = document.getElementById('username');

// Name Change Modal Elements
const changeNameBtn = document.getElementById('change-name-btn');
const changeNameModal = document.getElementById('change-name-modal');
const newNameInput = document.getElementById('new-name-input');
const saveNameButton = document.getElementById('save-name-button');
const cancelNameButton = document.getElementById('cancel-name-button');
const nameCooldownMessage = document.getElementById('name-cooldown-message');

// --- State ---
let myClientId = null;
let likedMessages = new Set(); // Track messages liked by the current client locally
let userProfiles = {}; // Local cache for user display names

const NAME_CHANGE_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// --- Initialization ---
async function initializeApp() {
    await room.initialize();
    myClientId = room.clientId;

    // Enable chat now that we are initialized
    chatInput.disabled = false;
    sendButton.disabled = false;

    setupListeners();
    subscribeToUpdates();
    
    // Initial fetch of profiles
    await fetchUserProfiles();
    updateMyDisplayName();
    renderMessages();
}

// --- Event Listeners & Subscriptions ---
function setupListeners() {
    sendButton.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Name Change Modal Listeners
    changeNameBtn.addEventListener('click', openNameChangeModal);
    cancelNameButton.addEventListener('click', closeNameChangeModal);
    saveNameButton.addEventListener('click', handleSaveName);
}

function subscribeToUpdates() {
    room.collection('message_v2').subscribe(renderMessages);
    room.collection('user_profile_v1').subscribe(handleProfileUpdates);
    room.onmessage = handleBroadcastEvent;
}

// --- Profile & Name Change ---
async function fetchUserProfiles() {
    const profiles = room.collection('user_profile_v1').getList();
    userProfiles = {};
    profiles.forEach(p => {
        if (p.userId) {
            userProfiles[p.userId] = p;
        }
    });
}

function handleProfileUpdates(profiles) {
    userProfiles = {};
    profiles.forEach(p => {
        if (p.userId) {
            userProfiles[p.userId] = p;
        }
    });
    updateMyDisplayName();
    renderMessages(); // Re-render messages to show new names
}

function updateMyDisplayName() {
    const myProfile = userProfiles[myClientId];
    if (myProfile && myProfile.displayName) {
        usernameDisplay.textContent = myProfile.displayName;
    } else {
        usernameDisplay.textContent = room.peers[myClientId]?.username || 'User';
    }
}

async function openNameChangeModal() {
    const myProfile = userProfiles[myClientId];
    if (myProfile && myProfile.lastChangedAt && (Date.now() - myProfile.lastChangedAt < NAME_CHANGE_COOLDOWN)) {
        const timeLeft = NAME_CHANGE_COOLDOWN - (Date.now() - myProfile.lastChangedAt);
        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        nameCooldownMessage.textContent = `You can change your name again in ${hours}h ${minutes}m.`;
        nameCooldownMessage.classList.remove('hidden');
        saveNameButton.disabled = true;
    } else {
        nameCooldownMessage.classList.add('hidden');
        saveNameButton.disabled = false;
    }
    newNameInput.value = usernameDisplay.textContent;
    changeNameModal.classList.remove('hidden');
}

function closeNameChangeModal() {
    changeNameModal.classList.add('hidden');
}

async function handleSaveName() {
    const newName = newNameInput.value.trim();
    if (!newName || newName.length < 3) {
        alert("Name must be at least 3 characters long.");
        return;
    }

    saveNameButton.disabled = true;
    const myProfile = userProfiles[myClientId];

    if (myProfile) {
        // Update existing profile
        await room.collection('user_profile_v1').update(myProfile.id, {
            displayName: newName,
            lastChangedAt: Date.now()
        });
    } else {
        // Create new profile
        await room.collection('user_profile_v1').create({
            userId: myClientId,
            displayName: newName,
            lastChangedAt: Date.now()
        });
    }

    closeNameChangeModal();
}

// --- Update Handlers ---
function handleBroadcastEvent(event) {
    const data = event.data;
    switch (data.type) {
        case 'connected':
            // Optional: add a system message for user joins
            break;
        case 'disconnected':
             addSystemMessage(`${userProfiles[data.clientId]?.displayName || data.username} left the chat.`);
            break;
        default:
            console.log('Received unknown event:', data);
    }
}

// --- Core Logic ---
async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    await room.collection('message_v2').create({
        text: text,
        authorId: myClientId,
        likes: 0,
    });

    chatInput.value = '';
    chatInput.focus();
}

async function addSystemMessage(text) {
    await room.collection('message_v2').create({
        text: text,
        isSystem: true,
    });
}

async function likeMessage(messageId) {
    const messages = room.collection('message_v2').getList();
    const message = messages.find(m => m.id === messageId);
    
    if (!message || message.authorId === myClientId || likedMessages.has(messageId) || message.isSystem) {
        return;
    }

    likedMessages.add(messageId);

    await room.collection('message_v2').update(messageId, {
        likes: (message.likes || 0) + 1
    });
}

// --- Rendering ---
function renderMessages() {
    // The subscribe callback now receives the list directly
    const messages = room.collection('message_v2').getList().slice().reverse();

    chatMessages.innerHTML = '';

    messages.forEach(msg => {
        if (!msg) return;

        const authorProfile = userProfiles[msg.authorId];
        const authorName = authorProfile?.displayName || room.peers[msg.authorId]?.username || 'Unknown';
        
        const wrapper = document.createElement('div');
        wrapper.classList.add('message-wrapper');

        const messageEl = document.createElement('div');
        messageEl.classList.add('message');
        
        if (msg.isSystem) {
            messageEl.classList.add('system-message');
            const textEl = document.createElement('span');
            textEl.textContent = msg.text;
            messageEl.appendChild(textEl);
            chatMessages.appendChild(messageEl); // No wrapper for system messages
            return;
        }
        
        if (msg.authorId === myClientId) {
            wrapper.classList.add('own-message');
            messageEl.classList.add('own-message');
        }

        const authorEl = document.createElement('div');
        authorEl.classList.add('message-author');
        authorEl.textContent = authorName;

        const contentWrapper = document.createElement('div');
        contentWrapper.classList.add('message-content');

        const textEl = document.createElement('span');
        textEl.textContent = msg.text;

        const likeContainer = document.createElement('div');
        likeContainer.style.display = 'flex';
        likeContainer.style.alignItems = 'center';
        likeContainer.style.marginLeft = '10px';
        likeContainer.style.flexShrink = '0';

        const likeButton = document.createElement('button');
        likeButton.classList.add('like-button');
        likeButton.textContent = '❤️';
        if (msg.authorId === myClientId || likedMessages.has(msg.id) || msg.isSystem) {
            likeButton.disabled = true;
            if (likedMessages.has(msg.id)) {
                likeButton.classList.add('liked');
            }
        } else {
            likeButton.onclick = () => likeMessage(msg.id);
        }

        const likeCount = document.createElement('span');
        likeCount.classList.add('like-count');
        likeCount.textContent = msg.likes || 0;

        likeContainer.appendChild(likeButton);
        if((msg.likes || 0) > 0) {
           likeContainer.appendChild(likeCount);
        }

        contentWrapper.appendChild(textEl);
        contentWrapper.appendChild(likeContainer);

        wrapper.appendChild(authorEl);
        wrapper.appendChild(messageEl);
        messageEl.appendChild(contentWrapper);

        chatMessages.appendChild(wrapper);
    });

    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- Start the app ---
initializeApp();