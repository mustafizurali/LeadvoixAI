// LeadVoixAI Simulator and UI Interactions

document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------
    // FAQ Accordion Logic
    // -------------------------------------------------------------
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            faqItems.forEach(i => i.classList.remove('active'));
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });

    // -------------------------------------------------------------
    // AI Voice Simulator Settings & State
    // -------------------------------------------------------------
    const btnToggleCall = document.getElementById('btn-toggle-call');
    const callLabel = document.querySelector('.call-action-label');
    const transcriptDiv = document.getElementById('transcript');
    const phoneScreen = document.querySelector('.phone-screen');
    const agentNameEl = document.querySelector('.agent-display-name');
    const agentStatusEl = document.querySelector('.agent-status');
    const avatarIcon = document.querySelector('.avatar-image i');
    const personaCards = document.querySelectorAll('.persona-card');

    let currentPersona = 'buyer'; // default
    let isCallActive = false;
    let currentStep = 0;
    
    // Web Speech API interfaces
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const speechSynthesis = window.speechSynthesis;
    let recognition = null;
    let synthUtterance = null;
    let userSpeechTimeout = null;

    // Personas Definitions & Conversation Scripts
    const agentProfiles = {
        buyer: {
            name: "Sarah",
            role: "Buyer Agent",
            status: "Online",
            voiceGender: "female",
            avatar: "fa-solid fa-headset",
            script: [
                {
                    agent: "Hello! Thanks for calling LeadVoix Realty. My name is Sarah. Are you looking to buy a home or just browsing today?",
                    expectedIntents: ["buy", "home", "browsing", "house"]
                },
                {
                    agent: "Great! We have some gorgeous properties listed in Miami and Dubai. What is your preferred neighborhood and maximum budget?",
                    expectedIntents: []
                },
                {
                    agent: "Got it, that budget gives us some fantastic options. What is your target timeframe for buying, and are you already pre-approved for a mortgage?",
                    expectedIntents: []
                },
                {
                    agent: "Perfect. I want to schedule a quick 10-minute strategy call with our senior agent so we can show you some off-market listings. Would tomorrow morning or afternoon work best?",
                    expectedIntents: []
                },
                {
                    agent: "Awesome, I've logged that in our calendar. Our agent will call you at that time. I will send you a calendar invite shortly. Thank you and have a fantastic day!",
                    isFinal: true
                }
            ]
        },
        seller: {
            name: "Michael",
            role: "Seller Agent",
            status: "Online",
            voiceGender: "male",
            avatar: "fa-solid fa-user-tie",
            script: [
                {
                    agent: "Hi there, thank you for reaching out! This is Michael. Are you looking to sell a property, or just curious about its value?",
                    expectedIntents: ["sell", "value", "valuation"]
                },
                {
                    agent: "Excellent, we can certainly help with that. What is the address of the property you are thinking about selling?",
                    expectedIntents: []
                },
                {
                    agent: "Got it. How would you describe the overall condition of the home? Has it had any recent renovations or upgrades?",
                    expectedIntents: []
                },
                {
                    agent: "Perfect, thank you. Let's schedule a brief 10-minute phone valuation appointment with our valuation specialist to give you an accurate market price. Does tomorrow afternoon work for you?",
                    expectedIntents: []
                },
                {
                    agent: "Excellent, I've booked your valuation slot. You will receive a confirmation message shortly. We look forward to helping you sell. Have a wonderful day!",
                    isFinal: true
                }
            ]
        },
        rental: {
            name: "Jessica",
            role: "Leasing Agent",
            status: "Online",
            voiceGender: "female",
            avatar: "fa-solid fa-key",
            script: [
                {
                    agent: "Hello! Jessica here. Thank you for calling. Are you looking to rent an apartment or a villa?",
                    expectedIntents: ["rent", "apartment", "villa"]
                },
                {
                    agent: "Perfect. How many bedrooms are you looking for, and what is your maximum monthly rental budget?",
                    expectedIntents: []
                },
                {
                    agent: "Okay, noted. What is your target move-in date, and do you have any pets or specific requirements?",
                    expectedIntents: []
                },
                {
                    agent: "Understood. We have a couple of listings that fit your criteria perfectly. Let's schedule a quick viewing tour. Would this Saturday morning work for you?",
                    expectedIntents: []
                },
                {
                    agent: "Fantastic, I've locked in your viewing appointment. I'll text you the address details shortly. Hope you find your dream home. Goodbye!",
                    isFinal: true
                }
            ]
        }
    };

    // -------------------------------------------------------------
    // Persona Selection Handler
    // -------------------------------------------------------------
    personaCards.forEach(card => {
        card.addEventListener('click', () => {
            if (isCallActive) {
                // If active call, ignore clicking or end call first
                endCall();
            }
            
            personaCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            currentPersona = card.dataset.persona;
            updateUIForPersona(currentPersona);
        });
    });

    function updateUIForPersona(personaKey) {
        const profile = agentProfiles[personaKey];
        agentNameEl.textContent = profile.name;
        agentStatusEl.textContent = "Ready to call";
        avatarIcon.className = profile.avatar;
        
        transcriptDiv.innerHTML = `<div class="message system-msg">You have selected ${profile.name} (${profile.role}). Click "Start Call" below to begin a live voice demo.</div>`;
    }

    // Initialize display UI
    updateUIForPersona(currentPersona);

    // -------------------------------------------------------------
    // Call Toggle (Start/End Call)
    // -------------------------------------------------------------
    btnToggleCall.addEventListener('click', () => {
        if (!isCallActive) {
            startCall();
        } else {
            endCall();
        }
    });

    // -------------------------------------------------------------
    // Start Call Flow
    // -------------------------------------------------------------
    function startCall() {
        isCallActive = true;
        currentStep = 0;
        
        phoneScreen.classList.add('active-call');
        btnToggleCall.classList.remove('start');
        btnToggleCall.classList.add('end');
        btnToggleCall.innerHTML = '<i class="fa-solid fa-phone-slash"></i>';
        callLabel.textContent = "End Call";
        
        const profile = agentProfiles[currentPersona];
        agentStatusEl.textContent = "In Call...";
        
        transcriptDiv.innerHTML = "";
        addTranscriptMessage("system-msg", `Calling ${profile.name}... Connected.`);

        // Setup speech recognition
        setupRecognition();

        // Speak the first greeting
        setTimeout(() => {
            playAgentResponse(profile.script[currentStep].agent);
        }, 1000);
    }

    // -------------------------------------------------------------
    // End Call Flow
    // -------------------------------------------------------------
    function endCall() {
        isCallActive = false;
        
        phoneScreen.classList.remove('active-call');
        btnToggleCall.classList.remove('end');
        btnToggleCall.classList.add('start');
        btnToggleCall.innerHTML = '<i class="fa-solid fa-phone"></i>';
        callLabel.textContent = "Start Call";
        
        agentStatusEl.textContent = "Call Ended";
        addTranscriptMessage("system-msg", "Call ended. Tap 'Start Call' to try again.");

        if (recognition) {
            try {
                recognition.stop();
            } catch(e) {}
        }
        if (speechSynthesis) {
            speechSynthesis.cancel();
        }
        clearTimeout(userSpeechTimeout);
    }

    // -------------------------------------------------------------
    // Speech Recognition Setup (User speaking)
    // -------------------------------------------------------------
    function setupRecognition() {
        if (!SpeechRecognition) {
            console.warn("SpeechRecognition not supported in this browser. Falling back to simulation mode.");
            return;
        }

        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            if (isCallActive) {
                agentStatusEl.textContent = "Listening...";
            }
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            if (event.error === 'not-allowed') {
                addTranscriptMessage("system-msg", "Microphone access blocked. Please type your reply in the browser console or allow mic access.");
            }
        };

        recognition.onend = () => {
            if (isCallActive && agentStatusEl.textContent === "Listening...") {
                // If it ended without results, restart it
                try {
                    recognition.start();
                } catch(e) {}
            }
        };

        recognition.onresult = (event) => {
            const userText = event.resultString || event.results[0][0].transcript;
            if (!userText) return;
            
            addTranscriptMessage("user-msg", userText);
            agentStatusEl.textContent = "Processing...";
            
            // Wait 1.5 seconds before replying to feel realistic
            setTimeout(() => {
                advanceConversation();
            }, 1200);
        };
    }

    function startListening() {
        if (!recognition || !isCallActive) {
            // Fallback: If browser doesn't support Web Speech API, simulate typing in 4 seconds
            clearTimeout(userSpeechTimeout);
            userSpeechTimeout = setTimeout(() => {
                if (isCallActive) {
                    addTranscriptMessage("user-msg", "Yes, that sounds good to me.");
                    setTimeout(() => {
                        advanceConversation();
                    }, 1200);
                }
            }, 4000);
            return;
        }

        try {
            recognition.start();
        } catch (e) {
            // Already started or busy
        }
    }

    // -------------------------------------------------------------
    // Conversation State Machine
    // -------------------------------------------------------------
    function advanceConversation() {
        if (!isCallActive) return;
        
        currentStep++;
        const profile = agentProfiles[currentPersona];
        
        if (currentStep < profile.script.length) {
            const nextScript = profile.script[currentStep];
            playAgentResponse(nextScript.agent);
            
            if (nextScript.isFinal) {
                // Auto hangup after final message
                setTimeout(() => {
                    endCall();
                }, 5000);
            }
        } else {
            endCall();
        }
    }

    // -------------------------------------------------------------
    // Speech Synthesis Setup (AI Agent speaking)
    // -------------------------------------------------------------
    function playAgentResponse(text) {
        if (!isCallActive) return;

        addTranscriptMessage("agent-msg", text);
        agentStatusEl.textContent = "Speaking...";

        if (recognition) {
            try {
                recognition.stop();
            } catch(e) {}
        }

        if (!speechSynthesis) {
            // Fallback for no voice synthesis
            setTimeout(() => {
                if (isCallActive) {
                    startListening();
                }
            }, 3000);
            return;
        }

        speechSynthesis.cancel(); // Stop any pending speech
        synthUtterance = new SpeechSynthesisUtterance(text);
        
        // Find best voice match
        const voices = speechSynthesis.getVoices();
        const profile = agentProfiles[currentPersona];
        
        // Look for Google US English or Microsoft English voices first
        let selectedVoice = null;
        if (profile.voiceGender === 'female') {
            selectedVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Zira') || v.name.includes('female') || v.name.includes('Samantha')));
        } else {
            selectedVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('David') || v.name.includes('Google US English') || v.name.includes('male') || v.name.includes('Microsoft')));
        }

        if (selectedVoice) {
            synthUtterance.voice = selectedVoice;
        }
        
        synthUtterance.rate = 1.05; // Slightly faster to sound energetic
        synthUtterance.pitch = 1.0;

        synthUtterance.onend = () => {
            if (isCallActive) {
                agentStatusEl.textContent = "Listening...";
                startListening();
            }
        };

        synthUtterance.onerror = (e) => {
            console.error("SpeechSynthesis error:", e);
            if (isCallActive) {
                agentStatusEl.textContent = "Listening...";
                startListening();
            }
        };

        speechSynthesis.speak(synthUtterance);
    }

    // -------------------------------------------------------------
    // UI Helpers
    // -------------------------------------------------------------
    function addTranscriptMessage(senderClass, text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${senderClass}`;
        msgDiv.textContent = text;
        transcriptDiv.appendChild(msgDiv);
        
        // Scroll to bottom
        transcriptDiv.scrollTop = transcriptDiv.scrollHeight;
    }

    // Chrome requires voices to be loaded asynchronously
    if (speechSynthesis && speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => {
            // Voices loaded
        };
    }
});
