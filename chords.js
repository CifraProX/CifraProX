const Chords = {
    // Dicionário de Acordes - Preenchido dinamicamente via Firestore
    dict: {},

    /**
     * @param {string} chordName Nome do acorde (ex: 'G', 'G*', 'G**')
     * @param {number} variationIndex Índice manual (opcional, soma aos asteriscos)
     */
    render: (chordName, variationIndex = 0) => {
        // Detectar asteriscos no final para definir variação (ex: G** = index 2)
        let baseName = chordName.replace(/\*+$/, '');
        const stars = chordName.length - baseName.length;

        // O índice final é a soma dos asteriscos + o índice manual (se houver navegação)
        let totalIndex = stars + variationIndex;

        let variations = Chords.dict[baseName];

        // Se não encontrar, tenta o nome original (vai que alguém cadastrou 'G*' como chave explicita)
        if (!variations) {
            variations = Chords.dict[chordName];
            totalIndex = variationIndex; // Reset se achou pela chave exata
            baseName = chordName;
        }

        if (!variations) return null;

        if (!Array.isArray(variations)) {
            variations = [variations];
        }

        // Garante loop (wrap around)
        const index = Math.abs(totalIndex % variations.length);
        const data = variations[index];

        const width = 100;
        const height = 120;
        const margin = 15;
        const stringGap = (width - 2 * margin) / 5;
        const fretGap = (height - 2 * margin) / 5;

        // Iniciar SVG
        let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;

        // Desenhar Nut (Cinza Escuro Suave)
        const nutWidth = data.bar ? 1 : 4;
        svg += `<line x1="${margin}" y1="${margin}" x2="${width - margin}" y2="${margin}" stroke="#4b5563" stroke-width="${nutWidth}"/>`;

        // Cordas (Cinza Médio)
        for (let i = 0; i < 6; i++) {
            const x = margin + i * stringGap;
            svg += `<line x1="${x}" y1="${margin}" x2="${x}" y2="${height - margin}" stroke="#9ca3af" stroke-width="1"/>`;
        }

        // Trastes (Cinza Médio)
        for (let i = 1; i <= 5; i++) {
            const y = margin + i * fretGap;
            svg += `<line x1="${margin}" y1="${y}" x2="${width - margin}" y2="${y}" stroke="#9ca3af" stroke-width="1"/>`;
        }

        // Pestana (Esmeralda Vibrante)
        if (data.bar) {
            const barFret = 1;
            const y = margin + (barFret * fretGap) - (fretGap / 2);
            const showBarLine = data.noBarLine !== true && data.noBarLine !== "true";
            if (showBarLine) {
                svg += `<rect x="${margin - 2}" y="${y - 4}" width="${width - 2 * margin + 4}" height="8" rx="2" fill="#059669"/>`;
            }
            svg += `<text x="0" y="${y + 4}" fill="#4b5563" font-size="11" font-family="sans-serif" font-weight="bold">${data.bar}ª</text>`;
        }

        // Dedos (Esmeralda Vibrante)
        data.p.forEach((fret, stringIndex) => {
            const x = margin + stringIndex * stringGap;

            if (fret === -1) {
                // X (Cinza avermelhado sutil ou vermelho puro?)
                svg += `<text x="${x}" y="${margin - 5}" text-anchor="middle" fill="#ef4444" font-size="11" font-family="sans-serif">×</text>`;
            } else if (fret === 0) {
                svg += `<circle cx="${x}" cy="${margin - 7}" r="3" stroke="#059669" stroke-width="1.5" fill="none"/>`;
            } else {
                // Se noBarLine for true, desenhamos o dedo mesmo que ele esteja na casa da "pestana"
                const noBar = data.noBarLine === true || data.noBarLine === "true";
                if (data.bar && fret === data.bar && !noBar) return;

                let displayFret = fret;
                if (data.bar) displayFret = fret - data.bar + 1;

                if (displayFret > 0 && displayFret <= 5) {
                    const y = margin + (displayFret * fretGap) - (fretGap / 2);
                    svg += `<circle cx="${x}" cy="${y}" r="5" fill="#059669"/>`;
                }
            }
        });

        svg += `</svg>`;
        return svg;
    },

    getVariationCount: (chordName) => {
        const baseName = chordName.replace(/\*+$/, '');
        // Tenta achar pelo baseName, senão pelo full name
        const variations = Chords.dict[baseName] || Chords.dict[chordName];
        if (!variations) return 0;
        return Array.isArray(variations) ? variations.length : 1;
    }
};

if (typeof module !== 'undefined') module.exports = Chords;
