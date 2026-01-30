const Transposer = {
    // Notas cromáticas (Sharp preference)
    scaleSharp: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
    // Notas cromáticas (Flat preference)
    scaleFlat: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],

    // Mapa de conversão rápida para normalizar
    normalizeMap: {
        'Cb': 'B', 'B#': 'C', 'E#': 'F', 'Fb': 'E'
    },

    /**
     * Identifica o índice da nota na escala cromática.
     */
    getNoteIndex: (note) => {
        const n = Transposer.normalizeMap[note] || note;
        let idx = Transposer.scaleSharp.indexOf(n);
        if (idx === -1) idx = Transposer.scaleFlat.indexOf(n);
        return idx;
    },

    /**
     * Transpõe um acorde
     * @param {string} chord - O acorde (ex: "Am", "G/B", "F#m7")
     * @param {number} semitones - Quantidade de semitons (+1, -2, etc)
     */
    transposeChord: (chord, semitones, preferredTones = []) => {
        // Regex para separar a Nota Base, o Sufixo (m, 7, etc) e o Baixo (/B)
        // Grupo 1: Nota Base (Ex: C, C#, Bb)
        // Grupo 2: Sufixo (m7, sus4, etc - tudo até a barra ou fim)
        // Grupo 3: Baixo opcional (Ex: /G#)
        const regex = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/;
        const match = chord.match(regex);

        if (!match) return chord; // Se não for acorde válido, retorna original

        const base = match[1];
        const suffix = match[2] || '';
        const bass = match[3];

        const newBase = Transposer.shiftNote(base, semitones, preferredTones);
        const newBass = bass ? '/' + Transposer.shiftNote(bass, semitones, preferredTones) : '';

        return newBase + suffix + newBass;
    },

    shiftNote: (note, semitones, preferredTones = []) => {
        const idx = Transposer.getNoteIndex(note);
        if (idx === -1) return note;

        let newIdx = (idx + semitones) % 12;
        if (newIdx < 0) newIdx += 12;

        // Tenta encontrar uma nota preferida que corresponda ao índice
        if (preferredTones && preferredTones.length > 0) {
            const preferred = preferredTones.find(t => Transposer.getNoteIndex(t) === newIdx);
            if (preferred) return preferred;
        }

        // Se não houver preferência, fallback para Sharp/Flat padrão
        // (Poderíamos melhorar: se a nota original era flat, tenta manter flat?)
        const originalIsFlat = note.includes('b');
        if (originalIsFlat) return Transposer.scaleFlat[newIdx];

        return Transposer.scaleSharp[newIdx];
    },

    /**
     * Calcula a distância em semitons entre duas notas
     */
    getSemitonesBetween: (fromNote, toNote) => {
        const fromIdx = Transposer.getNoteIndex(fromNote);
        const toIdx = Transposer.getNoteIndex(toNote);

        if (fromIdx === -1 || toIdx === -1) return 0;

        let diff = toIdx - fromIdx;
        // Normalizar para o menor caminho (-6 a +6) ou apenas positivo?
        // Vamos manter simples: sempre direção ascendente ou ajuste simples
        return diff;
    },

    /**
     * Transpõe o texto inteiro da cifra
     */
    transposeSong: (content, semitones, preferredTones = []) => {
        if (semitones === 0) return content;

        // Substitui tudo que está entre colchetes [Chord]
        // Ignora comandos como [p|...] ou [.|...]
        return content.replace(/\[([^\]]+)\]/g, (match, inner) => {
            if (inner.startsWith('p|') || inner.startsWith('.') || inner.startsWith('|')) return match;

            // Se tiver asteriscos de variação (Ex: G**), preserva
            const stars = inner.match(/\*+$/);
            const suffix = stars ? stars[0] : '';
            const chordName = inner.replace(/\*+$/, '');

            const transposed = Transposer.transposeChord(chordName, semitones, preferredTones);
            return `[${transposed}${suffix}]`;
        });
    }
};

// Se estiver no browser, expõe globalmente
if (typeof window !== 'undefined') {
    window.Transposer = Transposer;
}

if (typeof module !== 'undefined') module.exports = Transposer;
