// --- CIFRAS MODULE ---
app.cifraConfig = {
    scrollSpeed: 1,
    scrollInterval: null,
    fontSize: 18, // px
    transposition: 0
};

// Notes for Transposition
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

app.loadCifra = async (id) => {
    try {
        console.log('Loading Cifra:', id);

        // 1. Fetch Data
        // Try local state first (if coming from list)? No, fetch fresh to be safe or use cache.
        // But app_v2.js used app.db directly.
        let data = null;
        if (app.state.currentCifra && app.state.currentCifra.id === id) {
            data = app.state.currentCifra;
        } else {
            const doc = await app.db.collection('cifras').doc(id).get();
            if (!doc.exists) {
                app.showToast('Cifra não encontrada.');
                app.navigate('home');
                return;
            }
            data = { id: doc.id, ...doc.data() };
        }

        app.state.currentCifra = data;
        app.cifraConfig.transposition = 0; // Reset transposition
        app.cifraConfig.fontSize = 18; // Reset font size

        // 2. Render Basic Info
        document.getElementById('cifra-title').innerText = data.title;
        document.getElementById('cifra-artist').innerText = data.artist;
        document.getElementById('cifra-tone-display').innerText = data.tom || 'C'; // Initial Tone Display

        // 3. Render Content (Lyrics & Tabs)
        app.renderContent();

        // 4. Strumming (Batida)
        const strumContainer = document.getElementById('view-strumming-container');
        const strumDisplay = document.getElementById('view-strumming');
        if (data.strumming) {
            strumContainer.classList.remove('hidden');
            strumDisplay.innerHTML = app.renderStrumming(data.strumming);
        } else {
            strumContainer.classList.add('hidden');
        }

        // 5. Tabs vs Lyrics
        // Default to Lyrics
        app.setContentView('lyrics');

    } catch (e) {
        console.error('Erro em loadCifra:', e);
        app.showToast('Erro ao carregar cifra.');
        app.navigate('home');
    }
};

app.renderContent = () => {
    const data = app.state.currentCifra;
    if (!data) return;

    const contentDiv = document.getElementById('view-content');
    const tabsDiv = document.getElementById('view-tabs');
    const toneDisplay = document.getElementById('transposer-display'); // Specific ID for transposer

    // Update Tone Display
    const originalTone = data.tom || 'C';
    const currentTone = app.transposeNote(originalTone, app.cifraConfig.transposition);
    if (toneDisplay) toneDisplay.innerText = currentTone;


    // Process Content with Transposition
    let contentHtml = data.content || '';

    // Transpose Chords in Content
    // Regex matches [Chord]
    contentHtml = contentHtml.replace(/\[([^\]]+)\]/g, (match, chord) => {
        if (chord.startsWith('|') || chord.startsWith('tab')) return match; // Skip tabs/special

        const transposedChord = app.transposeChord(chord, app.cifraConfig.transposition);

        // Interactive Chord Span
        return `<span class="font-bold text-primary cursor-pointer hover:bg-primary/10 rounded px-1 transition-colors select-none" onclick="app.showChordDiagram('${transposedChord}')">${transposedChord}</span>`;
    });

    contentDiv.innerHTML = contentHtml;
    contentDiv.style.fontSize = `${app.cifraConfig.fontSize}px`;

    // Process Tabs
    if (data.tabs) {
        tabsDiv.innerText = data.tabs;
        tabsDiv.style.fontSize = `${Math.max(12, app.cifraConfig.fontSize - 4)}px`; // Tabs usually smaller
    } else {
        tabsDiv.innerText = 'Nenhuma tablatura cadastrada.';
    }

    // Chords List (Diagrams) - DISABLED due to missing library
    // app.renderChordDiagrams(); 
};

// --- TRANSPOSITION LOGIC ---

app.changeTone = (semitones) => {
    app.cifraConfig.transposition += semitones;
    app.renderContent();
};

app.resetTone = () => {
    app.cifraConfig.transposition = 0;
    app.renderContent();
};

