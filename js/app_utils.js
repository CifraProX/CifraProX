// --- UTILS ---
app.utils = {};

app.showToast = (message) => {
    const toast = document.createElement('div');
    toast.innerText = message;
    toast.style.cssText = 'position:fixed; bottom: 100px; right: 2rem; background: #1e293b; color: white; padding: 0.75rem 1.5rem; border-radius: 12px; font-size: 0.9em; font-weight: 600; z-index: 9999; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); opacity: 0; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); pointer-events:none; transform: translateY(10px); border: 1px solid rgba(255,255,255,0.1);';
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

app.modal = ({ title, content, input = false, confirmText = 'OK', cancelText = 'Cancelar', placeholder = '', onConfirm = null, onShow = null }) => {
    return new Promise((resolve) => {
        const root = document.getElementById('modal-root');
        const id = 'modal-' + Date.now();

        const html = `
        <div class="modal-overlay" id="${id}">
            <div class="modal-container">
                <div class="modal-title">${title}</div>
                <div class="modal-content">${content}</div>
                ${input ? `<input type="text" class="modal-input" id="${id}-input" placeholder="${placeholder}" autofocus>` : ''}
                <div class="modal-actions">
                    ${cancelText ? `<button class="btn btn-outline" id="${id}-cancel">${cancelText}</button>` : ''}
                    <button class="btn btn-primary" id="${id}-confirm">${confirmText}</button>
                </div>
            </div>
        </div>
    `;

        root.insertAdjacentHTML('beforeend', html);
        const modalEl = document.getElementById(id);

        requestAnimationFrame(() => {
            document.body.classList.add('modal-active');
            modalEl.classList.add('active'); // Add active class for scoped CSS
            if (typeof onShow === 'function') onShow(id);
        });

        const cleanup = (value) => {
            document.body.classList.remove('modal-active');
            modalEl.style.opacity = '0';
            setTimeout(() => {
                modalEl.remove();
                resolve(value);
            }, 300);
        };

        const inputField = document.getElementById(`${id}-input`);
        if (inputField) {
            inputField.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') document.getElementById(`${id}-confirm`).click();
            });
        }

        document.getElementById(`${id}-confirm`).onclick = () => {
            if (input) {
                cleanup(inputField.value);
                return;
            }
            if (typeof onConfirm === 'function') {
                onConfirm();
                cleanup(true);
                return;
            }
            cleanup(true);
        };

        if (cancelText) {
            document.getElementById(`${id}-cancel`).onclick = () => cleanup(null);
        }
    });
};

app.slugify = (text) => {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
};

app.getGenreIcon = (genre) => {
    if (!genre) return '';
    const map = {
        'Sertanejo': 'genero_sertanejo.svg',
        'Rock': 'genero_rock.svg',
        'MPB': 'genero_mpb.svg',
        'Acústico': 'genero_acustico.svg'
    };
    const file = map[genre];
    return file ? `<img src="icons/${file}" class="genre-icon-bg">` : '';
};

app.isActualChord = (name) => {
    if (!name) return false;
    if (name.includes('|') || name.includes('.') || name.startsWith('p|')) return false;

    const clean = name.trim().toLowerCase();
    const blacklist = ['intro', 'solo', 'riff', 'refrão', 'ponte', 'bridge', 'final', 'outro', 'instrumental', 'parte', 'pré-refrão', 'coro', 'batida', 'ritmo'];
    if (blacklist.some(term => clean.includes(term))) return false;

    if (clean.length > 10 || clean.includes(' ')) return false;
    return /^[A-Ga-g]/.test(clean);
};