app.transposeChord = (chord, semitones) => {
    if (semitones === 0) return chord;

    // Regex to split chord into: Root + Quality/Bass
    // Matches: A, A#, Bb, Cmaj7, D/F#
    const match = chord.match(/^([A-G][#b]?)(.*)$/);
    if (!match) return chord;

    let root = match[1];
    let rest = match[2];

    // Handle split bass (e.g., G/B)
    let bass = '';
    if (rest.includes('/')) {
        const parts = rest.split('/');
        rest = parts[0];
        bass = '/' + app.transposeNote(parts[1], semitones);
    }

    const newRoot = app.transposeNote(root, semitones);
    return newRoot + rest + bass;
};

app.transposeNote = (note, semitones) => {
    // Normalize note (handle flats/sharps context if possible, but for now simple)
    let index = NOTES.indexOf(note);
    if (index === -1) {
        index = NOTES_FLAT.indexOf(note);
    }
    if (index === -1) return note; // Unknown note

    let newIndex = (index + semitones) % 12;
    if (newIndex < 0) newIndex += 12;

    // Return sharp version by default for simplicity, or try to respect original connectivity
    return NOTES[newIndex];
};

// --- VIEW CONTROLS ---

app.setContentView = (mode) => {
    const btnLyrics = document.getElementById('btn-mode-lyrics');
    const btnTabs = document.getElementById('btn-mode-tabs');
    const viewContent = document.getElementById('view-content');
    const viewTabs = document.getElementById('view-tabs');

    if (mode === 'lyrics') {
        btnLyrics.classList.add('bg-white', 'dark:bg-slate-600', 'text-primary', 'shadow-sm');
        btnLyrics.classList.remove('text-slate-500', 'dark:text-slate-400');

        btnTabs.classList.remove('bg-white', 'dark:bg-slate-600', 'text-primary', 'shadow-sm');
        btnTabs.classList.add('text-slate-500', 'dark:text-slate-400');

        viewContent.classList.remove('hidden');
        viewTabs.classList.add('hidden');
    } else {
        btnTabs.classList.add('bg-white', 'dark:bg-slate-600', 'text-primary', 'shadow-sm');
        btnTabs.classList.remove('text-slate-500', 'dark:text-slate-400');

        btnLyrics.classList.remove('bg-white', 'dark:bg-slate-600', 'text-primary', 'shadow-sm');
        btnLyrics.classList.add('text-slate-500', 'dark:text-slate-400');

        viewTabs.classList.remove('hidden');
        viewContent.classList.add('hidden');
    }
};

app.changeFontSize = (delta) => {
    app.cifraConfig.fontSize = Math.max(12, Math.min(48, app.cifraConfig.fontSize + delta));
    app.renderContent();
};

// --- SCROLLING ---

app.toggleAutoScroll = () => {
    if (app.cifraConfig.scrollInterval) {
        app.stopAutoScroll();
    } else {
        // Show floating controls
        const controls = document.getElementById('scrolling-controls');
        if (controls) {
            controls.classList.remove('translate-y-20');
        }

        const speedInput = document.getElementById('scroll-speed-range');
        let speed = speedInput ? parseFloat(speedInput.value) : 1;

        app.showToast('Rolagem automática iniciada');

        app.cifraConfig.scrollInterval = setInterval(() => {
            // Recalculate speed in case it changed
            if (speedInput) speed = parseFloat(speedInput.value);
            // Scroll both main window and content container if needed
            // With the new layout, we might need to scroll the 'main' element, not window
            const mainScroll = document.querySelector('main.flex-1.overflow-y-auto');
            if (mainScroll) {
                mainScroll.scrollTop += speed;
            } else {
                window.scrollBy(0, speed);
            }
        }, 50); // 20fps
    }
};

app.stopAutoScroll = () => {
    if (app.cifraConfig.scrollInterval) {
        clearInterval(app.cifraConfig.scrollInterval);
        app.cifraConfig.scrollInterval = null;

        const controls = document.getElementById('scrolling-controls');
        if (controls) {
            controls.classList.add('translate-y-20');
        }
        app.showToast('Rolagem parada');
    }
};

// --- EXTRAS ---

app.showChordDiagram = (chord) => {
    // Placeholder for when Chords library returns
    // app.showToast(`Diagrama de ${chord} (Visualização desativada temporariamente)`);
    console.log('Show chord:', chord);
};

app.renderStrumming = (strumString) => {
    // Re-use logic from app_v2.js or simplified
    // 'D' = Down, 'U' = Up, etc.
    if (!strumString) return '';
    const map = {
        'D': '↓', 'U': '↑',
        'd': '↓.', 'u': '↑.', // muted checks
        'X': 'x', ' ': '&nbsp;'
    };

    return strumString.split('').map(char => {
        const symbol = map[char] || char;
        return `<span class="flex items-center justify-center w-8 h-8 rounded bg-slate-100 dark:bg-slate-700 font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">${symbol}</span>`;
    }).join('');
};
